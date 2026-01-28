from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user
from app.services.docker_service import DockerService
from app.services.xray_service import XrayService

router = APIRouter(
    prefix="/docker",
    tags=["Docker"],
)

docker_service = DockerService()
xray_service = XrayService()

@router.get("/containers")
def containers(user=Depends(get_current_user)):
    return docker_service.list_containers()


@router.post("/containers/{name}/restart")
def restart_container(name: str, user=Depends(get_current_user)):
    try:
        docker_service.restart(name)
        return {"status": "ok"}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/xray/versions")
async def xray_versions(user=Depends(get_current_user)):
    return await xray_service.get_available_xray_versions()

@router.post("/xray/install")
async def install_xray(version: str, user=Depends(get_current_user)):
    """
    Устанавливает выбранную версию Xray через Docker.
    """
    result = await xray_service.start(version)
    return result
    
@router.get("/xray/logs")
async def xray_logs(user=Depends(get_current_user)):
    return xray_service.logs()
