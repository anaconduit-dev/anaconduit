from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any

from app.core.dependencies import get_current_admin, get_xray_service
from app.services.xray_service import XrayService

# Роутер без префикса (он добавится в app/api/router.py)
router = APIRouter()

@router.get("/versions", response_model=List[str])
async def get_xray_versions(
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """
    Получает список доступных версий Xray напрямую из GitHub релизов.
    """
    versions = await service.get_available_xray_versions()
    if not versions:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, 
            detail="Could not fetch versions from GitHub"
        )
    return versions



@router.post("/install/{version}")
async def install_xray(
    version: str,
    # Вот здесь была ошибка! Исправляем:
    service: XrayService = Depends(get_xray_service), 
    user=Depends(get_current_admin)
):
    """Установка новой версии (с удалением старой)"""
    return await service.install(version)

@router.post("/start")
async def start_xray(
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """Запустить уже созданный контейнер"""
    return await service.start()

@router.post("/stop")
async def stop_xray(
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """Остановить контейнер"""
    return await service.stop()

@router.post("/restart")
async def restart_xray(
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """Перезагрузить контейнер"""
    return await service.restart()

@router.get("/status")
async def get_status(
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """Текущий статус контейнера Xray"""
    return await service.get_current_status()

@router.get("/stats")
async def get_xray_stats(
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """
    Запрашивает текущую статистику трафика через gRPC API Xray.
    """
    stats = await service.get_stats()
    # Если сервис вернул ошибку внутри списка (наш обработчик в сервисе так делает)
    if isinstance(stats, list) and len(stats) > 0 and "error" in stats[0]:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=stats[0]["error"])
    
    return stats


@router.get("/logs")
async def get_xray_logs(
    tail: int = 100,
    service: XrayService = Depends(get_xray_service),
    user=Depends(get_current_admin)
):
    """
    Выводит последние логи контейнера Xray для диагностики.
    """
    try:
        logs = await service.logs(tail=tail)
        return {"container": service.CONTAINER_NAME, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/gen-keys")
async def get_keys(
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Генерирует свежую пару ключей для нового Reality подключения"""
    keys = await xray_service.generate_reality_keys()
    return keys

    