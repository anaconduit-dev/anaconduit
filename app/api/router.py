from fastapi import APIRouter
from app.api.xray import router as xray_router 
from app.api.docker import router as docker_router

api_router = APIRouter()

# Добавляем префиксы и теги для удобства в Swagger UI
api_router.include_router(
    xray_router, 
    prefix="/xray", 
    tags=["Xray Management"]
)

api_router.include_router(
    docker_router, 
    prefix="/docker", 
    tags=["Docker System"]
)
