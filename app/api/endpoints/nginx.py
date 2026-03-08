from fastapi import APIRouter, Depends, HTTPException
from app.services.nginx_service import NginxService
from app.core.dependencies import get_current_admin, get_nginx_service
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()



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
    tail: int = 100,
    nginx_service = Depends(get_nginx_service),
    admin=Depends(get_current_admin)
):
    """
    Выводит последние логи контейнера Xray для диагностики.
    """
    try:
        logs = await nginx_service.logs(tail=tail)
        return {"container": nginx_service.CONTAINER_NAME, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
