import grpc
import os
# Импортируем сгенерированные файлы из папки proto
from app.proto import command_pb2 as stats_command
from app.proto import command_pb2_grpc as stats_service
from fastapi import HTTPException

class XrayAPIClient:
    def __init__(self, address="127.0.0.1:10085"):
        self.address = address

    async def test_connection(self):
        """Проверяет, отвечает ли gRPC API Xray"""
        async with grpc.aio.insecure_channel(self.address) as channel:
            # Используем сервис статистики для проверки связи
            stub = stats_service.StatsServiceStub(channel)
            try:
                # Запрашиваем пустую статистику
                request = stats_command.GetStatsRequest(name="api", reset=False)
                await stub.GetStats(request)
                return True
            except grpc.aio.AioRpcError as e:
                # Если ошибка 'not found' — сервер жив, просто нет данных
                if e.code() == grpc.StatusCode.NOT_FOUND:
                    return True
                print(f"gRPC Error: {e.code()} - {e.details()}")
                return False
            except Exception as e:
                print(f"Connection failed: {str(e)}")
                return False

    async def get_sys_stats(self):
        """Получает загрузку системы (Uptime, Memory) через gRPC"""
        async with grpc.aio.insecure_channel(self.address) as channel:
            stub = stats_service.StatsServiceStub(channel)
            try:
                request = stats_command.GetSysStatsRequest()
                response = await stub.GetSysStats(request)
                return {
                    "uptime": response.uptime,
                    "num_goroutine": response.num_goroutine,
                    "alloc": response.alloc,
                    "total_alloc": response.total_alloc
                }
            except Exception as e:
                return {"error": str(e)}
