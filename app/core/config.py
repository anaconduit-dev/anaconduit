from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Anaconduit"
    debug: bool = False
    log_level: str = "INFO"
    # Это значение подтянется из .env (HOST_DATA_PATH=/opt/anaconduit/data)
    # Мы используем его для команд Docker SDK
    host_data_path: str

    # А это путь ВНУТРИ контейнера backend. 
    # Так как в docker-compose ты прописал: /opt/anaconduit/data:/app/data
    # то Python должен писать именно в /app/data
    internal_data_path: Path = Path("/app/data")
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore"б env_prefix="")

settings = Settings()
