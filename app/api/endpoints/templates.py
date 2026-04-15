# app/api/endpoints/templates.py 

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.subscribe import SubscriptionTemplateCreate, SubscriptionTemplateRead, SubscriptionTemplateUpdate
from app.services.subscribe_service import SubscribeService
from app.core.dependencies import get_current_admin

router = APIRouter()

@router.post("/add", response_model=SubscriptionTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    obj_in: SubscriptionTemplateCreate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin) 
):
    """Создать новый шаблон подписки"""
    return await SubscribeService.create_template(db, obj_in)

@router.get("/get", response_model=List[SubscriptionTemplateRead])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Получить список всех шаблонов"""
    return await SubscribeService.get_templates(db)

@router.put("/update/{template_id}", response_model=SubscriptionTemplateRead)
async def update_template(
    template_id: int,
    obj_in: SubscriptionTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Обновить существующий шаблон"""
    updated = await SubscribeService.update_template(db, template_id, obj_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return updated

@router.delete("/delete/{template_id}")
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Удалить шаблон"""
    success = await SubscribeService.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return {"status": "success", "message": "Template deleted"}