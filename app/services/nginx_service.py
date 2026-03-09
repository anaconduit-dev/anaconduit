import anyio
import logging
import socket
import os
import re
from sqlalchemy import select
from app.models.models import Inbound
from app.core.config import settings
from app.services.docker_service import DockerService
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

class NginxService:
    CONTAINER_NAME = "nginx"
    IMAGE = "nginx:latest"

    def __init__(self):
        self.docker = DockerService()
        self.base_dir = settings.internal_data_path / "nginx"
        self.conf_d = self.base_dir / "conf.d"
        self.stream_d = self.base_dir / "stream-enabled"
        self.sites_a_d = self.base_dir / "sites-available"
        self.sites_e_d = self.base_dir / "sites-enabled"
        self.snippets = self.base_dir / "snippets"
        self.certs_dir = self.base_dir / "certs"

        

        self.domain = settings.panel_domain
        self.reality_domain = settings.reality_dest_domain
        self.panel_port = "8000"
        self.panel_path = settings.panel_secret_path.strip("/")
        self.sub_path = settings.sub_path.strip('/')
        self.sub_port = "8000"
        self.escaped_domain = re.escape(self.domain)
        self.escaped_reality = re.escape(self.reality_domain)
        self.static_inbounds = [
            {
                "sni": self.domain,           
                "port": 7443,
                "name": "web",
                "backend_host": "nginx"
            }
        ]

    async def _write(self, path, content: str):
        await anyio.to_thread.run_sync(lambda: path.write_text(content.strip()))

    async def _symlink(self, src, dst):
        def create():
            if not src.exists():
                raise FileNotFoundError(f"Source file for symlink does not exist: {src}")
            if dst.exists() or dst.is_symlink():
                dst.unlink()
            os.symlink(src.resolve(), dst)
        await anyio.to_thread.run_sync(create)

    async def ensure_directories(self):
        dirs = [
            self.base_dir,
            self.conf_d,
            self.stream_d,
            self.sites_a_d,
            self.sites_e_d,
            self.snippets,
            self.certs_dir,
        ]
    
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)


    async def generate_placeholder_page(self):
        html_dir = self.base_dir / "www"
        html_dir.mkdir(parents=True, exist_ok=True)
    
        index_file = html_dir / "index.html"
        content = f"""
<!DOCTYPE html>
<html lang="en">
<head>    
<meta charset="UTF-8">
<title>Site Placeholder</title>
<style>
body {{ font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }}
h1 {{ color: #333; }}
p {{ color: #666; }}
</style>
</head>
<body>
<h1>Welcome to {self.domain}</h1>
<p>This is a placeholder page.</p>
</body>
</html>
"""
        await self._write(index_file, content)
        logger.info(f"📝 Placeholder page generated at {index_file}")
    
    async def generate_main_nginx_conf(self):
        content = f"""
user nginx;
worker_processes auto;
pid /run/nginx.pid;

events {{
    worker_connections 4096;
}}

stream {{
    resolver 127.0.0.11 valid=30s;
    include /etc/nginx/stream-enabled/*.conf;
}}

http {{
    include       mime.types;
    default_type  application/octet-stream;

    # Маппинг для корректного WebSocket
    map $http_upgrade $connection_upgrade {{
        default upgrade;
        ''      close;
    }}

    http2_max_concurrent_streams 1000;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    keepalive_timeout 65;
    include /etc/nginx/sites-enabled/*;
}}
"""
        await self._write(self.base_dir / "nginx.conf", content)

    def normalize_sni(self, sni: str) -> str:
        if not sni:
            return ""

        sni = sni.split(":")[0]
        return sni.lower().strip()

    async def load_reality_inbounds(self, session: AsyncSessionLocal):
        """
        Загружает список SNI/портов из базы.
        Возвращает [{"sni": ..., "port": ...}]
        """
        inbounds = []

        try:
            result = await session.execute(
                select(Inbound).filter_by(is_active=True)
            )
            db_inbounds = result.scalars().all()

            for ib in db_inbounds:
                stream_settings = ib.stream_settings or {}
                security_type = stream_settings.get("security")

                if security_type != "reality":
                    continue

                reality_settings = stream_settings.get("realitySettings", {})

                server_names = reality_settings.get("serverNames", [])

                for sni in server_names:
                    sni = self.normalize_sni(sni)

                    if sni:
                        inbounds.append({
                            "sni": sni,
                            "port": ib.port
                        })

        except Exception as e:
            logger.error(f"❌ Ошибка при получении inbounds из БД: {e}")

        if not inbounds:
            inbounds.append({"sni": "fallback", "port": 8443})
            logger.warning("⚠ No reality inbounds found, using fallback")

        return inbounds


    def build_stream_blocks(self, inbounds):
        all_inbounds = inbounds + self.static_inbounds

        map_entries = []
        seen = set()

        for inbound in all_inbounds:
            sni = inbound["sni"]
            port = inbound["port"]
            backend_host = inbound.get("backend_host", "anaconduit_xray")

            if sni in seen:
                continue
            seen.add(sni)

            map_entries.append(
                f"    {sni} {backend_host}:{port};"
            )

        return map_entries


    async def generate_stream_conf(self):
        async with AsyncSessionLocal() as session:
            inbounds = await self.load_reality_inbounds(session)
        
        map_entries = self.build_stream_blocks(inbounds)

        content = f"""
map $ssl_preread_server_name $backend {{
    hostnames;

{chr(10).join(map_entries)}

    default anaconduit_xray:8443;
}}

server {{
    listen 443;

    proxy_pass $backend;

    ssl_preread on;
    proxy_protocol on;
}}
"""
        await self._write(self.stream_d / "00-sni-router.conf", content)
        logger.info("✅ Stream config generated with dynamic SNI + static panel")

    async def generate_sites_available_conf(self):
        redirect_conf = f"""
server {{
    listen 80;
    server_name {self.domain} {self.reality_domain};

    return 301 https://$host$request_uri;
}}
"""
        domain_conf = fr"""
server {{
    listen 7443 ssl proxy_protocol;
    listen [::]:7443 ssl proxy_protocol;
    http2 on;

    server_name {self.domain};
    port_in_redirect off;

    root /var/www/html/;
    index index.html index.htm;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_certificate     /etc/nginx/certs/{self.domain}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/{self.domain}/privkey.pem;

    server_tokens off;

    if ($host !~* ^(.+\.)?{self.escaped_domain}$ ){{ return 444; }}

    # Заглушка для корня
    location / {{
        root /var/www/html/;
        index index.html;
        try_files $uri /index.html;
    }}
        
    location /{self.panel_path} {{
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
        reality_conf = fr"""
