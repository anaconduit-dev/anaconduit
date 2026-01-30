# app/xray_api/client.py
import grpc
import logging
from typing import List, Dict, Any

# Импортируем сгенерированные файлы
# Путь зависит от того, как называется твоя корневая папка (Anaconduit?)
from app.xray_api.proto.app.stats.command import command_pb2
from app.xray_api.proto.app.stats.command import command_pb2_grpc

logger = logging.getLogger(__name__)

class XrayAPIClient:
    def __init__(self, host: str = "anaconduit_xray", port: int = 10085):
        self.address = f"{host}:{port}"
        self.channel = grpc.aio.insecure_channel(self.address)
        # В Xray StatsServiceStub обычно находится в command_pb2_grpc
        self.stats_stub = command_pb2_grpc.StatsServiceStub(self.channel)

    async def get_all_stats(self) -> List[Dict[str, Any]]:
        # Логируем начало запроса
        logger.info("Отправка gRPC запроса QueryStats в Xray...")
        
        request = command_pb2.QueryStatsRequest(pattern="", reset=False)
        try:
            # Выполняем запрос
            response = await self.stats_stub.QueryStats(request)
            
            # Логируем тип и содержимое ответа (для отладки)
            logger.debug(f"Сырой ответ gRPC: {type(response)}")
            
            if not response:
                logger.warning("Xray вернул абсолютно пустой ответ (None)")
                return []

            if not hasattr(response, 'stat') or not response.stat:
                logger.info("Статистика пуста: Xray не собрал данные по заданному паттерну.")
                return []

            # Формируем результат
            result = []
            for stat in response.stat:
                # Конвертируем байты в мегабайты с округлением до 2 знаков
                value_mb = round(stat.value / (1024 * 1024), 2)
                
                result.append({
                    "name": stat.name,
                    "bytes": stat.value,      # Оставляем сырые данные для точности
                    "megabytes": value_mb,    # Добавляем для удобства
                    "type": "upload" if "uplink" in stat.name else "download"
                })
            
            logger.info(f"Успешно получено счетчиков: {len(result)}")
            for item in result:
                logger.debug(f"Статистика: {item['name']} = {item['bytes']}")
                
            return result

        except grpc.RpcError as e:
            # Логируем специфические ошибки gRPC (таймаут, отказ в соединении и т.д.)
            logger.error(f"gRPC ошибка при получении статистики: {e.code()} - {e.details()}")
            return [{"error": "gRPC_ERROR", "details": e.details()}]
        except Exception as e:
            # Логируем любые другие ошибки (проблемы с атрибутами и т.д.)
            logger.exception(f"Непредвиденная ошибка в get_all_stats: {e}")
            return [{"error": "INTERNAL_ERROR", "message": str(e)}]