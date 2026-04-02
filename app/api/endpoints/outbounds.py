# app/api/v1/endpoints/outbounds.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from app.core.database import get_db
from app.models.models import Outbound
from app.schemas.outbound import OutboundCreate, OutboundResponse, OutboundUpdate
from app.core.dependencies import get_current_admin, get_xray_service
from app.services.xray import XrayService

router = APIRouter()

@router.post("/add", response_model=OutboundResponse)
async def create_outbound(
    obj_in: OutboundCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):

    # 1. Базовые проверки
    if obj_in.tag.lower() == "api":
        raise HTTPException(status_code=400, detail="Тег 'api' зарезервирован")

    # 2. Валидация каскада (Proxy Chain)
    if obj_in.proxy_settings and obj_in.proxy_settings.get("tag"):
        target_tag = obj_in.proxy_settings["tag"]
        
        # В режиме создания проверяем только против нового тега
        if target_tag == obj_in.tag:
            raise HTTPException(status_code=400, detail="Outbound не может проксировать через самого себя")
        
        target_exists = await db.execute(select(Outbound).where(Outbound.tag == target_tag))
        if not target_exists.scalars().first():
            raise HTTPException(status_code=400, detail=f"Целевой outbound '{target_tag}' не существует")

    # 3. Подготовка данных в БД
    if obj_in.is_default:
        await db.execute(update(Outbound).where(Outbound.is_default == True).values(is_default=False))
        await db.flush()

    new_outbound = Outbound(**obj_in.model_dump())
    db.add(new_outbound)
    await db.flush() # Отправляем в базу, чтобы генератор увидел изменения, но не фиксируем

    # 3. ВАЛИДАЦИЯ
    # Генерируем конфиг на основе текущего состояния сессии (включая flush)
    test_config = await xray_service.generator.build_config(db)
    is_valid, error_msg = await xray_service.validate_config(test_config)

    if not is_valid:
        await db.rollback() # Откатываем изменения в БД
        raise HTTPException(
            status_code=400, 
            detail=f"Ошибка валидации Xray: {error_msg}"
        )

    # 4. Если всё ок — фиксируем и перезапускаем
    await db.commit()
    await db.refresh(new_outbound)
    
    await xray_service.sync_and_restart()
    return new_outbound

@router.get("/get_outbounds", response_model=List[OutboundResponse])
async def get_outbounds(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    result = await db.execute(select(Outbound))
    return result.scalars().all()

@router.delete("/delete/{id}")
async def delete_outbound(
    id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):
    obj = await db.get(Outbound, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Outbound не найден")
    
    if obj.is_default:
        raise HTTPException(status_code=400, detail="Нельзя удалить default outbound")

    await db.delete(obj)
    await db.flush()

    # Валидируем, что после удаления всё еще работает
    test_config = await xray_service.generator.build_config(db)
    is_valid, error_msg = await xray_service.validate_config(test_config)

    if not is_valid:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Удаление приведет к ошибке конфига: {error_msg}")

    await db.commit()
    await xray_service.sync_and_restart()
    return {"status": "deleted"}

@router.patch("/update/{id}", response_model=OutboundResponse)
async def update_outbound(
    id: int,
    obj_in: OutboundUpdate,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    # 1. Получаем существующий объект
    db_obj = await db.get(Outbound, id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Outbound не найден")

    # Валидация каскада
    if obj_in.proxy_settings and obj_in.proxy_settings.get("tag"):
        target_tag = obj_in.proxy_settings["tag"]
        
        # Проверяем против нового тега (если он меняется) или против текущего
        final_tag = obj_in.tag or db_obj.tag
        if target_tag == final_tag:
            raise HTTPException(status_code=400, detail="Outbound не может проксировать через самого себя")
        
        target_exists = await db.execute(select(Outbound).where(Outbound.tag == target_tag))
        if not target_exists.scalars().first():
            raise HTTPException(status_code=400, detail=f"Целевой outbound '{target_tag}' не существует")
    
    # 2. Если меняем тег на 'api' — запрещаем
    if obj_in.tag and obj_in.tag.lower() == "api":
        raise HTTPException(status_code=400, detail="Тег 'api' зарезервирован")

    # 3. Обработка смены дефолтного аутбаунда
    if obj_in.is_default is True:
        # Снимаем флаг с других
        await db.execute(
            update(Outbound)
            .where(Outbound.id != id)
            .where(Outbound.is_default == True)
            .values(is_default=False)
        )

    # 4. Применяем изменения к объекту
    update_data = obj_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_obj, key, value)

    # 5. ВАЛИДАЦИЯ через Xray
    await db.flush() # Временно сохраняем в БД для генератора

    test_config = await xray_service.generator.build_config(db)
    is_valid, error_msg = await xray_service.validate_config(test_config)

    if not is_valid:
        await db.rollback() # Откатываем всё, если Xray не принял новый конфиг
        raise HTTPException(
            status_code=400, 
            detail=f"Ошибка в обновленных настройках Xray: {error_msg}"
        )

    # 6. Фиксация и применение
    await db.commit()
    await db.refresh(db_obj)
    
    # Синхронизируем конфиг в файловой системе и перезапускаем ядро
    await xray_service.sync_and_restart()
    
    return db_obj