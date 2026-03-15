from pydantic import BaseModel, Field

class AdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

class AdminUpdate(BaseModel):
    current_password: str # Для проверки
    new_username: str = Field(..., min_length=3, max_length=50)
    new_password: str = Field(..., min_length=8)