from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from app.core.config import settings
import bcrypt


# Теперь данные берутся из нашего централизованного конфига
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Создает JWT токен для аутентификации пользователя.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Payload (полезная нагрузка) токена
    payload = {
        "sub": str(subject),  # subject (обычно username или id)
        "exp": expire,        # время истечения
        "iat": datetime.now(timezone.utc), # время выпуска (issued at)
    }

    # Кодируем токен
    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def hash_password(password: str) -> str:
    # bcrypt требует bytes, поэтому кодируем строку
    pwd_bytes = password.encode('utf-8')
    # Генерируем соль и хешируем
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    # Возвращаем строку для хранения в БД
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False
