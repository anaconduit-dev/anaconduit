import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.xray_api.client import XrayAPIClient
from app.services.xray_service import XrayService
from app.services.nginx_service import NginxService

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
# --- Аутентификация ---
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False # Чтобы мы могли сами обрабатывать отсутствие токена
)

async def get_current_admin(token: Optional[str] = Depends(oauth2_scheme)):
    """
    Зависимость для защиты админских эндпоинтов.
    """
    # 🟢 DEV MODE
    if settings.debug:
        logger.debug("⚠️ DEBUG MODE: Skipping admin authentication")
        return {"username": "admin_dev", "role": "admin"}

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходима авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token, 
            settings.secret_key, 
            algorithms=[settings.algorithm]
        )
        username: str | None = payload.get("sub")

        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Токен не содержит данных пользователя",
            )
        return {"username": username, "role": "admin"}

    except JWTError as e:
        logger.error(f"JWT Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен недействителен или истек",
            headers={"WWW-Authenticate": "Bearer"},
        )