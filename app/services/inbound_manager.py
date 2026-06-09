import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.schemas.inbound import InboundCreate, InboundUpdate
from app.models import Inbound, Client
from app.services.xray import XrayService
from app.services.nginx_service import NginxService
from app.services.node_config_service import NodeConfigService 

logger = logging.getLogger(__name__)

class InboundManager:
    def __init__(self, db: AsyncSession, xray: XrayService, nginx: NginxService):
        self.db = db
        self.xray = xray
        self.nginx = nginx

    async def create_inbound(self, obj_in, node_id: int = 1):
        # 1. Валидация уникальности порта и тега (в рамках всей сети или ноды)
        # Проверяем порт на конкретной ноде
        if obj_in.port != 0:
            port_check = await self.db.execute(
                select(Inbound).where(
                    Inbound.port == obj_in.port, 
                    Inbound.is_active == True,
                    Inbound.node_id == node_id
                )
            )
            if port_check.scalars().first():
                raise HTTPException(status_code=400, detail=f"Порт {obj_in.port} занят на ноде {node_id}")

        existing_tag = await self.db.execute(select(Inbound).where(Inbound.tag == obj_in.tag))
        if existing_tag.scalars().first():
            raise HTTPException(status_code=400, detail=f"Тег {obj_in.tag} уже существует")

        # 2. Создание объекта
        new_inbound = Inbound(
            node_id=node_id, # Важно!
            listen=obj_in.listen,
            tag=obj_in.tag,
            protocol=obj_in.protocol,
            port=obj_in.port,
            settings=obj_in.settings.model_dump(exclude_none=True),
            stream_settings=obj_in.stream_settings.model_dump(exclude_none=True),
            sniffing=obj_in.sniffing.model_dump(exclude_none=True),
            is_active=True
        )
        self.db.add(new_inbound)
        await self.db.flush()

        # 3. Умная валидация и применение
        if node_id == 1:
            # Локальная нода: проверяем конфиг через реальное ядро
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Xray Error: {error_msg}")
            
            await self.db.commit()
            # Синхронизируем локально
            await NodeConfigService.build_and_save_all(self.db, node_id)
            await self.xray.sync_and_restart()
            await self.nginx.apply_all()
        else:
            # Удаленная нода: просто сохраняем. 
            # Нода сама подтянет изменения при следующем опросе.
            await self.db.commit()
            # Собираем новую версию конфига для этой ноды в БД
            await NodeConfigService.build_and_save_all(self.db, node_id)
            logger.info(f"🌐 Inbound created for remote Node {node_id}. Config version bumped.")

        return new_inbound

    async def delete_inbound(self, inbound_id: int):
        inbound = await self.db.get(Inbound, inbound_id)
        if not inbound:
            raise HTTPException(status_code=404, detail="Inbound not found")
        
        node_id = inbound.node_id
        await self.db.delete(inbound)
        await self.db.commit()

        if node_id == 1:
            await NodeConfigService.build_and_save_all(self.db, node_id)
            await self.xray.sync_and_restart()
            await self.nginx.apply_all()
        else:
            await NodeConfigService.build_and_save_all(self.db, node_id)
            
        return True

    async def get_inbound(self, inbound_id: int):
        inbound = await self.db.get(Inbound, inbound_id)
        if not inbound:
            raise HTTPException(status_code=404, detail="Inbound not found")
        return inbound

    async def update_inbound(self, inbound_id: int, obj_in: InboundUpdate):
        # 1. Поиск
        current = await self.db.get(Inbound, inbound_id)
        if not current:
            raise HTTPException(status_code=404, detail="Инбаунд не найден")

        # 2. Проверка уникальности порта на той же ноде
        if obj_in.port is not None and obj_in.port != current.port:
            port_check = await self.db.execute(
                select(Inbound).where(
                    Inbound.port == obj_in.port, 
                    Inbound.is_active == True,
                    Inbound.node_id == current.node_id, # Валидируем в рамках той же ноды
                    Inbound.id != inbound_id
                )
            )
            if port_check.scalars().first():
                raise HTTPException(status_code=400, detail=f"Порт {obj_in.port} занят на ноде {current.node_id}")

        # 3. Проверка тега (теги должны быть уникальны глобально)
        if obj_in.tag is not None and obj_in.tag != current.tag:
            tag_check = await self.db.execute(
                select(Inbound).where(Inbound.tag == obj_in.tag, Inbound.id != inbound_id)
            )
            if tag_check.scalars().first():
                raise HTTPException(status_code=400, detail=f"Тег {obj_in.tag} уже существует")

        # 4. Применяем изменения
        update_data = obj_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current, key, value)

        await self.db.flush()

        # 5. Умная синхронизация
        if current.node_id == 1:
            # Мастер-нода: полная проверка ядром
            test_config = await self.xray.generator.build_config(self.db)
            is_valid, error_msg = await self.xray.validate_config(test_config)
            if not is_valid:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Ошибка Xray: {error_msg}")
            
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, node_id)
            await self.xray.sync_and_restart()
            await self.nginx.apply_all()
        else:
            # Удаленная нода: просто сохраняем и инкрементируем версию конфига
            await self.db.commit()
            await NodeConfigService.build_and_save_all(self.db, current.node_id)
            logger.info(f"🌐 Inbound {inbound_id} updated for remote Node {current.node_id}")

        return current

    async def get_active_resources(self):
        """
        Метод сопоставления ресурсов. 
        ВАЖНО: Сейчас он берет статы только с локального Xray (Node 1).
        Для удаленных нод в будущем добавим агрегацию.
        """
        all_stats = await self.xray.client.get_all_stats()
        xray_data = {item["name"]: item for item in all_stats if item["category"] == "inbound"}
        
        result = await self.db.execute(select(Inbound.tag).where(Inbound.node_id == 1))
        db_tags = {row[0] for row in result.all()}

        managed_running = []
        manual_inbounds = []
        
        for tag, data in xray_data.items():
            if tag == "api-in": continue
            info = {
                "tag": tag,
                "total_mb": data["total_mb"],
                "download_mb": data["download_mb"],
                "upload_mb": data["upload_mb"]
            }
            if tag in db_tags:
                managed_running.append(info)
            else:
                manual_inbounds.append(info)

        orphaned_db = [tag for tag in db_tags if tag not in xray_data]

        return {
            "managed_running": managed_running,
            "manual_inbounds": manual_inbounds,
            "orphaned_db_inbounds": orphaned_db
        }