from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Anaconduit"
    debug: bool = False
    log_level: str = "INFO"
    host_data_path: Path = Path("./data")

    class Config:
        env_file = ".env"


settings = Settings()
