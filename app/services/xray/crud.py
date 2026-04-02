# app/services/xray/crud.py
import logging
import json
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.models import Inbound, Client, User
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

class XrayCRUDManager:
    def __init__(self, generator, manager, api_client):
        self.generator = generator
        self.manager = manager
        self.api_client = api_client

    def _get_xray_email(self, email: str, tag: str) -> str:
        """
        Единый стандарт формирования email для Xray.
        Всегда в нижнем регистре для избежания проблем десинхронизации.
        """
        clean_email = email.strip().lower()
        return f"{clean_email}#{tag}"

    # ---------- Работа с ИНБАУНДАМИ (Inbounds) ----------

    async def update_inbound(self, inbound_id: int, update_data: Dict[str, Any]):
        """Транзакционное обновление с валидацией через временный конфиг."""
        async with AsyncSessionLocal() as session:
            # 1. Находим инбаунд
            result = await session.execute(select(Inbound).where(Inbound.id == inbound_id))
            ib = result.scalars().first()
            if not ib: 
                raise ValueError("Inbound not found")

            # 2. Обновляем объект в ПАМЯТИ сессии
            for key, value in update_data.items():
                if hasattr(ib, key):
                    setattr(ib, key, value)

            # 3. Генерируем тестовый конфиг (увидит изменения ib в этой сессии)
            test_config = await self.generator.build_config(session)

            # 4. Валидируем мнимый конфиг через менеджер (xray -test)
            is_ok, error_msg = await self.manager.validate_config(test_config)
            
            if not is_ok:
                logger.error(f"❌ Валидация не прошла: {error_msg}")
                raise ValueError(f"Xray config is invalid: {error_msg}")

            # 5. Если всё ОК — комитим в БД
            await session.commit()
            
            # 6. Пишем на диск и рестартуем процесс
            await self.manager.save_config(test_config)
            return await self.manager.restart()

    # ---------- Работа с КЛИЕНТАМИ (Clients) через API ----------

    async def add_client_to_xray(self, inbound_tag: str, user_email: str, client_key: str, flow: str = "", level: int = 0, reverse:dict = {}):
        """Добавляет клиента через gRPC API с защитой от дублей."""
        xray_email = self._get_xray_email(user_email, inbound_tag)
        reverse_data = reverse if reverse and isinstance(reverse, dict) else None
        async with AsyncSessionLocal() as session:
            from app.models.models import Inbound # Импорт внутри, если есть риск циклической зависимости
            from sqlalchemy import select
            
            result = await session.execute(
                select(Inbound).where(Inbound.tag == inbound_tag)
            )
            # Вот здесь мы определяем переменную 'inbound'
            inbound = result.scalars().first()
            
        if not inbound:
            logger.error(f"Inbound с тегом {inbound_tag} не найден в базе!")
            raise ValueError(f"Inbound {inbound_tag} not found")
        try:
            await self.api_client.add_client(
                inbound_tag=inbound_tag,
                email=xray_email,
                uuid=client_key,
                protocol=inbound.protocol,
                flow=flow,
                level=level
            )
            logger.info(f"👤 Клиент {xray_email} (flow: {flow}) успешно добавлен")
            
            # Синхронизируем файл config.json на случай рестарта контейнера
            await self._sync_config()
            
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"⚠️ Юзер {xray_email} уже был в Xray. Пропускаем.")
            else:
                logger.error(f"❌ Ошибка gRPC при добавлении: {e}")
                raise Exception(f"Xray API error: {e}")

    async def remove_client_from_xray(self, inbound_tag: str, user_email: str):
        """Удаляет клиента из Xray API."""
        xray_email = self._get_xray_email(user_email, inbound_tag)
        try:
            await self.api_client.remove_client(
                inbound_tag=inbound_tag,
                email=xray_email
            )
            logger.info(f"🗑️ Клиент {xray_email} удален из памяти Xray")
            
            # Синхронизируем файл
            await self._sync_config()
            
        except Exception as e:
            if "not found" in str(e).lower() or "not exists" in str(e).lower():
                logger.warning(f"⚠️ Попытка удалить отсутствующего в Xray юзера: {xray_email}")
            else:
                logger.error(f"❌ Ошибка gRPC при удалении: {e}")
                raise Exception(f"Не удалось удалить из Xray: {e}")

    # ---------- Вспомогательные методы ----------

    async def _sync_config(self):
        """Перегенерирует и сохраняет конфиг на диск без рестарта сервиса."""
        async with AsyncSessionLocal() as session:
            config = await self.generator.build_config(session)
            await self.manager.save_config(config)