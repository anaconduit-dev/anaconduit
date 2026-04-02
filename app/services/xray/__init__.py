# app/services/xray/__init__.py
import logging
from typing import List, Dict, Any, Optional
from app.core.database import AsyncSessionLocal
from app.services.docker_service import DockerService

# Импорт под-сервисов
from .generator import XrayConfigGenerator
from .manager import XrayResourceManager
from .traffic import XrayTrafficManager
from .links import XrayLinkGenerator
from .security import XraySecurityService
from .crud import XrayCRUDManager

logger = logging.getLogger(__name__)

class XrayService:
    def __init__(self, api_client, docker_service: Optional[DockerService] = None):
        """
        Объединенный сервис управления Xray.
        :param api_client: Инстанс XrayAPIClient для работы через gRPC.
        :param docker_service: Инстанс DockerService для управления контейнером.
        """
        self.api_client = api_client
        self.docker = docker_service or DockerService()
        self.manager = XrayResourceManager(self.docker)
        
        # Инициализация специализированных модулей
        self.generator = XrayConfigGenerator(api_port=10085)
        self.manager = XrayResourceManager(self.docker)
        self.traffic = XrayTrafficManager(api_client)
        self.links = XrayLinkGenerator()
        self.security = XraySecurityService()
        
        # CRUD-сервис, которому нужны ссылки на генератор и менеджер
        self.crud = XrayCRUDManager(self.generator, self.manager, self.api_client)
    @property
    def CONTAINER_NAME(self) -> str:
        """Позволяет роуту /logs получить имя контейнера из менеджера"""
        return self.manager.CONTAINER_NAME

    # ---------- Конфигурация и Файлы ----------

    async def generate_full_config(self):
        """Собирает актуальный конфиг из БД и сохраняет его на диск."""
        async with AsyncSessionLocal() as session:
            config = await self.generator.build_config(session)
            await self.manager.save_config(config)
            return config

    async def validate_config(self, config: dict):
        """Проверяет корректность конфига через тестовый запуск."""
        return await self.manager.validate_config(config)

    # ---------- Управление процессом (Docker) ----------

    async def install(self, version: str):
        """Полная установка контейнера с текущим конфигом."""
        await self.generate_full_config()
        return await self.manager.install(version)

    async def start(self):
        return await self.manager.start()

    async def restart(self):
        return await self.manager.restart()

    async def stop(self):
        return await self.manager.stop()

    async def get_status(self):
        return await self.manager.get_status()

    async def get_node_versions(self):
        """Возвращает список доступных версий Xray с GitHub."""
        return await self.manager.get_github_versions()

    # ---------- Трафик и Лимиты (Бухгалтерия) ----------

    async def update_stats_in_db(self):
        """Синхронизирует потребление трафика из Xray в базу данных."""
        await self.traffic.update_stats_in_db(AsyncSessionLocal)

    async def reset_user_traffic(self, user_id: int):
        """Сбрасывает текущие счетчики трафика конкретного пользователя."""
        return await self.traffic.reset_user_traffic(AsyncSessionLocal, user_id)
        
    async def check_limits_and_disable(self):
        """Отключает просроченных пользователей или превысивших лимит."""
        await self.traffic.check_limits_and_disable(
            session_factory=AsyncSessionLocal,
            api_callback_remove=self.api_client.remove_client,
            api_callback_add=self.api_client.add_client
        )
        # После массовых изменений в БД обновляем конфиг на диске
        await self.generate_full_config()

    async def check_and_reset_traffic(self):
        """Сбрасывает счетчики трафика согласно расписанию (день/неделя/месяц)."""
        await self.traffic.check_and_reset_traffic(AsyncSessionLocal)

    # ---------- Клиентские ссылки и Подписки ----------

    def generate_config_link(self, client, user, inbound):
        return self.links.generate_config_link(client, user, inbound)

    async def generate_subscription(self, token: str, session: AsyncSessionLocal): 
        return await self.links.generate_subscription(token, session)

    # ---------- Безопасность ----------

    async def generate_reality_keys(self):
        return await self.security.generate_reality_keys()

    # ---------- Вспомогательные методы API ----------

    async def add_client_to_xray(self, tag: str, email: str, uuid: str):
        """Прокси-метод для добавления клиента в работающий Xray без рестарта."""
        return await self.api_client.add_client(tag, email, uuid)

    async def remove_client_from_xray(self, tag: str, email: str):
        """Прокси-метод для удаления клиента из работающего Xray без рестарта."""
        return await self.api_client.remove_client(tag, email)

    async def sync_and_restart(self):
        """Полная синхронизация конфига и рестарт контейнера."""
        await self.generate_full_config()
        return await self.manager.restart()


    async def ensure_xray_running(self, version: str = "latest") -> Dict[str, Any]:
        """Умная проверка состояния: запуск только при необходимости."""
        # 1. Получаем статус (из менеджера)
        status = await self.manager.get_status()
        current_version = status.get("version", "unknown")
        container_state = status.get("status", "exited")

        # 2. Определяем целевую версию (твоя логика сохранения версии)
        target_version = version if version != "latest" else current_version
        if target_version == "unknown":
            target_version = "26.1.23" # Твой дефолт

        # 3. Генерируем конфиг из БД для сравнения
        async with AsyncSessionLocal() as session:
            target_config = await self.generator.build_config(session)

        # 4. Проверяем изменения
        config_changed = await self.manager.is_config_different(target_config)
        
        # 5. Проверяем версию (если принудительно передана другая версия)
        version_changed = (version != "latest" and current_version != version.lstrip('v'))

        if container_state != "running" or config_changed or version_changed:
            logger.info(f"♻️ Обновление Xray (цель: {target_version}, reason: "
                        f"state={container_state}, cfg_ch={config_changed}, ver_ch={version_changed})")
            # Сохраняем и устанавливаем
            return await self.manager.install(target_version, target_config)

        logger.info("✅ Xray запущен и актуален (конфиг на диске совпадает с БД)")
        return {"status": "already_running", "version": current_version}

    async def get_available_xray_versions(self) -> List[str]:
        """
        Прокси-метод для получения списка версий из GitHub.
        Именно это имя (get_available_xray_versions) ищет ваш API роут.
        """
        return await self.manager.get_github_versions()

    async def logs(self, tail: int = 100) -> str:
        """Позволяет роуту /logs получить текст логов из менеджера"""
        return await self.manager.get_container_logs(tail=tail)

    async def get_active_tags(self) -> List[str]:
        """
        Прокси-метод для роутов API. 
        Возвращает список тегов инбаундов, которые сейчас реально работают в памяти Xray.
        """
        return await self.traffic.get_active_tags()

    async def update_inbound(self, inbound_id: int, update_data: dict):
        return await self.crud.update_inbound(inbound_id, update_data)

    async def add_client_to_xray(self, inbound_tag: str, user_email: str, client_key: str, flow: str = "", level: int = 0, reverse:dict = {}):
        return await self.crud.add_client_to_xray(inbound_tag = inbound_tag, user_email = user_email, client_key = client_key, flow = flow, level = level, reverse = reverse)

    async def remove_client_from_xray(self, inbound_tag: str, user_email: str):
        return await self.crud.remove_client_from_xray(inbound_tag=inbound_tag, user_email=user_email)
    
    # Рекомендую также добавить прямой вызов генерации для удобства
    async def generate_full_config(self):
        return await self.crud._sync_config()