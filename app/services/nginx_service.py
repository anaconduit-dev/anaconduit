import anyio
import logging
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

        # статические SNI
        self.static_inbounds = [
            {"sni": self.domain, "port": 7443, "name": "panel", "backend_host": "nginx"}
        ]

    async def _write(self, path, content: str):
        await anyio.to_thread.run_sync(lambda: path.write_text(content.strip()))

    async def _symlink(self, src, dst):
        def create():
            if not src.exists():
                raise FileNotFoundError(f"Source file does not exist: {src}")
            if dst.exists() or dst.is_symlink():
                dst.unlink()
            os.symlink(src.resolve(), dst)
        await anyio.to_thread.run_sync(create)

    async def ensure_directories(self):
        for d in [
            self.base_dir, self.conf_d, self.stream_d, 
            self.sites_a_d, self.sites_e_d, self.snippets, self.certs_dir
        ]:
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

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    keepalive_timeout 65;

    include /etc/nginx/sites-enabled/*;
}}
"""
        await self._write(self.base_dir / "nginx.conf", content)

    def normalize_sni(self, sni: str) -> str:
        return sni.split(":")[0].lower().strip() if sni else ""

    async def load_transport_inbounds(self, session: AsyncSessionLocal):
        """
        Загружает все inbounds (reality, grpc, ws, xhttp)
        Возвращает список с полями: sni, port, transport, unix_socket
        """
        inbounds = []

        try:
            result = await session.execute(select(Inbound).filter_by(is_active=True))
            db_inbounds = result.scalars().all()

            for ib in db_inbounds:
                stream = ib.stream_settings or {}
                transport = stream.get("network")
                sni_list = []

                if transport == "reality" and stream.get("security") == "reality":
                    sni_list = stream.get("realitySettings", {}).get("serverNames", [])
                else:
                    sni_list = stream.get("serverNames", [])

                for sni in sni_list:
                    sni = self.normalize_sni(sni)
                    if not sni:
                        continue

                    entry = {
                        "sni": sni,
                        "port": ib.port,
                        "transport": transport
                    }

                    # если xhttp — используем unix-сокет
                    if transport == "xhttp":
                        entry["unix_socket"] = f"/var/run/xhttp-{ib.port}.sock"

                    inbounds.append(entry)

        except Exception as e:
            logger.error(f"❌ Ошибка при получении inbounds: {e}")

        if not inbounds:
            # fallback
            inbounds.append({"sni": "fallback", "port": 8443, "transport": "reality"})

        return inbounds

    async def generate_stream_conf(self):
        async with AsyncSessionLocal() as session:
            inbounds = await self.load_transport_inbounds(session)

        map_entries = []
        for ib in inbounds + self.static_inbounds:
            sni = ib["sni"]
            transport = ib.get("transport", "tcp")
            backend = ""

            if transport == "grpc":
                backend = f"grpcs://anaconduit_xray:{ib['port']}"
            elif transport == "xhttp":
                backend = f"unix:{ib['unix_socket']}"
            else:
                backend = f"anaconduit_xray:{ib['port']}"

            map_entries.append(f"    {sni} {backend};")

        content = f"""
map $ssl_preread_server_name $backend {{
    hostnames;
{chr(10).join(map_entries)}
    default anaconduit_xray:8443;
}}

server {{
    listen 443 reuseport;

    proxy_pass $backend;
    ssl_preread on;
    proxy_protocol on;
}}
"""
        await self._write(self.stream_d / "00-sni-router.conf", content)
        logger.info("✅ Stream config generated with all transports (gRPC, WS, XHTTP, Reality)")

    async def generate_sites_available_conf(self):
        # 80 redirect
        redirect_conf = f"""
server {{
    listen 80;
    server_name {self.domain} {self.reality_domain};
    return 301 https://$host$request_uri;
}}
"""
        # Panel
        panel_conf = fr"""
server {{
    listen 7443 ssl http2;
    server_name {self.domain};

    ssl_certificate     /etc/nginx/certs/{self.domain}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/{self.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;

    location / {{
        root /var/www/html/;
        index index.html;
    }}

    location /{self.panel_path}/ {{
        proxy_pass http://anaconduit_backend:{self.panel_port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    include /etc/nginx/snippets/xui-common-locations.conf;
}}
"""
        # Reality
        reality_conf = fr"""
server {{
    listen 9443 ssl http2;
    server_name {self.reality_domain};

    ssl_certificate     /etc/nginx/certs/{self.reality_domain}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/{self.reality_domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;

    location / {{
        root /var/www/html/;
        index index.html;
    }}

    location /xray_port/ {{
        proxy_pass http://anaconduit_xray:$fwdport;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    include /etc/nginx/snippets/xui-common-locations.conf;
}}
"""
        await self._write(self.sites_a_d / "80-redirect.conf", redirect_conf)
        await self._write(self.sites_a_d / "main-domain.conf", panel_conf)
        await self._write(self.sites_a_d / "reality-domain.conf", reality_conf)

    async def generate_snippet(self):
        content = f"""
location /{self.panel_path}/ {{
    proxy_pass http://anaconduit_backend:{self.panel_port};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}}

location /{self.sub_path}/ {{
    proxy_pass http://anaconduit_backend:{self.sub_port};
}}

location ~ ^/(?<fwdport>\\d+)/(?<fwdpath>.*)$ {{
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://anaconduit_xray:$fwdport;
}}
"""
        await self._write(self.snippets / "xui-common-locations.conf", content)

    async def generate_symlinks(self):
        # упрощаем: только panel / reality / redirect
        configs = ["main-domain.conf", "reality-domain.conf", "80-redirect.conf"]
        def create():
            for name in configs:
                dst = self.sites_e_d / name
                src = f"../sites-available/{name}"
                if dst.exists() or dst.is_symlink():
                    dst.unlink()
                os.symlink(src, dst)
                logger.info(f"🔗 Symlink created: {name} -> {src}")
        await anyio.to_thread.run_sync(create)

    async def apply_all(self):
        await self.ensure_directories()
        await self.generate_placeholder_page()
        await self.generate_main_nginx_conf()
        await self.generate_stream_conf()
        await self.generate_sites_available_conf()
        await self.generate_snippet()
        await self.generate_symlinks()
        logger.info("✅ Nginx configs generated")

        if await self.docker.get_status(self.CONTAINER_NAME) == "running":
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")
            logger.info("♻️ Nginx reloaded")

    # методы управления контейнером остаются без изменений

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
