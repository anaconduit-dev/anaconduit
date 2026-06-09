import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from fastapi import HTTPException

from app.models import User, Client, Inbound
from app.services.xray import XrayService
from app.services.node_config_service import NodeConfigService

logger = logging.getLogger(__name__)

class UserOrchestrator:
    def __init__(self, db: AsyncSession, xray_service: XrayService):
        self.db = db
        self.xray = xray_service

    async def add_client(self, inbound_id: int, email: str, id_or_password: str, 
                         flow: str = "", level: int = 0):
        # 1. Проверка инбаунда
        inbound = await self.db.get(Inbound, inbound_id)
        if not inbound:
            raise HTTPException(status_code=404, detail="Inbound not found")

        # 2. Ищем или создаем юзера
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user:
            user = User(email=email)
            self.db.add(user)
            await self.db.flush()

        # 3. Проверка дубликата доступа
        client_check = await self.db.execute(
            select(Client).where(Client.user_id == user.id, Client.inbound_id == inbound_id)
        )
        if client_check.scalars().first():
            raise HTTPException(status_code=400, detail="User already has access to this inbound")

        # 4. Создание клиента в БД
        new_client = Client(
            user_id=user.id,
            inbound_id=inbound_id,
            uuid=id_or_password,
            flow=flow if inbound.protocol == "vless" else "",
            level=level,
            reverse={},
            enable=True
        )
        self.db.add(new_client)
        
        try:
            await self.db.commit()
            await self.db.refresh(new_client)
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {e}")

        # 5. Обновление конфига ноды (после коммита)
        await NodeConfigService.build_and_save_all(self.db, inbound.node_id)

        # 6. Умная синхронизация в реальном времени
        if inbound.node_id == 1:
            logger.info(f"📡 Локальная синхронизация (Node 1) для {user.email}")
            try:
                await self.xray.add_client_to_xray(
                    inbound_tag=inbound.tag,
                    user_email=user.email,
                    client_key=new_client.uuid,
                    flow=new_client.flow,
                    reverse=new_client.reverse,
                    level=new_client.level
                )
            except Exception as e:
                logger.error(f"❌ gRPC error: {e}")
        else:
            logger.info(f"🌐 Очередь на удаленную синхронизацию (Node {inbound.node_id})")
            # TODO: Вызов Remote Node API
            
        return user, new_client

    async def delete_full_user(self, user_id: int):
        result = await self.db.execute(
            select(User).options(joinedload(User.clients).joinedload(Client.inbound)).where(User.id == user_id)
        )
        user = result.unique().scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        affected_nodes: Set[int] = set()

        for client in user.clients:
            if not client.inbound: continue
            affected_nodes.add(client.inbound.node_id)

            if client.inbound.node_id == 1:
                try:
                    await self.xray.remove_client_from_xray(client.inbound.tag, user.email)
                except Exception as e:
                    logger.error(f"❌ gRPC error: {e}")

        email = user.email
        await self.db.delete(user)
        await self.db.commit()

        # Массовое обновление конфигов для всех затронутых нод
        for node_id in affected_nodes:
            await NodeConfigService.build_and_save_all(self.db, node_id)
            logger.info(f"📦 Config bumped for Node {node_id}")

        return email

    async def remove_from_inbound(self, user_id: int, inbound_id: int):
        result = await self.db.execute(
            select(Client)
            .options(joinedload(Client.user), joinedload(Client.inbound))
            .where(Client.user_id == user_id, Client.inbound_id == inbound_id)
        )
        client = result.scalars().first()
        if not client:
            raise HTTPException(status_code=404, detail="Доступ не найден")

        node_id = client.inbound.node_id
        tag = client.inbound.tag
        email = client.user.email

        if node_id == 1:
            try:
                await self.xray.remove_client_from_xray(tag, email)
            except Exception as e:
                logger.error(f"❌ gRPC error: {e}")

        await self.db.delete(client)
        await self.db.commit()

        # Обновляем конфиг ноды после удаления доступа
        await NodeConfigService.build_and_save_all(self.db, node_id)
        
        return tag

    async def update_limits(self, user_id: int, data):
        result = await self.db.execute(
            select(User).options(joinedload(User.clients).joinedload(Client.inbound)).where(User.id == user_id)
        )
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Применяем изменения лимитов
        if data.auto_reset_traffic is not None: user.auto_reset_traffic = data.auto_reset_traffic
        if data.reset_period is not None: user.reset_period = data.reset_period
        if data.traffic_limit is not None: user.traffic_limit = data.traffic_limit * 1024**3
        
        if data.add_days is not None:
            if data.add_days == 0:
                user.expiry_time = None
            else:
                start = user.expiry_time if (user.expiry_time and user.expiry_time > datetime.now()) else datetime.now()
                user.expiry_time = start + timedelta(days=data.add_days)

        # Логика (де)активации
        total_used = (user.total_up or 0) + (user.total_down or 0)
        is_valid = (not user.expiry_time or user.expiry_time > datetime.now()) and \
                   (user.traffic_limit == 0 or total_used < user.traffic_limit)

        affected_nodes: Set[int] = {c.inbound.node_id for c in user.clients if c.inbound}

        # Если статус изменился на "активный", пробуем gRPC
        if is_valid and not user.is_active:
            user.is_active = True
            for client in user.clients:
                if client.inbound and client.inbound.is_active and client.inbound.node_id == 1:
                    try:
                        await self.xray.add_client_to_xray(
                            inbound_tag=client.inbound.tag, user_email=user.email,
                            client_key=client.uuid, flow=client.flow, level=client.level
                        )
                    except Exception as e:
                        logger.error(f"❌ gRPC push error: {e}")

        await self.db.commit()

        # Обновляем статические конфиги для всех нод юзера
        for node_id in affected_nodes:
            await NodeConfigService.build_and_save_all(self.db, node_id)

        # Полная перегенерация мастер-конфига (для локального файла)
        await self.xray.generate_full_config()
        
        return user
    
    async def get_all_users(self):
        result = await self.db.execute(
            select(User).options(joinedload(User.clients).joinedload(Client.inbound))
        )
        return result.unique().scalars().all()

    async def reset_token(self, user_id: int):
        user = await self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.subscription_token = secrets.token_urlsafe(16)
        await self.db.commit()
        return user.subscription_token

    async def reset_traffic(self, user_id: int):
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        try:
            await self.xray.reset_user_traffic(user_id)
            await self.db.commit()
            return user.email
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))