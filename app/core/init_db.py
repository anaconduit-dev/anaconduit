# app/core/init_db.py
import logging
from sqlalchemy import select
from app.models import models
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.core.config import settings

logger = logging.getLogger(__name__)

async def create_initial_admin():
    if not settings.admin_user or not settings.admin_password:
        return
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.Admin))
        if result.scalars().first():
            return
        new_admin = models.Admin(
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
        result = await session.execute(select(models.Outbound))
        if result.scalars().first():
            return
            
        new_outbound = models.Outbound(
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

async def setup_initial_data():
    """Агрегатор для вызова в lifespan"""
    try:
        await create_initial_admin()
        await seed_default_outbound()
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации данных: {e}")