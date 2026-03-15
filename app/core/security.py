from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from app.core.config import settings
import bcrypt

# Теперь данные берутся из нашего централизованного конфига
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    # Важно: поле "exp" должно быть в payload для валидации
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "anaconduit-api" # полезно добавить издателя
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

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
