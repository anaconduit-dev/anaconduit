from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.core.dependencies import get_current_admin
from app.models.models import Admin
# Импортируем твои обновленные схемы
from app.schemas.admin import AdminUpdate 

router = APIRouter()

@router.put("/update-credentials", status_code=status.HTTP_200_OK)
async def update_admin_credentials(
    data: AdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """
    Смена логина/пароля с проверкой текущего пароля и инвалидацией всех сессий.
    """
    # 1. Проверяем старый пароль
    if not verify_password(data.current_password, current_admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль введен неверно"
        )

    try:
        # 2. Обновляем данные
        current_admin.username = data.new_username
        current_admin.password_hash = hash_password(data.new_password)
        
        # 3. Сбрасываем все активные сессии на других устройствах
        current_admin.token_version += 1
        
        db.add(current_admin)
        await db.commit()
        await db.refresh(current_admin)
        
        return {
            "status": "success",
            "message": "Данные успешно обновлены. Все активные сессии на других устройствах завершены."
        }
    except Exception as e:
        await db.rollback()
        # Логируем ошибку для себя, пользователю отдаем общую информацию
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось обновить данные в базе"
        )