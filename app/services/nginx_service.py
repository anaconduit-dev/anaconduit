# app/services/nginx_service.py

import logging
import os
from pathlib import Path
from app.core.config import settings
from app.services.docker_service import DockerService
from app.core.database import AsyncSessionLocal
from app.services.nginx.generator import NginxConfigGenerator
from app.services.nginx.file_manager import NginxFileManager
from app.services.node_config_service import NodeConfigService
logger = logging.getLogger(__name__)

class NginxService:
    CONTAINER_NAME = "nginx"
    IMAGE = "nginx:1.28.3"

    def __init__(self):
        # Мастер-сервис всегда работает с локальным Docker и node_id=1
        self.node_id = 1
        self.docker = DockerService()
        
        # Основные пути данных на мастере
        self.base_dir = settings.internal_data_path / "nginx"
        self.log_dir = settings.internal_data_path / "nginx_log"
        self.host_sockets_dir = f"{settings.host_data_path}/run"
        
        # Вспомогательные модули
        self.files = NginxFileManager(self.base_dir)
        # Генератор инициализируется как Master (включает пути панели и подписок)
        self.gen = NginxConfigGenerator(is_master=True)

    def _get_container_config(self):
        """Конфигурация контейнера с исправленной командой запуска логов"""
        h = settings.host_data_path
        host_nginx_dir = f"{h}/nginx"
        log_nginx_dir = f"{h}/nginx_log"
        
        volumes = {
            f"{host_nginx_dir}/nginx.conf": {"bind": "/etc/nginx/nginx.conf", "mode": "ro"},
            f"{host_nginx_dir}/stream-enabled": {"bind": "/etc/nginx/stream-enabled", "mode": "rw"},
            f"{host_nginx_dir}/snippets": {"bind": "/etc/nginx/snippets", "mode": "rw"},
            f"{host_nginx_dir}/certs": {"bind": "/etc/nginx/certs", "mode": "ro"},
            f"{host_nginx_dir}/www": {"bind": "/var/www/html", "mode": "rw"},
            f"{host_nginx_dir}/sites-available": {"bind": "/etc/nginx/sites-available", "mode": "rw"},
            f"{host_nginx_dir}/sites-enabled": {"bind": "/etc/nginx/sites-enabled", "mode": "rw"},
            f"{host_nginx_dir}/user-conf.d": {"bind": "/etc/nginx/user-conf.d", "mode": "rw"},
            f"{log_nginx_dir}": {"bind": "/var/log/nginx", "mode": "rw"},
            self.host_sockets_dir: {"bind": "/run/xray", "mode": "ro"}
        }
        
        # Исправляем команду: сначала создаем файлы логов, потом запускаем tail
        command = [
            "sh", "-c", 
            "mkdir -p /var/log/nginx && "
            "touch /var/log/nginx/access.log /var/log/nginx/error.log /var/log/nginx/stream_access.log && "
            "tail -F /var/log/nginx/stream_access.log > /dev/stdout & "
            "tail -F /var/log/nginx/access.log > /dev/stdout & "
            "tail -F /var/log/nginx/error.log > /dev/stderr & "
            "nginx -g 'daemon off;'"
        ]
        
        return {
            "image": self.IMAGE,
            "volumes": volumes,
            "ports": {"80/tcp": 80, "443/tcp": 443},
            "network": "anaconduit_net",
            "command": command
        }

    async def ensure_directories(self):
        """Подготовка структуры папок на диске мастера"""
        dirs = [
            self.base_dir,
            self.log_dir,
            self.base_dir / "stream-enabled",
            self.base_dir / "sites-available",
            self.base_dir / "sites-enabled",
            self.base_dir / "snippets",
            self.base_dir / "certs",
            self.base_dir / "user-conf.d",
            self.base_dir / "www"
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)
            
        # Папка для unix-сокетов Xray (права 777 для взаимодействия контейнеров)
        backend_run_dir = Path(settings.internal_data_path) / "run"
        backend_run_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(backend_run_dir, 0o777)

    async def generate_placeholder_page(self):
        """Создает дефолтную страницу, если пользователь не загрузил свою"""
        index_file = self.base_dir / "www" / "index.html"
        
        if index_file.exists():
            return

        content = self.gen.generate_placeholder_html()
        await self.files.write(index_file, content)
        logger.info(f"📝 Placeholder page generated at {index_file}")

    async def apply_all(self):
        """
        Генерирует и записывает конфигурационные файлы Nginx на диск мастера,
        затем выполняет reload контейнера.
        """
        await self.ensure_directories()
        await self.generate_placeholder_page()
        
        async with AsyncSessionLocal() as session:
            
            reality_ib, xhttp_ib = await NodeConfigService._get_node_inbounds(session, self.node_id)
            
        # Статичные маршруты только для Мастера (прокси на саму панель)
        static_ib = [{"sni": settings.panel_domain, "port": 7443, "backend_host": "nginx"}]
        
        # Если Reality не настроен, добавляем дефолтный fallback
        if not reality_ib:
            reality_ib.append({"sni": "fallback", "port": 8443})

        # 1. Запись основного конфига
        await self.files.write(self.base_dir / "nginx.conf", self.gen.generate_main_conf())
        
        # 2. Запись Stream (L4) конфига
        await self.files.write(
            self.base_dir / "stream-enabled/00-sni-router.conf", 
            self.gen.generate_stream_conf(reality_ib, static_ib)
        )
        
        # 3. Запись HTTP сайтов (vhosts) и создание симлинков
        sites = self.gen.generate_sites_conf()
        for filename, content in sites.items():
            available_path = self.base_dir / "sites-available" / filename
            enabled_path = self.base_dir / "sites-enabled" / filename
            await self.files.write(available_path, content)
            await self.files.create_symlink(filename, enabled_path)

        # 4. Запись сниппетов (включая пути панели и xHTTP)
        await self.files.write(
            self.base_dir / "snippets/xui-common-locations.conf", 
            self.gen.generate_snippet_conf(xhttp_ib)
        )

        # Reload контейнера, если он запущен
        status = await self.get_current_status()
        if status["status"] == "running":
            await self.docker.exec(self.CONTAINER_NAME, "nginx -s reload")
            logger.info("🔄 Nginx reloaded on Master Node")

    async def get_current_status(self):
        """Проверка состояния контейнера и версии Nginx"""
        state = await self.docker.get_status(self.CONTAINER_NAME)
        version = "unknown"
        if state == "running":
            try:
                version_raw = await self.docker.exec(self.CONTAINER_NAME, "nginx -version")
                if version_raw: 
                    version = version_raw.split('/')[-1].strip()
            except: pass
        return {"container": self.CONTAINER_NAME, "status": state, "version": version}

    async def install_and_run(self):
        """Пересоздание контейнера с актуальными параметрами"""
        await self.docker.remove_container(self.CONTAINER_NAME)
        await self.apply_all()
        config = self._get_container_config()
        return await self.docker.run_container(
            name=self.CONTAINER_NAME,
            image=config['image'],
            ports=config['ports'],
            volumes=config['volumes'],
            network=config['network'],
            restart_policy={"Name": "always"},
            command=config['command']
        )

    async def is_config_changed(self):
        inspect_data = await self.docker.inspect_container(self.CONTAINER_NAME)
        if not inspect_data:
            return True # Контейнера нет

        target_config = self._get_container_config()
        
        # 1. Сравнение Image
        current_image = inspect_data.get('Config', {}).get('Image')
        if current_image != target_config['image']:
            return True

        # 2. АВТОМАТИЧЕСКАЯ проверка всех Volumes
        # Достаем текущие маунты из Docker (Source: Destination)
        # Важно: Docker может добавлять слеши в конце путей, нормализуем их
        current_mounts = {
            Path(m['Source']).resolve(): Path(m['Destination']).resolve() 
            for m in inspect_data.get('Mounts', [])
        }
        
        for host_path, vol_info in target_config['volumes'].items():
            h_path = Path(host_path).resolve()
            c_path = Path(vol_info['bind']).resolve()
            
            # Проверяем, существует ли такая связка в текущем контейнере
            if h_path not in current_mounts or current_mounts[h_path] != c_path:
                logger.info(f"🔄 Изменение в Volume: {h_path} -> {c_path}")
                return True

        # 3. Проверка портов
        current_ports = inspect_data.get('HostConfig', {}).get('PortBindings', {})
        for port_key, host_port in target_config['ports'].items():
            # Docker хранит порты как {'80/tcp': [{'HostIp': '', 'HostPort': '80'}]}
            bindings = current_ports.get(port_key, [])
            if not bindings or int(bindings[0].get('HostPort')) != host_port:
                return True
        # 4. Проверка Command (Cmd)
        # В Docker inspect это Config.Cmd (список строк)
        current_cmd = inspect_data.get('Config', {}).get('Cmd', [])
        target_cmd = target_config.get('command', [])
        
        if current_cmd != target_cmd:
            logger.info(f"🔄 Изменение в Command")
            # Можно добавить лог для отладки, если команды длинные:
            # logger.debug(f"Current: {current_cmd} | Target: {target_cmd}")
            return True

        return False

    async def ensure_nginx_running(self):
        status = await self.docker.get_status(self.CONTAINER_NAME)
        conf_changed = await self.is_config_changed()
        
        if status == "running" and not conf_changed:
            logger.info("✅ Nginx запущен и актуален, просто обновляем конфиги")
            await self.apply_all()
        else:
            if conf_changed:
                logger.info("🔄 Конфигурация контейнера изменилась, пересоздаем...")
            else:
                logger.info("🚀 Контейнер не запущен, выполняем чистую установку")
            
            # install_and_run сам удалит старый и создаст новый
            await self.install_and_run()

    # --- Управление контейнером ---
    async def start(self): return await self.docker.start(self.CONTAINER_NAME)
    async def stop(self): return await self.docker.stop(self.CONTAINER_NAME)
    async def restart(self): return await self.docker.restart(self.CONTAINER_NAME)
    async def logs(self, tail=200): return await self.docker.logs(self.CONTAINER_NAME, tail=tail)

    # --- API методы для работы с файлами в /www ---
    async def list_files(self, subpath: str = ""):
        return await self.files.list_files(subpath)

    async def get_file_content(self, filename: str):
        return await self.files.read_file(filename)

    async def save_file_content(self, filename: str, content: str):
        path = self.files._resolve_safe(filename)
        await self.files.write(path, content)

    async def delete_file(self, filename: str):
        await self.files.delete_item(filename)

    async def update_landing_page(self, html_content: str):
        """Обновление index.html через API"""
        await self.save_file_content("index.html", html_content)
        logger.info("🎨 Master Landing page updated")