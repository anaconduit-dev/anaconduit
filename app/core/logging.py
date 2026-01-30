import logging
import sys
from typing import Union

# Формат логов: время, уровень, название модуля и само сообщение
LOG_FORMAT = (
    "[%(asctime)s] "
    "[%(levelname)s] "
    "[%(name)s]: %(message)s"
)

def setup_logging(level: Union[str, int] = "INFO") -> None:
    """
    Глобальная настройка логирования для Anaconduit
    """
    
    # Если уровень передан строкой (из настроек pydantic), приводим к верхнему регистру
    if isinstance(level, str):
        level = level.upper()

    logging.basicConfig(
        level=level,
        format=LOG_FORMAT,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
        force=True # Перезаписывает базовые настройки, если они были инициализированы ранее
    )

    # --- Тонкая настройка шумных библиотек ---
    
    # Uvicorn access логи обычно слишком частые (запросы health-check и т.д.)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    
    # HTTPX логирует каждый GET/POST запрос к GitHub - убираем лишнее
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # gRPC может спамить при попытках переподключения
    logging.getLogger("grpc").setLevel(logging.ERROR)
    
    # Docker SDK
    logging.getLogger("docker").setLevel(logging.INFO)

    logging.info(f"Система логирования инициализирована. Уровень: {level}")
