import grpc
from fastapi import HTTPException

class XrayAPIClient:
    def __init__(self, address="host.docker.internal:10085"):
        self.address = address

    def _import_proto(self):
    try:
        # Путь теперь повторяет структуру папок Xray
        from app.proto.app.stats.command import command_pb2 as stats_command
        from app.proto.app.stats.command import command_pb2_grpc as stats_service
        return stats_command, stats_service
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Генерация не завершена: {e}")

    async def test_connection(self):
        stats_command, stats_service = self._import_proto()
        
        async with grpc.aio.insecure_channel(self.address) as channel:
            stub = stats_service.StatsServiceStub(channel)
            try:
                request = stats_command.GetStatsRequest(name="api", reset=False)
                await stub.GetStats(request)
                return True
            except grpc.aio.AioRpcError as e:
                if e.code() == grpc.StatusCode.NOT_FOUND:
                    return True
                return False
            except Exception:
                return False

    async def get_sys_stats(self):
        stats_command, stats_service = self._import_proto()
        
        async with grpc.aio.insecure_channel(self.address) as channel:
            stub = stats_service.StatsServiceStub(channel)
            try:
                request = stats_command.GetSysStatsRequest()
                response = await stub.GetSysStats(request)
                return {
                    "uptime": response.uptime,
                    "num_goroutine": response.num_goroutine,
                    "alloc": response.alloc
                }
            except Exception as e:
                return {"error": str(e)}
