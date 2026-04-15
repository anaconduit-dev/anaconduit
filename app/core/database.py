# app/core/database.py 

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from sqlalchemy import MetaData

# Правила именования для всех индексов и ключей
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}



# 1. Создаем движок
engine = create_async_engine(
    settings.database_url, 
    echo=False,
    # Это гарантирует, что aiosqlite будет корректно обрабатывать подключения
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

# 2. Включаем поддержку Foreign Keys для SQLite
# Без этого PRAGMA ondelete="CASCADE" в моделях будет игнорироваться
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# 3. Настраиваем фабрику сессий (используем современный async_sessionmaker)
AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# 4. Базовый класс для моделей (Style SQLAlchemy 2.0)
class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming_convention)

# 5. Зависимость для FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()