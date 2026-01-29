import grpc
import logging
from typing import List, Dict, Optional, Any

from app.xray_api.proto import stats_pb2, stats_pb2_grpc


logger = logging.getLogger(__name__)

class XrayAPIClient:
    def __init__(self, host: str = "anaconduit_xray", port: int = 10085):
        self.address = f"{host}:{port}"
        self.channel = grpc.aio.insecure_channel(self.address)
        self.stats_stub = stats_pb2_grpc.StatsServiceStub(self.channel)

    async def close(self):
        """Закрытие канала связи (вызывать при остановке приложения)"""
        await self.channel.close()
        logger.info(f"gRPC channel to {self.address} closed")

    async def get_user_stats(self, email: str) -> Optional[int]:
        """Получение статистики конкретного пользователя"""
        # Обычно проверяют и uplink, и downlink
        request = stats_pb2.GetStatsRequest(
            name=f"user>>>{email}>>>traffic>>>downlink", 
            reset=False
        )
        try:
            response = await self.stats_stub.GetStats(request)
            return response.stat.value
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.NOT_FOUND:
                logger.warning(f"Статистика для {email} не найдена (возможно, не было трафика)")
            else:
                logger.error(f"Ошибка gRPC GetStats: {e.code()} - {e.details()}")
            return None

    async def get_all_stats(self) -> List[Dict[str, Any]]:
        """Получение всех доступных счетчиков"""
        request = stats_pb2.QueryStatsRequest(pattern="", reset=False)
        try:
            response = await self.stats_stub.QueryStats(request)
            
            # Безопасная проверка на наличие данных
            if not response or not hasattr(response, 'stat'):
                return []
                
            return [
                {"name": stat.name, "value": stat.value} 
                for stat in response.stat
            ]
        except grpc.RpcError as e:
            logger.error(f"Ошибка gRPC QueryStats: {e.code()} - {e.details()}")
            return []