import anyio
import logging
import socket
from app.core.config import settings
from app.services.docker_service import DockerService

logger = logging.getLogger(__name__)

class NginxService:
    CONTAINER_NAME = "nginx"
    # Важно: используйте образ с поддержкой stream и acme модулей
    IMAGE = "nginx:mainline-alpine" 

    def __init__(self):
        self.docker = DockerService()
        # Пути внутри вашего Python-приложения (volume source)
        self.base_dir = settings.internal_data_path / "nginx"
        self.conf_d = self.base_dir / "conf.d"
        self.stream_d = self.base_dir / "stream-enabled"
        self.snippets = self.base_dir / "snippets"
        
        for p in [self.conf_d, self.stream_d, self.snippets]:
            p.mkdir(parents=True, exist_ok=True)

        # Переменные из settings (имена как в Bash-скрипте)
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

    # --- ФУНКЦИЯ ПРОВЕРКИ IP И ПОДГОТОВКИ ACME ---
    async def configure_acme_domains(self, domains: list) -> str:
        """
        Проверяет, указывают ли домены на IP сервера.
        Возвращает блок конфигурации acme для каждого валидного домена.
        """
        valid_domains = []
        try:
            # Получаем внешний IP сервера (аналог curl icanhazip)
            server_ip = socket.gethostbyname(socket.gethostname()) 
        except:
            server_ip = None

        for dom in domains:
            try:
                dom_ip = socket.gethostbyname(dom)
                if dom_ip: # В идеале: if dom_ip == server_ip
                    valid_domains.append(f"acme {dom};")
            except socket.gaierror:
                logger.warning(f"Domain {dom} does not resolve. Skipping SSL.")
        
        return "\n    ".join(valid_domains)

    # --- ГЕНЕРАЦИЯ SNI STREAM (L4) ---
    async def generate_stream_conf(self):
        content = f"""
map $ssl_preread_server_name $sni_name {{
    hostnames;
    {self.reality_domain}      xray;
    {self.domain}              www;
    default                    xray;
}}

upstream xray {{
    server anaconduit_xray:8443;
}}

upstream www {{
    server 127.0.0.1:7443;
}}

server {{
    proxy_protocol on;
    set_real_ip_from 127.0.0.1;
    listen          443;
    proxy_pass      $sni_name;
    ssl_preread     on;
}}
"""
        await self._write(self.stream_d / "stream.conf", content)

    # --- ГЕНЕРАЦИЯ SNIPPET (INCLUDES) ---
    async def _gen_sub2sing_block(self) -> str:
        if not self.sub2singbox_path: return ""
        return f"""
    location /{self.sub2singbox_path}/ {{
        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://anaconduit_sub2sing:8080/;
    }}"""

    async def _gen_web_page_block(self) -> str:
        if not self.web_path: return ""
        return f"""
    location ~ ^/{self.web_path}/clashmeta/(.+)$ {{
        default_type text/plain;
        ssi on;
        ssi_types text/plain;
        set $subid $1;
        root /var/www/subpage;
        try_files /clash.yaml =404;
    }}
    location ~ ^/{self.web_path} {{
        root /var/www/subpage;
        index index.html;
        try_files $uri $uri/ /index.html =404;
    }}"""

    async def _gen_subscription_block(self) -> str:
        if not self.sub_path: return ""
        return f"""
    location /{self.sub_path} {{
        if ($hack = 1) {{return 404;}}
        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_pass https://127.0.0.1:{self.sub_port};
    }}
    location /assets/ {{
        if ($hack = 1) {{return 404;}}
        proxy_pass https://127.0.0.1:{self.sub_port};
    }}"""

    async def _gen_xhttp_block(self) -> str:
        # Здесь логика: если в бд нет активных xhttp инбаундов, путь будет пустой
        if not self.xhttp_path: return ""
        return f"""
    location /{self.xhttp_path} {{
        grpc_pass grpc://anaconduit_xray:2023;
        grpc_set_header Host $host;
        grpc_set_header X-Real-IP $remote_addr;
    }}"""

    async def _gen_dynamic_fwd_block(self) -> str:
        # Этот блок из оригинального скрипта позволяет стучаться на любой порт 
        # Мы можем оставить его включенным или тоже сделать опциональным
        return f"""
    location ~ ^/(?P<fwdport>\\d+)/(?P<fwdpath>.*)$ {{
        if ($hack = 1) {{return 404;}}
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        if ($content_type ~* "GRPC") {{
            grpc_pass grpc://anaconduit_xray:$fwdport$is_args$args;
            break;
        }}
        proxy_pass http://anaconduit_xray:$fwdport$is_args$args;
    }}"""

    async def generate_snippets(self):
        """Собирает все блоки в один файл"""
        blocks = [
            await self._gen_sub2sing_block(),
            await self._gen_web_page_block(),
            await self._gen_subscription_block(),
            await self._gen_xhttp_block(),
            await self._gen_dynamic_fwd_block(),
            "\n    location / { try_files $uri $uri/ =404; }"
        ]
        
        # Убираем пустые строки и склеиваем
        content = "\n".join([b for b in blocks if b.strip()])
        await self._write(self.snippets / "includes.conf", content)

    # --- ГЕНЕРАЦИЯ ГЛАВНОГО NGINX.CONF ---
    async def generate_main_nginx_conf(self):
        content = f"""
user  nginx;
worker_processes  auto;
load_module modules/ngx_stream_module.so;
load_module modules/ngx_http_acme_module.so;

worker_rlimit_nofile 16384;

events {{
    worker_connections  4096;
}}

stream {{
    include /etc/nginx/stream-enabled/*.conf;
}}

http {{
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    resolver 8.8.8.8 1.1.1.1 valid=300s;
    
    acme_issuer letsencrypt {{
        uri https://acme-v02.api.letsencrypt.org/directory;
        state_path /var/cache/nginx/acme;
        accept_terms_of_service;
    }}
    acme_shared_zone zone=ngx_acme:10M;

    include /etc/nginx/conf.d/*.conf;
}}
"""
        await self._write(self.base_dir / "nginx.conf", content)

    # --- ГЕНЕРАЦИЯ SITES (DOMAIN & REALITY) ---
    async def generate_sites_conf(self):
        acme_block = await self.configure_acme_domains([self.domain, self.reality_domain])
        
        common_ssl_logic = f"""
    server_tokens off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!eNULL:!MD5:!DES:!RC4:!ADH:!SSLv3:!EXP:!PSK:!DSS;
    
    # ACME Auto-SSL
    {acme_block}

    if ($request_uri ~ "(\\"|'|`|~|,|:|--|;|%|\\$|&&|\\?\\?|0x00|0X00|\\||\\\\|\\{{|\\}}|\\[|\\]|<|>|\\.\\.\\.|\\.\\.\\/|\\/\\/\\/)"){{set $hack 1;}}
"""

        domain_conf = f"""
server {{
    listen 7443 ssl http2 proxy_protocol;
    server_name {self.domain};
    root /var/www/html/;
    {common_ssl_logic}

    if ($host !~* ^(.+\\.)?{self.domain}$ ){{return 444;}}
    if ($ssl_server_name !~* ^(.+\\.)?{self.domain}$ ) {{ return 444; }}

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
        reality_conf = f"""
