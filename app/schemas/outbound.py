# app/schemas/outbound.py
from pydantic import BaseModel, Field, IPvAnyAddress
from typing import List, Optional, Union, Any
from enum import Enum

class OutboundProtocol(str, Enum):
    FREEDOM = "freedom"
    SOCKS = "socks"
    HTTP = "http"
    BLACKHOLE = "blackhole"
    DNS = "dns"
    VLESS = "vless" 
    TROJAN = "trojan"

# Настройки для протокола Freedom (прямой выход)
class FreedomSettings(BaseModel):
    domainStrategy: str = Field(default="AsIs", pattern="^(AsIs|UseIP|UseIPv4|UseIPv6)$")
    redirect: Optional[str] = None
    userLevel: int = 0

# Настройки для протокола SOCKS (например, для WARP)
class SocksServer(BaseModel):
    address: str # "warp" или IP
    port: int
    users: Optional[List[dict]] = None

class SocksSettings(BaseModel):
    servers: List[SocksServer]
    version: str = "5"

# Базовая схема Outbound
class OutboundBase(BaseModel):
    tag: str = Field(..., min_length=1, example="warp-out")
    protocol: OutboundProtocol
    settings: dict = Field(default_factory=dict)
    stream_settings: Optional[dict] = Field(default_factory=dict)
    
    proxy_settings: Optional[dict] = Field(default_factory=dict, example={"tag": "vps-nl-trojan"})
    
    mux: Optional[dict] = Field(default_factory=lambda: {"enabled": False})
    is_default: bool = False
    is_active: bool = True
    description: Optional[str] = None
    node_id: Optional[int] = Field(None, description="null для глобального аутбаунда")

class OutboundCreate(OutboundBase):
    pass

class OutboundResponse(OutboundBase):
    id: int

    class Config:
        from_attributes = True

class OutboundUpdate(BaseModel):
    tag: Optional[str] = Field(None, min_length=1)
    protocol: Optional[OutboundProtocol] = None
    settings: Optional[dict] = None
    stream_settings: Optional[dict] = None
    proxy_settings: Optional[dict] = None # Добавили сюда тоже
    mux: Optional[dict] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    node_id: Optional[int] = None


class RoutingRuleBase(BaseModel):
    outbound_tag: str
    domain: Optional[List[str]] = Field(None, example=["geosite:google", "netflix.com"])
    ip: Optional[List[str]] = Field(None, example=["geoip:private", "1.1.1.1"])
    port: Optional[str] = Field(None, example="53, 80, 443")
    inbound_tags: Optional[List[str]] = None
    client_emails: Optional[List[str]] = None
    priority: int = 0
    is_active: bool = True
    description: Optional[str] = None
    node_id: Optional[int] = None

class RoutingRuleCreate(RoutingRuleBase):
    pass

class RoutingRuleResponse(RoutingRuleBase):
    id: int

    class Config:
        from_attributes = True

class RoutingRuleUpdate(BaseModel):
    outbound_tag: Optional[str] = None
    domain: Optional[List[str]] = None
    ip: Optional[List[str]] = None
    port: Optional[str] = None
    inbound_tags: Optional[List[str]] = None
    client_emails: Optional[List[str]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    node_id: Optional[int] = None