import logging
import secrets
import psutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.dependencies import get_xray_service, get_current_admin
from app.models.models import Client, Inbound, User
from app.services.xray_service import XrayService
from app.schemas.user import UserResponse
from typing import List, Optional
from datetime import datetime, timedelta, time
from app.core.config import settings
from app.core.logging import setup_logging


logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)):
    # 1. Считаем общее кол-во активных юзеров
    total_query = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    total_clients = total_query.scalar() or 0

    # 2. Считаем новых за сегодня (от 00:00:00 текущего дня)
    today_start = datetime.combine(datetime.now(), time.min)
    new_today_query = await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    new_today = new_today_query.scalar() or 0

    # 3. Суммируем весь трафик (из агрегированных полей пользователей)
    traffic_query = await db.execute(
        select(func.sum(User.total_up + User.total_down))
    )
    total_traffic_bytes = traffic_query.scalar() or 0

    return {
        "total_clients": total_clients,
        "new_today": new_today,
        "total_traffic_bytes": total_traffic_bytes
    }


@router.get("/system/summary")
async def get_dashboard_summary():
    system_cpu = psutil.cpu_percent(interval=None) # Текущая нагрузка CPU
    system_ram = psutil.virtual_memory() # Данные по RAM сервера
    
    # Свободное место на диске (там, где лежат логи и БД)
    disk = psutil.disk_usage('/')

    return {
        "system": {
            "cpu_percent": system_cpu,
            "mem_percent": system_ram.percent,
            "disk_percent": disk.percent
        }
    }