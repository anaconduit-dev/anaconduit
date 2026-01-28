import os
import json
import httpx
from typing import List
from pathlib import Path

from app.services.docker_service import DockerService
from app.core.config import settings


class XrayService:
    CONTAINER_NAME = "anaconduit_xray"
    API_PORT = 10085
    GITHUB_API_URL_XRAY = "https://api.github.com/repos/XTLS/Xray-core/releases"

    def __init__(self):
        self.docker = DockerService()
        # Путь для Python (запись файла)
        self.internal_xray_dir = settings.internal_data_path / "xray"
        self.internal_xray_dir.mkdir(parents=True, exist_ok=True)
        
        # Путь для Docker (монтирование)
        self.host_xray_dir = f"{settings.host_data_path}/xray"

    # ---------- Versions ----------

    async def get_available_xray_versions(self) -> List[str]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                self.GITHUB_API_URL_XRAY,
                headers={
                    "User-Agent": "Anaconduit",
                    "Accept": "application/vnd.github+json",
                },
            )
            response.raise_for_status()

            versions = []
            for release in response.json():
                if release.get("prerelease"):
                    continue
                tag = release.get("tag_name")
                if tag:
                    versions.append(tag)

            return versions

    # ---------- Config ----------

    def ensure_base_config(self):
        config_path = self.internal_xray_dir / "config.json"

        base_config = {
            "log": {"loglevel": "info"},
            "api": {
                "tag": "api",
                "services": [
                    "HandlerService",
                    "StatsService",
                    "LoggerService"
                ]
            },
            "inbounds": [
                {
                    "listen": "0.0.0.0",
                    "port": self.API_PORT,
                    "protocol": "dokodemo-door",
                    "settings": {"address": "127.0.0.1"},
                    "tag": "api"
                }
            ],
            "outbounds": [
                {"protocol": "freedom", "tag": "direct"}
            ]
        }

        with open(config_path, "w") as f:
            json.dump(base_config, f, indent=2)
        
        print(f"✅ Конфиг записан во внутреннюю папку: {config_path}")



    # ---------- Runtime ----------

    async def start(self, version: str):
        self.ensure_base_config()

        image = f"teddysun/xray:{version.lstrip('v')}"

        # удалить старый контейнер
        self.docker.remove_container(self.CONTAINER_NAME)
        
        container = self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=image,
            ports={f"{self.API_PORT}/tcp": self.API_PORT},
            volumes={
                self.host_xray_dir: {
                    "bind": "/etc/xray",
                    "mode": "rw",
                }
            },
            restart_policy={"Name": "always"},
        )

        return {
            "status": "running",
            "container_id": container.short_id,
            "api": f"http://localhost:{self.API_PORT}",
        }

    def stop(self):
        self.docker.remove_container(self.CONTAINER_NAME)

    def logs(self):
        return self.docker.logs(self.CONTAINER_NAME)
