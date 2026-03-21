# app/xray_api/client.py
import grpc
import logging
from typing import List, Dict, Any
from app.xray_api.proto.app.stats.command import command_pb2
from app.xray_api.proto.app.stats.command import command_pb2_grpc
from app.xray_api.proto.app.stats.command import command_pb2 as stats_pb2
from app.xray_api.proto.app.proxyman.command import command_pb2 as proxyman_command_pb2
from app.xray_api.proto.app.proxyman.command import command_pb2_grpc as proxyman_command_pb2_grpc
from app.xray_api.proto.common.protocol import user_pb2
from app.xray_api.proto.proxy.vless import account_pb2 as vless_account_pb2

import json

logger = logging.getLogger(__name__)

class XrayAPIClient:
    def __init__(self, host: str = "anaconduit_xray", port: int = 10085):
        self.address = f"{host}:{port}"
        self.channel = grpc.aio.insecure_channel(self.address)
        # В Xray StatsServiceStub обычно находится в command_pb2_grpc
        self.stats_stub = command_pb2_grpc.StatsServiceStub(self.channel)
        self.handler_stub = proxyman_command_pb2_grpc.HandlerServiceStub(self.channel)

    async def get_stats(self, reset: bool = False) -> List[Dict[str, Any]]:
        # logger.info(f"Запрос статистики (reset={reset})...")
        # Передаем параметр reset в запрос gRPC
        request = command_pb2.QueryStatsRequest(pattern="", reset=reset)
        
        try:
            response = await self.stats_stub.QueryStats(request)
            if not response or not hasattr(response, 'stat'):
                return []

            # Если тебе нужны сырые данные для update_stats_in_db, 
            # возвращаем список объектов stat
            raw_stats = []
            for stat in response.stat:
                raw_stats.append({
                    "name": stat.name,
                    "value": stat.value
                })
            return raw_stats

        except Exception as e:
            logger.error(f"Ошибка получения статистики: {e}")
            return []
            
    async def get_all_stats(self) -> List[Dict[str, Any]]:
        logger.info("Запрос статистики и группировка данных...")
        request = command_pb2.QueryStatsRequest(pattern="", reset=False)
        
        try:
            response = await self.stats_stub.QueryStats(request)
            if not response or not hasattr(response, 'stat'):
                return []

            # Временный словарь для группировки
            grouped = {}

            for stat in response.stat:
                # stat.name обычно имеет формат: "inbound>>>tag>>>uplink" или "user>>>email>>>downlink"
                parts = stat.name.split(">>>")
                if len(parts) < 3:
                    continue

                category = parts[0]  # inbound или user
                identifier = parts[1] # имя (socks-test или email пользователя)
                direction = parts[2]  # uplink или downlink

                if identifier not in grouped:
                    grouped[identifier] = {
                        "name": identifier,
                        "category": category,
                        "upload": 0,
                        "download": 0,
                        "total_bytes": 0
                    }

                # Наполняем данными
                if direction == "uplink":
                    grouped[identifier]["upload"] = stat.value
                else:
                    grouped[identifier]["download"] = stat.value
                
                grouped[identifier]["total_bytes"] += stat.value

            # Финальный список с конвертацией в человекочитаемый вид
            result = []
            for item in grouped.values():
                item["upload_mb"] = round(item["upload"] / (1024 * 1024), 2)
                item["download_mb"] = round(item["download"] / (1024 * 1024), 2)
                item["total_mb"] = round(item["total_bytes"] / (1024 * 1024), 2)
                result.append(item)

            return result

        except Exception as e:
            logger.error(f"Ошибка парсинга статистики: {e}")
            return []

    async def add_client(self, inbound_tag: str, email: str, uuid: str, protocol: str = "vless", flow: str = "", level: int = 0):
        """
        Универсальное добавление пользователя для любого протокола.
        """
        logger.info(f"Добавление {protocol}-клиента {email} в {inbound_tag}...")
        # 1. Выбираем класс аккаунта в зависимости от протокола
        if protocol == "vless":
            from app.xray_api.proto.proxy.vless import account_pb2 as vless_account_pb2
            account = vless_account_pb2.Account(id=uuid, flow=flow)
        
        elif protocol == "vmess":
            from app.xray_api.proto.proxy.vmess import account_pb2 as vmess_account_pb2
            # У VMess uuid называется id, alter_id обычно 0
            account = vmess_account_pb2.Account(id=uuid, alter_id=0)
            
        elif protocol == "trojan":
            from app.xray_api.proto.proxy.trojan import config_pb2 as trojan_account_pb2
            # У Trojan uuid используется как пароль (password)
            account = trojan_account_pb2.Account(password=uuid)
            
        elif protocol == "shadowsocks":
            from app.xray_api.proto.proxy.shadowsocks import config_pb2 as ss_account_pb2
            # У SS uuid используется как пароль
            account = ss_account_pb2.Account(password=uuid, cipher_type=ss_account_pb2.CipherType.AES_128_GCM)
        
        else:
            raise ValueError(f"Протокол {protocol} пока не поддерживается в gRPC клиенте")

        # 2. Создаем структуру User
        user = user_pb2.User(
            email=email,
            level=level,
            account=self._to_typed_message(account, protocol), # Используем имя протокола как ключ для маппинга
        )

        # 3. Формируем и отправляем запрос
        request = proxyman_command_pb2.AlterInboundRequest(
            tag=inbound_tag,
            operation=self._to_typed_message(
                proxyman_command_pb2.AddUserOperation(user=user), 
                "add_user"
            )
        )

        try:
            await self.handler_stub.AlterInbound(request)
            logger.info(f"✅ {protocol.upper()} клиент {email} успешно добавлен")
        except Exception as e:
            logger.error(f"❌ Ошибка gRPC: {e}")
            raise e

    async def remove_client(self, inbound_tag: str, email: str):
        """
        Динамическое удаление пользователя из инбаунда через gRPC
        """
        logger.info(f"Удаление клиента {email} из инбаунда {inbound_tag}...")

        # 1. Формируем операцию удаления
        remove_user_op = proxyman_command_pb2.RemoveUserOperation(email=email)

        # 2. Упаковываем в запрос AlterInboundRequest
        request = proxyman_command_pb2.AlterInboundRequest(
            tag=inbound_tag,
            operation=self._to_typed_message(remove_user_op, "remove_user")
        )

        try:
            await self.handler_stub.AlterInbound(request)
            logger.info(f"✅ Клиент {email} успешно удален из памяти Xray")
        except Exception as e:
            logger.error(f"❌ Ошибка gRPC AlterInbound (Remove): {e}")
            raise e

    # Обнови метод _to_typed_message, добавив маппинг для удаления
    def _to_typed_message(self, message: Any, type_name: str) -> Any:
        from app.xray_api.proto.common.serial import typed_message_pb2
        
        # Маппинг имен для Xray Core
        mapping = {
            # Аккаунты (протоколы)
            "vless": "xray.proxy.vless.Account",
            "vmess": "xray.proxy.vmess.Account",
            "trojan": "xray.proxy.trojan.Account",
            "shadowsocks": "xray.proxy.shadowsocks.Account",
            
            # Операции проксимена
            "add_user": "xray.app.proxyman.command.AddUserOperation",
            "remove_user": "xray.app.proxyman.command.RemoveUserOperation",
            "add_inbound": "xray.app.proxyman.command.AddInboundOperation",
            "remove_inbound": "xray.app.proxyman.command.RemoveInboundOperation",
        }
        
        target_type = mapping.get(type_name, type_name)
        
        return typed_message_pb2.TypedMessage(
            type=target_type,
            value=message.SerializeToString()
        )

    # В твоем файле gRPC клиента (например, app/xray_api/client.py)

    async def get_active_inbounds_from_xray(self) -> List[str]:
        """
        Получает список тегов всех активных инбаундов через Stats API.
        """
        try:
            # Запрашиваем статистику, фильтруя только инбаунды
            request = stats_pb2.QueryStatsRequest(pattern="inbound", reset=False)
            response = await self.stats_stub.QueryStats(request)
            
            # Извлекаем уникальные теги из строк вида "inbound>>>TAG>>>traffic..."
            active_tags = set()
            for stat in response.stat:
                # stat.name: "inbound>>>vless_reality>>>traffic>>>downlink"
                parts = stat.name.split(">>>")
                if len(parts) > 1:
                    active_tags.add(parts[1])
            
            return list(active_tags)
        except Exception as e:
            logger.error(f"Ошибка получения инбаундов через gRPC: {e}")
            return []

    async def sync_all_traffic(self):
        # Получаем всю статистику из Xray gRPC
        # Она вернет данные и для тех, кто в config.json, и для тех, кто в custom.json
        stats = await self.client.get_stats() 
        
        async with AsyncSessionLocal() as session:
            for item in stats:
                # Парсим: "user>>>ivan@test.com#reality_port>>>traffic>>>downlink"
                parts = item["name"].split(">>>")
                if parts[0] != "user": continue
                
                full_id = parts[1]
                value = int(item["value"])
                
                if "#" not in full_id: continue
                email, tag = full_id.split("#")

                # Пытаемся найти клиента в БД
                result = await session.execute(
                    select(Client).join(User).join(Inbound)
                    .where(User.email == email, Inbound.tag == tag)
                )
                client = result.scalars().first()

                if client:
                    # Обновляем обычного юзера
                    await self._update_db_stats(client, value, parts[3])
                else:
                    # 🚀 ЛОГИКА ДЛЯ КАСТОМА:
                    # Мы можем либо писать это в таблицу "ExternalTraffic", 
                    # либо просто логировать, чтобы ты видел нагрузку в админке
                    logger.info(f"📊 Кастомный трафик: {full_id} употребил {value} байт")
            
            await session.commit()