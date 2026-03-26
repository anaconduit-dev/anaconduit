import json
import httpx
import anyio
import logging
import base64
import docker
import subprocess
import tempfile
import os
import asyncio
import urllib.parse
import time
import shutil
from fastapi import Response
from typing import List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy import update, select, func
from sqlalchemy.orm import joinedload
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519
from collections import defaultdict
from app.models.models import Inbound, User, Client
from app.xray_api.client import XrayAPIClient
from app.services.docker_service import DockerService
from app.core.config import settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

class XrayService:
    CONTAINER_NAME = "anaconduit_xray"
    API_PORT = 10085
    GITHUB_API_URL_XRAY = "https://api.github.com/repos/XTLS/Xray-core/releases"
    CACHE_TTL = 3600

    def __init__(self, client: XrayAPIClient):
        self.client = client
        self.docker = DockerService()
        self.internal_xray_dir = settings.xray_internal_path
        self.internal_xray_dir.mkdir(parents=True, exist_ok=True)
        self.host_xray_dir = f"{settings.host_data_path}/xray"
        self.host_log_dir = os.path.join(os.path.dirname(self.host_xray_dir), "xray_log")
        self.host_sockets_dir = f"{settings.host_data_path}/run"
        os.makedirs(self.host_sockets_dir, exist_ok=True)
        # Важно: даем права, чтобы контейнеры могли писать/читать сокеты
        os.chmod(self.host_sockets_dir, 0o777)

        self._version_cache = None
        self._cache_last_updated = 0

    # ---------- Утилиты для именования (Критически важно!) ----------

    def _get_xray_email(self, email: str, tag: str) -> str:
        """
        Единый стандарт формирования email для Xray.
        Всегда в нижнем регистре для избежания проблем десинхронизации.
        """
        clean_email = email.strip().lower()
        return f"{clean_email}#{tag}"

    # ---------- Config Generation ----------

    async def _save_config_async(self, config: dict):
        config_path = self.internal_xray_dir / "config.json"
        def _write():
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)
            return config_path
        return await anyio.to_thread.run_sync(_write)
        
    async def get_available_xray_versions(self) -> List[str]:
        current_time = time.time()

        # 1. Проверяем, есть ли данные в кэше и не истекло ли время TTL
        if self._version_cache and (current_time - self._cache_last_updated < self.CACHE_TTL):
            logger.info("Returning Xray versions from cache")
            return self._version_cache

        # 2. Если кэша нет или он протух, идем в GitHub
        headers = {
            "User-Agent": "Anaconduit-App/1.0",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # Если у вас есть токен в настройках, обязательно добавьте его:
        # if settings.GITHUB_TOKEN:
        #     headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"

        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            try:
                response = await client.get(self.GITHUB_API_URL_XRAY)
                response.raise_for_status()
                
                data = response.json()
                versions = [r["tag_name"] for r in data if not r.get("prerelease")]
                
                if versions:
                    # 3. Обновляем кэш
                    self._version_cache = versions
                    self._cache_last_updated = current_time
                    logger.info(f"Updated Xray versions cache. Found {len(versions)} versions.")
                
                return versions

            except Exception as e:
                logger.error(f"GitHub Error: {e}")
                # Если GitHub упал, но у нас есть старый кэш — отдаем его, чтобы юзер не видел ошибку
                if self._version_cache:
                    logger.warning("GitHub unreachable. Returning stale cache.")
                    return self._version_cache
                return []

    async def get_stats(self) -> List[Dict[str, Any]]:
        """Используется для отображения в UI (без сброса)"""
        try: 
            # Вызываем исправленный метод
            return await self.client.get_stats(reset=False)
        except Exception as e: 
            logger.error(f"Error in service get_stats: {e}")
            return []

    async def generate_full_config_dto(self, session: AsyncSessionLocal) -> dict:
        """
        Собирает структуру конфига Xray в словарь (dict), 
        используя текущую сессию БД (видит изменения до commit).
        """
        # Внутри контейнера пути неизменны
        container_access_log = "/var/log/xray/access.log"
        container_error_log = "/var/log/xray/error.log"

        # Базовая структура (переносим из твоего старого метода)
        config = {
            "log": {"loglevel": "warning", "access": "none", "error": ""},
            "stats": {},
            "api": {
                "tag": "api",
                "services": ["HandlerService", "StatsService", "LoggerService"]
            },
            "policy": {
                "levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}},
                "system": {"statsInboundUplink": True, "statsInboundDownlink": True}
            },
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
                "rules": [{"type": "field", "inboundTag": ["api-in"], "outboundTag": "api"}]
            }
        }
        
        FRONTEND_INTERNAL_PORT = 8080

        # Получаем инбаунды ИМЕННО из переданной сессии
        result = await session.execute(
            select(Inbound).where(Inbound.is_active == True)
        )
        db_inbounds = result.scalars().all()

        for ib in db_inbounds:
            # --- Твоя логика обработки Nginx, Reality и Транспортов ---
            # (Копируем всё из твоего generate_full_config сюда)
            network_type = ib.stream_settings.get("network", "tcp")
            security_type = ib.stream_settings.get("security", "none")
            
            clean_stream_settings = ib.stream_settings.copy()
            clean_settings = ib.settings.copy()
            listen_address = ib.listen
            if "fallbacks" in clean_settings:
                for fb in clean_settings["fallbacks"]:
                    dest = str(fb.get("dest", ""))
                    # Если в dest только порт (например, "80" или "443"), добавляем имя контейнера
                    if dest.isdigit():
                        fb["dest"] = f"nginx:{dest}"
                    # Если там 127.0.0.1:80, тоже меняем на nginx:80
                    elif "127.0.0.1" in dest or "localhost" in dest:
                        fb["dest"] = dest.replace("127.0.0.1", "nginx").replace("localhost", "nginx")

            if network_type == "ws":
                ws_settings = clean_stream_settings.get("wsSettings", {})
                
                
                # 1. Путь с портом
                raw_path = ws_settings.get("path", "/").lstrip("/")
                ws_settings["path"] = f"/{ib.port}/{raw_path}"
                
                # 2. Чистим Host (согласно логам Xray)
                if "headers" in ws_settings and "Host" in ws_settings["headers"]:
                    
                    del ws_settings["headers"]["Host"] # Убираем из headers, оставляем в корне wsSettings
                    if not ws_settings["headers"]: # Если headers пуст, удаляем его совсем
                        del ws_settings["headers"]

                clean_stream_settings["wsSettings"] = ws_settings

            elif network_type == "grpc":
                grpc_settings = clean_stream_settings.get("grpcSettings", {})
                service = grpc_settings.get("serviceName", "")
                
                # Для gRPC логика такая же: порт должен быть частью serviceName
                port_prefix_no_slash = f"{ib.port}"
                if service and not service.startswith(port_prefix_no_slash):
                    grpc_settings["serviceName"] = f"/{port_prefix_no_slash}/{service.lstrip('/')}"
                    clean_stream_settings["grpcSettings"] = grpc_settings

            elif network_type == "xhttp":
                if listen_address.startswith("/") and "," not in listen_address:
                    listen_address = f"{listen_address},0666"
                # Добавляем или обновляем sockopt для Unix Socket
                if "sockopt" not in clean_stream_settings:
                    clean_stream_settings["sockopt"] = {}
            # Reality & Nginx fix
            if security_type == "reality":
                reality_settings = clean_stream_settings.get("realitySettings", {})
                if settings.reality_dest_domain in reality_settings.get("dest", ""):
                    reality_settings["dest"] = "nginx:9443"
                    clean_stream_settings["realitySettings"] = reality_settings
            

            # Сбор клиентов для этого инбаунда
            client_result = await session.execute(
                select(Client)
                .join(User)
                .options(joinedload(Client.user))
                .where(Client.inbound_id == ib.id, Client.enable == True, User.is_active == True)
            )
            db_clients = client_result.scalars().all()
            
            xray_clients = []
            for c in db_clients:
                # Твоя логика формирования client_dict (email, id/password, flow)
                client_dict = {
                    "email": self._get_xray_email(c.user.email, ib.tag),
                    "level": c.level,
                }
                if ib.protocol == "vless":
                    client_dict["id"] = c.uuid
                    if network_type == "tcp" and security_type in ["reality", "tls"]:
                        client_dict["flow"] = c.flow or ""
                elif ib.protocol == "trojan":
                    client_dict["password"] = c.uuid
                
                xray_clients.append(client_dict)
            
            # Формируем объект инбаунда для Xray
            inbound_settings = clean_settings
            inbound_settings["clients"] = xray_clients

            xray_inbound = {
                "listen": listen_address,
                "tag": ib.tag,
                "port": ib.port,
                "protocol": ib.protocol,
                "settings": inbound_settings,
                "streamSettings": clean_stream_settings,
                "sniffing": ib.sniffing or {"enabled": True, "destOverride": ["http", "tls"]}
            }

            

            config["inbounds"].append(xray_inbound)

        return config

    async def generate_full_config(self):
        """Создает новую сессию, генерирует конфиг и пишет на диск."""
        async with AsyncSessionLocal() as session:
            config = await self.generate_full_config_dto(session)
            await self._save_config_async(config)
            return config
    # ---------- Dynamic API Management ----------

    async def add_client_to_xray(self, inbound_tag: str, user_email: str, client_key: str, flow: str = "", level: int = 0, reverse:dict = {}):
        """Добавляет клиента через gRPC API с защитой от дублей."""
        xray_email = self._get_xray_email(user_email, inbound_tag)
        reverse_data = reverse if reverse and isinstance(reverse, dict) else None
        async with AsyncSessionLocal() as session:
            from app.models.models import Inbound # Импорт внутри, если есть риск циклической зависимости
            from sqlalchemy import select
            
            result = await session.execute(
                select(Inbound).where(Inbound.tag == inbound_tag)
            )
            # Вот здесь мы определяем переменную 'inbound'
            inbound = result.scalars().first()
            
        if not inbound:
            logger.error(f"Inbound с тегом {inbound_tag} не найден в базе!")
            raise ValueError(f"Inbound {inbound_tag} not found")
        try:
            await self.client.add_client(
                inbound_tag=inbound_tag,
                email=xray_email,
                uuid=client_key,
                protocol=inbound.protocol,
                flow=flow,
                level=level
            )
            logger.info(f"👤 Клиент {xray_email} (flow: {flow}) успешно добавлен")
            # Синхронизируем файл на случай перезагрузки
            await self.generate_full_config() 
        except Exception as e:
            # Если Xray говорит, что юзер есть, мы не падаем, а просто логируем
            if "already exists" in str(e).lower():
                logger.warning(f"⚠️ Юзер {xray_email} уже был в Xray. Пропускаем.")
            else:
                logger.error(f"❌ Ошибка gRPC при добавления: {e}")
                raise Exception(f"Xray API error: {e}")

    async def remove_client_from_xray(self, inbound_tag: str, user_email: str):
        """Удаляет клиента из Xray API."""
        xray_email = self._get_xray_email(user_email, inbound_tag)
        try:
            await self.client.remove_client(
                inbound_tag=inbound_tag,
                email=xray_email
            )
            logger.info(f"🗑️ Клиент {xray_email} удален из памяти Xray")
            await self.generate_full_config() 
        except Exception as e:
            # Если юзера нет в Xray (уже удален или после рестарта) - это не критично
            if "not found" in str(e).lower() or "not exists" in str(e).lower():
                logger.warning(f"⚠️ Попытка удалить отсутствующего в Xray юзера: {xray_email}")
            else:
                logger.error(f"❌ Ошибка gRPC при удалении: {e}")
                # Выбрасываем ошибку, чтобы остановить удаление из БД, если API упало
                raise Exception(f"Не удалось удалить из Xray: {e}")

    # ---------- Stats & DB Update ----------

    async def reset_user_traffic(self, session, user_id: int):
        # Используем одну сессию, переданную сверху
        user = await session.get(User, user_id)
        if not user: return
        
        logger.info(f"--- СБРОС ТРАФИКА ДЛЯ {user.email} ---")
        logger.info(f"Было: up={user.total_up}, down={user.total_down}")

        # Важно: приводим к 0, если там None
        current_up = user.total_up or 0
        current_down = user.total_down or 0

        # 1. Обновляем накопители (summary)
        user.summary_total_up = (user.summary_total_up or 0) + current_up
        user.summary_total_down = (user.summary_total_down or 0) + current_down
        
        # 2. Обнуляем текущие
        user.total_up = 0
        user.total_down = 0
        user.last_reset_at = datetime.now() # Используем объект даты, а не функцию SQL

        # 3. Обновляем клиентов
        result = await session.execute(select(Client).where(Client.user_id == user_id))
        clients = result.scalars().all()
        for client in clients:
            client.summary_up = (client.summary_up or 0) + (client.up or 0)
            client.summary_down = (client.summary_down or 0) + (client.down or 0)
            client.up = 0
            client.down = 0
        
        # НЕ делаем тут session.commit(), сделаем его один раз в check_and_reset_traffic
        logger.info(f"Стало: summary_up={user.summary_total_up}, summary_down={user.summary_total_down}")

    async def check_and_reset_traffic(self):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.auto_reset_traffic == True)
            )
            users = result.scalars().all()
            now = datetime.now()

            for user in users:
                # Считаем разницу во времени
                last_check = user.last_reset_at or user.created_at
                delta = now - last_check
                logger.info(f"пользователь {user.email}, период {user.reset_period} прошло {delta}")
                should_reset = False
                if user.reset_period == "day" and delta.days >= 1:
                    should_reset = True
                elif user.reset_period == "week" and delta.days >= 7:
                    should_reset = True
                elif user.reset_period == "month" and delta.days >= 30:
                    should_reset = True

                if should_reset:
                    await self.reset_user_traffic(session, user.id)
            
            await session.commit() # Один коммит на всех
    # app/services/xray_service.py

    async def update_stats_in_db(self):
        stats_list = await self.client.get_stats(reset=True)
        if not stats_list: return

        # 1. Собираем все email и tag из статистики за один проход
        needed_identifiers = set()
        parsed_stats = []
        for item in stats_list:
            parts = item["name"].split(">>>")
            if len(parts) >= 4 and "#" in parts[1]:
                email, tag = parts[1].lower().split("#")
                parsed_stats.append({
                    "email": email, "tag": tag, 
                    "dir": parts[3], "val": int(item["value"])
                })
                needed_identifiers.add(email)

        if not parsed_stats: return

        async with AsyncSessionLocal() as session:
            # 2. Загружаем всех нужных клиентов ОДНИМ запросом
            result = await session.execute(
                select(Client.id, Client.user_id, User.email, Inbound.tag)
                .join(User).join(Inbound)
                .where(func.lower(User.email).in_(needed_identifiers))
            )
            # Создаем карту для быстрого поиска: {(email, tag): (client_id, user_id)}
            mapping = {(r.email.lower(), r.tag.lower()): (r.id, r.user_id) for r in result}

            client_deltas = defaultdict(lambda: {"up": 0, "down": 0})
            user_deltas = defaultdict(lambda: {"up": 0, "down": 0})

            # 3. Распределяем трафик, используя карту в памяти
            for s in parsed_stats:
                ids = mapping.get((s["email"], s["tag"]))
                if not ids: continue
                
                c_id, u_id = ids
                key = "up" if "uplink" in s["dir"] else "down"
                client_deltas[c_id][key] += s["val"]
                user_deltas[u_id][key] += s["val"]

            # 4. Выполняем обновления (тут можно оставить как есть или использовать bulk_update)
            for c_id, d in client_deltas.items():
                await session.execute(
                    update(Client).where(Client.id == c_id)
                    .values(up=Client.up + d["up"], down=Client.down + d["down"])
                )
            for u_id, d in user_deltas.items():
                await session.execute(
                    update(User).where(User.id == u_id)
                    .values(total_up=User.total_up + d["up"], total_down=User.total_down + d["down"])
                )
            
            await session.commit()
    

    # ---------- Контейнер и Жизненный цикл ----------

    async def install(self, version: str) -> Dict[str, Any]:
        await self.generate_full_config()
        # 1. Настройка путей для логов
        # settings.host_data_path обычно указывает на /home/vpsadmin/data/anaconduit
        
        os.makedirs(self.host_log_dir, exist_ok=True)
        
        
            

        # Гарантируем наличие custom.json
        custom_config_path = self.internal_xray_dir / "custom.json"
        if not custom_config_path.exists():
            with open(custom_config_path, "w") as f:
                json.dump({"inbounds": []}, f)
            
        
        for filename in os.listdir(self.host_sockets_dir):
            file_path = os.path.join(self.host_sockets_dir, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path) # Удаляем файлы сокетов
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
        # lstrip('v') гарантирует, что мы не получим 'teddysun/xray:vv1.8.4'
        clean_v = version.lstrip('v')
        image = f"teddysun/xray:{clean_v}"
        
        await self.docker.remove_container(self.CONTAINER_NAME)
        
        container = await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=image,
            command='sh -c "rm -f /run/xray/*.sock && xray -confdir /etc/xray"',
            ports={},
            environment={
                "TZ": "UTC"
            },
            volumes={
                self.host_xray_dir: {"bind": "/etc/xray", "mode": "rw"},
                self.host_log_dir: {"bind": "/var/log/xray", "mode": "rw"},
                self.host_sockets_dir: {"bind": "/run/xray", "mode": "rw"},
            },
            network="anaconduit_net",
            restart_policy={"Name": "always"},
        )

        return {"status": "installed", "version": clean_v}

    async def ensure_xray_running(self, version: str = "latest") -> Dict[str, Any]:
        """
        Проверяет, запущен ли контейнер Xray нужной версии.
        Если нет — устанавливает и запускает.
        """
        status = await self.get_current_status()
        current_version = status.get("version", "unknown")
        container_state = status.get("status", "exited")

        logger.info(f"Текущий контейнер Xray: {container_state}, версия: {current_version}")

        # Если контейнер не запущен или версия не совпадает
        if container_state != "running" or (version != "latest" and current_version != version.lstrip("v")):
            logger.info(f"♻️ Устанавливаем Xray версии {version}...")
            result = await self.install(version)
            logger.info(f"✅ Xray {result['version']} установлен и запущен")
            return result
        else:
            logger.info(f"✅ Xray уже работает, версия {current_version}")
            return {"status": "already_running", "version": current_version}

    async def get_current_status(self):
        state = await self.docker.get_status(self.CONTAINER_NAME)
        version = "unknown"
        if state == "running":
            try:
                version_raw = await self.docker.exec(self.CONTAINER_NAME, "xray -version")
                if version_raw: version = version_raw.split('\n')[0].split(' ')[1]
            except: pass
        return {"container": self.CONTAINER_NAME, "status": state, "version": version}

    async def restart(self):
        await self.docker.restart(self.CONTAINER_NAME)
        return {"status": "ok"}

    async def start(self): return await self.docker.start(self.CONTAINER_NAME)
    async def stop(self): return await self.docker.stop(self.CONTAINER_NAME)
    async def logs(self, tail: int = 100): return await self.docker.logs(self.CONTAINER_NAME, tail=tail)


    async def generate_reality_keys(self) -> Dict[str, str]:
        private_key = x25519.X25519PrivateKey.generate()
        public_key = private_key.public_key()
        def b64_xray(key_bytes: bytes) -> str:
            return base64.urlsafe_b64encode(key_bytes).decode('utf-8').rstrip('=')
        
        return {
            "private_key": b64_xray(private_key.private_bytes(encoding=serialization.Encoding.Raw, format=serialization.PrivateFormat.Raw, encryption_algorithm=serialization.NoEncryption())),
            "public_key": b64_xray(public_key.public_bytes(encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw))
        }
    

    def generate_config_link(self, client: Client, user: User, inbound: Inbound) -> str:
        domain = settings.panel_domain
        stream = inbound.stream_settings or {}
        net = stream.get("network", "tcp")
        security = stream.get("security", "none")
        
        # Порт для клиента всегда 443 (Nginx Frontend)
        port = 443 
        
        # Базовые параметры
        params = {
            "security": security, 
            "type": net,
            "sni": domain # SNI по умолчанию для TLS
        }

        # ЛОГИКА PORT-IN-PATH (как в x-ui-pro)
        if net in ["ws", "grpc", "xhttp"] and security == "none":
            params["security"] = "tls"
        # Вытаскиваем реальный внутренний порт инбаунда
        inbound_port = inbound.port

        if net == "ws":
            ws = stream.get("wsSettings", {})
            original_path = ws.get("path", "/").lstrip("/")
            # Формируем путь: /порт/оригинальный_путь
            params["path"] = f"/{inbound_port}/{original_path}"
            params["host"] = ws.get("headers", {}).get("Host", domain)
            
        elif net == "grpc":
            grpc = stream.get("grpcSettings", {})
            raw_service = grpc.get("serviceName", "").lstrip("/")
            
            # 1. Добавляем ВЕДУЩИЙ СЛЕШ, как в скрипте
            params["serviceName"] = f"/{inbound_port}/{raw_service}"
            
            # 2. Добавляем authority (критично для gRPC)
            params["authority"] = domain
            
            # 3. SNI тоже оставляем для TLS хендшейка
            params["sni"] = domain
            params["security"] = "tls"
            params["mode"] = "multi" if grpc.get("multiMode") else "gun"
            
        elif net == "xhttp":
            xhttp = stream.get("xhttpSettings", {})
            original_path = xhttp.get("path", "/").lstrip("/")
            
            # ДЛЯ xHTTP БОЛЬШЕ НЕ НУЖЕН /ПОРТ/ В НАЧАЛЕ
            params["path"] = f"/{original_path}"
            params["mode"] = xhttp.get("mode", "packet-up")
            # xHTTP за Nginx всегда требует TLS (или смену на h2)
            params["security"] = "tls" 
            params["sni"] = domain

        # Reality (остается без изменений, так как идет через Stream/TCP)
        if security == "reality":
            reality = stream.get("realitySettings", {})
            params.update({
                "security": "reality",
                "sni": reality.get("serverNames", [domain])[0],
                "pbk": reality.get("publicKey", ""),
                "sid": reality.get("shortIds", [""])[0] if reality.get("shortIds") else "",
                "fp": reality.get("fingerprint", "chrome"),
            })
            if net == "tcp":
                params["flow"] = "xtls-rprx-vision"

        # Очистка и сборка query string
        query_params = {k: v for k, v in params.items() if v}
        query_str = urllib.parse.urlencode(query_params)
        remark = urllib.parse.quote(f"{user.email}@{inbound.tag}")

        if inbound.protocol == "trojan":
            return f"trojan://{client.uuid}@{domain}:{port}?{query_str}#{remark}"
        elif inbound.protocol == "vless":
            return f"vless://{client.uuid}@{domain}:{port}?{query_str}#{remark}"

        return ""

    async def generate_subscription(self, token: str, session: AsyncSessionLocal):
        result = await session.execute(
            select(User)
            .where(User.subscription_token == token)
            .options(joinedload(User.clients).joinedload(Client.inbound))
        )
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        raw_links_list = []

        for client in user.clients:
            if client.inbound.protocol in ["vless", "trojan"]:
                link = self.generate_config_link(client, user, client.inbound)
                raw_links_list.append(link)

        payload = base64.b64encode("\n".join(raw_links_list).encode()).decode()
        
        # Заголовки для отображения трафика в приложении (v2rayNG и др.)
        update_interval = 6 
        remark = urllib.parse.quote(f"Anaconduit: {user.email}")
        headers = {
            "Subscription-Userinfo": (
                f"upload={user.total_up}; download={user.total_down}; "
                f"total={user.traffic_limit}; expire={int(user.expiry_time.timestamp()) if user.expiry_time else 0}"
            ),
            # Указываем клиенту интервал обновления в ЧАСАХ
            "Profile-Update-Interval": str(update_interval),
            "Content-Disposition": f'attachment; filename="{remark}"; filename*=UTF-8\'\'{remark}',
            "Content-Type": "text/plain; charset=utf-8"
        }
        return Response(content=payload, headers=headers)

        
    async def get_active_tags(self) -> List[str]:
        """
        Получает список тегов активных инбаундов из оперативной памяти Xray.
        Используется для сверки состояния БД и реального процесса Xray.
        """
        try:
            # Получаем статистику через gRPC
            all_stats = await self.get_stats()
            
            # Извлекаем уникальные теги из имен счетчиков (формат inbound>>>TAG>>>...)
            active_tags = set()
            for item in all_stats:
                parts = item["name"].split(">>>")
                if parts[0] == "inbound" and parts[1] != "api-in":
                    active_tags.add(parts[1])
            
            logger.info(f"🔍 Активные теги в памяти Xray: {list(active_tags)}")
            return list(active_tags)
        except Exception as e:
            logger.error(f"❌ Не удалось получить активные теги из Xray: {e}")
            return []

    async def check_limits_and_disable(self):
        async with AsyncSessionLocal() as session:
            now = datetime.now()
            # 1. Загружаем ВООБЩЕ ВСЕХ пользователей (и активных, и нет)
            result = await session.execute(
                select(User).options(joinedload(User.clients).joinedload(Client.inbound))
            )
            users = result.scalars().unique().all()

            for user in users:
                total_used = user.total_up + user.total_down
                
                # Проверяем, вписывается ли юзер в лимиты
                time_ok = not user.expiry_time or user.expiry_time > now
                traffic_ok = user.traffic_limit == 0 or total_used < user.traffic_limit

                if user.is_active:
                    # ЛОГИКА ОТКЛЮЧЕНИЯ
                    if not time_ok or not traffic_ok:
                        reason = "срок истек" if not time_ok else "лимит трафика"
                        logger.info(f"🚫 Отключаю: {user.email} ({reason})")
                        user.is_active = False
                        for client in user.clients:
                            await self.remove_client_from_xray(client.inbound.tag, user.email)
                else:
                    # ЛОГИКА ВКЛЮЧЕНИЯ (RE-ENABLE)
                    if time_ok and traffic_ok:
                        # Важно: включаем только если он был выключен системой, а не админом вручную
                        # (Если хочешь, чтобы админское "выкл" было приоритетнее, 
                        # нужно добавить поле в БД типа `manual_disabled`)
                        logger.info(f"✅ Включаю обратно: {user.email} (лимиты обновлены)")
                        user.is_active = True
                        for client in user.clients:
                            try:
                                await self.add_client_to_xray(client.inbound.tag, user.email, client.uuid)
                            except Exception as e:
                                logger.error(f"Ошибка при включении {user.email}: {e}")

            await session.commit()
            # После массового изменения обновляем конфиг на диске
            await self.generate_full_config()

    async def sync_and_restart(self):
        """
        Полная синхронизация: генерирует новый конфиг и перезапускает контейнер.
        Используется при структурных изменениях (удаление/добавление инбаундов).
        """
        try:
            logger.info("♻️ Запуск полной синхронизации и рестарта Xray...")
            
            # 1. Пересобираем config.json на основе текущего состояния БД
            await self.generate_full_config()
            
            # 2. Перезапускаем контейнер через DockerService
            await self.docker.restart(self.CONTAINER_NAME)
            
            logger.info("✅ Xray успешно перезапущен с обновленным конфигом")
            return {"status": "ok", "message": "Xray synced and restarted"}
        except Exception as e:
            logger.error(f"❌ Ошибка при выполнении sync_and_restart: {e}")
            raise Exception(f"Failed to sync and restart Xray: {e}")



    async def validate_config(self, config_to_test: dict, filename: str = "custom.json") -> bool:
        """
        Проверяет валидность конфига с помощью команды 'xray test'.
        """
        # 1. Создаем временный файл для теста, чтобы не затереть текущий рабочий
        test_filename = f"test_{filename}"
        test_path = self.internal_xray_dir / test_filename
        
        try:
            with open(test_path, "w") as f:
                json.dump(config_to_test, f)

            # 2. Запускаем одноразовый контейнер для проверки
            # Мы монтируем ту же папку и просим xray проверить её
            # Флаг --rm в Docker SDK не всегда удобен, поэтому удалим вручную
            test_container_name = "xray_validator"
            
            # Используем текущую версию образа (или последнюю)
            image = "teddysun/xray:latest" 
            
            def _run_test():
                #import docker
                docker_client = self.docker.client 
                
                try:
                    # Меняем команду на классический синтаксис флагов
                    # Флаг -confdir говорит откуда брать файлы, -test запускает проверку
                    docker_client.containers.run(
                        image="teddysun/xray:latest",
                        command="xray -test -confdir /etc/xray",  # <--- Исправлено здесь
                        volumes={
                            self.host_xray_dir: {"bind": "/etc/xray", "mode": "ro"},
                            self.host_log_dir: {"bind": "/var/log/xray", "mode": "ro"}, # Используем реальный путь
                            self.host_sockets_dir: {"bind": "/run/xray", "mode": "ro"}
                        },
                        remove=True,
                        network_disabled=True
                    )
                    return True, "OK"
                except docker.errors.ContainerError as e:
                    # Если Xray найдет ошибку в JSON, он выведет её в stderr
                    return False, e.stderr.decode()
                except Exception as e:
                    return False, str(e)

            is_ok, message = await anyio.to_thread.run_sync(_run_test)
            
            if not is_ok:
                logger.error(f"❌ Ошибка валидации конфига: {message}")
                return False, message
                
            return True, "OK"

        finally:
            # Чистим за собой временный файл
            if test_path.exists():
                test_path.unlink()
                
    async def update_inbound(self, inbound_id: int, update_data: Dict[str, Any]):
        async with AsyncSessionLocal() as session:
            # 1. Находим инбаунд в рамках ЭТОЙ сессии
            result = await session.execute(select(Inbound).where(Inbound.id == inbound_id))
            ib = result.scalars().first()
            if not ib: raise ValueError("Inbound not found")

            # 2. Обновляем объект в ПАМЯТИ (в БД еще старые данные)
            for key, value in update_data.items():
                if hasattr(ib, key):
                    setattr(ib, key, value)

            # 3. Генерируем DTO (он увидит обновленного ib благодаря переданной сессии)
            test_config = await self.generate_full_config_dto(session)

            # 4. Валидируем "мнимый" конфиг через временный запуск Xray
            is_ok, error_msg = await self.validate_config(test_config)
            
            if not is_ok:
                # ВАЖНО: Если тут ошибка, мы ничего не комитим!
                logger.error(f"❌ Валидация не прошла: {error_msg}")
                raise ValueError(f"Xray config is invalid: {error_msg}")

            # 5. Если всё супер — сохраняем изменения в БД
            await session.commit()
            
            # 6. Теперь можно смело писать на диск и рестартить
            await self._save_config_async(test_config)
            return await self.restart()
