#app/schemas/group.py

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List

class UserGroupBase(BaseModel):
    name: str = Field(..., example="Premium-Group")
    template_id: Optional[int] = Field(None, description="ID шаблона подписки для этой группы")

class UserGroupCreate(UserGroupBase):
    pass

class UserGroupUpdate(BaseModel):
    name: Optional[str] = None
    template_id: Optional[int] = None

class UserGroupRead(UserGroupBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# Схема для привязки пользователя к группе
class UserGroupLink(BaseModel):
    user_id: int
    group_id: int