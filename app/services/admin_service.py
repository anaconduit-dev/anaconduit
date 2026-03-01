import logging
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Admin
from app.core.security import hash_password

logger = logging.getLogger(__name__)

class AdminService:
    @staticmethod
    async def create_first_admin(db: AsyncSession, username: str, password: str):
        # Проверяем, есть ли уже админы
        result = await db.execute(select(Admin))
        if result.scalars().first():
            logger.warning("Админ уже существует. Пропуск создания.")
            return None

        new_admin = Admin(
            username=username,
            password_hash=hash_password(password)
        )
        db.add(new_admin)
        await db.commit()
        await db.refresh(new_admin)
        logger.info(f"✅ Создан первый администратор: {username}")
        return new_admin