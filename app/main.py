from fastapi import FastAPI, HTTPException
from .services.github import get_xray_releases
from app.core.xray_api import XrayAPIClient

from .core.docker_manager import install_xray_container, get_xray_status, get_xray_logs
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

@app.get("/api/xray/logs")
async def xray_logs():
    """Получить текущее состояние ядра Xray"""
    logs = await get_xray_logs()
    return logs

@app.get("/api/xray/test-grpc")
async def test_grpc():
    client = XrayAPIClient()
    is_alive = await client.test_connection()
    if is_alive:
        return {"status": "connected", "message": "gRPC API is responding"}
    else:
        raise HTTPException(
            status_code=503, 
            detail="Xray gRPC API is unreachable. Check if Xray is running with API enabled."
        )


