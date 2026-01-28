import logging

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.docker import router as docker_router


setup_logging(settings.log_level)

logger = logging.getLogger(__name__)
logger.info("Starting application")

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="0.1.0",
)

app.include_router(docker_router)

