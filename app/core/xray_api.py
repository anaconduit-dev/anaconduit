import grpc
from xraydb.utils import XrayASyncClient # Пример использования обертки
# Импортируем сгенерированные файлы
# Важно: убедитесь, что папка app/proto содержит __init__.py
from app.proto import command_pb2 as stats_command
from app.proto import command_pb2_grpc as stats_service
from fastapi import HTTPException

XRAY_API_ADDR = "127.0.0.1:10085"

class XrayController:
    def __init__(self):
        self.client = XrayASyncClient(XRAY_API_ADDR)

    async def add_user(self, inbound_tag: str, email: str, user_id: str):
        """Добавляет пользователя в работающее ядро без перезагрузки"""
        try:
            await self.client.add_user(
                inbound_tag=inbound_tag,
                email=email,
                uuid=user_id,
                flow="xtls-rprx-vision"
            )
            return True
        except Exception as e:
            print(f"GRPC Error: {e}")
            return False

    async def get_user_traffic(self, email: str):
        """Получает данные о трафике пользователя"""
        stats = await self.client.get_user_stats(email, reset=False)
        return stats # { "uplink": 12345, "downlink": 67890 }



class XrayAPIClient:
    def __init__(self, address="127.0.0.1:10085"):
        self.address = address

    async def test_connection(self):
        """Проверяет связь с Xray и возвращает версию (через заглушку статистики)"""
        # Используем асинхронный канал gRPC (native в grpcio)
        async with grpc.aio.insecure_channel(self.address) as channel:
            stub = stats_service.StatsServiceStub(channel)
            try:
                # Пытаемся получить статистику (даже если она пустая)
                # Request для получения версии или общего состояния
                request = stats_command.GetStatsRequest(name="inbound>>>api>>>traffic>>>downlink", reset=False)
                
                # Если Xray ответит (даже ошибкой, что статы нет), значит API активно
                await stub.GetStats(request)
                return True
            except grpc.aio.AioRpcError as e:
                # Если ошибка "status not found" — это нормально, значит API работает, но данных нет
                if e.code() == grpc.StatusCode.NOT_FOUND:
                    return True
                print(f"gRPC Error: {e.code()} - {e.details()}")
                return False
            except Exception as e:
                print(f"Connection failed: {str(e)}")
                return False

    async def get_sys_stats(self):
        """Пример получения системной статистики"""
        async with grpc.aio.insecure_channel(self.address) as channel:
            stub = stats_service.StatsServiceStub(channel)
            request = stats_command.GetSysStatsRequest()
            try:
                response = await stub.GetSysStats(request)
                return {
                    "uptime": response.uptime,
                    "num_goroutine": response.num_goroutine,
                    "alloc": response.alloc,
                    "total_alloc": response.total_alloc
                }
            except Exception as e:
                return {"error": str(e)}
