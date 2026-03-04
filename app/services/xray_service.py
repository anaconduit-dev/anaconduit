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
from typing import List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy import update, select
from sqlalchemy.orm import joinedload
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519

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

    async def generate_full_config(self):
        # Внутри контейнера логи будут лежать здесь:
        container_access_log = "/var/log/xray/access.log"
        container_error_log = "/var/log/xray/error.log"

        config = {
            "log": {
                "loglevel": "warning",
                "access": "none",
                "error": "" 
              },
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
        
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Inbound).where(Inbound.is_active == True))
            db_inbounds = result.scalars().all()
            
            NGINX_INTERNAL_PORT = 80 
            NGINX_HOST = "nginx"

            for ib in db_inbounds:
                network_type = ib.stream_settings.get("network", "tcp")
                security_type = ib.stream_settings.get("security", "none")

                clean_stream_settings = ib.stream_settings.copy()

                # --- ЛОГИКА ВЗАИМОДЕЙСТВИЯ С NGINX ---
                if security_type == "reality":
                    reality_settings = clean_stream_settings.get("realitySettings", {})
                    current_dest = reality_settings.get("dest", "")
                    
                    # Если домен совпадает — подменяем на локальный порт
                    if settings.reality_dest_domain in current_dest:
                        reality_settings["dest"] = "nginx:9443"
                        # Убеждаемся, что изменения применились к словарю
                        clean_stream_settings["realitySettings"] = reality_settings
                
                is_proxied = network_type in ["ws", "grpc", "xhttp"] and security_type == "none"
                
                if is_proxied:
                    # Заставляем инбаунд слушать только локальные запросы от Nginx
                    # В идеале тут использовать Unix Sockets: f"/dev/shm/{ib.tag}.sock,0666"
                    ib.listen = "127.0.0.1" 
                    
                    # Убираем sniffing, так как Nginx уже расшифровал трафик
                    ib.sniffing["enabled"] = False

                client_result = await session.execute(
                    select(Client)
                    .join(User)
                    .options(joinedload(Client.user))
                    .where(Client.inbound_id == ib.id, Client.enable == True, User.is_active == True)
                )
                db_clients = client_result.scalars().all()
                
                # Используем наш генератор имен для консистентности
                xray_clients = []
                for c in db_clients:
                    client_dict = {
                        "email": self._get_xray_email(c.user.email, ib.tag),
                        "level": c.level,
                    }
                    if ib.protocol == "vless":
                        client_dict["id"] = c.uuid  # Для VLESS нужен именно 'id'
                        # КРИТИЧНО: Flow только для VLESS + TCP/RAW + (Reality/TLS)
                        if network_type == "tcp" and security_type in ["reality", "tls"]:
                            client_dict["flow"] = c.flow if c.flow else ""
                        else:
                            # Для gRPC, WS и XHTTP поле flow должно отсутствовать
                            if "flow" in client_dict: del client_dict["flow"]

                    elif ib.protocol == "trojan":
                        client_dict["password"] = c.uuid
                    
                    if c.reverse and isinstance(c.reverse, dict) and len(c.reverse) > 0:
                        client_dict["reverse"] = c.reverse
                    
                    xray_clients.append(client_dict)
                clean_stream_settings = ib.stream_settings.copy()
                
                # Удаляем настройки других транспортов, чтобы не было конфликтов
                # Если выбрали xhttp, grpcSettings нам не нужны
                transport_keys = ["tcpSettings", "wsSettings", "grpcSettings", "xhttpSettings"]
                current_transport_key = f"{network_type}Settings"
                
                for key in transport_keys:
                    if key != current_transport_key and key in clean_stream_settings:
                        del clean_stream_settings[key]
                inbound_settings = ib.settings.copy()

                if ib.protocol == "vless" and network_type != "tcp":
                    if "flow" in inbound_settings:
                        del inbound_settings["flow"]
                xray_inbound = {
                    "listen": ib.listen,
                    "tag": ib.tag,
                    "port": ib.port,
                    "protocol": ib.protocol,
                    "settings": inbound_settings,
                    "streamSettings": clean_stream_settings, # Используем очищенные настройки
                    "sniffing": ib.sniffing or {"enabled": True, "destOverride": ["http", "tls"]}
                }
                
                xray_inbound["settings"]["clients"] = xray_clients
                if "sniffing" in xray_inbound and "domainsExcluded" in xray_inbound["sniffing"]:
                    # Очищаем список от пустых строк
                    xray_inbound["sniffing"]["domainsExcluded"] = [
                        d for d in xray_inbound["sniffing"]["domainsExcluded"] if d.strip() != ""
                    ]
                network_type = ib.stream_settings.get("network", "tcp") 

                if network_type != "grpc" and not xray_inbound["settings"].get("fallbacks"):
                    xray_inbound["settings"]["fallbacks"] = [{"dest": FRONTEND_INTERNAL_PORT, "xver": 0}]

                config["inbounds"].append(xray_inbound)

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

    # app/services/xray_service.py

    async def update_stats_in_db(self):
        """
        Запрашивает инкрементальную статистику (reset=True) и сохраняет в БД.
        """
        # Запрашиваем статистику через gRPC. 
        
        stats_list = await self.client.get_stats(reset=True) 
        if not stats_list:
            return

        async with AsyncSessionLocal() as session:
            for item in stats_list:
                # Парсим имя счетчика: "user>>>email@test.com#tag>>>traffic>>>downlink"
                parts = item["name"].split(">>>")
                if parts[0] != "user":
                    continue

                full_id = parts[1].lower()
                direction = parts[3] # uplink или downlink
                value = int(item["value"]) #байты

                if value <= 0 or "#" not in full_id:
                    continue

                email, tag = full_id.split("#")

                # Ищем клиента в БД
                result = await session.execute(
                    select(Client).join(User).join(Inbound)
                    .where(User.email == email, Inbound.tag == tag)
                )
                client = result.scalars().first()

                if client:
                    # 1. Обновляем статистику конкретного клиента (ключа)
                    if direction == "uplink":
                        client.up += value
                    else:
                        client.down += value
                    
                    # 2. Обновляем агрегированную статистику владельца (User)
                    await session.execute(
                        update(User)
                        .where(User.id == client.user_id)
                        .values(
                            total_up=User.total_up + (value if direction == "uplink" else 0),
                            total_down=User.total_down + (value if direction == "downlink" else 0)
                        )
                    )

            await session.commit()
            logger.info(f"📊 Статистика успешно синхронизирована с БД.")

    # ---------- Контейнер и Жизненный цикл ----------

    async def install(self, version: str) -> Dict[str, Any]:
        await self.generate_full_config()
        # 1. Настройка путей для логов
        # settings.host_data_path обычно указывает на /home/vpsadmin/data/anaconduit
        host_log_dir = os.path.join(os.path.dirname(self.host_xray_dir), "xray_log")
        
        os.makedirs(host_log_dir, exist_ok=True)
        
        
            

        # Гарантируем наличие custom.json
        custom_config_path = self.internal_xray_dir / "custom.json"
        if not custom_config_path.exists():
            with open(custom_config_path, "w") as f:
                json.dump({"inbounds": []}, f)
            

        # lstrip('v') гарантирует, что мы не получим 'teddysun/xray:vv1.8.4'
        clean_v = version.lstrip('v')
        image = f"teddysun/xray:{clean_v}"
        
        await self.docker.remove_container(self.CONTAINER_NAME)
        
        container = await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=image,
            command="xray -confdir /etc/xray",
            ports={}, 
            volumes={
                self.host_xray_dir: {"bind": "/etc/xray", "mode": "rw"},
                host_log_dir: {"bind": "/var/log/xray", "mode": "rw"} 
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
    
        stream = inbound.stream_settings
        net = stream.get("network", "tcp")
        security = stream.get("security", "none")
    
        # Порт учитывает Nginx
        port = 443 
    
        # Базовые параметры
        params = {"security": security, "type": net}
    
        # Транспортные настройки
        if net == "ws":
            ws = stream.get("wsSettings", {})
            params["path"] = ws.get("path", "/")
            params["host"] = ws.get("headers", {}).get("Host", domain)
        elif net == "grpc":
            grpc = stream.get("grpcSettings", {})
            params["serviceName"] = grpc.get("serviceName", "")
            params["mode"] = "multi" if grpc.get("multiMode") else "gun"
        elif net == "xhttp":
            xhttp = stream.get("xhttpSettings", {})
            params["path"] = xhttp.get("path", "/")
            params["mode"] = xhttp.get("mode", "stream-up")
    
        # Reality
        if security == "reality":
            reality = stream.get("realitySettings", {})
            params.update({
                "security": "reality",
                "sni": reality.get("serverNames", [domain])[0],
                "pbk": reality.get("publicKey", ""),
                "sid": reality.get("shortIds", [""])[0] if reality.get("shortIds") else "",
                "fp": reality.get("fingerprint", "chrome"),
            })
            # Если TCP + Reality, принудительно flow
            if net == "tcp":
                params["flow"] = "xtls-rprx-vision"
    
        # Очистка пустых параметров
        query_params = {k: v for k, v in params.items() if v}
        query_str = urllib.parse.urlencode(query_params)
    
        # Remark
        remark = urllib.parse.quote(f"{user.email}@{inbound.tag}")
    
        # Формат ссылки
        if inbound.protocol == "trojan":
            return f"trojan://{client.uuid}@{domain}:{port}?{query_str}#{remark}"
        elif inbound.protocol == "vless":
            return f"vless://{client.uuid}@{domain}:{port}?{query_str}#{remark}"
    
        return ""

    def generate_subscription(self, client_links: List[str]) -> str:
        """Собирает список ссылок в Base64 строку (формат V2Ray подписки)"""
        combined = "\n".join(client_links)
        return base64.b64encode(combined.encode('utf-8')).decode('utf-8')

        
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
                            self.host_log_dir: {"bind": "/var/log/xray", "mode": "ro"} # Используем реальный путь
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



