import os
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- Общие настройки ---
    app_name: str = "Anaconduit"
    debug: bool = False
    log_level: str = "INFO"
    
    # --- Пути (Docker Sync) ---
    # Значение из .env (HOST_DATA_PATH). Используется в Docker SDK.
    host_data_path: str 

    # Путь внутри контейнера backend. Используется для записи файлов (open()).
    # Мы фиксируем его, так как он задан в docker-compose.
    internal_data_path: Path = Path("/app/data")

    # --- Безопасность (если используешь JWT) ---
    secret_key: str = "your-super-secret-key-change-it"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 дней

    # --- Pydantic Settings Config ---
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding='utf-8',
        extra="ignore", 
        env_prefix=""
    )

    @property
    def xray_internal_path(self) -> Path:
        """Вспомогательный путь к папке xray внутри контейнера"""
        path = self.internal_data_path / "xray"
        # Создаем папку автоматически при обращении, если её нет
        path.mkdir(parents=True, exist_ok=True)
        return path

# Инициализируем настройки
settings = Settings()
