from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.subscribe import SubscriptionTemplate
from app.schemas.subscribe import SubscriptionTemplateCreate, SubscriptionTemplateUpdate

class SubscribeService:
    @staticmethod
    async def create_template(db: AsyncSession, obj_in: SubscriptionTemplateCreate):
        db_obj = SubscriptionTemplate(**obj_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def get_templates(db: AsyncSession):
        result = await db.execute(select(SubscriptionTemplate))
        return result.scalars().all()

    @staticmethod
    async def get_template_by_id(db: AsyncSession, template_id: int):
        result = await db.execute(
            select(SubscriptionTemplate).where(SubscriptionTemplate.id == template_id)
        )
        return result.scalars().first()

    @staticmethod
    async def update_template(db: AsyncSession, template_id: int, obj_in: SubscriptionTemplateUpdate):
        # db.get — самый эффективный способ поиска по PK
        db_obj = await db.get(SubscriptionTemplate, template_id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await db.commit()
        await db.refresh(db_obj)
        return db_obj
        
    @staticmethod
    async def delete_template(db: AsyncSession, template_id: int):
        result = await db.execute(
            select(SubscriptionTemplate).where(SubscriptionTemplate.id == template_id)
        )
        db_obj = result.scalars().first()
        if db_obj:
            await db.delete(db_obj)
            await db.commit()
            return True
        return False