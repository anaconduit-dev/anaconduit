# app/core/init_db.py

import logging
import secrets
from sqlalchemy import select, update
from app.models import Admin, Node, Outbound, GlobalSettings, Inbound, RoutingRule
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.core.config import settings


logger = logging.getLogger(__name__)

async def init_host_node():
    """
    Проверяет наличие 'Host Node' в БД. Если ее нет, создает запись на основе настроек.
    Используется для того, чтобы мастер-сервер управлялся по той же логике, что и ноды.
    """
    async with AsyncSessionLocal() as session:
        # 1. Сначала ищем именно по ID 1
        result = await session.execute(select(Node).where(Node.id == 1))
        host_node = result.scalars().first()

        if not host_node:
            logger.info("🚀 Регистрация основной (Host) ноды под ID 1...")
            
            base_path = settings.panel_secret_path if settings.panel_secret_path.startswith("/") else f"/{settings.panel_secret_path}"
            full_api_url = f"https://{settings.panel_domain}{base_path}/api/v1/node-agent"

            new_node = Node(
                id=1,  # <--- ГАРАНТИЯ: Явно указываем ID
                name="Master Server",
                address=settings.panel_domain,
                api_url=full_api_url,
                reality_server_address=settings.reality_dest_domain or "127.0.0.1:443",
                secret_token=secrets.token_urlsafe(32),
                is_active=True
            )
            
            try:
                session.add(new_node)
                await session.commit()
                logger.info(f"✅ Host Node зарегистрирована (ID: 1, Address: {settings.panel_domain})")
            except Exception as e:
                await session.rollback()
                # Если вдруг ID 1 занят кем-то другим, пробуем найти по адресу
                logger.warning(f"⚠️ Не удалось занять ID 1 (возможно занят): {e}")



async def migrate_null_nodes():
    """
    Находит все системные объекты без node_id и привязывает их к Master Node (ID=1).
    Это избавляет от необходимости фильтровать по NULL в коде.
    """
    async with AsyncSessionLocal() as session:
        # Список моделей, которые нужно обновить
        models_to_fix = [Inbound, Outbound, RoutingRule]
        
        for model in models_to_fix:
            stmt = (
                update(model)
                .where(model.node_id == None)
                .values(node_id=1)
            )
            await session.execute(stmt)
        
        await session.commit()
        logger.info("🛠 Данные синхронизированы: все объекты привязаны к Host Node (ID: 1)")

async def create_initial_admin():
    if not settings.admin_user or not settings.admin_password:
        return
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Admin))
        if result.scalars().first():
            return
        new_admin = Admin(
            username=settings.admin_user,
            password_hash=hash_password(settings.admin_password)
        )
        session.add(new_admin)
        await session.commit()
        logger.info(f"✅ Начальный администратор '{settings.admin_user}' создан успешно.")

async def seed_default_outbound():
    """Создает базовый outbound 'freedom', если таблица пуста."""
    async with AsyncSessionLocal() as session:
        # Проверяем, есть ли уже хоть один outbound
        result = await session.execute(select(Outbound))
        if result.scalars().first():
            return
            
        new_outbound = Outbound(
            tag="direct",
            protocol="freedom",
            settings={},  # Пустые настройки для прямого выхода
            is_default=True,
            is_active=True,
            description="Прямой выход в интернет (создано автоматически при запуске)"
        )
        
        session.add(new_outbound)
        await session.commit()
        logger.info("✅ Дефолтный outbound 'direct' (freedom) создан успешно.")

async def init_global_settings():
    """Создает дефолтные глобальные настройки, если они отсутствуют"""
    async with AsyncSessionLocal() as session:
        # Проверяем, есть ли уже запись
        result = await session.execute(select(GlobalSettings).where(GlobalSettings.id == 1))
        settings = result.scalars().first()

        if not settings:
            print("🚀 Initializing Global Settings with default values...")
            default_settings = GlobalSettings(
                id=1,
                domain_strategy="AsIs",
                log_level="warning",
                access_log="/var/log/xray/access.log",
                error_log="/var/log/xray/error.log",
                stats_user_uplink=True,
                stats_user_downlink=True,
                dns_settings={
                    "servers": ["8.8.8.8", "1.1.1.1", "localhost"]
                }
            )
            session.add(default_settings)
            await session.commit()
            print("✅ Global Settings initialized.")
        else:
            print("ℹ️ Global Settings already exists.")

async def setup_initial_data():
    """Агрегатор для вызова в lifespan"""
    try:
        await init_global_settings()
        await create_initial_admin()
        await seed_default_outbound()
        await init_host_node()
        await migrate_null_nodes()
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации данных: {e}")