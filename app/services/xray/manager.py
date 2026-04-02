# app/services/xray/manager.py
import json
import os
import shutil
import logging
import time
import httpx
import anyio
import docker
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.services.docker_service import DockerService
from app.core.config import settings

logger = logging.getLogger(__name__)

class XrayResourceManager:
    CONTAINER_NAME = "anaconduit_xray"
    GITHUB_API_URL = "https://api.github.com/repos/XTLS/Xray-core/releases"
    CACHE_TTL = 3600

    def __init__(self, docker_service: DockerService):
        self.docker = docker_service
        self.internal_xray_dir = settings.xray_internal_path
        self.host_xray_dir = f"{settings.host_data_path}/xray"
        self.host_log_dir = os.path.join(os.path.dirname(self.host_xray_dir), "xray_log")
        self.host_sockets_dir = f"{settings.host_data_path}/run"
        
        self._ensure_dirs_exist()

        # Кэш версий
        self._version_cache = None
        self._cache_last_updated = 0

    # --- Работа с файлами ---

    def _ensure_dirs_exist(self):
        """Создает необходимые папки, если их нет. Логирует только создание."""
        dirs_to_check = [
            (self.host_xray_dir, "Конфигурация"),
            (self.host_log_dir, "Логи"),
            (self.host_sockets_dir, "Сокеты")
        ]
        
        created_any = False
        try:
            for path, name in dirs_to_check:
                if not os.path.exists(path):
                    os.makedirs(path, exist_ok=True)
                    logger.info(f"📁 Создана папка Xray ({name}): {path}")
                    created_any = True
            
            if not created_any:
                # Если всё уже было, пишем только в DEBUG, чтобы не спамить в консоль
                logger.debug(f"✅ Инфраструктура Xray уже готова: {self.host_xray_dir}")
            else:
                logger.info(f"🚀 Вся инфраструктура папок Xray успешно проверена и подготовлена")
                
        except Exception as e:
            logger.error(f"❌ Критическая ошибка при подготовке папок Xray: {e}")

    async def save_config(self, config: dict):
        config_path = self.internal_xray_dir / "config.json"
        def _write():
            # На случай если папку удалили "на лету"
            os.makedirs(os.path.dirname(config_path), exist_ok=True) 
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)
        await anyio.to_thread.run_sync(_write)

    def _get_container_params(self, version: str):
        clean_v = version.lstrip('v')
        return {
            "image": f"teddysun/xray:{clean_v}",
            "volumes": {
                self.host_xray_dir: {"bind": "/etc/xray", "mode": "rw"},
                self.host_log_dir: {"bind": "/var/log/xray", "mode": "rw"},
                self.host_sockets_dir: {"bind": "/run/xray", "mode": "rw"},
            },
            "command": 'sh -c "rm -f /run/xray/*.sock && xray -confdir /etc/xray"',
            "network": "anaconduit_net"
        }

    # --- Жизненный цикл контейнера ---

    async def install(self, version: str) -> Dict[str, Any]:
        """Полная установка/переустановка контейнера"""
        # 1. Чистка сокетов
        if os.path.exists(self.host_sockets_dir):
            for filename in os.listdir(self.host_sockets_dir):
                file_path = os.path.join(self.host_sockets_dir, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    logger.error(f"Failed to delete socket {file_path}: {e}")
        # 2. Гарантируем наличие custom.json
        custom_config_path = self.internal_xray_dir / "custom.json"
        if not custom_config_path.exists():
            with open(custom_config_path, "w") as f:
                json.dump({"inbounds": []}, f)

        # 3. Параметры Docker
        params = self._get_container_params(version)

        # 4. Рестарт через DockerService
        await self.docker.remove_container(self.CONTAINER_NAME)
        await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=params["image"],
            command=params["command"],
            volumes=params["volumes"],
            network=params["network"],
            environment={"TZ": "UTC"},
            restart_policy={"Name": "always"},
        )
        return {"status": "installed", "version": version}

    async def validate_config(self, config_to_test: dict) -> tuple[bool, str]:
        """Проверка конфига через 'xray -test' во временном контейнере"""
        test_path = self.internal_xray_dir / "test_config.json"
        try:
            with open(test_path, "w") as f:
                json.dump(config_to_test, f)

            def _run_test():
                client = self.docker.client
                try:
                    client.containers.run(
                        image="teddysun/xray:latest",
                        command="xray -test -confdir /etc/xray",
                        volumes={self.host_xray_dir: {"bind": "/etc/xray", "mode": "ro"}},
                        remove=True,
                        network_disabled=True
                    )
                    return True, "OK"
                except docker.errors.ContainerError as e:
                    return False, e.stderr.decode()
                except Exception as e:
                    return False, str(e)

            return await anyio.to_thread.run_sync(_run_test)
        finally:
            if test_path.exists():
                test_path.unlink()

    # --- Утилиты версий ---

    async def get_github_versions(self) -> List[str]:
        if self._version_cache and (time.time() - self._cache_last_updated < self.CACHE_TTL):
            return self._version_cache

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(self.GITHUB_API_URL)
                resp.raise_for_status()
                versions = [r["tag_name"] for r in resp.json() if not r.get("prerelease")]
                self._version_cache = versions
                self._cache_last_updated = time.time()
                return versions
            except Exception as e:
                logger.error(f"GitHub error: {e}")
                return self._version_cache or []

    # --- Прокси-методы к DockerService ---
    
    async def start(self): return await self.docker.start(self.CONTAINER_NAME)
    async def restart(self): return await self.docker.restart(self.CONTAINER_NAME)
    async def stop(self): return await self.docker.stop(self.CONTAINER_NAME)
    async def get_status(self): 
        state = await self.docker.get_status(self.CONTAINER_NAME)
        version = "unknown"
        if state == "running":
            try:
                version_raw = await self.docker.exec(self.CONTAINER_NAME, "xray -version")
                if version_raw: version = version_raw.split('\n')[0].split(' ')[1]
            except: pass
        return {"container": self.CONTAINER_NAME, "status": state, "version": version}


    async def is_config_different(self, new_config: dict) -> bool:
        """Сравнивает переданный конфиг с тем, что физически лежит в config.json"""
        config_path = self.internal_xray_dir / "config.json"
        if not config_path.exists():
            return True
        
        def _read_and_compare():
            try:
                with open(config_path, "r") as f:
                    current_on_disk = json.load(f)
                # Сравниваем словари. json.dumps используется для нормализации порядка ключей, 
                # но в Python 3.7+ словари сохраняют порядок, так что прямое сравнение dict тоже ок.
                return current_on_disk != new_config
            except Exception:
                return True # Если файл битый, считаем что конфиг изменился
                
        return await anyio.to_thread.run_sync(_read_and_compare)

    async def get_container_logs(self, tail: int = 100) -> str:
        """Получает последние N строк логов из контейнера Xray"""
        try:
            # Обращаемся к DockerService, который умеет читать логи по имени контейнера
            logs = await self.docker.logs(self.CONTAINER_NAME, tail=tail)
            return logs
        except Exception as e:
            logger.error(f"❌ Ошибка при чтении логов Docker: {e}")
            return f"Error reading logs: {str(e)}"