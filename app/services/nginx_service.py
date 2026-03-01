import anyio
import logging
import socket
from app.core.config import settings
from app.services.docker_service import DockerService

logger = logging.getLogger(__name__)

class NginxService:
    CONTAINER_NAME = "nginx"
    IMAGE = "nginx:mainline-alpine" 

    def __init__(self):
        self.docker = DockerService()
        self.base_dir = settings.internal_data_path / "nginx"
        self.www = self.base_dir / "www"
        self.conf_d = self.base_dir / "conf.d"
        self.stream_d = self.base_dir / "stream-enabled"
        self.snippets = self.base_dir / "snippets"
        
        # Создаем все папки заранее
        for p in [self.conf_d, self.stream_d, self.snippets, self.www]:
            p.mkdir(parents=True, exist_ok=True)

        self.domain = settings.panel_domain
        self.reality_domain = settings.reality_dest_domain
        self.panel_port = "8000"
        self.panel_path = settings.panel_secret_path.strip("/")
        self.sub_port = "8000"
        self.sub_path = settings.sub_path.strip('/')
        self.json_path = None
        self.xhttp_path = None
        self.web_path = None
        self.sub2singbox_path = None

    async def _write(self, path, content: str):
        await anyio.to_thread.run_sync(lambda: path.write_text(content.strip()))

    async def generate_stream_conf(self):
        # Мы пишем адрес прямо в значения map
        content = f"""
map $ssl_preread_server_name $backend_target {{
    hostnames;
    {self.reality_domain}    anaconduit_xray:8443;
    {self.domain}              127.0.0.1:7443;
    default                    anaconduit_xray:8443;
}}

server {{
    listen          443;
    proxy_protocol  on;
    
    # Так как используется переменная $backend_target, 
    # Nginx НЕ будет проверять наличие 'anaconduit_xray' при старте!
    proxy_pass      $backend_target;
    
    ssl_preread     on;
}}
"""
        await self._write(self.stream_d / "stream.conf", content)

    # ... (Методы _gen_sub2sing_block, _gen_web_page_block и т.д. без изменений) ...

    async def generate_snippets(self):
        blocks = [
            # Ваши методы генерации блоков...
            "\n    location / { try_files $uri $uri/ =404; }"
        ]
        content = "\n".join([b for b in blocks if b.strip()])
        await self._write(self.snippets / "includes.conf", content)

    async def generate_main_nginx_conf(self):
        content = f"""
user  nginx;
worker_processes  auto;
worker_rlimit_nofile 16384;

events {{
    worker_connections  4096;
}}

stream {{
    # Внутренний DNS Docker (обязательно для резолвинга имен контейнеров)
    resolver 127.0.0.11 valid=30s; 

    include /etc/nginx/stream-enabled/*.conf;
}}

http {{
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Резолвер и здесь для надежности
    resolver 127.0.0.11 8.8.8.8 valid=300s;

    include /etc/nginx/conf.d/*.conf;
}}
"""
        await self._write(self.base_dir / "nginx.conf", content)

    async def generate_sites_conf(self):
        # Пути для проверки наличия сертификатов на хосте
        host_cert_dir = settings.internal_data_path / "letsencrypt" / "live" / self.domain
        has_certs = (host_cert_dir / "fullchain.pem").exists()

        if not has_certs:
            logger.warning(f"Certificates for {self.domain} not found. Using HTTP-only mode for Certbot challenge.")
            common_ssl_logic = "# SSL will be enabled after certbot run"
            ssl_listen_domain = "listen 7443 proxy_protocol;"
            ssl_listen_reality = "listen 9443;"
        else:
            common_ssl_logic = f"""
    server_tokens off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!eNULL:!MD5:!DES:!RC4:!ADH:!SSLv3:!EXP:!PSK:!DSS;
    ssl_certificate /etc/letsencrypt/live/{self.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{self.domain}/privkey.pem;

    if ($request_uri ~ "(\\"|'|`|~|,|:|--|;|%|\\$|&&|\\?\\?|0x00|0X00|\\||\\\\|\\{{|\\}}|\\[|\\]|<|>|\\.\\.\\.|\\.\\.\\/|\\/\\/\\/)"){{set $hack 1;}}
"""
            ssl_listen_domain = "listen 7443 ssl http2 proxy_protocol;"
            ssl_listen_reality = "listen 9443 ssl http2;"

        # --- Конфиг основного домена ---
        # Используем двойные скобки {{ }} там, где они должны остаться в конфиге Nginx
        domain_conf = f"""
server {{
    {ssl_listen_domain}
    server_name {self.domain};
    root /var/www/html/;
    {common_ssl_logic}

    if ($host !~* ^(.+\\.)?{self.domain.replace('.', '\\.')}$ ){{return 444;}}
    {f'if ($ssl_server_name !~* ^(.+\\.)?{self.domain.replace(".", "\\.")}$ ) {{ return 444; }}' if has_certs else ""}

    location /{self.panel_path}/ {{
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_pass http://anaconduit_backend:{self.panel_port};
    }}
    include /etc/nginx/snippets/includes.conf;
}}
"""

        # --- Конфиг Reality домена ---
        reality_conf = f"""
server {{
    {ssl_listen_reality}
    server_name {self.reality_domain};
    root /var/www/html/;
    {common_ssl_logic}

    if ($host !~* ^(.+\\.)?{self.reality_domain.replace('.', '\\.')}$ ){{return 444;}}
    
    location /{self.panel_path}/ {{
        proxy_pass http://anaconduit_backend:{self.panel_port};
    }}
    include /etc/nginx/snippets/includes.conf;
}}
"""

        # --- Конфиг 80 порта (HTTP) ---
        http_conf = f"""
server {{
    listen 80;
    server_name {self.domain} {self.reality_domain};

    location /.well-known/acme-challenge/ {{
        root /var/www/html;
    }}

    location / {{
        return 301 https://$host$request_uri;
    }}
}}
"""
        # Теперь записываем переменные, которые мы только что определили
        await self._write(self.conf_d / f"{self.domain}.conf", domain_conf)
        await self._write(self.conf_d / f"{self.reality_domain}.conf", reality_conf)
        await self._write(self.conf_d / "80.conf", http_conf)

    async def apply_all(self):
        await self.generate_main_nginx_conf()
        await self.generate_snippets()
        await self.generate_stream_conf()
        await self.generate_sites_conf()

        if await self.docker.get_status(self.CONTAINER_NAME) != "running":
            await self.install_and_run()
        else:
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")

        # Автоматизация получения SSL
        host_cert_file = settings.internal_data_path / "letsencrypt" / "live" / self.domain / "fullchain.pem"
        if not host_cert_file.exists():
            await self.run_certbot()
            await self.generate_sites_conf()
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")

    async def run_certbot(self):
        host_letsencrypt = f"{settings.host_data_path}/letsencrypt"
        host_www = f"{settings.host_data_path}/nginx/www"
        
        command = (
            f"certonly --webroot -w /var/www/html "
            f"-d {self.domain} -d {self.reality_domain} "
            f"--email {settings.admin_email} --agree-tos --no-eff-email --non-interactive"
        )
        
        await self.docker.run_container(
            name="certbot_helper",
            image="certbot/certbot",
            volumes={
                host_letsencrypt: {"bind": "/etc/letsencrypt", "mode": "rw"},
                host_www: {"bind": "/var/www/html", "mode": "rw"},
            },
            command=command,
            network="anaconduit_net",
            remove=True
        )

    async def install_and_run(self):
        host_path = f"{settings.host_data_path}/nginx"
        certs_path = f"{settings.host_data_path}/letsencrypt"

        volumes = {
            f"{host_path}/nginx.conf": {"bind": "/etc/nginx/nginx.conf", "mode": "ro"},
            f"{host_path}/conf.d": {"bind": "/etc/nginx/conf.d", "mode": "rw"},
            f"{host_path}/stream-enabled": {"bind": "/etc/nginx/stream-enabled", "mode": "rw"},
            f"{host_path}/snippets": {"bind": "/etc/nginx/snippets", "mode": "rw"},
            certs_path: {"bind": "/etc/letsencrypt", "mode": "ro"},
            f"{host_path}/www": {"bind": "/var/www/html", "mode": "rw"},
        }

        return await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=self.IMAGE,
            ports={"80/tcp": 80, "443/tcp": 443},
            volumes=volumes,
            network="anaconduit_net"
        )
