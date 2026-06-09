# app/api/endpoints/inbounds.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_xray_service, get_nginx_service
from app.schemas.inbound import InboundCreate, InboundUpdate
from app.models import Inbound, Client
from app.services.xray import XrayService
from app.services.nginx_service import NginxService
from app.services.inbound_manager import InboundManager

router = APIRouter()

@router.post("/add", status_code=status.HTTP_201_CREATED)
async def create_inbound(
    obj_in: InboundCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    nginx_service: NginxService = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
):
    manager = InboundManager(db, xray_service, nginx_service)
    # По умолчанию создаем на мастере (node_id=1), 
    # позже можно будет передавать node_id из фронтенда
    new_inbound = await manager.create_inbound(obj_in, node_id=1)
    return {"status": "success", "data": {"id": new_inbound.id}}

@router.delete("/delete/{inbound_id}")
async def delete_inbound(
    inbound_id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    nginx_service: NginxService = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
):
    manager = InboundManager(db, xray_service, nginx_service)
    await manager.delete_inbound(inbound_id)
    return {"status": "success", "message": f"Inbound {inbound_id} deleted"}

@router.get("/get_inbounds_all", response_model=List[dict])
async def get_inbounds(
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    # 1. Получаем список из БД
    query = (
        select(Inbound, func.count(Client.id).label("clients_count"))
        .outerjoin(Client, Inbound.id == Client.inbound_id)
        .group_by(Inbound.id)
    )
    result = await db.execute(query)
    rows = result.all()

    # 2. Получаем список "живых" тегов напрямую из Xray ядра
    # Нам нужно добавить этот метод в xray_service
    active_xray_tags = await xray_service.get_active_tags()

    output = []
    for inbound, count in rows:
        item = {
            "id": inbound.id,
            "tag": inbound.tag,
            "protocol": inbound.protocol,
            "port": inbound.port,
            "is_active": inbound.is_active,
            "is_running_in_xray": inbound.tag in active_xray_tags, # 🚀 Статус из API
            "clients_count": count,
            "dest": inbound.stream_settings.get("realitySettings", {}).get("dest", "N/A"),
            "node_id": inbound.node_id
        }
        output.append(item)
        
    return output

@router.get("/get/{inbound_id}")
async def get_inbound(
    inbound_id: int, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    nginx_service: NginxService = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
):
    manager = InboundManager(db, xray_service, nginx_service)
    return await manager.get_inbound(inbound_id)

@router.patch("/update/{inbound_id}")
async def update_inbound_api(
    inbound_id: int, 
    obj_in: InboundUpdate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    nginx_service: NginxService = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
):
    manager = InboundManager(db, xray_service, nginx_service)
    await manager.update_inbound(inbound_id, obj_in)
    return {"status": "success", "message": "Обновлено и синхронизировано"}

@router.get("/get_all_active_resources")
async def get_all_active_resources(
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    nginx_service: NginxService = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
):
    manager = InboundManager(db, xray_service, nginx_service)
    return await manager.get_active_resources()