import logging
from typing import List, Optional

import docker
from docker.models.containers import Container
from docker.errors import DockerException, NotFound

from app.core.config import settings

logger = logging.getLogger(__name__)


class DockerService:
    """
    Сервис-обертка над Docker Engine API
    """

    # ❗ Ограничиваем, какими контейнерами можно управлять
    ALLOWED_CONTAINERS = {
        "nginx",
        "anaconduit_xray",
        "anaconduit_backend",
    }

    def __init__(self):
        # В dev можно вообще не требовать Docker
        if settings.debug:
            logger.warning("DockerService запущен в DEBUG-режиме")

        try:
            self.client = docker.from_env()
            self.client.ping()
        except DockerException as e:
            logger.error("Docker недоступен: %s", e)
            raise RuntimeError("Docker недоступен")

    # ---------- internal ----------

    def _check_allowed(self, name: str):
        if name not in self.ALLOWED_CONTAINERS:
            raise PermissionError(f"Управление контейнером '{name}' запрещено")

    def _get(self, name: str) -> Optional[Container]:
        try:
            return self.client.containers.get(name)
        except NotFound:
            return None

    # ---------- public API ----------

    def list_containers(self) -> List[dict]:
        """
        Список разрешённых контейнеров
        """
        result = []
        for container in self.client.containers.list(all=True):
            if container.name in self.ALLOWED_CONTAINERS:
                result.append({
                    "name": container.name,
                    "image": container.image.tags,
                    "status": container.status,
                })
        return result

    def start(self, name: str) -> None:
        self._check_allowed(name)
        container = self._get(name)
        if not container:
            raise ValueError("Контейнер не найден")
        container.start()

    def stop(self, name: str, timeout: int = 10) -> None:
        self._check_allowed(name)
        container = self._get(name)
        if not container:
            raise ValueError("Контейнер не найден")
        container.stop(timeout=timeout)

    def restart(self, name: str, timeout: int = 10) -> None:
        self._check_allowed(name)
        container = self._get(name)
        if not container:
            raise ValueError("Контейнер не найден")
        container.restart(timeout=timeout)

    def logs(self, name: str, tail: int = 100) -> str:
        self._check_allowed(name)
        container = self._get(name)
        if not container:
            raise ValueError("Контейнер не найден")
        return container.logs(tail=tail).decode("utf-8", errors="ignore")
        

    def remove_container(self, name: str) -> None:
        self._check_allowed(name)
        container = self._get(name)
        if container:
            container.stop()
            container.remove()

    def run_container(
        self,
        name: str,
        image: str,
        ports: dict | None = None,
        volumes: dict | None = None,
        environment: dict | None = None,
        restart_policy: dict | None = None,
    ) -> Container:
        self._check_allowed(name)

        return self.client.containers.run(
            image=image,
            name=name,
            detach=True,
            ports=ports,
            volumes=volumes,
            environment=environment,
            restart_policy=restart_policy,
        )
