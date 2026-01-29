import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import SECRET_KEY, ALGORITHM
from app.xray_api.client import XrayAPIClient
from app.services.xray_service import XrayService

logger = logging.getLogger(__name__)

# --- Инициализация Singleton-клиента ---
# Мы создаем его один раз при импорте модуля.
# Но само соединение (channel) gRPC лучше открывать асинхронно.
_xray_grpc_client = XrayAPIClient(
    host="anaconduit_xray", 
    port=10085
)

def get_xray_client() -> XrayAPIClient:
    """Возвращает глобальный экземпляр gRPC клиента"""
    return _xray_grpc_client

def get_xray_service(
    client: XrayAPIClient = Depends(get_xray_client),
) -> XrayService:
    """Инжектирует сервис Xray с уже готовым клиентом"""
    return XrayService(client)


# --- Аутентификация ---

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False,
)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    """
    Единая точка аутентификации. 
    Сделал асинхронной, чтобы соответствовать общему стилю.
    """

    # 🟢 DEV MODE
    if settings.debug:
        # В дебаге логируем, что проверка пропущена
        return {"username": "admin_dev", "role": "admin"}

    # 🔐 PROD MODE
    if not token:
        logger.warning("Попытка доступа без токена")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")

        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        
        return {"username": username}

    except JWTError as e:
        logger.error(f"JWT Decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
        )
