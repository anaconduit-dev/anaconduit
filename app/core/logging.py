import logging
import sys


LOG_FORMAT = (
    "[%(asctime)s] "
    "[%(levelname)s] "
    "%(name)s: %(message)s"
)


def setup_logging(level: str = "INFO") -> None:
    """
    Глобальная настройка логирования
    """
    logging.basicConfig(
        level=level,
        format=LOG_FORMAT,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Убираем слишком шумные логи
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
