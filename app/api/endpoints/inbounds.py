from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_xray_service, get_nginx_service
from app.schemas.inbound import InboundCreate, InboundUpdate
from app.models.models import Inbound, Client
from app.services.xray_service import XrayService
from app.services.nginx_service import NginxService

router = APIRouter()

@router.post("/add", status_code=status.HTTP_201_CREATED)
async def create_inbound(
    obj_in: InboundCreate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin),
    nginx_service: NginxService = Depends(get_nginx_service)
):
    # Проверяем, не занят ли порт другим активным инбаундом
    port_check = await db.execute(
        select(Inbound).where(Inbound.port == obj_in.port, Inbound.is_active == True)
    )
    if port_check.scalars().first():
        raise HTTPException(
            status_code=400, 
            detail=f"Порт {obj_in.port} уже используется другим активным инбаундом"
        )
    # 1. Проверяем уникальность тега
    existing = await db.execute(select(Inbound).where(Inbound.tag == obj_in.tag))
    if existing.scalars().first():
        raise HTTPException(
            status_code=400, 
            detail=f"Инбаунд с тегом '{obj_in.tag}' уже существует"
        )

    # 2. Сохраняем в базу данных
    new_inbound = Inbound(
        listen=obj_in.listen,
        tag=obj_in.tag,
        protocol=obj_in.protocol,
        port=obj_in.port,
        settings=obj_in.settings.model_dump(exclude_none=True),
        stream_settings=obj_in.stream_settings.model_dump(exclude_none=True),
        sniffing=obj_in.sniffing.model_dump(exclude_none=True),
        is_active=True
    )
    
    db.add(new_inbound)
    await db.commit()
    await db.refresh(new_inbound)

    # 3. МАГИЯ: Синхронизируем и рестартуем Xray
    try:
        await xray_service.sync_and_restart()
        await nginx_service.apply_all()
    except Exception as e:
        # Если Xray не смог рестартануть, мы не удаляем запись из БД, 
        # но сообщаем об ошибке применения конфига.
        raise HTTPException(
            status_code=500,
            detail=f"Данные сохранены, но Xray не смог применить конфиг: {e}"
        )
    
    return {
        "status": "success", 
        "message": f"Подключение '{obj_in.tag}' создано и запущено",
        "data": {"id": new_inbound.id, "port": new_inbound.port}
    }

