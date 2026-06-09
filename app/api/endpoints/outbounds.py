# app/api/endpoints/outbounds.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from app.core.database import get_db
from app.models.models import Outbound
from app.schemas.outbound import OutboundCreate, OutboundResponse, OutboundUpdate
from app.core.dependencies import get_current_admin, get_xray_service
from app.services.xray import XrayService
from app.services.outbound_manager import OutboundManager

router = APIRouter()

@router.post("/add", response_model=OutboundResponse)
async def create_outbound(
    obj_in: OutboundCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):
    manager = OutboundManager(db, xray_service)
    # По умолчанию node_id=1, можно расширить схему для выбора ноды
    return await manager.create_outbound(obj_in, node_id=1)

@router.get("/get_outbounds", response_model=List[OutboundResponse])
async def get_outbounds(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    result = await db.execute(select(Outbound))
    return result.scalars().all()

@router.delete("/delete/{id}")
async def delete_outbound(
    id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):
    manager = OutboundManager(db, xray_service)
    await manager.delete_outbound(id)
    return {"status": "success"}

@router.patch("/update/{id}", response_model=OutboundResponse)
async def update_outbound(
    id: int,
    obj_in: OutboundUpdate,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    manager = OutboundManager(db, xray_service)
    return await manager.update_outbound(id, obj_in)