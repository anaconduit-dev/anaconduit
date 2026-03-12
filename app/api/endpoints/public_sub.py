from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.models.models import User, Client
from app.core.config import settings
from sqlalchemy import text
# Здесь НЕ используем зависимости авторизации админа!
router = APIRouter(prefix="/api/v1")

@router.get("/{token}/info")
async def get_subscription_info(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.subscription_token == token)
        .options(joinedload(User.clients).joinedload(Client.inbound))
    )
    user = result.scalars().first()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Subscription not found or inactive")

    used_traffic = (user.total_up or 0) + (user.total_down or 0)
    total_limit = user.traffic_limit
    
    usage_percent = 0
    if total_limit and total_limit > 0:
        usage_percent = min(round((used_traffic / total_limit) * 100, 1), 100)

    return {
        "username": user.email,
        "status": "active",
        "used_traffic_gb": round(used_traffic / (1024**3), 2),
        "total_traffic_gb": round(total_limit / (1024**3), 2) if total_limit else None,
        "usage_percent": usage_percent,
        "expire_date": user.expiry_time,
        "subscription_url": f"https://{settings.panel_domain}/{settings.sub_path}/{token}"
    }



