# app/schemas/user.py

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class InboundMin(BaseModel):
    tag: str  # Это то самое имя (например, vless-reality)
    protocol: str

    class Config:
        from_attributes = True

class ClientSchema(BaseModel):
    id: int
    inbound_id: int
    id_or_password: str = Field(..., validation_alias="uuid")
    up: int
    down: int
    enable: bool
    # Добавляем связь с инбаундом
    inbound: Optional[InboundMin] = None 

    class Config:
        from_attributes = True
        populate_by_name = True
class XrayClientConfig(BaseModel):
    id: str # Сюда передаем uuid
    level: int = 0
    email: str # Сюда передаем "email#tag"
    flow: Optional[str] = ""
    reverse: Optional[Dict[str, Any]] = {}

class UserResponse(BaseModel):
    id: int
    email: str
    total_up: int
    total_down: int
    traffic_limit: Optional[int] = 0
    expiry_time: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    clients: List[ClientSchema]
    subscription_token: Optional[str] = None

    class Config:
        from_attributes = True

class AddClientRequest(BaseModel):
    email: str
    id_or_password: str
    flow: Optional[str] = ""
    level: int = 0



class UpdateLimitsSchema(BaseModel):
    traffic_limit: Optional[int] = None # В ГБ
    add_days: Optional[int] = None
    auto_reset_traffic: Optional[bool] = None
    reset_period: Optional[str] = None # "day", "week", "month"

class UserShortResponse(BaseModel):
    id: int
    email: str
    # Никаких clients и inbounds здесь!
    
    class Config:
        from_attributes = True