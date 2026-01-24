import grpc
# Обрати внимание: теперь импортируем из нашего плоского пакета proto
from app.proto import stats_pb2 as stats_types
from app.proto import stats_pb2_grpc as stats_service

class XrayAPIClient:
    def __init__(self, address="host.docker.internal:10085"):
        self.address = address

    async def test_connection(self):
        try:
            async with grpc.aio.insecure_channel(self.address) as channel:
                stub = stats_service.StatsServiceStub(channel)
                # Вызов метода получения системной статистики
                request = stats_types.GetSysStatsRequest()
                response = await stub.GetSysStats(request)
                return True if response.uptime > 0 else False
        except Exception as e:
            print(f"gRPC Error: {e}")
            return False
