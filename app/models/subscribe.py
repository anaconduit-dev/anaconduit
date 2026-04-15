# app/models/subscribe.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class SubscriptionTemplate(Base):
    __tablename__ = "subscription_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    # Тип клиента: 'json' (Xray), 'clash' (YAML), 'sing-box' и т.д.
    client_type = Column(String, nullable=False, server_default="json", index=True)
    
    content = Column(Text, nullable=False) 
    content_type = Column(String, default="application/json")
    injection_tag = Column(String, default="// {{USER_OUTBOUNDS}}")
    description = Column(String, nullable=True)

    # Связь с группами (один шаблон может быть у многих групп)
    groups = relationship("UserGroup", back_populates="template")

class UserGroupAssociation(Base):
    __tablename__ = "user_group_association"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    group_id = Column(Integer, ForeignKey("user_groups.id", ondelete="CASCADE"), primary_key=True)

class UserGroup(Base):
    __tablename__ = "user_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    template_id = Column(Integer, ForeignKey("subscription_templates.id"), nullable=True)
    
    template = relationship("SubscriptionTemplate", back_populates="groups")
    
    # Связь Many-to-Many с User через ассоциативную таблицу
    users = relationship("User", secondary="user_group_association", backref="groups")