server {{
    listen 9443 ssl;
    listen [::]:9443 ssl;
    http2 on;

    server_name {self.reality_domain};
    root /var/www/html/;
    index index.html index.htm;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_certificate     /etc/nginx/certs/{self.reality_domain}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/{self.reality_domain}/privkey.pem;

    server_tokens off;

    if ($host !~* ^(.+\.)?{self.escaped_reality}$ ){{ return 444; }}

    location / {{
        root /var/www/html/;
        index index.html;
        try_files $uri /index.html;
    }}
    location /xray_port/ {{
        proxy_pass http://anaconduit_xray:$fwdport;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $proxy_protocol_addr;
        proxy_set_header X-Forwarded-For $proxy_protocol_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
    include /etc/nginx/snippets/xui-common-locations.conf;
}}
"""
        await self._write(self.sites_a_d / "80-redirect.conf", redirect_conf)
        await self._write(self.sites_a_d / "main-domain.conf", domain_conf)
        await self._write(self.sites_a_d / "reality-domain.conf", reality_conf)
    
    
    async def generate_snippet(self):
        content = f"""
location ~ ^/(?P<fwdport>\\d+)/ {{
    resolver 127.0.0.11 valid=30s;
    
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
    
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    if ($content_type ~* "grpc") {{
        grpc_pass grpc://anaconduit_xray:$fwdport;
        break;
    }}

    # ВАЖНО: Мы убираем переменную из конца. 
    # Nginx сам передаст полный оригинальный URI (например, /54420/57177/...)
    proxy_pass http://anaconduit_xray:$fwdport;
}}
"""    
        await self._write(self.snippets / "xui-common-locations.conf", content)

    async def generate_symlinks(self):
        # Список файлов, которые нужно активировать
        configs = ["main-domain.conf", "reality-domain.conf", "80-redirect.conf"]
        
        def create_relative_links():
            for name in configs:
                dst = self.sites_e_d / name
                # Относительный путь: подняться на уровень выше и зайти в sites-available
                # Это будет работать и на хосте, и внутри контейнера
                src_relative = f"../sites-available/{name}"
                
                # Удаляем старый линк или файл, если он есть
                if dst.exists() or dst.is_symlink():
                    dst.unlink()
                
                # Создаем симлинк
                os.symlink(src_relative, dst)
                logger.info(f"🔗 Создан симлинк: {name} -> {src_relative}")

        await anyio.to_thread.run_sync(create_relative_links)
    async def get_current_status(self):
        state = await self.docker.get_status(self.CONTAINER_NAME)
        version = "unknown"
        if state == "running":
            try:
                version_raw = await self.docker.exec(self.CONTAINER_NAME, "nginx -version")
                if version_raw: version = version_raw.split(' ')[2].split('/')[1]
            except: pass
        return {"container": self.CONTAINER_NAME, "status": state, "version": version}
        
    async def apply_all(self):
        await self.ensure_directories()
        await self.generate_placeholder_page()
        await self.generate_main_nginx_conf()
        await self.generate_stream_conf()
        await self.generate_sites_available_conf()
        await self.generate_snippet()        # сначала сниппеты
        await self.generate_symlinks()       # потом симлинки
        logger.info("✅ Конфиги Nginx сгенерированы")

        if await self.docker.get_status(self.CONTAINER_NAME) == "running":
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")
            logger.info("♻️ Nginx перезагружен")

    async def install_and_run(self):
        
        host_nginx_dir = f"{settings.host_data_path}/nginx"
        await self.docker.remove_container(self.CONTAINER_NAME)
        await self.apply_all()
        mime_path = self.base_dir / "mime.types"
        if not mime_path.exists():
            mime_content = "types { text/html html; text/css css; application/javascript js; image/png png; }"
            await self._write(mime_path, mime_content)

        volumes = {
            f"{host_nginx_dir}/nginx.conf": {"bind": "/etc/nginx/nginx.conf", "mode": "ro"},
            f"{host_nginx_dir}/conf.d": {"bind": "/etc/nginx/conf.d", "mode": "rw"},
            f"{host_nginx_dir}/stream-enabled": {"bind": "/etc/nginx/stream-enabled", "mode": "rw"},
            f"{host_nginx_dir}/snippets": {"bind": "/etc/nginx/snippets", "mode": "rw"},
            f"{host_nginx_dir}/certs": {"bind": "/etc/nginx/certs", "mode": "ro"},
            f"{host_nginx_dir}/www": {"bind": "/var/www/html", "mode": "rw"},
            f"{host_nginx_dir}/sites-available": {"bind": "/etc/nginx/sites-available", "mode": "rw"},
            f"{host_nginx_dir}/sites-enabled": {"bind": "/etc/nginx/sites-enabled", "mode": "rw"},
        }

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
        if status == "running":
            logger.info("✅ Nginx уже запущен, перезагрузка конфигов")
            await self.apply_all()
        else:
            logger.info("🚀 Запуск Nginx контейнера")
            await self.install_and_run()
