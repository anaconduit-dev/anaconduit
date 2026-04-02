# app/core/config.py

import os
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # --- Общие настройки ---
    VERSION: str = "1.0.07"
    GITHUB_REPO: str = "anaconduit-dev/anaconduit"

    app_name: str = "Anaconduit"
    debug: bool = False
    log_level: str = "INFO"

    # --- Пути (Docker Sync) ---
    # Значение из .env (HOST_DATA_PATH). Используется в Docker SDK.
    host_data_path: str
    database_url: str 
    admin_user: str = "admin"
    admin_password: str = "changeme" # Обязательно смени в .env!
    server_domain: str = "127.0.0.1"
    panel_domain: str = Field("127.0.0.1", env="PANEL_DOMAIN")
    panel_secret_path: str = Field("/admin", env="PANEL_SECRET_PATH")
    sub_path: str = Field("ooooooo", env="SUB_PATH")
    reality_dest_domain: str = Field("", env="REALITY_DEST_DOMAIN")

    # Путь внутри контейнера backend. Используется для записи файлов (open()).
    # Мы фиксируем его, так как он задан в docker-compose.
    internal_data_path: Path = Path("/app/data")

    # --- Безопасность (если используешь JWT) ---
    secret_key: str = "your-super-secret-key-change-it"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # --- Pydantic Settings Config ---
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding='utf-8',
        extra="ignore", 
        env_prefix=""
    )

    def ensure_folders(self):
        """Принудительно создает структуру папок для всех сервисов"""
        subfolders = [
            "xray",
        ]
        for folder in subfolders:
            path = self.internal_data_path / folder
            path.mkdir(parents=True, exist_ok=True)
        print(f"📁 Структура папок проверена в {self.internal_data_path}")

    @property
    def xray_internal_path(self) -> Path:
        return self.internal_data_path / "xray"

    @property
    def panel_url(self) -> str:
        protocol = "http" if self.debug else "https"
        path = self.panel_secret_path.lstrip("/")
        return f"{protocol}://{self.panel_domain}/{path}"

# 1. Создаем объект настроек
settings = Settings()

# 2. СРАЗУ вызываем создание папок, не дожидаясь обращений к свойствам
#settings.ensure_folders()
