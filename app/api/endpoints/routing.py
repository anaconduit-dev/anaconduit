from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_xray_service
from app.models.models import RoutingRule, Outbound
from app.schemas.outbound import RoutingRuleCreate, RoutingRuleResponse, RoutingRuleUpdate
from app.services.xray import XrayService

router = APIRouter()

@router.post("/add", response_model=RoutingRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_routing_rule(
    obj_in: RoutingRuleCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):
    # 1. Проверяем, существует ли целевой outbound_tag в базе
    outbound_check = await db.execute(
        select(Outbound).where(Outbound.tag == obj_in.outbound_tag)
    )
    if not outbound_check.scalars().first():
        # Если тега нет в БД, Xray всё равно упадет, но лучше остановить это сразу
        raise HTTPException(
            status_code=400, 
            detail=f"Outbound с тегом '{obj_in.outbound_tag}' не существует"
        )

    # 2. Добавляем в сессию (без commit)
    new_rule = RoutingRule(**obj_in.model_dump())
    db.add(new_rule)
    
    # 3. ВАЛИДАЦИЯ через flush и xray -test
    await db.flush()
    
    test_config = await xray_service.generator.build_config(db)
    is_valid, error_msg = await xray_service.validate_config(test_config)

    if not is_valid:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"Ошибка маршрутизации Xray: {error_msg}"
        )

    # 4. Фиксация
    await db.commit()
    await db.refresh(new_rule)
    
    # Рестарт Xray для применения правил
    await xray_service.sync_and_restart()
    return new_rule

@router.get("/all", response_model=List[RoutingRuleResponse])
async def get_routing_rules(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    # Сортируем по приоритету (как в конфиге Xray)
    result = await db.execute(select(RoutingRule).order_by(RoutingRule.priority.desc()))
    return result.scalars().all()

@router.delete("/delete/{id}")
async def delete_routing_rule(
    id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    obj = await db.get(RoutingRule, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    await db.delete(obj)
    await db.commit()
    
    # После удаления тоже рестартим, чтобы Xray перестал использовать правило
    await xray_service.sync_and_restart()
    return {"status": "success", "message": "Rule deleted"}

@router.patch("/update/{id}", response_model=RoutingRuleResponse)
async def update_routing_rule(
    id: int,
    obj_in: RoutingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    # 1. Ищем правило
    rule = await db.get(RoutingRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Правило не найдено")

    # 2. Если меняется outbound_tag, проверяем его существование
    if obj_in.outbound_tag is not None:
        outbound_check = await db.execute(
            select(Outbound).where(Outbound.tag == obj_in.outbound_tag)
        )
        if not outbound_check.scalars().first():
            raise HTTPException(
                status_code=400, 
                detail=f"Целевой outbound '{obj_in.outbound_tag}' не существует"
            )

    # 3. Применяем изменения к объекту в памяти
    update_data = obj_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    # 4. ВАЛИДАЦИЯ (снова через flush + xray -test)
    await db.flush()
    
    test_config = await xray_service.generator.build_config(db)
    is_valid, error_msg = await xray_service.validate_config(test_config)

    if not is_valid:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"Ошибка в обновленном правиле Xray: {error_msg}"
        )

    # 5. Фиксация и рестарт
    await db.commit()
    await db.refresh(rule)
    
    await xray_service.sync_and_restart()
    return rule