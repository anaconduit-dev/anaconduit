from pydantic import BaseModel

class LandingUpdate(BaseModel):
    html: str

# Схема данных для запроса
class UpdateRequest(BaseModel):
    version_tag: str