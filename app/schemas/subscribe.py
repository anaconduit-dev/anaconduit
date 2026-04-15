# app/schemas/subscribe.py

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class SubscriptionTemplateBase(BaseModel):
    name: str = Field(..., df_description="Название шаблона", example="Xray-PC-Full")
    
    # Новое ключевое поле для логики выбора
    client_type: str = Field(
        default="json", 
        df_description="Тип клиента: json, clash, sing-box", 
        example="json"
    )
    
    content: str = Field(..., example='{"outbounds": ["// {{USER_OUTBOUNDS}}"]}')
    content_type: str = Field(default="application/json", example="application/json")
    injection_tag: str = Field(default="// {{USER_OUTBOUNDS}}")
    description: Optional[str] = None

class SubscriptionTemplateCreate(SubscriptionTemplateBase):
    pass

class SubscriptionTemplateUpdate(BaseModel):
    name: Optional[str] = None
    client_type: Optional[str] = None
    content: Optional[str] = None
    content_type: Optional[str] = None
    injection_tag: Optional[str] = None
    description: Optional[str] = None

class SubscriptionTemplateRead(SubscriptionTemplateBase):
    id: int

    # Настройка для работы с моделями SQLAlchemy (Pydantic V2)
    model_config = ConfigDict(from_attributes=True)