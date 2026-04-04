# app/services/xray/resource_crud.py

import logging
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.models.models import XrayResource
from app.schemas.resource import ResourceCreate, ResourceUpdate

logger = logging.getLogger(__name__)

async def get_resources(db: AsyncSessionLocal):
    result = await db.execute(select(XrayResource))
    return result.scalars().all()

async def create_resource(db: AsyncSessionLocal, resource_in: ResourceCreate):
    new_res = XrayResource(**resource_in.model_dump(mode="json"))
    db.add(new_res)
    await db.commit()
    await db.refresh(new_res)
    return new_res

async def update_resource(db: AsyncSessionLocal, resource_id: int, resource_in: ResourceUpdate):
    result = await db.execute(select(XrayResource).where(XrayResource.id == resource_id))
    db_res = result.scalars().first()
    
    if db_res:
        # Переводим в dict, исключая непереданные поля
        update_data = resource_in.model_dump(exclude_unset=True, mode="json")
        
        # Если изменился URL, мы ДОЛЖНЫ перекачать файл
        if "url" in update_data:
            # Превращаем HttpUrl в строку для БД, если Pydantic вернул объект
            if update_data["url"]:
                update_data["url"] = str(update_data["url"])
            
            update_data["status"] = "pending"
            db_res.last_updated = None  # Сбрасываем дату, чтобы прошел по условиям времени
            logger.info(f"🔄 URL ресурса {db_res.filename} изменен. Статус сброшен в pending.")

        for key, value in update_data.items():
            setattr(db_res, key, value)
            
        await db.commit()
        await db.refresh(db_res)
    return db_res

async def delete_resource(db: AsyncSessionLocal, resource_id: int):
    result = await db.execute(select(XrayResource).where(XrayResource.id == resource_id))
    db_res = result.scalars().first()
    if db_res:
        await db.delete(db_res)
        await db.commit()
    return db_res