# app/schemas/resource.py

from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import Optional

class ResourceBase(BaseModel):
    filename: str
    url: HttpUrl
    auto_update: bool = True
    update_interval: int = 168

class ResourceCreate(ResourceBase):
    status: str = "pending"
    pass

class ResourceUpdate(BaseModel):
    filename: Optional[str] = None
    url: Optional[HttpUrl] = None
    auto_update: Optional[bool] = None
    update_interval: Optional[int] = None
    status: Optional[str] = None

class ResourceInDB(ResourceBase):
    id: int
    last_updated: Optional[datetime]
    status: str
    error_message: Optional[str]
    
    class Config:
        from_attributes = True