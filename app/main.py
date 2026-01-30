import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.router import api_router

# Настройка логирования до запуска приложения
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)

# --- Доработки: Lifespan (управление жизненным циклом) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Здесь выполняется код ПЕРЕД стартом приложения и ПОСЛЕ его остановки.
    """
    logger.info("🚀 Приложение Anaconduit запускается")
    
    # Здесь в будущем можно инициализировать глобальные пулы соединений
    # или проверять доступность Docker-демона
    
    yield  # В этой точке приложение принимает запросы
    # Shutdown
    from app.core.dependencies import get_xray_client
    client = get_xray_client()
    await client.close() # Закрываем gRPC канал при выключении
    # Код здесь выполнится при выключении (Ctrl+C или docker stop)
    logger.info("🛑 Приложение Anaconduit останавливается")

# --- Инициализация FastAPI ---
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="0.1.0",
    lifespan=lifespan  # Подключаем жизненный цикл
)

# Подключаем роутеры
app.include_router(api_router)

# Опционально: базовый эндпоинт для проверки работоспособности
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": settings.app_name}
