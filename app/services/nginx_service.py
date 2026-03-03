import anyio
import logging
import socket
import os
import re
from app.core.config import settings
from app.services.docker_service import DockerService

logger = logging.getLogger(__name__)

class NginxService:
    CONTAINER_NAME = "nginx"
    IMAGE = "nginx:latest" # Используем официальный стабильный образ

    def __init__(self):
        self.docker = DockerService()
        self.base_dir = settings.internal_data_path / "nginx"
        self.conf_d = self.base_dir / "conf.d"
        self.stream_d = self.base_dir / "stream-enabled"
        self.sites_a_d = self.base_dir / "sites-available"
        self.sites_e_d = self.base_dir / "sites-enabled"
        self.snippets = self.base_dir / "snippets"
        self.certs_dir = self.base_dir / "certs" # Папка для certbot
        
        for p in [self.conf_d, self.stream_d, self.snippets, self.certs_dir, self.sites_a_d, self.sites_e_d]:
            p.mkdir(parents=True, exist_ok=True)

        self.domain = settings.panel_domain
        self.reality_domain = settings.reality_dest_domain
        self.panel_port = "8000"
        self.panel_path = settings.panel_secret_path.strip("/")
        
        # Параметры путей
        self.sub_path = settings.sub_path.strip('/')
        self.sub_port = "8000"
        self.escaped_domain = re.escape(self.domain)
        self.escaped_reality = re.escape(self.reality_domain)

    async def _write(self, path, content: str):
        await anyio.to_thread.run_sync(lambda: path.write_text(content.strip()))

    async def _symlink(self, src, dst):
        def create():
            if dst.exists() or dst.is_symlink():
                dst.unlink()
            os.symlink(src.resolve(), dst)  # resolve() превращает в абсолютный путь
        await anyio.to_thread.run_sync(create)

    
    async def generate_main_nginx_conf(self):
        # Модуль stream в официальном образе nginx:latest уже встроен.
        # Удаляем строки load_module, чтобы не было ошибки dlopen().
        content = f"""
user nginx;
worker_processes auto;
pid /run/nginx.pid;

events {{
    worker_connections 4096;
}}

stream {{
    include /etc/nginx/stream-enabled/*.conf;
}}

http {{
    include       mime.types;
    default_type  application/octet-stream;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    keepalive_timeout 65;

    include /etc/nginx/sites-enabled/*;
}}
"""
        await self._write(self.base_dir / "nginx.conf", content)

    async def generate_stream_conf(self):
        content = f"""
map $ssl_preread_server_name $backend_name {{
    hostnames;

    {self.reality_domain}   xray;
    {self.domain}           web;

    default                 xray;
}}

upstream xray {{
    server anaconduit_xray:8443;
}}

upstream web {{
    server 127.0.0.1:7443;
}}

server {{
    listen          443;
    proxy_pass      $backend_name;
    ssl_preread     on;
    proxy_protocol  on;
}}
"""
        await self._write(self.stream_d / "00-sni-router.conf", content)

    

    async def generate_sites_available_conf(self):
        
        redirect_conf = f"""
server {{
    listen 80;
    server_name {self.domain} {self.reality_domain};

    return 301 https://$host$request_uri;
}}
        """


        # Конфиг основного домена (Панель + Подписки)
        domain_conf = f"""
server {{
    listen 7443 ssl http2 proxy_protocol;
    listen [::]:7443 ssl http2 proxy_protocol;

    server_name {self.domain};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_certificate     /etc/nginx/certs/{self.domain}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/{self.domain}/privkey.pem;

    server_tokens off;

    if ($host !~* ^(.+\\.)?{self.escaped_domain}$ ){{ return 444; }}

    location / {{
        proxy_pass http://anaconduit_backend:{self.panel_port};
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $proxy_protocol_addr;
        proxy_set_header X-Forwarded-For $proxy_protocol_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    include /etc/nginx/snippets/xui-common-locations.conf;
}}
"""
        # Конфиг домена маскировки (Reality Dest)
        reality_conf = f"""
server {{
    listen 9443 ssl http2;
    listen [::]:9443 ssl http2;

    server_name {self.reality_domain};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_certificate     /etc/nginx/certs/{self.reality_domain}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/{self.reality_domain}/privkey.pem;

    server_tokens off;

    if ($host !~* ^(.+\.)?{self.escaped_reality}$ ){{ return 444; }}

    include /etc/nginx/snippets/xui-common-locations.conf;
}}
"""
        await self._write(self.sites_a_d / f"80-redirect.conf", redirect_conf)
        await self._write(self.sites_a_d / f"main-domain.conf", domain_conf)
        await self._write(self.sites_a_d / f"reality-domain.conf", reality_conf)

    async def generate_snippet(self):

        content = f"""
########################################
# Панель
########################################

location /{self.panel_path}/ {{
    proxy_pass http://anaconduit_backend:{self.panel_port}/;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $proxy_protocol_addr;
    proxy_set_header X-Forwarded-For $proxy_protocol_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}}

########################################
# Подписки
########################################

location /{self.sub_path}/ {{
    proxy_pass http://anaconduit_backend:{self.sub_port}/;
}}

########################################
# WebSocket forwarder
########################################

location ~ ^/(?<fwdport>\\d+)/(?<fwdpath>.*)$ {{

    proxy_http_version 1.1;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_pass http://anaconduit_xray:$fwdport;
}}
"""

        await self._write(self.snippets / "xui-common-locations.conf", content)

    async def generate_symlinks(self):
        await self._symlink(
            self.sites_a_d / "main-domain.conf",
            self.sites_e_d / "main-domain.conf"
        )

        await self._symlink(
            self.sites_a_d / "reality-domain.conf",
            self.sites_e_d / "reality-domain.conf"
        )

        await self._symlink(
            self.sites_a_d / "80-redirect.conf",
            self.sites_e_d / "80-redirect.conf"
        )
    async def apply_all(self):
        # 1. Генерация конфигов
        await self.generate_main_nginx_conf()
        await self.generate_stream_conf()
        await self.generate_sites_available_conf()
        await self.generate_symlinks()
        await self.generate_snippet()
        logger.info("✅ Конфиги Nginx сгенерированы")
    
        # 2. Если контейнер уже запущен — reload
        if await self.docker.get_status(self.CONTAINER_NAME) == "running":
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")
            logger.info("♻️ Nginx перезагружен")

    async def install_and_run(self):
        await self.apply_all()  # Генерация конфигов и сниппетов

        host_path = f"{settings.host_data_path}/nginx"
        volumes = {
            f"{host_path}/nginx.conf": {"bind": "/etc/nginx/nginx.conf", "mode": "ro"},
            f"{host_path}/conf.d": {"bind": "/etc/nginx/conf.d", "mode": "rw"},
            f"{host_path}/stream-enabled": {"bind": "/etc/nginx/stream-enabled", "mode": "rw"},
            f"{host_path}/snippets": {"bind": "/etc/nginx/snippets", "mode": "rw"},
            f"{host_path}/certs": {"bind": "/etc/nginx/certs", "mode": "ro"},
            f"{host_path}/www": {"bind": "/var/www/certbot", "mode": "rw"},
            f"{host_path}/sites-available": {"bind": "/etc/nginx/sites-available", "mode": "rw"},
            f"{host_path}/sites-enabled": {"bind": "/etc/nginx/sites-enabled", "mode": "rw"},
        }

        # Удаляем старый контейнер, если есть
        await self.docker.remove_container(self.CONTAINER_NAME)

        container = await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=self.IMAGE,
            ports={"80/tcp": 80, "443/tcp": 443},
            volumes=volumes,
            network="anaconduit_net",
            restart_policy={"Name": "always"},
        )
        return container

    async def start(self):
        return await self.docker.start(self.CONTAINER_NAME)

    async def stop(self):
        return await self.docker.stop(self.CONTAINER_NAME)

    async def restart(self):
        return await self.docker.restart(self.CONTAINER_NAME)

    async def logs(self, tail: int = 100):
        return await self.docker.logs(self.CONTAINER_NAME, tail=tail)

    async def ensure_nginx_running(self):
        status = await self.docker.get_status(self.CONTAINER_NAME)
        if status != "running":
            logger.info("🚀 Запуск Nginx контейнера")
            await self.install_and_run()
