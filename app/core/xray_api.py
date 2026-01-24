import grpc
from app.proto import stats_pb2 as stats_types
from app.proto import stats_pb2_grpc as stats_service

class XrayAPIClient:
    def __init__(self, address="172.18.0.1:10085"):
        self.address = address

    async def test_connection(self):
        """Проверка связи через запрос статистики трафика"""
        try:
            async with grpc.aio.insecure_channel(self.address) as channel:
                stub = stats_service.StatsServiceStub(channel)
                
                # Запрашиваем статистику по несуществующему тегу. 
                # Если API работает, Xray ответит (пусть даже ошибкой 'not found'), 
                # но само соединение будет успешным.
                request = stats_types.GetStatsRequest(name="test_connection", reset=False)
                
                try:
                    await stub.GetStats(request)
                    return True
                except grpc.aio.AioRpcError as e:
                    # Если ошибка StatusCode.NOT_FOUND — значит сервер ответил, API активно!
                    if e.code() == grpc.StatusCode.NOT_FOUND:
                        return True
                    print(f"gRPC Status Error: {e.code()}")
                    return False
        except Exception as e:
            print(f"gRPC Connection Fatal Error: {e}")
            return False
