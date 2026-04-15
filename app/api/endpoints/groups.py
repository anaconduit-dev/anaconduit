# app/api/endpoints/groups.py 

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.group import UserGroupCreate, UserGroupRead, UserGroupUpdate, UserGroupLink
from app.schemas.user import UserShortResponse
from app.services.group_service import GroupService
from app.core.dependencies import get_current_admin

router = APIRouter()

@router.post("/add", response_model=UserGroupRead, status_code=status.HTTP_201_CREATED)
async def create_group(
    obj_in: UserGroupCreate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Создать новую группу пользователей"""
    return await GroupService.create_group(db, obj_in)

@router.get("/get", response_model=List[UserGroupRead])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Список всех групп"""
    return await GroupService.get_groups(db)

@router.get("/get/{group_id}", response_model=UserGroupRead)
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Получить информацию о конкретной группе"""
    group = await GroupService.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group

@router.patch("/update/{group_id}", response_model=UserGroupRead)
async def update_group(
    group_id: int,
    obj_in: UserGroupUpdate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Обновить параметры группы (имя, шаблон)"""
    updated_group = await GroupService.update_group(db, group_id, obj_in)
    if not updated_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Group not found"
        )
    return updated_group

@router.delete("/remove/{group_id}")
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Удалить группу"""
    await GroupService.delete_group(db, group_id)
    return {"status": "success", "message": "Group deleted"}

# --- Управление пользователями в группе ---

@router.get("/{group_id}/users", response_model=List[UserShortResponse])
async def get_group_members(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    return await GroupService.get_group_users(db, group_id)

@router.post("/attach-user")
async def attach_user(
    link: UserGroupLink,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Добавить одного пользователя в группу"""
    await GroupService.add_user_to_group(db, link.user_id, link.group_id)
    return {"status": "success", "message": "User attached"}

@router.post("/detach-user")
async def detach_user(
    link: UserGroupLink,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Исключить пользователя из группы"""
    await GroupService.remove_user_from_group(db, link.user_id, link.group_id)
    return {"status": "success", "message": "User detached"}

@router.post("/{group_id}/bulk-attach")
async def bulk_attach(
    group_id: int,
    user_ids: List[int],
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """Массовое добавление пользователей в группу"""
    await GroupService.bulk_attach_users(db, group_id, user_ids)
    return {"status": "success", "message": f"{len(user_ids)} users added"}