from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List

from app.models import UserGroup, UserGroupAssociation
from app.models import User
from app.schemas.group import UserGroupCreate, UserGroupUpdate

class GroupService:
    @staticmethod
    async def create_group(db: AsyncSession, obj_in: UserGroupCreate):
        db_obj = UserGroup(**obj_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def get_groups(db: AsyncSession):
        # Получаем все группы
        result = await db.execute(select(UserGroup))
        return result.scalars().all()

    @staticmethod
    async def get_group_by_id(db: AsyncSession, group_id: int):
        result = await db.execute(select(UserGroup).where(UserGroup.id == group_id))
        return result.scalars().first()

    @staticmethod
    async def update_group(db: AsyncSession, group_id: int, obj_in: UserGroupUpdate):
        stmt = select(UserGroup).where(UserGroup.id == group_id)
        result = await db.execute(stmt)
        db_obj = result.scalars().first()
        
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def delete_group(db: AsyncSession, group_id: int):
        # Удаляем саму группу (каскадное удаление связей должно быть настроено в модели)
        stmt = delete(UserGroup).where(UserGroup.id == group_id)
        await db.execute(stmt)
        await db.commit()
        return True

    @staticmethod
    async def add_user_to_group(db: AsyncSession, user_id: int, group_id: int):
        stmt = select(UserGroupAssociation).where(
            UserGroupAssociation.user_id == user_id,
            UserGroupAssociation.group_id == group_id
        )
        existing = await db.execute(stmt)
        if existing.scalars().first():
            return True
            
        assoc = UserGroupAssociation(user_id=user_id, group_id=group_id)
        db.add(assoc)
        await db.commit()
        return True

    @staticmethod
    async def remove_user_from_group(db: AsyncSession, user_id: int, group_id: int):
        stmt = delete(UserGroupAssociation).where(
            UserGroupAssociation.user_id == user_id,
            UserGroupAssociation.group_id == group_id
        )
        await db.execute(stmt)
        await db.commit()
        return True

    @staticmethod
    async def get_group_users(db: AsyncSession, group_id: int):
        stmt = (
            select(User)
            .join(UserGroupAssociation)
            .where(UserGroupAssociation.group_id == group_id)
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def bulk_attach_users(db: AsyncSession, group_id: int, user_ids: List[int]):
        """Массовая привязка для удобства фронтенда"""
        for u_id in user_ids:
            # Проверка существования связи
            stmt = select(UserGroupAssociation).where(
                UserGroupAssociation.user_id == u_id,
                UserGroupAssociation.group_id == group_id
            )
            existing = await db.execute(stmt)
            if not existing.scalars().first():
                assoc = UserGroupAssociation(user_id=u_id, group_id=group_id)
                db.add(assoc)
        
        await db.commit()
        return True