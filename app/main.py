import logging
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.api.endpoints.sub import get_public_sub
from app.core.dependencies import get_xray_service, get_xray_client
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.router import api_router
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.database import get_db
from app.models import models 
from app.core.security import hash_password
from sqlalchemy import select 
from app.xray_api.client import XrayAPIClient
from app.services.xray_service import XrayService
from app.services.nginx_service import NginxService

xray_client = XrayAPIClient()
xray_service = XrayService(client=xray_client)
nginx_service = NginxService()

# Настройка логирования
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)

# --- Настройки путей (выносим в начало для удобства) ---
SECRET_PATH = settings.panel_secret_path.strip('/')
SUB_PATH = settings.sub_path.strip('/')
static_path = os.path.join(os.path.dirname(__file__), "static")
# --- Вспомогательная логика SPA ---

async def get_spa_content(mode: str):
    """Готовит index.html с внедренным конфигом"""
    index_file = os.path.join(static_path, "index.html")
    if not os.path.exists(index_file):
        return None
        
    try:
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()

        basename = f"/{SECRET_PATH}" if mode == "admin" else f"/{SUB_PATH}"
        
        # Конфиг для React
        config_script = f"""
        <script>
            window.__PANEL_CONFIG__ = {{ 
                "basename": "{basename}",
                "mode": "{mode}" 
            }};
        </script>
        """
        # Важно: добавляем <base>, чтобы относительные пути в JS/CSS работали
        replacement = f'<head><base href="{basename}/">{config_script}'
        content = content.replace("<head>", replacement)
        return content
    except Exception as e:
        logger.error(f"Error reading index.html: {e}")
        return None

# --- Вспомогательные функции (админ, статы) остаются без изменений ---
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

async def stats_updater_task():
    client = get_xray_client()
    xray_service = get_xray_service(client)
    while True:
        try:
            await asyncio.sleep(30) 
            await xray_service.update_stats_in_db()
            await xray_service.check_limits_and_disable()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"❌ Ошибка в фоновом планировщике статистики: {e}")
            await asyncio.sleep(30)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Приложение Anaconduit запускается")

    # 1. Создание таблиц
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Создание начального админа
    try:
        await create_initial_admin()
    except Exception as e:
        logger.error(f"❌ Ошибка при создании начального админа: {e}")

    # 3. Установка и запуск Xray
    try:
        await xray_service.ensure_xray_running(version="latest")
        # Генерация конфигов сразу после установки
        await xray_service.generate_full_config()
        await nginx_service.ensure_nginx_running()
    except Exception as e:
        logger.error(f"❌ Не удалось установить Xray при старте: {e}")

    # 4. Фоновый планировщик статистики
    bg_task = asyncio.create_task(stats_updater_task())
    
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
app.include_router(api_router)



@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": settings.app_name}

# 2. ПОДКЛЮЧАЕМ СТАТИКУ ФРОНТЕНДА (в самом конце)
# Путь внутри контейнера будет /app/app/static (согласно Dockerfile)
# 2. Подключаем Фронтенд (SPA)
if os.path.exists(static_path):
    # Ассеты (JS/CSS) должны быть доступны по прямому пути /assets/... 
    # Nginx будет проксировать их сюда
    assets_dir = os.path.join(static_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Роут для СТРАНИЦЫ ПОДСПИСКИ
    @app.get(f"/{SUB_PATH}/{{token:path}}", include_in_schema=False)
    async def serve_subscription(
        request: Request, 
        token: str, 
        db: AsyncSessionLocal = Depends(get_db)
    ):
        if token.startswith("assets/"):
            file_path = os.path.join(static_path, token)
            if os.path.exists(file_path):
                return FileResponse(file_path)
        # 1. Определяем тип клиента по User-Agent
        user_agent = request.headers.get("user-agent", "").lower()
        logger.info(f">>> Запрос к подписке! клиент: {user_agent}")
        # Список сигнатур v2ray-клиентов
        is_client_app = any(app in user_agent for app in [
            "v2ray", "shadowrocket", "nekobox", "clash", 
            "streisand", "sing-box", "surge", "v2fly", "prizrak-box"
        ])

        if is_client_app:
            try:
                # Получаем сервис через зависимости вручную (так как мы внутри роута)
                xray_service = globals().get("xray_service")
                
                # Отдаем конфиг (Base64) напрямую приложению
                return await get_public_sub(
                    token=token, 
                    db=db, 
                    xray_service=xray_service
                )
            except Exception as e:
                logger.error(f"Ошибка генерации конфига для приложения: {e}")
                raise HTTPException(status_code=404, detail="Config not found")

        # 2. Если это браузер — отдаем интерфейс (SPA)
        content = await get_spa_content(mode="client")
        if not content:
            return HTMLResponse("Front-end not built", status_code=500)
            
        return HTMLResponse(content=content)

    # Роут для АДМИН-ПАНЕЛИ
    @app.get(f"/{SECRET_PATH}/{{full_path:path}}", include_in_schema=False)
    async def serve_admin_panel(full_path: str = ""):
        logger.info(f">>> Запрос к админке! Path: {full_path}")
        # Аналогичная проверка на файлы
        file_path = os.path.join(static_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        content = await get_spa_content(mode="admin")
        if content:
            return HTMLResponse(content=content)
        return HTMLResponse("Index not found", status_code=404)
        
else:
    logger.warning(f"⚠️ Статика не найдена: {static_path}")
