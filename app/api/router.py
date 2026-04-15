from fastapi import APIRouter
from app.api import xray, docker
from app.api.endpoints import (
    auth, inbounds, clients, 
    config, sub, nginx, stats, 
    admin, app, backup, outbounds, 
    routing, resources, settings,
    groups, templates)



api_router = APIRouter()

# Добавляем префиксы и теги для удобства в Swagger UI
api_router.include_router(
    xray.router, 
    prefix="/xray", 
    tags=["Xray Management"]
)

api_router.include_router(
    templates.router, 
    prefix="/templates", 
    tags=["Subscription Templates"])

api_router.include_router(
    groups.router, 
    prefix="/groups", 
    tags=["Groups"])

api_router.include_router(
    resources.router, 
    prefix="/resource", 
    tags=["resource"]
)

api_router.include_router(
    settings.router, 
    prefix="/settings", 
    tags=["settings"]
)

api_router.include_router(
    app.router, 
    prefix="/app", 
    tags=["App Management"]
)

api_router.include_router(
    admin.router, 
    prefix="/admin", 
    tags=["admin"]
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
    tags=["inbound"])
    
api_router.include_router(
    outbounds.router,
    prefix="/outbound",
    tags=["outbound"])

api_router.include_router(
    routing.router,
    prefix="/routing",
    tags=["routing"])

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

api_router.include_router(
    backup.router, 
    prefix="/backup", 
    tags=["backup"]
)