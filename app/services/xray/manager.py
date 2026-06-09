# app/services/xray/manager.py
import json
import os
import shutil
import logging
import time
import httpx
import anyio
import docker
import socket
from sqlalchemy import select
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.services.docker_service import DockerService
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.models import XrayResource

logger = logging.getLogger(__name__)

class XrayResourceManager:
    CONTAINER_NAME = "anaconduit_xray"
    GITHUB_API_URL = "https://api.github.com/repos/XTLS/Xray-core/releases"
    CACHE_TTL = 3600

    def __init__(self, docker_service: DockerService):
        self.docker = docker_service
        self.internal_resource_dir = settings.xray_internal_path
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
        """
        Создает необходимые папки, используя ВНУТРЕННИЕ пути контейнера.
        Благодаря Docker Volumes, папки появятся и на хосте (/opt/anaconduit/data/...).
        """
        
        internal_log_dir = self.internal_resource_dir.parent / "xray_log"
        internal_run_dir = self.internal_resource_dir.parent / "run"

        dirs_to_check = [
            (self.internal_resource_dir, "Конфигурация/Ресурсы"),
            (internal_log_dir, "Логи"),
            (internal_run_dir, "Сокеты")
        ]
        
        created_any = False
        try:
            for path, name in dirs_to_check:
                # Превращаем в Path объект, если это строка, для надежности
                p = Path(path)
                if not p.exists():
                    p.mkdir(parents=True, exist_ok=True)
                    logger.info(f"📁 Создана папка Xray ({name}): {p}")
                    created_any = True
            
            if not created_any:
                logger.debug(f"✅ Инфраструктура Xray уже готова в {self.internal_resource_dir.parent}")
            else:
                logger.info(f"🚀 Вся инфраструктура папок Xray успешно подготовлена")
                
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
        # 1. Если кэш еще свежий — отдаем сразу
        if self._version_cache and (time.time() - self._cache_last_updated < self.CACHE_TTL):
            return self._version_cache

        # 2. Настраиваем более агрессивные таймауты
        # connect=3.0 не даст коду висеть 10 секунд на стадии DNS-запроса
        timeout = httpx.Timeout(10.0, connect=3.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                resp = await client.get(self.GITHUB_API_URL)
                resp.raise_for_status()
                
                versions = [r["tag_name"] for r in resp.json() if not r.get("prerelease")]
                
                if versions:
                    self._version_cache = versions
                    self._cache_last_updated = time.time()
                    return versions
                    
            except (httpx.ConnectError, socket.gaierror) as e:
                # Специфическая обработка ошибки DNS
                logger.warning(f"Network/DNS issue fetching Xray versions: {e}. Using stale cache.")
            except Exception as e:
                logger.error(f"Unexpected GitHub error: {e}")

        return self._version_cache if self._version_cache else []

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

    async def get_all_resource_configs(self) -> List[Any]:
        """Получает список всех ресурсов из БД для проверки обновлений."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(XrayResource))
            return result.scalars().all()

    async def download_resource(self, resource: Any) -> bool:
        """Логика скачивания с проверкой безопасности (размер и расширение)."""
        MAX_SIZE = 150 * 1024 * 1024  # 150 MB (Geo-базы обычно 10-100MB)
        ALLOWED_EXT = {".dat", ".db"}
        
        dest_path = self.internal_resource_dir / resource.filename

        # 1. Проверка расширения
        if dest_path.suffix not in ALLOWED_EXT:
            error_msg = f"🚫 Недопустимое расширение файла: {dest_path.suffix}"
            logger.error(error_msg)
            await self._update_res_db(resource.id, "failed", error_msg)
            return False

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=300.0) as client:
                # Используем stream, чтобы проверить размер до полной загрузки в память
                async with client.stream("GET", str(resource.url)) as resp:
                    resp.raise_for_status()
                    
                    # 2. Проверка заголовка Content-Length
                    cl = resp.headers.get("Content-Length")
                    if cl and int(cl) > MAX_SIZE:
                        raise ValueError(f"Файл слишком большой: {int(cl) // 1024 // 1024}MB")

                    downloaded_size = 0
                    with open(dest_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=8192):
                            downloaded_size += len(chunk)
                            if downloaded_size > MAX_SIZE:
                                raise ValueError("Файл превысил лимит в процессе загрузки")
                            f.write(chunk)

            # 3. Обновляем статус в БД (вынес в отдельный метод для чистоты)
            await self._update_res_db(resource.id, "success")
            return True

        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Ошибка при скачивании {resource.filename}: {error_msg}")
            await self._update_res_db(resource.id, "failed", error_msg)
            return False

    async def _update_res_db(self, res_id: int, status: str, error: str = None):
        """Вспомогательный метод для обновления статуса в БД"""
        async with AsyncSessionLocal() as session:
            res_db = await session.get(XrayResource, res_id)
            if res_db:
                if status == "success":
                    res_db.last_updated = datetime.now()
                res_db.status = status
                res_db.error_message = error
                await session.commit()

    async def sync_all_resources(self, force_resource_id: int = None):
        """
        Проверяет ресурсы. 
        force_resource_id: если передан ID, обновим его игнорируя тайминги.
        """
        resources = await self.get_all_resource_configs() 
        
        any_updated = False 
        target_success = True

        for res in resources:
            # 1. Определяем базовый путь
            file_path = self.internal_resource_dir / res.filename
            
            # 2. Условия для скачивания
            need_download = False
            
            # Условие А: Прямое указание (через API) или статус в БД
            if force_resource_id == res.id or res.status == "pending":
                need_download = True
                logger.info(f"🔄 Принудительное обновление ресурса: {res.filename}")

            # Условие Б: Файла физически нет
            elif not file_path.exists():
                need_download = True

            # Условие В: Плановое обновление (если включено автообновление)
            elif res.auto_update and res.last_updated:
                deadline = res.last_updated + timedelta(hours=res.update_interval)
                if datetime.now() > deadline:
                    need_download = True
                    logger.info(f"⏰ Плановое обновление по расписанию: {res.filename}")

            if need_download:
                success = await self.download_resource(res)
                if success:
                    any_updated = True
                else:
                    if force_resource_id == res.id:
                        target_success = False

        # 3. Рестартуем Xray только если хоть один файл реально скачался
        if any_updated:
            logger.info("🚀 Перезапуск Xray после обновления ресурсов...")
            await self.restart()
        
        return target_success