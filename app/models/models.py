import secrets
import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger, JSON, UniqueConstraint, Enum, func
from sqlalchemy.sql import func
from app.core.database import Base
from sqlalchemy.orm import relationship

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    # Добавляем версию токена
    token_version = Column(Integer, default=1, server_default="1", nullable=False)

class Inbound(Base):
    __tablename__ = "inbounds"
    id = Column(Integer, primary_key=True, index=True)
    tag = Column(String, unique=True, index=True, nullable=False)
    listen = Column(String, default="0.0.0.0", nullable=False)
    protocol = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    settings = Column(JSON, nullable=False)
    stream_settings = Column(JSON, nullable=False)
    sniffing = Column(JSON, nullable=True, default=lambda: {
        "enabled": False,
        "destOverride": ["http", "tls", "quic"]
    })
    is_active = Column(Boolean, default=True)

class User(Base):
    """Сущность пользователя — владелец нескольких подключений"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    token = Column(String, unique=True, index=True) 
    
    # Общая статистика по всем инбаундам (агрегированная)
    total_up = Column(BigInteger, default=0)
    total_down = Column(BigInteger, default=0)
    traffic_limit = Column(BigInteger, nullable=True, default=0)
    expiry_time = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    subscription_token = Column(String, unique=True, index=True, default=lambda: secrets.token_urlsafe(16))
    # Глобальные накопители (никогда не сбрасываются)
    summary_total_up = Column(BigInteger, default=0, server_default="0")
    summary_total_down = Column(BigInteger, default=0, server_default="0")
    
    # Поля для автоматизации
    auto_reset_traffic = Column(Boolean, default=False, server_default="false")
    reset_period = Column(String, default="month")
    last_reset_at = Column(DateTime, server_default=func.now(), nullable=True)

    clients = relationship("Client", back_populates="user", cascade="all")

class Client(Base):
    """Конкретный 'ключ' (UUID) пользователя для конкретного инбаунда"""
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    inbound_id = Column(Integer, ForeignKey("inbounds.id", ondelete="CASCADE"), nullable=False)
    
    # UUID. Может быть одинаковым для всех инбаундов пользователя или разным
    uuid = Column(String, unique=True, index=True, nullable=False)
    # --- Новые поля для совместимости с Xray API ---
    flow = Column(String, nullable=True, default="") # Для VLESS + Reality это "xtls-rprx-vision"
    level = Column(Integer, default=0)
    reverse = Column(JSON, nullable=True, default=dict) # Обычно пустой объект {}
    # -----------------------------------------------
    # Статистика именно этого подключения (email в Xray будет иметь вид "user@mail.com#tag")
    up = Column(BigInteger, default=0)
    down = Column(BigInteger, default=0)
    enable = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    # Накопители для конкретного ключа
    summary_up = Column(BigInteger, default=0, server_default="0")
    summary_down = Column(BigInteger, default=0, server_default="0")

    user = relationship("User", back_populates="clients")
    
    inbound = relationship("Inbound") 

    __table_args__ = (
        UniqueConstraint('user_id', 'inbound_id', name='_user_inbound_uc'),
    )


class OutboundType(str, enum.Enum):
    FREEDOM = "freedom"
    SOCKS = "socks"
    HTTP = "http"
    BLACKHOLE = "blackhole"
    DNS = "dns"

class Outbound(Base):
    """Конфигурация выхода трафика (Freedom, WARP через SOCKS, и т.д.)"""
    __tablename__ = "outbounds"

    id = Column(Integer, primary_key=True, index=True)
    tag = Column(String, unique=True, index=True, nullable=False) # Например: "warp-socks", "direct"
    protocol = Column(String, nullable=False, default="freedom") # "freedom", "socks", "http"
    
    # Основные настройки протокола (address, port, users для SOCKS)
    # Для freedom может быть {"domainStrategy": "UseIP"}
    settings = Column(JSON, nullable=False, default=dict)
    
    # Настройки транспорта (TLS, sockopt и т.д.)
    stream_settings = Column(JSON, nullable=True, default=dict)
    proxy_settings = Column(JSON, nullable=True, default=dict)
    # Настройки мультиплексирования
    mux = Column(JSON, nullable=True, default=lambda: {"enabled": False})

    is_default = Column(Boolean, default=False, server_default="false")
    is_active = Column(Boolean, default=True, server_default="true")
    description = Column(String, nullable=True)

class RoutingRule(Base):
    """Правила маршрутизации: какой трафик через какой Outbound пускать"""
    __tablename__ = "routing_rules"

    id = Column(Integer, primary_key=True, index=True)
    outbound_tag = Column(String, ForeignKey("outbounds.tag", ondelete="CASCADE"), nullable=False)
    
    # Условия срабатывания (Xray поддерживает массивы строк для каждого поля)
    domain = Column(JSON, nullable=True) # ["geosite:google", "netflix.com"]
    ip = Column(JSON, nullable=True)     # ["1.1.1.1", "geoip:private"]
    port = Column(String, nullable=True) # "53, 80, 443"
    
    # Можно привязать правило к конкретному входящему протоколу
    inbound_tags = Column(JSON, nullable=True) # ["vless-reality-main"]
    
    # Список email пользователей (если хотим маршрутизировать конкретных юзеров)
    client_emails = Column(JSON, nullable=True) 

    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, server_default="true")
    description = Column(String, nullable=True)

    outbound = relationship("Outbound")

class XrayResource(Base):
    __tablename__ = "xray_resources"

    id = Column(Integer, primary_key=True, index=True)
    
    # Имя файла на диске, например "geoip.dat" или "custom_ads.dat"
    filename = Column(String, unique=True, nullable=False, index=True)
    
    # Прямая ссылка на скачивание (https://...)
    url = Column(String, nullable=False)
    
    # Флаг автоматического обновления
    auto_update = Column(Boolean, default=True)
    
    # Интервал обновления в часах (например, 168 = 1 неделя)
    update_interval = Column(Integer, default=168)
    
    # Служебные поля для мониторинга
    last_updated = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending")  # pending, success, failed
    error_message = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<XrayResource {self.filename} (status={self.status})>"