from fastapi import APIRouter
from app.api import xray, docker
from app.api.endpoints import auth, inbounds, clients, config, sub, nginx, stats



api_router = APIRouter()

# Добавляем префиксы и теги для удобства в Swagger UI
api_router.include_router(
    xray.router, 
    prefix="/xray", 
    tags=["Xray Management"]
)

api_router.include_router(
    docker.router, 
    prefix="/docker", 
    tags=["Docker System"]
)
api_router.include_router(
    sub.router, 
    prefix="/subscribe", 
    tags=["Subscription"]
)
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Security"])

api_router.include_router(
    inbounds.router,
    prefix="/inbound",
    tags=["inbounds"])

api_router.include_router(
    clients.router,
    prefix="/client",
    tags=["clients"])

api_router.include_router(
    config.router,
    prefix="/custom_config",
    tags=["custom_config"])
    
api_router.include_router(
    nginx.router, 
    prefix="/nginx", 
    tags=["nginx"]
)

api_router.include_router(
    stats.router, 
    prefix="/stats", 
    tags=["stats"]
)