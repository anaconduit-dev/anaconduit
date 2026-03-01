import os
import re
import logging
import json
import base64
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse, FileResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine, Base, AsyncSessionLocal
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.models.models import User, Client
from app.services.xray_service import XrayService
from app.core.dependencies import get_xray_service
from app.core.config import settings




router = APIRouter()
@router.get("/{user_id}/config-links")
async def get_user_links(
    user_id: int, 
    db: AsyncSessionLocal = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service)
):
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(joinedload(User.clients).joinedload(Client.inbound))
    )
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    individual_links = []
    raw_links_list = []

    for client in user.clients:
        if client.inbound.protocol in ["vless", "trojan"]:
            link = xray_service.generate_config_link(client, user, client.inbound)
            raw_links_list.append(link)
            individual_links.append({
                "tag": client.inbound.tag,
                "protocol": client.inbound.protocol,
                "link": link
            })
    
    subscription_base64 = xray_service.generate_subscription(raw_links_list)
    link_subscription = f"https://{settings.panel_domain}/{settings.sub_path}/{user.subscription_token}"
    return {
        "user_email": user.email,
        "links": individual_links,
        "subscription": subscription_base64,
        "link_subscription": link_subscription
    }


@router.get("/info")
async def get_subscription_info(token: str, db: AsyncSessionLocal = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.subscription_token == token)
        .options(joinedload(User.clients).joinedload(Client.inbound))
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Subscription not found")

    used_traffic = (user.total_up or 0) + (user.total_down or 0)
    total_limit = user.traffic_limit
    
    # Считаем процент для фронтенда
    usage_percent = 0
    if total_limit and total_limit > 0:
        usage_percent = min(round((used_traffic / total_limit) * 100, 1), 100)

    return {
        "username": user.email,
        "status": "active" if user.is_active else "disabled",
        "used_traffic_gb": round(used_traffic / (1024**3), 2),
        "total_traffic_gb": round(total_limit / (1024**3), 2) if total_limit else None,
        "usage_percent": usage_percent,
        "expire_date": user.expiry_time,
        "links": {
            # Это ссылка, которую клиент вставляет в приложение (Shadowrocket/v2rayNG)
            "subscription_url": f"https://{settings.panel_domain}/{settings.sub_path}/{token}"
        }
    }



@router.get(f"/{settings.sub_path}/{{token}}", response_class=PlainTextResponse)
async def get_public_sub(
    token: str, 
    db: AsyncSessionLocal = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service)
):
    # Ищем пользователя именно по токену!
    result = await db.execute(
        select(User)
        .where(User.subscription_token == token, User.is_active == True)
        .options(joinedload(User.clients).joinedload(Client.inbound))
    )
    user = result.scalars().first()

    if not user:
        # Важно: для приложений лучше возвращать пустой список или 404
        raise HTTPException(status_code=404, detail="User not found or inactive")
    
    raw_links_list = []

    for client in user.clients:
        # Генерируем ссылку для каждого активного инбаунда пользователя
        link = xray_service.generate_config_link(client, user, client.inbound)
        if link:
            raw_links_list.append(link)
    
    # Кодируем список ссылок в Base64
    subscription_base64 = xray_service.generate_subscription(raw_links_list)
            
    return subscription_base64
