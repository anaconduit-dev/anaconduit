import json
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_xray_service, get_current_admin
from app.services.xray import XrayService

router = APIRouter()

@router.get("/get_custom_config")
async def get_custom_config(
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Читает содержимое custom.json"""
    path = xray_service.internal_xray_dir / "custom.json"
    if not path.exists():
        return {"inbounds": []}
    
    with open(path, "r") as f:
        return json.load(f)

@router.post("/update_custom_config")
async def update_custom_config(
    new_config: dict,
    xray_service: XrayService = Depends(get_xray_service),
    admin: dict = Depends(get_current_admin)
):
    """Валидирует и сохраняет кастомный конфиг"""
    
    # 1. Валидация
    is_valid, error_msg = await xray_service.validate_config(new_config)
    if not is_valid:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid Xray configuration: {error_msg}"
        )

    # 2. Если всё ок — сохраняем
    path = xray_service.internal_xray_dir / "custom.json"
    with open(path, "w") as f:
        json.dump(new_config, f, indent=2)

    # 3. Применяем изменения (рестарт)
    await xray_service.sync_and_restart()
    
    return {"status": "success", "message": "Config validated and applied"}

