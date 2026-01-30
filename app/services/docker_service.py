import logging
import anyio
from typing import List, Optional, Dict, Any

import docker
from docker.models.containers import Container
from docker.errors import DockerException, NotFound

from app.core.config import settings

logger = logging.getLogger(__name__)

class DockerService:
    ALLOWED_CONTAINERS = {
        "nginx",
        "anaconduit_xray",
        "anaconduit_backend",
    }

    def __init__(self):
        try:
            # Оставляем инициализацию клиента в синхронном виде (выполняется при старте)
            self.client = docker.from_env()
            self.client.ping()
        except DockerException as e:
            logger.error("Docker недоступен: %s", e)
            raise RuntimeError("Docker недоступен")

    # ---------- internal (синхронные методы остаются синхронными) ----------

    def _check_allowed(self, name: str):
        if name not in self.ALLOWED_CONTAINERS:
            raise PermissionError(f"Управление контейнером '{name}' запрещено")

    def _get_sync(self, name: str) -> Optional[Container]:
        try:
            return self.client.containers.get(name)
        except NotFound:
            return None

    # ---------- public API (превращаем в асинхронные) ----------

    async def list_containers(self) -> List[Dict[str, Any]]:
        """Запускаем блокирующий поиск в отдельном потоке"""
        def _list():
            result = []
            for container in self.client.containers.list(all=True):
                if container.name in self.ALLOWED_CONTAINERS:
                    result.append({
                        "name": container.name,
                        "image": [str(t) for t in container.image.tags],
                        "status": container.status,
                    })
            return result
        
        return await anyio.to_thread.run_sync(_list)

    async def restart(self, name: str, timeout: int = 10) -> None:
        self._check_allowed(name)
        
        def _restart():
            container = self._get_sync(name)
            if not container:
                raise ValueError(f"Контейнер {name} не найден")
            container.restart(timeout=timeout)
            
        await anyio.to_thread.run_sync(_restart)

    async def logs(self, name: str, tail: int = 100) -> str:
        self._check_allowed(name)

        def _get_logs():
            container = self._get_sync(name)
            if not container:
                raise ValueError("Контейнер не найден")
            return container.logs(tail=tail).decode("utf-8", errors="ignore")

        return await anyio.to_thread.run_sync(_get_logs)

    async def remove_container(self, name: str) -> None:
        self._check_allowed(name)

        def _remove():
            container = self._get_sync(name)
            if container:
                try:
                    container.stop(timeout=2)
                except:
                    pass
                container.remove(force=True)

        await anyio.to_thread.run_sync(_remove)

    async def run_container(
        self,
        name: str,
        image: str,
        ports: Optional[Dict] = None,
        volumes: Optional[Dict] = None,
        environment: Optional[Dict] = None,
        restart_policy: Optional[Dict] = None,
        network: Optional[str] = None,
    ) -> Any:
        self._check_allowed(name)

        def _run():
            # Важно: если образа нет, Docker начнет его скачивать (это долго!)
            # В потоке это не заблокирует основной API
            return self.client.containers.run(
                image=image,
                name=name,
                detach=True,
                ports=ports,
                volumes=volumes,
                environment=environment,
                restart_policy=restart_policy,
                network=network,
            )

        return await anyio.to_thread.run_sync(_run)
    
    async def get_status(self, name: str) -> str:
        """Возвращает статус контейнера: running, exited, или not_found"""
        def _get_status():
            container = self._get_sync(name)
            if not container:
                return "not_found"
            return container.status
        return await anyio.to_thread.run_sync(_get_status)

    async def start(self, name: str) -> str:
        self._check_allowed(name)
        def _start():
            container = self._get_sync(name)
            if not container:
                return "not_found"
            if container.status == "running":
                return "already_running"
            container.start()
            return "started"
        return await anyio.to_thread.run_sync(_start)

    async def stop(self, name: str, timeout: int = 10) -> str:
        self._check_allowed(name)
        def _stop():
            container = self._get_sync(name)
            if not container:
                return "not_found"
            if container.status != "running":
                return f"already_{container.status}"
            container.stop(timeout=timeout)
            return "stopped"
        return await anyio.to_thread.run_sync(_stop)
