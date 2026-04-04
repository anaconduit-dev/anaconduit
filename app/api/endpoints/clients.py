import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.dependencies import get_xray_service, get_current_admin
from app.models.models import Client, Inbound, User  # Добавили User
from app.services.xray import XrayService
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
    inbound_id: int,
    email: str,
    id_or_password: str,
    flow: Optional[str] = "",
    level: int = 0,           
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    # 1. Проверяем существование инбаунда
    inbound = await db.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")
    if inbound.protocol == "vless":
        client_data = {
            "id": id_or_password, # Для VLESS это UUID
            "flow": flow,
            "email": email,
            "level": level
        }
    elif inbound.protocol == "trojan":
        client_data = {
            "password": id_or_password, # Для Trojan это пароль
            "email": email,
            "level": level
        }
    # 2. Ищем пользователя по email или создаем нового
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        user = User(email=email)
        db.add(user)
        await db.flush() # Получаем ID пользователя, не закрывая транзакцию
    
    # 3. Проверяем, нет ли уже у этого юзера подключения к этому инбаунду
    client_check = await db.execute(
        select(Client).where(Client.user_id == user.id, Client.inbound_id == inbound_id)
    )
    if client_check.scalars().first():
        raise HTTPException(status_code=400, detail="User already has access to this inbound")

    # 4. Создаем новое подключение (Client)
    # Используем один UUID для всех подключений пользователя (удобно для мульти-ссылок)
    # Либо генерируй новый, если хочешь разные UUID на разные порты
    new_client = Client(
        user_id=user.id,
        inbound_id=inbound_id,
        uuid=id_or_password,
        flow=flow if inbound.protocol == "vless" else "",
        level=level,    # 🆕 Сохраняем level
        reverse={},     # 🆕 По умолчанию пустой dict
        enable=True
    )
    
    db.add(new_client)
    
    try:
        await db.commit()
        await db.refresh(new_client)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    # 5. Добавляем в Xray через gRPC API
    # Передаем "чистый" email пользователя, сервис сам сделает email#tag
    try:
        await xray_service.add_client_to_xray(
            inbound_tag=inbound.tag,
            user_email=user.email,
            client_key=new_client.uuid,
            flow=new_client.flow,
            reverse=new_client.reverse,   
            level=new_client.level  
        )
    except Exception as e:
        # Если gRPC упал, запись в базе уже есть, но Xray о ней не знает. 
        # В идеале тут стоит сделать rollback или пометить client.enable = False
        raise HTTPException(status_code=500, detail=f"Xray API error: {e}")


    return {
        "status": "success", 
        "user_id": user.id,
        "client_id": new_client.id,
        "uuid": new_client.uuid,
    }

@router.get("/get_user", response_model=List[UserResponse])
async def get_users(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    """Получить список всех пользователей с полной вложенностью данных"""
    result = await db.execute(
        select(User).options(
            joinedload(User.clients).joinedload(Client.inbound) 
        )
    )
    return result.unique().scalars().all()


# --- 1. УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ПОЛНОСТЬЮ ---
@router.delete("/remove/{user_id}")
async def delete_full_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Удаляет юзера и ВСЕ его подключения из всех инбаундов"""
    result = await db.execute(
        select(User).options(joinedload(User.clients)).where(User.id == user_id)
    )
    user = result.unique().scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Удаляем из каждого инбаунда в Xray
    for client in user.clients:
        inbound = await db.get(Inbound, client.inbound_id)
        if inbound:
            await xray_service.remove_client_from_xray(inbound.tag, user.email)

    # Удаляем из БД (Client'ы удалятся по каскаду)
    await db.delete(user)
    await db.commit()
    
    return {"status": "success", "detail": f"Пользователь {user.email} полностью удален"}


# --- 2. УДАЛЕНИЕ ДОСТУПА ТОЛЬКО К ОДНОМУ ИНБАУНДУ ---
@router.delete("/delete/{user_id}/inbound/{inbound_id}")
async def remove_user_from_inbound(
    user_id: int,
    inbound_id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Удаляет доступ конкретного юзера к конкретному порту"""
    # Ищем клиента и подгружаем связанные данные
    result = await db.execute(
        select(Client)
        .options(joinedload(Client.user), joinedload(Client.inbound))
        .where(Client.user_id == user_id, Client.inbound_id == inbound_id)
    )
    client = result.scalars().first()

    if not client:
        raise HTTPException(status_code=404, detail="Доступ не найден")

    # 1. Выбиваем из Xray API
    await xray_service.remove_client_from_xray(
        inbound_tag=client.inbound.tag,
        user_email=client.user.email
    )

    # 2. Удаляем только эту запись из таблицы clients
    await db.delete(client)
    await db.commit()

    return {"status": "success", "detail": f"Доступ к {client.inbound.tag} аннулирован"}

@router.patch("/update-limits/{user_id}")
async def update_user_limits(
    user_id: int,
    data: UpdateLimitsSchema, # Используем схему из Body
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin),
    xray_service: XrayService = Depends(get_xray_service)
):
    result = await db.execute(
        select(User).options(joinedload(User.clients).joinedload(Client.inbound)).where(User.id == user_id)
    )
    user = result.scalars().first()
    
    if not user: 
        raise HTTPException(status_code=404, detail="User not found")

    if data.auto_reset_traffic is not None:
        user.auto_reset_traffic = data.auto_reset_traffic
    
    if data.reset_period is not None:
        user.reset_period = data.reset_period

    # 2. Обновляем лимиты
    if data.traffic_limit is not None:
        user.traffic_limit = data.traffic_limit * 1024 * 1024 * 1024
    
    if data.add_days is not None:
        if data.add_days == 0:
            user.expiry_time = None
        else:
            start_date = user.expiry_time if (user.expiry_time and user.expiry_time > datetime.now()) else datetime.now()
            user.expiry_time = start_date + timedelta(days=data.add_days)

    # 3. Логика автоматической активации
    now = datetime.now()
    # Важно: суммируем текущий расход
    total_used = (user.total_up or 0) + (user.total_down or 0)
    time_ok = not user.expiry_time or user.expiry_time > now
    traffic_ok = user.traffic_limit == 0 or total_used < user.traffic_limit

    if time_ok and traffic_ok and not user.is_active:
        user.is_active = True
        logger.info(f"🚀 Активация пользователя {user.email}")
        
        for client in user.clients:
            if client.inbound and client.inbound.is_active:
                try:
                    await xray_service.add_client_to_xray(
                        inbound_tag=client.inbound.tag,
                        user_email=user.email,
                        client_key=client.uuid,
                        flow=client.flow,   
                        level=client.level  
                    )
                except Exception as e:
                    logger.error(f"Ошибка Xray: {e}")

    await db.commit()
    await xray_service.generate_full_config()

    return {
        "status": "success", 
        "is_active": user.is_active,
        "auto_reset": user.auto_reset_traffic,
        "reset_period": user.reset_period
    }

@router.post("/users/{user_id}/reset-token")
async def reset_subscription_token(
    user_id: int, db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404)
    
    user.subscription_token = secrets.token_urlsafe(16)
    await db.commit()
    return {"new_token": user.subscription_token}

@router.post("/{user_id}/reset-traffic")
async def reset_user_traffic(
    user_id: int, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin),
    xray_service: XrayService = Depends(get_xray_service)
):
    # 1. Проверяем существование пользователя
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # 2. Обновляем Clients (накопители + обнуление текущих)
        # Используем ленивое обновление через update statement
        await xray_service.reset_user_traffic(user_id)
        await db.commit()
        return {"status": "success", "message": f"Traffic reset for user {user.email}"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")