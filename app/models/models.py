import secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger, JSON, UniqueConstraint
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

    clients = relationship("Client", back_populates="user", cascade="all, delete-orphan")

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

    user = relationship("User", back_populates="clients")
    
    inbound = relationship("Inbound") 

    __table_args__ = (
        UniqueConstraint('user_id', 'inbound_id', name='_user_inbound_uc'),
    )