from sqlalchemy import Column, Integer, String
from .database import Base

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class Inbound(Base):
    __tablename__ = "inbounds"
    id = Column(Integer, primary_key=True)
    remark = Column(String)  # Название (напр. "Main Reality")
    protocol = Column(String, default="vless")
    port = Column(Integer, default=443)
    
    # Специфичные для Reality настройки (храним в JSON или отдельными полями)
    private_key = Column(String)
    public_key = Column(String)
    short_id = Column(String)
    dest_domain = Column(String, default="google.com:443") # Домен для маскировки
