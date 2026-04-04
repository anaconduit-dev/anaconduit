# app/api/endpoints/resource.py

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.core.database import get_db
from app.models.models import XrayResource
from app.services.xray.resource_crud import get_resources, create_resource, update_resource, delete_resource
from app.core.dependencies import get_xray_service, get_current_admin
from app.schemas.resource import ResourceInDB, ResourceCreate, ResourceUpdate

router = APIRouter()

@router.get("/get", response_model=list[ResourceInDB])
async def list_geo_resources(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    return await get_resources(db)

@router.post("/add", response_model=ResourceInDB)
async def add_geo_resource(
    res: ResourceCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    new_res = await create_resource(db, res)
    asyncio.create_task(xray_service.manager.sync_all_resources())
    return new_res

@router.patch("/update/{resource_id}", response_model=ResourceInDB)
async def edit_geo_resource(
    resource_id: int, 
    res: ResourceUpdate,
    db: AsyncSession = Depends(get_db),
    xray_service = Depends(get_xray_service), # ИСПРАВЛЕНО: было get_current_admin
    admin: dict = Depends(get_current_admin)
):
    db_res = await update_resource(db, resource_id, res)
    if not db_res:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if db_res.status == "pending":
        # Запускаем фоновую задачу, чтобы не заставлять фронтенд ждать скачивания
        asyncio.create_task(xray_service.manager.sync_all_resources(force_resource_id=resource_id))
        
    return db_res

@router.delete("/remove/{resource_id}")
async def remove_geo_resource(
    resource_id: int,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    await delete_resource(db, resource_id)
    return {"status": "deleted"}

@router.post("/sync")
async def trigger_sync(
    xray_service = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Ручной запуск синхронизации всех файлов"""
    await xray_service.manager.sync_all_resources()
    return {"status": "sync_triggered"}

@router.post("/sync/{resource_id}")
async def trigger_single_resource_sync(
    resource_id: int,
    xray_service = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Принудительное обновление конкретного файла по кнопке из UI"""
    # Вызываем синхронизацию. 
    # Если хочешь дождаться результата и вернуть успех/провал, 
    # нужно, чтобы sync_all_resources что-то возвращала.
    await xray_service.manager.sync_all_resources(force_resource_id=resource_id)
    
    # После выполнения проверяем статус в БД
    async with AsyncSessionLocal() as session:
        res = await session.get(XrayResource, resource_id)
        if res and res.status == "success":
            return {"status": "success"}
        else:
            return {"status": "failed", "error": res.error_message if res else "Not found"}