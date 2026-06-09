# app/services/routing_manager.py

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from typing import List

from app.models import RoutingRule, Outbound
from app.services.xray import XrayService
from app.services.node_config_service import NodeConfigService

logger = logging.getLogger(__name__)

class RoutingManager:
    def __init__(self, db: AsyncSession, xray: XrayService):
        self.db = db
        self.xray = xray

    async def create_rule(self, obj_in, node_id: int = 1):
        # 1. Проверяем, существует ли целевой outbound именно на этой ноде
        # Исключаем встроенные теги (direct, block), если они не в БД
        if obj_in.outbound_tag not in ["direct", "block"]:
            outbound_check = await self.db.execute(
                select(Outbound).where(
                    Outbound.tag == obj_in.outbound_tag, 
                    Outbound.node_id == node_id
                )
            )
            if not outbound_check.scalars().first():
                raise HTTPException(
                    status_code=400, 
                    detail=f"Outbound '{obj_in.outbound_tag}' не найден на ноде {node_id}"
                )

        # 2. Добавляем в сессию
        new_rule = RoutingRule(**obj_in.model_dump())
        self.db.add(new_rule)
        await self.db.flush()

        # 3. Валидация
        if node_id == 1:
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Xray Routing Error: {error_msg}")
            
            await self.db.commit()
            await self.xray.sync_and_restart()
        else:
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, node_id)
            logger.info(f"🌐 Routing rule created for remote Node {node_id}")

        return new_rule

    async def update_rule(self, id: int, obj_in):
        rule = await self.db.get(RoutingRule, id)
        if not rule:
            raise HTTPException(status_code=404, detail="Правило не найдено")

        node_id = rule.node_id

        # Если меняется тег выхода, проверяем его наличие на этой ноде
        if obj_in.outbound_tag and obj_in.outbound_tag not in ["direct", "block"]:
            outbound_check = await self.db.execute(
                select(Outbound).where(
                    Outbound.tag == obj_in.outbound_tag, 
                    Outbound.node_id == node_id
                )
            )
            if not outbound_check.scalars().first():
                raise HTTPException(status_code=400, detail="Целевой outbound не найден на этой ноде")

        update_data = obj_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(rule, key, value)

        await self.db.flush()

        if node_id == 1:
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Ошибка валидации: {error_msg}")
            await self.db.commit()
            await self.xray.sync_and_restart()
        else:
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, node_id)

        return rule

    async def delete_rule(self, id: int):
        rule = await self.db.get(RoutingRule, id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        node_id = rule.node_id
        await self.db.delete(rule)
        await self.db.commit()

        if node_id == 1:
            await self.xray.sync_and_restart()
        else:
            await NodeConfigService.build_and_save_all(self.db, node_id)
        
        return True