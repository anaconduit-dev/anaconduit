# app/services/outbound_manager.py

import logging
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from typing import List, Set

from app.models import Outbound
from app.services.xray import XrayService
from app.services.node_config_service import NodeConfigService

logger = logging.getLogger(__name__)

class OutboundManager:
    def __init__(self, db: AsyncSession, xray: XrayService):
        self.db = db
        self.xray = xray

    async def create_outbound(self, obj_in, node_id: int = 1):
        # 1. Базовые проверки
        if obj_in.tag.lower() == "api":
            raise HTTPException(status_code=400, detail="Тег 'api' зарезервирован")

        # 2. Валидация каскада (Proxy Chain) внутри конкретной ноды
        if obj_in.proxy_settings and obj_in.proxy_settings.get("tag"):
            target_tag = obj_in.proxy_settings["tag"]
            if target_tag == obj_in.tag:
                raise HTTPException(status_code=400, detail="Циклическое проксирование запрещено")
            
            target_exists = await self.db.execute(
                select(Outbound).where(Outbound.tag == target_tag, Outbound.node_id == node_id)
            )
            if not target_exists.scalars().first():
                raise HTTPException(status_code=400, detail=f"Целевой outbound '{target_tag}' не найден на ноде {node_id}")

        # 3. Сброс старого дефолта на этой ноде
        if obj_in.is_default:
            await self.db.execute(
                update(Outbound)
                .where(Outbound.is_default == True, Outbound.node_id == node_id)
                .values(is_default=False)
            )
            await self.db.flush()

        new_outbound = Outbound(**obj_in.model_dump(), node_id=node_id)
        self.db.add(new_outbound)
        await self.db.flush()

        # 4. Умная валидация
        if node_id == 1:
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Ошибка Xray: {error_msg}")
            
            await self.db.commit()
            await self.xray.sync_and_restart()
        else:
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, node_id)
            logger.info(f"🌐 Outbound created for remote Node {node_id}")

        return new_outbound

    async def update_outbound(self, id: int, obj_in):
        db_obj = await self.db.get(Outbound, id)
        if not db_obj:
            raise HTTPException(status_code=404, detail="Outbound не найден")

        node_id = db_obj.node_id

        # Валидация каскада
        if obj_in.proxy_settings and obj_in.proxy_settings.get("tag"):
            target_tag = obj_in.proxy_settings["tag"]
            final_tag = obj_in.tag or db_obj.tag
            if target_tag == final_tag:
                raise HTTPException(status_code=400, detail="Циклическое проксирование запрещено")
            
            target_exists = await self.db.execute(
                select(Outbound).where(Outbound.tag == target_tag, Outbound.node_id == node_id)
            )
            if not target_exists.scalars().first():
                raise HTTPException(status_code=400, detail="Целевой outbound не найден")

        if obj_in.is_default is True:
            await self.db.execute(
                update(Outbound)
                .where(Outbound.id != id, Outbound.is_default == True, Outbound.node_id == node_id)
                .values(is_default=False)
            )

        update_data = obj_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_obj, key, value)

        await self.db.flush()

        if node_id == 1:
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Ошибка Xray: {error_msg}")
            await self.db.commit()
            await self.xray.sync_and_restart()
        else:
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, node_id)

        return db_obj

    async def delete_outbound(self, id: int):
        obj = await self.db.get(Outbound, id)
        if not obj:
            raise HTTPException(status_code=404, detail="Outbound не найден")
        
        if obj.is_default:
            raise HTTPException(status_code=400, detail="Нельзя удалить дефолтный выход")

        node_id = obj.node_id
        await self.db.delete(obj)
        await self.db.flush()

        if node_id == 1:
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Удаление нарушит конфиг: {error_msg}")
            await self.db.commit()
            await self.xray.sync_and_restart()
        else:
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, node_id)
        
        return True