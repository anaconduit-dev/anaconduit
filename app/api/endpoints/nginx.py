from fastapi import APIRouter, Depends, HTTPException, Body
from app.services.nginx_service import NginxService
from app.core.dependencies import get_current_admin, get_nginx_service
from app.core.config import settings
from app.schemas.system import LandingUpdate
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/landing", response_model=dict)
async def get_landing_content(
    nginx_service = Depends(get_nginx_service),
    current_admin=Depends(get_current_admin)
    ):
    """Получает текущее содержимое index.html"""
    index_file = nginx_service.base_dir / "www" / "index.html"
    
    if not index_file.exists():
        # Если файла нет, возвращаем стандартный текст или ошибку
        return {"html": "<h1>Welcome to Anaconduit</h1>"}
    
    try:
        content = index_file.read_text()
        return {"html": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не удалось прочитать файл: {e}")

@router.get("/landing/file/{filename:path}")
async def get_file(
    filename: str,
    nginx_service = Depends(get_nginx_service),
    current_admin=Depends(get_current_admin)
    ):
    content = await nginx_service.get_file_content(filename)
    return {"content": content}

@router.post("/landing")
async def update_landing_content(
    data: LandingUpdate,
    nginx_service = Depends(get_nginx_service),
    current_admin=Depends(get_current_admin)
):
    """Обновляет содержимое index.html"""
    try:
        await nginx_service.update_landing_page(data.html)
        return {"status": "success", "message": "Страница обновлена"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при записи: {e}")

@router.post("/apply")
async def apply_config(
    nginx_service = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
    ):
    """Перегенерация конфига без перезапуска контейнера (nginx reload)"""
    try:
        # 1. Генерируем конфиг
        await nginx_service.apply_all()
        
        return {"message": "Config applied and Nginx reloaded"}
        
    except Exception as e:
        logger.error(f"Failed to reload Nginx: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_status(
    nginx_service = Depends(get_nginx_service),
    admin=Depends(get_current_admin)
):
    """Текущий статус контейнера Xray"""
    return await nginx_service.get_current_status()


@router.post("/start")
async def start_nginx(
    nginx_service = Depends(get_nginx_service),
    admin=Depends(get_current_admin)
):
    """Запустить уже созданный контейнер"""
    return await nginx_service.start()

@router.post("/stop")
async def stop_nginx(
    nginx_service = Depends(get_nginx_service),
    admin=Depends(get_current_admin)
):
    """Остановить контейнер"""
    return await nginx_service.stop()

@router.post("/restart")
async def restart_nginx(
    nginx_service = Depends(get_nginx_service),
    admin=Depends(get_current_admin)
):
    """Перезагрузить контейнер"""
    return await nginx_service.restart()

@router.get("/logs")
async def get_nginx_logs(
    tail: int = 200, # Увеличим tail, так как после фильтрации строк станет меньше
    nginx_service: NginxService = Depends(get_nginx_service),
    admin = Depends(get_current_admin)
):
    """
    Выводит логи Nginx, исключая запросы к админ-панели (SECRET_PATH).
    """
    try:
        # Получаем сырые логи
        raw_logs = await nginx_service.logs(tail=tail)
        
        # Если logs возвращает одну строку с \n, разбиваем её
        if isinstance(raw_logs, str):
            log_lines = raw_logs.splitlines()
        else:
            log_lines = raw_logs

        # Фильтруем: оставляем только те строки, где НЕТ нашего секретного пути
        # Также можно убрать запросы к статике (assets), если нужно
        secret_path = settings.panel_secret_path.strip("/")
        
        filtered_logs = [
            line for line in log_lines 
            if f"/{secret_path}/" not in line 
            and "/assets/" not in line
            and "GET /health" not in line # убираем еще и проверки здоровья
        ]
        final_logs_string = "\n".join(filtered_logs)

        return {
            "container": nginx_service.CONTAINER_NAME, 
            "logs": final_logs_string
        }
    except Exception as e:
        logger.error(f"Ошибка при получении логов Nginx: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/landing/save")
async def save_file(
    filename: str = Body(..., embed=True), 
    html: str = Body(..., embed=True),
    nginx_service = Depends(get_nginx_service),
    current_admin=Depends(get_current_admin)
):
    """Создает или обновляет файл в директории www"""
    try:
        await nginx_service.save_file_content(filename, html)
        return {"status": "success", "message": f"File {filename} saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/landing/file/{filename:path}")
async def delete_file_endpoint(
    filename: str, 
    nginx_service = Depends(get_nginx_service),
    current_admin=Depends(get_current_admin)
):
    """Удаляет файл из директории www"""
    try:
        await nginx_service.delete_file(filename)
        return {"status": "success", "message": f"File {filename} deleted"}
    except Exception as e:
        # Если это наша ошибка про index.html — отдаем 400
        status = 400 if "index.html" in str(e) else 500
        raise HTTPException(status_code=status, detail=str(e))


@router.get("/landing/list_files")
async def get_list_files(
    subpath: str = "", # Добавляем возможность передать подпапку
    nginx_service = Depends(get_nginx_service),
    current_admin = Depends(get_current_admin) 
):
    try:
        # Передаем subpath в метод сервиса
        return await nginx_service.list_files(subpath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))