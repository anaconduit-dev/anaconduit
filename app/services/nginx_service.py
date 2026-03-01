import anyio
import logging
import socket
import os
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
        self.snippets = self.base_dir / "snippets"
        self.certs_dir = self.base_dir / "certs" # Папка для certbot
        
        for p in [self.conf_d, self.stream_d, self.snippets, self.certs_dir]:
            p.mkdir(parents=True, exist_ok=True)

        self.domain = settings.panel_domain
        self.reality_domain = settings.reality_dest_domain
        self.panel_port = "8000"
        self.panel_path = settings.panel_secret_path.strip("/")
        
        # Параметры путей
        self.sub_path = settings.sub_path.strip('/')
        self.sub_port = "8000"

    async def _write(self, path, content: str):
        await anyio.to_thread.run_sync(lambda: path.write_text(content.strip()))

    async def generate_stream_conf(self):
        # 1. Формируем логику маппинга
       content = f"""
map $ssl_preread_server_name $backend_name {{
    hostnames;
    {self.reality_domain}      anaconduit_xray:8443;
    {self.domain}              127.0.0.1:7443;
    default                    anaconduit_xray:8443;
}}

server {{
    listen          443;
    proxy_pass      $backend_name;
    ssl_preread     on;
    proxy_protocol  on;
    # set_real_ip_from для стрима в докере обычно не критичен, но оставим логику
}}
"""
        await self._write(self.stream_d / "stream.conf", content)

    async def generate_main_nginx_conf(self):
        # Модуль stream в официальном образе nginx:latest уже встроен.
        # Удаляем строки load_module, чтобы не было ошибки dlopen().
        content = f"""
user  nginx;
worker_processes  auto;
worker_rlimit_nofile 16384;

events {{
    worker_connections  4096;
}}

stream {{
    resolver 127.0.0.11 valid=30s;
    include /etc/nginx/stream-enabled/*.conf;
}}

http {{
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    # Редирект с 80 на 443
    server {{
        listen 80;
        server_name {self.domain} {self.reality_domain};
        location /.well-known/acme-challenge/ {{
            root /var/www/certbot;
        }}
        location / {{
            return 301 https://$host$request_uri;
        }}
    }}

    include /etc/nginx/conf.d/*.conf;
}}
"""
        await self._write(self.base_dir / "nginx.conf", content)

    async def generate_sites_conf(self):
        # Пути к сертификатам внутри контейнера (соответствуют volume в install.sh)
        ssl_path = f"/etc/nginx/certs/live/{self.domain}"
        
        ssl_block = f"""
    ssl_certificate {ssl_path}/fullchain.pem;
    ssl_certificate_key {ssl_path}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!eNULL:!MD5:!DES:!RC4:!ADH:!SSLv3:!EXP:!PSK:!DSS;
    ssl_prefer_server_ciphers on;
"""

        # Конфиг основного домена (Панель + Подписки)
        domain_conf = f"""
server {{
    listen 7443 ssl http2 proxy_protocol;
    server_name {self.domain};
    {ssl_block}

    server_tokens off;
    
    # Защита от хаков (из твоего примера)
    if ($request_uri ~ "(\\"|'|`|~|,|:|--|;|%|\\$|&&|\\?\\?|0x00|0X00|\\||\\\\|\\{{|\\}}|\\[|\\]|<|>|\\.\\.\\.|\\.\\.\\/|\\/\\/\\/)") {{ set $hack 1; }}

    # Админка
    location /{self.panel_path}/ {{
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://anaconduit_backend:{self.panel_port};
    }}

    # Подписки и остальное
    include /etc/nginx/snippets/includes.conf;
}}
"""
        # Конфиг домена маскировки (Reality Dest)
        reality_ssl_path = f"/etc/nginx/certs/live/{self.reality_domain}"
        reality_conf = f"""
server {{
    listen 9443 ssl http2;
    server_name {self.reality_domain};
    ssl_certificate {reality_ssl_path}/fullchain.pem;
    ssl_certificate_key {reality_ssl_path}/privkey.pem;

    location / {{
        root /var/www/html;
        index index.html;
    }}
}}
"""
        await self._write(self.conf_d / f"{self.domain}.conf", domain_conf)
        await self._write(self.conf_d / f"{self.reality_domain}.conf", reality_conf)

    async def apply_all(self):
        await self.generate_main_nginx_conf()
        await self.generate_stream_conf()
        await self.generate_sites_conf()
        # Сниппеты можно оставить пустыми или с доп. логикой
        await self._write(self.snippets / "includes.conf", "# Empty for now")
        
        if await self.docker.get_status(self.CONTAINER_NAME) == "running":
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")
        else:
            await self.install_and_run()

    async def install_and_run(self):
        host_path = f"{settings.host_data_path}/nginx"
        volumes = {
            f"{host_path}/nginx.conf": {"bind": "/etc/nginx/nginx.conf", "mode": "ro"},
            f"{host_path}/conf.d": {"bind": "/etc/nginx/conf.d", "mode": "rw"},
            f"{host_path}/stream-enabled": {"bind": "/etc/nginx/stream-enabled", "mode": "rw"},
            f"{host_path}/snippets": {"bind": "/etc/nginx/snippets", "mode": "rw"},
            f"{host_path}/certs": {"bind": "/etc/nginx/certs", "mode": "ro"}, # Сертификаты от Certbot
            f"{host_path}/www": {"bind": "/var/www/certbot", "mode": "rw"}, # Для проверки Certbot
        }

        return await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=self.IMAGE,
            ports={"80/tcp": 80, "443/tcp": 443},
            volumes=volumes,
            network="anaconduit_net"
        )
