from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime
import secrets

class NodeBase(BaseModel):
    name: str
    address: str
    api_url: str
    reality_server_address: str
    is_active: bool = True

class NodeCreate(NodeBase):
    # Токен генерируется автоматически, если не передан
    secret_token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

class NodeUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    api_url: Optional[str] = None
    reality_server_address: Optional[str] = None
    is_active: Optional[bool] = None


class NodeResponse(NodeBase):
    id: int
    desired_version: int
    applied_version: int
    last_heartbeat: Optional[datetime]

    class Config:
        from_attributes = True

class NodeConfigResponse(BaseModel):
    version: int
    config_payload: Dict[str, Any]
    nginx_payload: Optional[Dict[str, Any]] = None
    checksum: str

    class Config:
        from_attributes = True