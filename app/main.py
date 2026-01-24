from fastapi import FastAPI, HTTPException
from .services.github import get_xray_releases

from .core.docker_manager import install_xray_container, get_xray_status
from pydantic import BaseModel

app = FastAPI(title="Anaconduit Panel API")

@app.get("/api/xray/versions")
async def fetch_versions():
    """
    Получает список доступных версий Xray-core с GitHub.
    """
    data = await get_xray_releases()
    
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    
    return data

class InstallRequest(BaseModel):
    version: str

@app.post("/api/xray/install")
async def install_xray(request: InstallRequest):
    """
    Устанавливает выбранную версию Xray через Docker.
    """
    result = await install_xray_container(request.version)
    return result

@app.get("/api/xray/status")
async def xray_status():
    """Получить текущее состояние ядра Xray"""
    status = await get_xray_status()
    return status
