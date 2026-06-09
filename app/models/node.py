# app/models/node.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    api_url = Column(String, nullable=False) 
    reality_server_address = Column(String, nullable=False)
    
    secret_token = Column(String, nullable=False)
    
    desired_version = Column(Integer, default=0)
    applied_version = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True)
    last_heartbeat = Column(DateTime(timezone=True), onupdate=func.now())
    
    inbounds = relationship("Inbound", back_populates="node")
    outbounds = relationship("Outbound", back_populates="node")
    routing_rules = relationship("RoutingRule", back_populates="node")

class NodeConfig(Base):
    __tablename__ = "node_configs"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id"))
    version = Column(Integer, nullable=False)
    
    config_payload = Column(JSON, nullable=False)
    
    nginx_payload = Column(JSON, nullable=True)
    
    checksum = Column(String, nullable=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
