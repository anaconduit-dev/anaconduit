import subprocess
import os
import logging

logger = logging.getLogger(__name__)

class UpdateService:
    def __init__(self):
        # /repo — это путь внутри контейнера, который смотрит в /opt/anaconduit
        self.repo_path = os.getenv("PROJECT_ROOT", "/repo")

    async def apply_update(self, version_tag: str) -> bool:
        try:
            # Обновляем теги и принудительно переключаемся
            # -f затирает локальные изменения (кроме тех, что в .gitignore)
            subprocess.run(["git", "fetch", "--tags"], cwd=self.repo_path, check=True)
            subprocess.run(["git", "checkout", "-f", version_tag], cwd=self.repo_path, check=True)
            
            logger.info(f"Successfully checked out to {version_tag}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Git error: {e}")
            return False

    def trigger_rebuild(self):
        """
        Выход с кодом 100. 
        Наш entrypoint.sh увидит этот код и запустит docker compose up -d --build
        """
        logger.info("Exiting with code 100 to trigger rebuild...")
        # Используем os._exit, чтобы мгновенно убить процесс без очистки ресурсов,
        # так как нам нужно просто выйти в shell-скрипт
        os._exit(100)