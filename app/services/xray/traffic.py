# app/services/xray/traffic.py
import logging
from datetime import datetime
from collections import defaultdict
from sqlalchemy import select, update, func
from sqlalchemy.orm import joinedload
from app.models.models import User, Client, Inbound
from app.xray_api.client import XrayAPIClient

logger = logging.getLogger(__name__)

class XrayTrafficManager:
    def __init__(self, api_client: XrayAPIClient):
        self.api_client = api_client

    def _get_xray_email(self, email: str, tag: str) -> str:
        return f"{email.strip().lower()}#{tag}"

    async def update_stats_in_db(self, session_factory):
        """Сбор статистики из Xray и запись в БД дельт трафика"""
        stats_list = await self.api_client.get_stats(reset=True)
        if not stats_list:
            return

        parsed_stats = []
        needed_emails = set()
        
        for item in stats_list:
            # Формат Xray: inbound>>>tag>>>user>>>email#tag>>>traffic>>>uplink
            parts = item["name"].split(">>>")
            if len(parts) >= 4 and "#" in parts[1]:
                email, tag = parts[1].lower().split("#")
                parsed_stats.append({
                    "email": email, "tag": tag, 
                    "dir": parts[3], "val": int(item["value"])
                })
                needed_emails.add(email)

        if not parsed_stats:
            return

        async with session_factory() as session:
            # Загружаем маппинг email/tag -> IDs одним запросом
            result = await session.execute(
                select(Client.id, Client.user_id, User.email, Inbound.tag)
                .join(User).join(Inbound)
                .where(func.lower(User.email).in_(needed_emails))
            )
            mapping = {(r.email.lower(), r.tag.lower()): (r.id, r.user_id) for r in result}

            client_deltas = defaultdict(lambda: {"up": 0, "down": 0})
            user_deltas = defaultdict(lambda: {"up": 0, "down": 0})

            for s in parsed_stats:
                ids = mapping.get((s["email"], s["tag"]))
                if not ids: continue
                
                c_id, u_id = ids
                key = "up" if "uplink" in s["dir"] else "down"
                client_deltas[c_id][key] += s["val"]
                user_deltas[u_id][key] += s["val"]

            # Применяем обновления
            for c_id, d in client_deltas.items():
                await session.execute(
                    update(Client).where(Client.id == c_id)
                    .values(up=Client.up + d["up"], down=Client.down + d["down"])
                )
            for u_id, d in user_deltas.items():
                await session.execute(
                    update(User).where(User.id == u_id)
                    .values(total_up=User.total_up + d["up"], total_down=User.total_down + d["down"])
                )
            await session.commit()

    async def check_limits_and_disable(self, session_factory, api_callback_remove, api_callback_add):
        """Проверка лимитов и управление состоянием пользователей в Xray"""
        async with session_factory() as session:
            now = datetime.now()
            result = await session.execute(
                select(User).options(joinedload(User.clients).joinedload(Client.inbound))
            )
            users = result.scalars().unique().all()

            for user in users:
                total_used = (user.total_up or 0) + (user.total_down or 0)
                time_ok = not user.expiry_time or user.expiry_time > now
                traffic_ok = user.traffic_limit == 0 or total_used < user.traffic_limit

                if user.is_active:
                    if not time_ok or not traffic_ok:
                        user.is_active = False
                        for client in user.clients:
                            await api_callback_remove(client.inbound.tag, user.email)
                else:
                    if time_ok and traffic_ok:
                        # Включаем только если не было ручного отключения (если есть такое поле)
                        user.is_active = True
                        for client in user.clients:
                            await api_callback_add(client.inbound.tag, user.email, client.uuid)
            await session.commit()

    async def check_and_reset_traffic(self, session_factory):
        """Автоматический сброс трафика по периодам (день/неделя/месяц)"""
        async with session_factory() as session:
            result = await session.execute(
                select(User).where(User.auto_reset_traffic == True)
            )
            users = result.scalars().all()
            now = datetime.now()

            for user in users:
                last_check = user.last_reset_at or user.created_at
                delta = now - last_check
                
                reset_needed = False
                if user.reset_period == "day" and delta.days >= 1: reset_needed = True
                elif user.reset_period == "week" and delta.days >= 7: reset_needed = True
                elif user.reset_period == "month" and delta.days >= 30: reset_needed = True

                if reset_needed:
                    # Переносим текущий трафик в summary и обнуляем
                    user.summary_total_up = (user.summary_total_up or 0) + (user.total_up or 0)
                    user.summary_total_down = (user.summary_total_down or 0) + (user.total_down or 0)
                    user.total_up = 0
                    user.total_down = 0
                    user.last_reset_at = now
                    
                    # Сброс для клиентов пользователя
                    res_clients = await session.execute(select(Client).where(Client.user_id == user.id))
                    for c in res_clients.scalars().all():
                        c.summary_up = (c.summary_up or 0) + (c.up or 0)
                        c.summary_down = (c.summary_down or 0) + (c.down or 0)
                        c.up = 0
                        c.down = 0
            await session.commit()

    async def get_active_tags(self) -> list[str]:
        """
        Получает список тегов активных инбаундов напрямую из памяти Xray через gRPC.
        """
        try:
            # Вызываем получение статистики (уже реализовано в api_client)
            # reset=False, так как мы просто проверяем наличие тега, а не сбрасываем счетчик
            stats_list = await self.api_client.get_stats(reset=False)
            if not stats_list:
                return []

            active_tags = set()
            for item in stats_list:
                # Формат имени в Xray: inbound>>>TAG>>>traffic>>>direction
                parts = item["name"].split(">>>")
                if len(parts) >= 2 and parts[0] == "inbound":
                    tag = parts[1]
                    if tag != "api-in":  # Игнорируем технический инбаунд API
                        active_tags.add(tag)

            return list(active_tags)
        except Exception as e:
            logger.error(f"❌ Ошибка при получении активных тегов через gRPC: {e}")
            return []

    async def reset_user_traffic(self, session_factory, user_id: int):
        """
        Ручной сброс трафика пользователя: перенос в summary и обнуление текущих счетчиков.
        """
        async with session_factory() as session:
            # 1. Загружаем пользователя и его клиентов
            result = await session.execute(
                select(User)
                .options(joinedload(User.clients))
                .where(User.id == user_id)
            )
            user = result.unique().scalar_one_or_none()
            
            if not user:
                logger.warning(f"⚠️ Попытка сброса трафика: Пользователь {user_id} не найден")
                return False

            now = datetime.now()
            
            # 2. Переносим данные пользователя в накопитель
            user.summary_total_up = (user.summary_total_up or 0) + (user.total_up or 0)
            user.summary_total_down = (user.summary_total_down or 0) + (user.total_down or 0)
            
            # 3. Обнуляем текущие показатели пользователя
            user.total_up = 0
            user.total_down = 0
            user.last_reset_at = now

            # 4. Сбрасываем данные всех привязанных клиентов (протоколов)
            for client in user.clients:
                client.summary_up = (client.summary_up or 0) + (client.up or 0)
                client.summary_down = (client.summary_down or 0) + (client.down or 0)
                client.up = 0
                client.down = 0
            
            await session.commit()
            logger.info(f"✅ Трафик пользователя {user.email} успешно сброшен в статистику")
            return True