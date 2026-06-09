import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.dependencies import get_xray_service, get_current_admin
from app.models import Client, Inbound, User 
from app.services.xray import XrayService
from app.services.user_orchestrator import UserOrchestrator
from app.schemas.user import UserResponse, UpdateLimitsSchema
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
from app.core.config import settings
from app.core.logging import setup_logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/{inbound_id}/add-client")
async def add_client(
    inbound_id: int, email: str, id_or_password: str, flow: Optional[str] = "", level: int = 0,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    orchestrator = UserOrchestrator(db, xray_service)
    user, client = await orchestrator.add_client(inbound_id, email, id_or_password, flow, level)
    
    return {
        "status": "success", 
        "user_id": user.id,
        "client_id": client.id,
        "uuid": client.uuid,
    }

@router.get("/get_user", response_model=List[UserResponse])
async def get_users(
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), # Добавляем для инициализации оркестратора
    admin: dict = Depends(get_current_admin)
):
    orchestrator = UserOrchestrator(db, xray_service)
    return await orchestrator.get_all_users()


# --- 1. УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ПОЛНОСТЬЮ ---
@router.delete("/remove/{user_id}")
async def delete_full_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    orchestrator = UserOrchestrator(db, xray_service)
    email = await orchestrator.delete_full_user(user_id)
    return {"status": "success", "detail": f"Пользователь {email} полностью удален"}

# --- 2. УДАЛЕНИЕ ДОСТУПА ТОЛЬКО К ОДНОМУ ИНБАУНДУ ---
@router.delete("/delete/{user_id}/inbound/{inbound_id}")
async def remove_user_from_inbound(
    user_id: int, inbound_id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    orchestrator = UserOrchestrator(db, xray_service)
    tag = await orchestrator.remove_from_inbound(user_id, inbound_id)
    return {"status": "success", "detail": f"Доступ к {tag} аннулирован"}

@router.patch("/update-limits/{user_id}")
async def update_user_limits(
    user_id: int, data: UpdateLimitsSchema,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    orchestrator = UserOrchestrator(db, xray_service)
    user = await orchestrator.update_limits(user_id, data)
    return {
        "status": "success", 
        "is_active": user.is_active,
        "auto_reset": user.auto_reset_traffic,
        "reset_period": user.reset_period
    }

@router.post("/users/{user_id}/reset-token")
async def reset_subscription_token(
    user_id: int, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    orchestrator = UserOrchestrator(db, xray_service)
    new_token = await orchestrator.reset_token(user_id)
    return {"new_token": new_token}

@router.post("/{user_id}/reset-traffic")
async def reset_user_traffic(
    user_id: int, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin),
    xray_service: XrayService = Depends(get_xray_service)
):
    orchestrator = UserOrchestrator(db, xray_service)
    email = await orchestrator.reset_traffic(user_id)
    return {"status": "success", "message": f"Traffic reset for user {email}"}