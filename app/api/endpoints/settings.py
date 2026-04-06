# app/api/endpoints/settings.py 

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import GlobalSettings
from app.schemas.settings import GlobalSettingsResponse, GlobalSettingsUpdate
from app.core.dependencies import get_current_admin, get_xray_service
from app.services.xray import XrayService

router = APIRouter()

@router.get("/get", response_model=GlobalSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    """Получение текущих глобальных настроек"""
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.id == 1))
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(status_code=404, detail="Настройки не инициализированы")
    return settings

@router.patch("/update", response_model=GlobalSettingsResponse)
async def update_settings(
    obj_in: GlobalSettingsUpdate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """
    Универсальное обновление настроек (domain_strategy, log_level и т.д.)
    с обязательной валидацией через ядро Xray перед сохранением.
    """
    # 1. Получаем текущую запись (всегда id=1)
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.id == 1))
    db_obj = result.scalars().first()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="Запись настроек не найдена")

    # 2. Применяем изменения к объекту в памяти
    update_data = obj_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_obj, key, value)

    # 3. ПРЕДВАРИТЕЛЬНАЯ ВАЛИДАЦИЯ
    # Скидываем изменения в транзакцию БД, чтобы генератор их увидел
    await db.flush() 

    # Генерируем тестовый конфиг с новыми параметрами (стратегией, логами и т.д.)
    test_config = await xray_service.generator.build_config(db)
    is_valid, error_msg = await xray_service.validate_config(test_config)

    if not is_valid:
        # Если Xray "ругается" на новую стратегию или настройки, откатываемся
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"Xray не принимает эти настройки: {error_msg}"
        )

    # 4. ФИКСАЦИЯ
    await db.commit()
    await db.refresh(db_obj)
    
    # 5. СИНХРОНИЗАЦИЯ И ПЕРЕЗАПУСК
    # Это применит новую domain_strategy или уровень логирования немедленно
    await xray_service.sync_and_restart()
    
    return db_obj