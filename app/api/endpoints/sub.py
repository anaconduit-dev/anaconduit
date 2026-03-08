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
from app.core.dependencies import get_xray_service, get_current_admin
from app.core.config import settings




router = APIRouter()
@router.get("/{user_id}/config-links")
async def get_user_links(
    user_id: int, 
    db: AsyncSessionLocal = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
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







