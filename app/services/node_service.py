# app/services/node_service.py

import logging
import hashlib
import json
import secrets
from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException

from app.models import Node, NodeConfig
from app.schemas.node import NodeCreate, NodeUpdate # Добавь NodeUpdate в схемы

logger = logging.getLogger(__name__)

class NodeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_node(self, obj_in: NodeCreate) -> Node:
        """Регистрация новой ноды в системе"""
        new_node = Node(**obj_in.model_dump())
        self.db.add(new_node)
        await self.db.commit()
        await self.db.refresh(new_node)
        return new_node

    async def get_node_by_id(self, node_id: int) -> Optional[Node]:
        return await self.db.get(Node, node_id)

    async def update_heartbeat(self, node_id: int, applied_version: int):
        """Обновление статуса ноды при 'стуке' (heartbeat)"""
        await self.db.execute(
            update(Node)
            .where(Node.id == node_id)
            .values(
                last_heartbeat=datetime.now(),
                applied_version=applied_version
            )
        )
        await self.db.commit()

    async def get_latest_config(self, node_id: int, secret_token: str) -> Optional[NodeConfig]:
        """Выдача последнего конфига для ноды с проверкой токена"""
        # 1. Проверяем токен ноды
        result = await self.db.execute(
            select(Node).where(Node.id == node_id, Node.secret_token == secret_token)
        )
        node = result.scalars().first()
        if not node:
            raise HTTPException(status_code=403, detail="Invalid node credentials")

        # 2. Берем самый свежий конфиг по версии
        config_result = await self.db.execute(
            select(NodeConfig)
            .where(NodeConfig.node_id == node_id)
            .order_by(NodeConfig.version.desc())
            .limit(1)
        )
        return config_result.scalars().first()

    async def get_all_nodes(self) -> List[Node]:
        result = await self.db.execute(select(Node))
        return result.scalars().all()

    async def update_node(self, node_id: int, obj_in: NodeUpdate) -> Optional[Node]:
        """Обновление метаданных ноды"""
        node = await self.get_node_by_id(node_id)
        if not node:
            return None
        
        update_data = obj_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(node, key, value)
            
        await self.db.commit()
        await self.db.refresh(node)
        return node

    async def delete_node(self, node_id: int) -> bool:
        """Удаление ноды из системы"""
        node = await self.get_node_by_id(node_id)
        if not node:
            return False
        
        # Можно добавить проверку: если на ноде есть активные клиенты, 
        # запретить удаление или выдать предупреждение.
        
        await self.db.delete(node)
        await self.db.commit()
        return True

    async def rotate_node_token(self, node_id: int) -> Optional[str]:
        """Генерирует новый secret_token для ноды и возвращает его"""
        new_token = secrets.token_urlsafe(32)
        
        result = await self.db.execute(
            update(Node)
            .where(Node.id == node_id)
            .values(secret_token=new_token)
        )
        
        if result.rowcount == 0:
            return None
            
        await self.db.commit()
        return new_token