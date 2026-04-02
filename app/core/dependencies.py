import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Admin
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.xray_api.client import XrayAPIClient
from app.services.xray import XrayService
from app.services.nginx_service import NginxService
from app.services.backup_service import BackupService


logger = logging.getLogger(__name__)

# --- gRPC и Сервисы ---
_xray_grpc_client = XrayAPIClient(
    host="anaconduit_xray", 
    port=10085
)

def get_xray_client() -> XrayAPIClient:
    return _xray_grpc_client

def get_xray_service(client: XrayAPIClient = Depends(get_xray_client)) -> XrayService:
    return XrayService(client)

def get_nginx_service() -> NginxService:
    return NginxService()

def get_backup_service() -> BackupService:
    return BackupService()
# --- Аутентификация ---
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False # Чтобы мы могли сами обрабатывать отсутствие токена
)

async def get_current_admin(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db) # Добавляем сессию БД
):
    # 🟢 DEV MODE (здесь тоже лучше вернуть объект, а не dict, чтобы не ломать код)
    if settings.debug:
        # Пытаемся найти любого админа для тестов
        result = await db.execute(select(Admin))
        admin = result.scalars().first()
        return admin

    if not token:
        raise HTTPException(status_code=401, detail="Необходима авторизация")

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        token_version_in_jwt: int = payload.get("v") # Извлекаем версию из токена

        if username is None or token_version_in_jwt is None:
            raise HTTPException(status_code=401, detail="Некорректный токен")
        
        # Запрашиваем админа из БД
        result = await db.execute(select(Admin).where(Admin.username == username))
        admin = result.scalars().first()

        if admin is None:
            raise HTTPException(status_code=401, detail="Администратор не найден")
            
        # ПРОВЕРКА ВЕРСИИ: Самый важный момент
        if admin.token_version != token_version_in_jwt:
            logger.warning(f"🚫 Сессия аннулирована для {username} (несовпадение версий)")
            raise HTTPException(
                status_code=401, 
                detail="Сессия истекла из-за смены пароля"
            )
            
        return admin

    except JWTError:
        raise HTTPException(status_code=401, detail="Токен недействителен")