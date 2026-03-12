from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.config import settings
import logging
import secrets
from app.core.dependencies import get_current_admin
from app.schemas.system import UpdateRequest
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.logging import setup_logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()



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