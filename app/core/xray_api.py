import grpc
from xray_grpc import stats_pb2_grpc as stats_service
from xray_grpc import stats_pb2 as stats_types
from fastapi import HTTPException

class XrayAPIClient:
    def __init__(self, address="host.docker.internal:10085"):
        self.address = address

    async def test_connection(self):
        """Проверка связи через готовую библиотеку"""
        try:
            # Создаем асинхронный канал
            async with grpc.aio.insecure_channel(self.address) as channel:
                stub = stats_service.StatsServiceStub(channel)
                
                # Запрашиваем системную статистику (самый простой вызов)
                request = stats_types.GetSysStatsRequest()
                response = await stub.GetSysStats(request)
                
                if response.uptime > 0:
                    return True
                return False
        except Exception as e:
            print(f"gRPC Connection Error: {e}")
            return False

    async def get_sys_stats(self):
        """Получение данных о нагрузке"""
        try:
            async with grpc.aio.insecure_channel(self.address) as channel:
                stub = stats_service.StatsServiceStub(channel)
                request = stats_types.GetSysStatsRequest()
                response = await stub.GetSysStats(request)
                return {
                    "uptime": response.uptime,
                    "num_goroutine": response.num_goroutine,
                    "alloc": response.alloc
                }
        except Exception as e:
            return {"error": str(e)}
