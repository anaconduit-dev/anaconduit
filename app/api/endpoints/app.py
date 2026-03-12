from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.config import settings
import logging
import secrets
from app.core.dependencies import get_current_admin, get_update_service
from app.schemas.system import UpdateRequest
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.logging import setup_logging
from pydantic import BaseModel
from app.services.update_service import UpdateService



setup_logging(settings.log_level)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/update")
async def start_update(
    data: UpdateRequest,
    dmin: dict = Depends(get_current_admin),
    update_service: UpdateService = Depends(get_update_service)
    ):
    """
    Эндпоинт, который вызывает фронтенд при нажатии кнопки 'Обновить'
    """
    # 1. Проверяем, что гит смог переключить версию
    # Мы используем await, потому что это быстрая операция
    success = await update_service.apply_update(data.version_tag)
    
    if not success:
        raise HTTPException(
            status_code=500, 
            detail="Не удалось переключить версию кода через Git"
        )

    # 2. Запускаем перезапуск контейнеров через 2 секунды,
    # чтобы успеть отправить этот ответ фронтенду
    import asyncio
    loop = asyncio.get_event_loop()
    loop.call_later(2, update_service.trigger_rebuild)

    return {
        "status": "success", 
        "message": f"Код обновлен до {data.version_tag}. Система перезагружается..."
    }


@router.get("/status")
async def get_system_status(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
    ):
    # Узнаем текущую ревизию из Alembic
    try:
        db_version = await db.execute(text("SELECT version_num FROM alembic_version"))
        rev = db_version.scalar()
    except Exception:
        rev = "unknown"

    return {
        "app_name": settings.app_name,
        "version": settings.VERSION,
        "db_revision": rev
    }