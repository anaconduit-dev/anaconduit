from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any, Union, Annotated


class Fallback(BaseModel):
    dest: Any  # Может быть числом (80) или строкой ("127.0.0.1:80")
    xver: int = 0
    alpn: Optional[str] = None
    path: Optional[str] = None

class TrojanSettings(BaseModel):
    clients: List[Dict[str, Any]] = []
    fallbacks: List[Fallback] = []

class ShadowsocksSettings(BaseModel):
    method: str = "aes-128-gcm"
    password: str
    network: str = "tcp,udp"

class VLESSSettings(BaseModel):
    decryption: str = "none"
    flow: Optional[str] = "xtls-rprx-vision"
    clients: List[Dict[str, Any]] = []
    fallbacks: List[Fallback] = []

# 2. Настройки Reality (Transport layer)
class RealitySettings(BaseModel):
    show: bool = False
    dest: str = "www.microsoft.com:443"
    xver: int = 0
    serverNames: List[str] = ["www.microsoft.com"]
    privateKey: str
    publicKey: str  
    shortIds: List[str] = []
    fingerprint: str = "chrome"
    spiderX: str = "/"
    maxTimediff: int = 0

class GRPCSettings(BaseModel):
    serviceName: str = "grpc"
    multiMode: bool = False
    # Остальные поля (idle_timeout и т.д.) по доке нужны только клиенту,
    # но можно добавить для гибкости
    authority: Optional[str] = None

class XHTTPSettings(BaseModel):
    path: str = "/"
    mode: str = "stream-up"  # По умолчанию рекомендуемый режим
    extra: Dict[str, Any] = {} # На случай будущих расширений протокола

class WSSettings(BaseModel):
    acceptProxyProtocol: bool = False # Теперь это здесь
    path: str = "/"
    host: Optional[str] = None # Поле хоста
    headers: Dict[str, str] = {}
    heartbeatPeriod: int = 0

class TLSSettings(BaseModel):
    serverName: Optional[str] = ""
    alpn: List[str] = ["h2", "http/1.1"]
    allowInsecure: bool = False
    minVersion: str = "1.2"
    maxVersion: str = "1.3"
    # Для входящих (Inbound) обычно сертификаты указываются здесь, 
    # но Reality их заменяет. Для обычного TLS нужно поле 'certificates'
    certificates: List[Dict[str, Any]] = []

class Sockopt(BaseModel):
    tcpFastOpen: bool = False
    tcpNoDelay: bool = True
    tcpcongestion: str = "bbr"
    tcpMptcp: bool = False
    mark: int = 0
    tproxy: str = "off"
    domainStrategy: str = "AsIs" # Или "UseIP"
    tcpMaxSeg: int = 1440
    tcpKeepAliveIdle: int = 300
    tcpUserTimeout: int = 10000
    acceptProxyProtocol: bool = False


# 3. Общая обертка транспорта (StreamSettings)
class StreamSettings(BaseModel):
    network: str  # tcp, ws, grpc, xhttp
    security: str # none, tls, reality
    
    # Настройки для разных типов сети
    tcpSettings: Optional[Dict] = None
    wsSettings: Optional[Dict] = None
    grpcSettings: Optional[Dict] = None
    xhttpSettings: Optional[XHTTPSettings] = None 
    sockopt: Optional[Sockopt] = None
    
    # Настройки безопасности
    tlsSettings: Optional[Dict] = None
    realitySettings: Optional[Dict] = None

class Sniffing(BaseModel):
    enabled: bool = True
    destOverride: List[str] = ["http", "tls", "quic"]
    metadataOnly: bool = False
    domainsExcluded: List[str] = [""]
    routeOnly: bool = False



# 4. Финальная схема для создания Inbound
class InboundCreate(BaseModel):
    tag: str = Field(..., example="VLESS_REALITY_443")
    listen: str = Field("0.0.0.0", example="0.0.0.0")
    protocol: str = Field("vless", pattern="^(vless|vmess|trojan|shadowsocks)$")
    port: int = Field(..., ge=0, le=65535)
    hide_behind_nginx: bool = Field(False, description="Проксировать через Nginx")
    settings: Union[TrojanSettings, VLESSSettings, Dict[str, Any]]
    stream_settings: StreamSettings
    sniffing: Sniffing
    is_active: bool = True

    @model_validator(mode='before')
    @classmethod
    def validate_nginx_logic(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        hide_nginx = data.get("hide_behind_nginx", False)
        stream = data.get("stream_settings")
        
        if hide_nginx:
            # 1. Принудительно слушаем только локалхост
            data["listen"] = "127.0.0.1"
            
            # 2. Если передан stream_settings, правим безопасность
            if stream and isinstance(stream, dict):
                # За Nginx шифрование Xray (TLS/Reality) должно быть отключено
                stream["security"] = "none"
                # Убираем настройки безопасности, если они просочились
                stream.pop("tlsSettings", None)
                stream.pop("realitySettings", None)
                
            # 3. Отключаем сниффинг (Nginx сам разбирает протоколы)
            sniffing = data.get("sniffing")
            if sniffing and isinstance(sniffing, dict):
                sniffing["enabled"] = False

        return data

    @model_validator(mode='after')
    def check_protocol_compatibility(self) -> 'InboundCreate':
        # Проверка: WS не дружит с Reality (уже на уровне схемы)
        if self.stream_settings.network == "ws" and self.stream_settings.security == "reality":
            raise ValueError("WS network does not support Reality security")
        
        
                
        return self
