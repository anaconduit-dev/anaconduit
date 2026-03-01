from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_admin
from app.services.docker_service import DockerService

router = APIRouter()

@router.get("/containers")
async def list_all_allowed_containers(
    service: DockerService = Depends(DockerService), # Можно так, если нет сложных зависимостей
    user=Depends(get_current_admin)
):
    """Список только разрешенных системных контейнеров"""
    return await service.list_containers()

# И всё! Остальное уехало в xray.py
