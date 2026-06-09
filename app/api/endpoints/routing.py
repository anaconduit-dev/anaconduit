# app/api/endpoints/routing.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_xray_service
from app.models.models import RoutingRule, Outbound
from app.schemas.outbound import RoutingRuleCreate, RoutingRuleResponse, RoutingRuleUpdate
from app.services.xray import XrayService
from app.services.routing_manager import RoutingManager

router = APIRouter()

@router.post("/add", response_model=RoutingRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_routing_rule(
    obj_in: RoutingRuleCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):
    manager = RoutingManager(db, xray_service)
    # По умолчанию создаем для мастера
    return await manager.create_rule(obj_in)

@router.get("/all", response_model=List[RoutingRuleResponse])
async def get_routing_rules(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    # Показываем все правила, сортируя по приоритету
    result = await db.execute(select(RoutingRule).order_by(RoutingRule.priority.desc()))
    return result.scalars().all()

@router.delete("/delete/{id}")
async def delete_routing_rule(
    id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    manager = RoutingManager(db, xray_service)
    await manager.delete_rule(id)
    return {"status": "success"}

@router.patch("/update/{id}", response_model=RoutingRuleResponse)
async def update_routing_rule(
    id: int,
    obj_in: RoutingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    manager = RoutingManager(db, xray_service)
    return await manager.update_rule(id, obj_in)