@router.get("/get_inbounds_all", response_model=List[dict])
async def get_inbounds(
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    # 1. Получаем список из БД
    query = (
        select(Inbound, func.count(Client.id).label("clients_count"))
        .outerjoin(Client, Inbound.id == Client.inbound_id)
        .group_by(Inbound.id)
    )
    result = await db.execute(query)
    rows = result.all()

    # 2. Получаем список "живых" тегов напрямую из Xray ядра
    # Нам нужно добавить этот метод в xray_service
    active_xray_tags = await xray_service.get_active_tags()

    output = []
    for inbound, count in rows:
        item = {
            "id": inbound.id,
            "tag": inbound.tag,
            "protocol": inbound.protocol,
            "port": inbound.port,
            "is_active": inbound.is_active,
            "is_running_in_xray": inbound.tag in active_xray_tags, # 🚀 Статус из API
            "clients_count": count,
            "dest": inbound.stream_settings.get("realitySettings", {}).get("dest", "N/A")
        }
        output.append(item)
        
    return output

@router.delete("/delete/{inbound_id}")
async def delete_inbound(
    inbound_id: int,
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    nginx_service: NginxService = Depends(get_nginx_service),
    admin: dict = Depends(get_current_admin)
):
    """Удалить инбаунд и обновить конфиг Xray"""
    inbound = await db.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")
        
    await db.delete(inbound)
    await db.commit()
    
    # После удаления из БД — пересобираем конфиг и рестартим Xray
    await xray_service.sync_and_restart()
    await nginx_service.apply_all()
    
    return {"status": "success", "message": f"Inbound {inbound_id} deleted"}

@router.get("/get_all_active_resources")
async def get_all_active_resources(
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    # 1. Получаем все данные из Xray (уже сгруппированные)
    all_stats = await xray_service.client.get_all_stats()
    
    # Создаем словарь для быстрого доступа к данным трафика по имени
    xray_data = {item["name"]: item for item in all_stats if item["category"] == "inbound"}
    xray_tags = list(xray_data.keys())

    # 2. Получаем теги из БД
    result = await db.execute(select(Inbound.tag))
    db_tags = {row[0] for row in result.all()}

    # 3. Сопоставляем
    managed_running = []
    manual_inbounds = []
    
    for tag in xray_tags:
        if tag == "api-in": continue
        
        info = {
            "tag": tag,
            "total_mb": xray_data[tag]["total_mb"],
            "download_mb": xray_data[tag]["download_mb"],
            "upload_mb": xray_data[tag]["upload_mb"]
        }
        
        if tag in db_tags:
            managed_running.append(info)
        else:
            manual_inbounds.append(info)

    # Те, кто в базе есть, но в Xray не видны
    orphaned_db = [tag for tag in db_tags if tag not in xray_data]

    return {
        "managed_running": managed_running,
        "manual_inbounds": manual_inbounds,
        "orphaned_db_inbounds": orphaned_db
    }

@router.patch("/update/{inbound_id}")
async def update_inbound_api(
    inbound_id: int, 
    obj_in: InboundUpdate, 
    db: AsyncSession = Depends(get_db),
    xray_service: XrayService = Depends(get_xray_service), 
    admin: dict = Depends(get_current_admin)
):
    # 1. Сначала проверяем, существует ли сам инбаунд
    result = await db.execute(select(Inbound).where(Inbound.id == inbound_id))
    current_inbound = result.scalars().first()
    
    if not current_inbound:
        raise HTTPException(status_code=404, detail="Инбаунд не найден")

    # 2. Если меняется ПОРТ, проверяем, не занят ли он кем-то другим
    if obj_in.port is not None and obj_in.port != current_inbound.port:
        port_check = await db.execute(
            select(Inbound).where(
                Inbound.port == obj_in.port, 
                Inbound.is_active == True,
                Inbound.id != inbound_id  # Исключаем текущий инбаунд
            )
        )
        if port_check.scalars().first():
            raise HTTPException(
                status_code=400, 
                detail=f"Порт {obj_in.port} уже используется другим активным инбаундом"
            )

    # 3. Если меняется ТЕГ, проверяем уникальность
    if obj_in.tag is not None and obj_in.tag != current_inbound.tag:
        tag_check = await db.execute(
            select(Inbound).where(
                Inbound.tag == obj_in.tag,
                Inbound.id != inbound_id
            )
        )
        if tag_check.scalars().first():
            raise HTTPException(
                status_code=400, 
                detail=f"Инбаунд с тегом '{obj_in.tag}' уже существует"
            )

    # 4. Вызываем магию XrayService (Валидация DTO -> Commit -> Restart)
    try:
        # Превращаем схему в словарь, удаляя неуказанные поля
        update_data = obj_in.model_dump(exclude_unset=True)
        
        # Наш новый транзакционный метод в сервисе
        await xray_service.update_inbound(inbound_id, update_data)
        
    except ValueError as ve:
        # Это ошибки валидации конфига Xray
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Системные ошибки (Docker, БД и т.д.)
        raise HTTPException(status_code=500, detail=f"Ошибка при обновлении: {e}")

    return {
        "status": "success",
        "message": f"Инбаунд '{current_inbound.tag}' успешно обновлен и перезапущен",
        "data": {"id": inbound_id}
    }

@router.get("/get/{inbound_id}")
async def get_inbound(
    inbound_id: int, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
    ):
    result = await db.execute(select(Inbound).where(Inbound.id == inbound_id))
    inbound = result.scalars().first()
    
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")
        
    return inbound