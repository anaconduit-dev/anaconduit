import logging
import time

import anyio

from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor

import docker

from datetime import datetime, timezone

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

    STATS_CACHE_TTL = 7  # seconds

    def __init__(self):
        try:
            self.client = docker.from_env()
            self.client.ping()
        except DockerException as e:
            logger.error("Docker недоступен: %s", e)
            raise RuntimeError("Docker недоступен")

        self._stats_cache: Dict[str, Any] = {}
        self._stats_cache_time = 0.0

        self._executor = ThreadPoolExecutor(max_workers=6)

    # ---------- internal ----------

    def _check_allowed(self, name: str):
        if name not in self.ALLOWED_CONTAINERS:
            raise PermissionError(f"Управление контейнером '{name}' запрещено")

    def _get_sync(self, name: str) -> Optional[Container]:
        try:
            return self.client.containers.get(name)
        except NotFound:
            return None

    def _fetch_stats(self, container: Container):

        if container.status != "running":
            return None

        try:
            return container.stats(stream=False)
        except Exception:
            return None

    # ---------- public API ----------

    async def list_containers(self) -> Dict[str, Any]:

        def _list():

            now_ts = time.time()

            containers: List[Container] = [
                c for c in self.client.containers.list(all=True)
                if c.name in self.ALLOWED_CONTAINERS
            ]

            # ---------- stats cache ----------

            if now_ts - self._stats_cache_time > self.STATS_CACHE_TTL:

                futures = [
                    self._executor.submit(self._fetch_stats, c)
                    for c in containers
                ]

                stats_results = [f.result() for f in futures]

                self._stats_cache = {
                    c.name: stats
                    for c, stats in zip(containers, stats_results)
                }

                self._stats_cache_time = now_ts

            stats_cache = self._stats_cache

            container_list = []

            total_cpu = 0.0
            total_mem_bytes = 0
            total_mem_limit_bytes = 0

            now = datetime.now(timezone.utc)

            for container in containers:

                stats = stats_cache.get(container.name)

                cpu_val = 0.0
                mem_usage_bytes = 0
                mem_limit_bytes = 0
                mem_percent = 0.0
                uptime = "offline"

                if container.status == "running":

                    started_at_str = container.attrs.get("State", {}).get("StartedAt", "")

                    if started_at_str:
                        try:

                            clean_date = started_at_str[:26] + "Z"

                            start_dt = datetime.strptime(
                                clean_date,
                                "%Y-%m-%dT%H:%M:%S.%fZ"
                            ).replace(tzinfo=timezone.utc)

                            uptime = str(now - start_dt).split('.')[0]

                        except Exception:
                            uptime = "unknown"

                    if stats:

                        mem_stats = stats.get("memory_stats", {})

                        mem_usage_bytes = mem_stats.get("usage", 0)
                        mem_limit_bytes = mem_stats.get("limit", 0)

                        total_mem_bytes += mem_usage_bytes
                        total_mem_limit_bytes += mem_limit_bytes

                        if mem_limit_bytes > 0:
                            mem_percent = (mem_usage_bytes / mem_limit_bytes) * 100

                        cpu_stats = stats.get("cpu_stats", {})
                        precpu_stats = stats.get("precpu_stats", {})

                        cpu_delta = (
                            cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
                            - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
                        )

                        system_delta = (
                            cpu_stats.get("system_cpu_usage", 0)
                            - precpu_stats.get("system_cpu_usage", 0)
                        )

                        if system_delta > 0 and cpu_delta > 0:

                            num_cpus = cpu_stats.get("online_cpus", 1)

                            cpu_val = (cpu_delta / system_delta) * num_cpus * 100.0

                            total_cpu += cpu_val

                container_list.append({

                    "name": container.name,
                    "status": container.status,
                    "uptime": uptime,

                    "cpu_percent": round(cpu_val, 2),

                    "memory": {
                        "usage_mb": round(mem_usage_bytes / 1048576, 2),
                        "limit_mb": round(mem_limit_bytes / 1048576, 2),
                        "percent": round(mem_percent, 2)
                    },

                    "image": [str(t) for t in container.image.tags],

                })

            total_mem_usage_percent = 0.0

            if total_mem_limit_bytes > 0:
                total_mem_usage_percent = (total_mem_bytes / total_mem_limit_bytes) * 100

            return {

                "containers": container_list,

                "total": {

                    "cpu_percent": round(total_cpu, 2),

                    "mem_usage_mb": round(total_mem_bytes / 1048576, 2),

                    "mem_usage_percent": round(total_mem_usage_percent, 2),

                    "count": len(container_list)

                }

            }

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
                except Exception:
                    pass

                container.remove(force=True)

        await anyio.to_thread.run_sync(_remove)

    async def run_container(
        self,
        name: str,
        image: str,
        command: Optional[str] = None,
        ports: Optional[Dict] = None,
        volumes: Optional[Dict] = None,
        environment: Optional[Dict] = None,
        restart_policy: Optional[Dict] = None,
        network: Optional[str] = None,
    ) -> Any:

        self._check_allowed(name)

        def _run():

            return self.client.containers.run(
                image=image,
                name=name,
                command=command,
                detach=True,
                ports=ports,
                volumes=volumes,
                environment=environment,
                restart_policy=restart_policy,
                network=network,
            )

        return await anyio.to_thread.run_sync(_run)

    async def get_status(self, name: str) -> str:

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

    async def exec(self, name: str, command: str) -> str:

        self._check_allowed(name)

        def _exec():

            container = self._get_sync(name)

            if not container:
                raise ValueError(f"Контейнер {name} не найден")

            exit_code, output = container.exec_run(command)

            return output.decode("utf-8", errors="ignore").strip()

        return await anyio.to_thread.run_sync(_exec)

    async def inspect_container(self, name: str):
        """Возвращает низкоуровневую информацию о контейнере (инспект)"""
        try:
            # Выполняем в потоке, так как docker-py блокирующий
            container = await anyio.to_thread.run_sync(
                lambda: self.client.containers.get(name)
            )
            return container.attrs # Это и есть словарь со всеми параметрами
        except Exception:
            # Если контейнер не найден, docker-py выбросит исключение
            return None