server {{
    listen 9443 ssl http2;
    server_name {self.reality_domain};
    root /var/www/html/;
    {common_ssl_logic}

    if ($host !~* ^(.+\\.)?{self.reality_domain}$ ){{return 444;}}
    
    location /{self.panel_path}/ {{
        proxy_pass http://anaconduit_backend:{self.panel_port};
    }}
    include /etc/nginx/snippets/includes.conf;
}}
"""
        # 80 port redirect
        http_conf = f"""
server {{
    listen 80;
    server_name {self.domain} {self.reality_domain};
    return 301 https://$host$request_uri;
}}
"""
        await self._write(self.conf_d / f"{self.domain}.conf", domain_conf)
        await self._write(self.conf_d / f"{self.reality_domain}.conf", reality_conf)
        await self._write(self.conf_d / "80.conf", http_conf)

    # --- ЗАПУСК И ПРИМЕНЕНИЕ ---
    async def apply_all(self):
        await self.generate_main_nginx_conf()
        await self.generate_snippets()
        await self.generate_stream_conf()
        await self.generate_sites_conf()
        
        # Перезагружаем или запускаем контейнер
        if await self.docker.get_status(self.CONTAINER_NAME) == "running":
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")
        else:
            await self.install_and_run()

    async def install_and_run(self):
        # Остановка мешающих процессов на хосте (если нужно)
        # В Docker-среде обычно порты 80/443 пробрасываются из контейнера
        
        host_path = f"{settings.host_data_path}/nginx"
        volumes = {
            f"{host_path}/nginx.conf": {"bind": "/etc/nginx/nginx.conf", "mode": "ro"},
            f"{host_path}/conf.d": {"bind": "/etc/nginx/conf.d", "mode": "rw"},
            f"{host_path}/stream-enabled": {"bind": "/etc/nginx/stream-enabled", "mode": "rw"},
            f"{host_path}/snippets": {"bind": "/etc/nginx/snippets", "mode": "rw"},
            f"{host_path}/acme-cache": {"bind": "/var/cache/nginx/acme", "mode": "rw"},
        }

        return await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=self.IMAGE,
            ports={"80/tcp": 80, "443/tcp": 443},
            volumes=volumes,
            network="anaconduit_net"
        )

    async def get_current_status(self):
        state = await self.docker.get_status(self.CONTAINER_NAME)
        version = "unknown"
        if state == "running":
            try:
                version_raw = await self.docker.exec(self.CONTAINER_NAME, "nginx -version")
                if version_raw: version = version_raw.split(' ')[2].split('/')[1]
            except: pass
        return {"container": self.CONTAINER_NAME, "status": state, "version": version}

    async def restart(self):
        await self.docker.restart(self.CONTAINER_NAME)
        return {"status": "ok"}

    async def start(self): return await self.docker.start(self.CONTAINER_NAME)
    async def stop(self): return await self.docker.stop(self.CONTAINER_NAME)
    async def logs(self, tail: int = 100): return await self.docker.logs(self.CONTAINER_NAME, tail=tail)