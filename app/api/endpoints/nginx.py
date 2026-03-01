from fastapi import APIRouter, Depends, HTTPException
from app.services.nginx_service import NginxService
from app.core.dependencies import get_current_admin, get_nginx_service
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()



@router.post("/setup")
async def setup_nginx(use_ssl: bool = False, nginx_service = Depends(get_nginx_service)):
    """Первичная установка и запуск Nginx"""
    try:
        # 1. Генерируем конфиги
        await nginx_service.generate_main_nginx_conf()
        await nginx_service.generate_stream_conf()
        await nginx_service.generate_sites_conf()
        await nginx_service.generate_sites_conf()
        
       
        
        # 2. Запускаем контейнер
        await nginx_service.install_and_run()
        return {"message": "Nginx started successfully", "ssl": use_ssl}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/apply")
async def apply_config(nginx_service = Depends(get_nginx_service)):
    """Перегенерация конфига без перезапуска контейнера (nginx reload)"""
    try:
        # 1. Генерируем конфиг
        await nginx_service.apply_all()
        
        
        logger.info(f"Nginx reload output: {output}")
        return {"message": "Config applied and Nginx reloaded", "details": output}
        
    except Exception as e:
        logger.error(f"Failed to reload Nginx: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_status(
    nginx_service = Depends(get_nginx_service),
    user=Depends(get_current_admin)
):
    """Текущий статус контейнера Xray"""
    return await nginx_service.get_current_status()


@router.post("/start")
async def start_nginx(
    nginx_service = Depends(get_nginx_service),
    user=Depends(get_current_admin)
):
    """Запустить уже созданный контейнер"""
    return await nginx_service.start()

@router.post("/stop")
async def stop_nginx(
    nginx_service = Depends(get_nginx_service),
    user=Depends(get_current_admin)
):
    """Остановить контейнер"""
    return await nginx_service.stop()

@router.post("/restart")
async def restart_nginx(
    nginx_service = Depends(get_nginx_service),
    user=Depends(get_current_admin)
):
    """Перезагрузить контейнер"""
    return await nginx_service.restart()

@router.get("/logs")
async def get_nginx_logs(
    tail: int = 100,
    nginx_service = Depends(get_nginx_service),
    user=Depends(get_current_admin)
):
    """
    Выводит последние логи контейнера Xray для диагностики.
    """
    try:
        logs = await nginx_service.logs(tail=tail)
        return {"container": nginx_service.CONTAINER_NAME, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
