import json
import httpx
import anyio
import logging
from typing import List, Dict, Any
from app.xray_api.client import XrayAPIClient
from app.services.docker_service import DockerService
from app.core.config import settings

logger = logging.getLogger(__name__)

class XrayService:
    CONTAINER_NAME = "anaconduit_xray"
    API_PORT = 10085
    GITHUB_API_URL_XRAY = "https://api.github.com/repos/XTLS/Xray-core/releases"

    def __init__(self, client: XrayAPIClient):
        self.client = client
        self.docker = DockerService()
        
        # Пути
        self.internal_xray_dir = settings.internal_data_path / "xray"
        self.internal_xray_dir.mkdir(parents=True, exist_ok=True)
        self.host_xray_dir = f"{settings.host_data_path}/xray"

    # ---------- Versions ----------

    async def get_available_xray_versions(self) -> List[str]:
        """Получение списка версий с GitHub"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(
                    self.GITHUB_API_URL_XRAY,
                    headers={
                        "User-Agent": "Anaconduit",
                        "Accept": "application/vnd.github+json",
                    },
                )
                response.raise_for_status()
                
                return [
                    release["tag_name"] 
                    for release in response.json() 
                    if not release.get("prerelease") and "tag_name" in release
                ]
            except Exception as e:
                logger.error(f"Ошибка при получении версий Xray: {e}")
                return []

    # ---------- Config ----------

    async def _save_config_async(self, config: dict):
        """Асинхронная запись конфига через поток"""
        config_path = self.internal_xray_dir / "config.json"
        
        def _write():
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)
            return config_path

        return await anyio.to_thread.run_sync(_write)

    async def ensure_base_config(self):
        """Формирование базового конфига Xray"""
        base_config = {
            "log": {"loglevel": "info"},
            "api": {
                "tag": "api",
                "services": ["HandlerService", "StatsService", "LoggerService", "RoutingService"]
            },
            "stats": {},  # Обязательно для работы модуля статистики
            "inbounds": [
                {
                    "listen": "0.0.0.0",
                    "port": self.API_PORT,
                    "protocol": "dokodemo-door",
                    "settings": {"address": "127.0.0.1"},
                    "tag": "api-in"
                }
            ],
            "outbounds": [{"protocol": "freedom", "tag": "direct"}],
            "routing": {
                "rules": [
                    {"type": "field", "inboundTag": ["api-in"], "outboundTag": "direct"}
                ]
            }
        }
        path = await self._save_config_async(base_config)
        logger.info(f"✅ Базовый конфиг Xray обновлен: {path}")

    # ---------- Runtime ----------

    # ... внутри класса XrayService ...

    async def install(self, version: str) -> Dict[str, Any]:
        """
        Полная установка: подготовка конфига, удаление старого и запуск нового контейнера.
        """
        await self.ensure_base_config()
        image = f"teddysun/xray:{version.lstrip('v')}"

        # Удаляем старый, если он есть
        await self.docker.remove_container(self.CONTAINER_NAME)
        
        container = await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=image,
            ports={f"{self.API_PORT}/tcp": self.API_PORT},
            volumes={
                self.host_xray_dir: {
                    "bind": "/etc/xray",
                    "mode": "rw",
                }
            },
            network="anaconduit_net",
            restart_policy={"Name": "always"},
        )

        return {
            "status": "installed and running",
            "container_id": container.id[:12] if hasattr(container, 'id') else "unknown",
            "version": version
        }

    async def start(self):
        status = await self.docker.start(self.CONTAINER_NAME)
        if status == "not_found":
            return {"status": "error", "message": "Container not found. Please install it first."}
        if status == "already_running":
            return {"status": "ok", "message": "Xray is already running"}
        return {"status": "ok", "message": "Xray started successfully"}

    async def stop(self):
        status = await self.docker.stop(self.CONTAINER_NAME)
        if status == "not_found":
            return {"status": "error", "message": "Container not found"}
        if status.startswith("already"):
            return {"status": "ok", "message": f"Xray is already {status.split('_')[1]}"}
        return {"status": "ok", "message": "Xray stopped successfully"}

    async def restart(self):
        # Для restart проверка статуса обычно не нужна, 
        # так как Docker сам поднимет его из любого состояния
        await self.docker.restart(self.CONTAINER_NAME)
        return {"status": "ok", "message": "Xray restarted"}
    
    async def get_current_status(self):
        """Метод для отображения статуса в UI"""
        state = await self.docker.get_status(self.CONTAINER_NAME)
        return {"container": self.CONTAINER_NAME, "status": state}

    async def logs(self, tail: int = 100):
        return await self.docker.logs(self.CONTAINER_NAME, tail=tail)

    # ---------- gRPC Stats ----------
    
    async def get_stats(self) -> List[Dict[str, Any]]:
        """Получение статистики через gRPC клиент"""
        try:
            stats = await self.client.get_all_stats()
            return stats if stats is not None else []
        except Exception as e:
            logger.error(f"Ошибка gRPC при получении статистики: {e}")
            return [{"error": str(e)}]
