# app/main.py
import logging
import asyncio
import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.core.dependencies import get_xray_service, get_xray_client
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.router import api_router
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.database import get_db
import app.models  
from app.core.security import hash_password
from sqlalchemy import select 
from app.xray_api.client import XrayAPIClient
from app.services.xray import XrayService
from app.services.nginx_service import NginxService
from app.api.endpoints import public_sub
from app.core.init_db import setup_initial_data
from app.core.spa import get_spa_content
from app.services.scheduler import stats_updater_task

xray_client = XrayAPIClient()
xray_service = XrayService(api_client=xray_client)
nginx_service = NginxService()

# Настройка логирования
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)

# --- Настройки путей (выносим в начало для удобства) ---
SECRET_PATH = settings.panel_secret_path.strip('/')
SUB_PATH = settings.sub_path.strip('/')
static_path = os.path.join(os.path.dirname(__file__), "static")

    

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Приложение Anaconduit запускается")

    # 1. Инициализация БД
    await setup_initial_data()
    # 1.1 Инициализация Geo-ресурсов (наша новая функция)
    from app.services.xray.crud import XrayCRUDManager
    await XrayCRUDManager.init_default_resources()
    # 2. Инфраструктура (Xray/Nginx)
    try:
        await xray_service.ensure_xray_running(version="latest")
        # Генерация конфигов сразу после установки
        await xray_service.generate_full_config()
    except Exception as e:
        logger.error(f"❌ Не удалось установить Xray при старте: {e}")
    try:
        await nginx_service.ensure_nginx_running()
    except Exception as e:
        logger.error(f"❌ Не удалось запустить Nginx при старте: {e}")

    # 3. Запуск фоновых задач
    bg_task = asyncio.create_task(stats_updater_task(xray_service))
    
    yield  # --- FastAPI готов к работе ---
    
    # 5. Завершение фоновой задачи
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass
    
    # 6. Закрытие клиента
    await xray_client.close()
    logger.info("🛑 Приложение Anaconduit остановлено")

# --- Инициализация FastAPI ---
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="0.1.0",
    lifespan=lifespan,
    openapi_url="/api/v1/openapi.json" if settings.debug else None, # Отключает генерацию схемы openapi.json
    docs_url="/api/v1/docs" if settings.debug else None,    # Отключает /docs (Swagger UI)
    redoc_url="/api/v1/redoc" if settings.debug else None    # Отключает /redoc
)

# Настройка CORS (ВАЖНО для разработки фронта отдельно)
origins = [
    #"http://localhost:5173",
    #"http://127.0.0.1:5173",
    #"http://localhost:8000",
]

# Добавляем домен из конфига, если он задан
if settings.panel_domain:
    origins.append(f"http://{settings.panel_domain}")
    origins.append(f"https://{settings.panel_domain}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Сначала подключаем API роутеры
app.include_router(api_router, prefix=f"/{settings.panel_secret_path}")
# Подписочный API (отдельный router)
app.include_router(public_sub.router, prefix=f"/{settings.sub_path}")




@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": settings.app_name}

# 2. ПОДКЛЮЧАЕМ СТАТИКУ ФРОНТЕНДА (в самом конце)
# Путь внутри контейнера будет /app/app/static (согласно Dockerfile)
# Подключаем SPA (фронтенд)
if os.path.exists(static_path):
    # Ассеты (JS/CSS) остаются на /assets
    assets_dir = os.path.join(static_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Роут для страницы подписки (SUB_PATH)
    @app.get(f"/{SUB_PATH}/{{token:path}}", include_in_schema=False)
    async def serve_subscription(
        request: Request, 
        token: str, 
        db: AsyncSessionLocal = Depends(get_db)
    ):
        # Если это прямой доступ к assets
        if token.startswith("assets/"):
            file_path = os.path.join(static_path, token)
            if os.path.exists(file_path):
                return FileResponse(file_path)

        # Определяем клиентское приложение по User-Agent
        user_agent = request.headers.get("user-agent", "").lower()
        logger.info(f">>> Запрос к подписке! клиент: {user_agent}")

        # 1. Проверяем, кто пришел (Браузер или Прокси-клиент)
        is_browser = False
        if user_agent:
            ua = user_agent.lower()
            if "mozilla" in ua or "chrome" in ua or "safari" in ua:
                is_browser = True
        # 2. Если браузер — отправляем на фронтенд (React)
        if is_browser:
            content = await get_spa_content(mode="client", static_path = static_path)
            if not content:
                return HTMLResponse("Front-end not built", status_code=500)
            return HTMLResponse(content=content)

        return await xray_service.generate_subscription(token, db, request)

        


    # 3️⃣ Роут для админки (SECRET_PATH)
    @app.get(f"/{SECRET_PATH}/{{full_path:path}}", include_in_schema=False)
    async def serve_admin_panel(full_path: str = ""):
        logger.info(f">>> Запрос к админке! Path: {full_path}")
        file_path = os.path.join(static_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)

        content = await get_spa_content(mode="admin", static_path = static_path)
        if content:
            return HTMLResponse(content=content)
        return HTMLResponse("Index not found", status_code=404)

else:
    logger.warning(f"⚠️ Статика не найдена: {static_path}")
