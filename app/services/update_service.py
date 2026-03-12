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
            # 1. Сначала "лечим" проблему безопасности Git
            # Добавляем /repo в список безопасных директорий
            subprocess.run(
                ["git", "config", "--global", "--add", "safe.directory", self.repo_path], 
                check=True
            )

            # 2. Теперь выполняем fetch
            logger.info(f"Fetching tags in {self.repo_path}...")
            subprocess.run(
                ["git", "fetch", "--tags"], 
                cwd=self.repo_path, 
                check=True,
                capture_output=True,
                text=True
            )

            # 3. Переключаемся на версию
            logger.info(f"Checking out to {version_tag}...")
            subprocess.run(
                ["git", "checkout", "-f", version_tag], 
                cwd=self.repo_path, 
                check=True,
                capture_output=True,
                text=True
            )
            
            return True
        except subprocess.CalledProcessError as e:
            # Теперь мы увидим реальную причину в логах, если что-то упадет
            logger.error(f"Git error: {e.stderr if e.stderr else e}")
            return False
        except Exception as e:
            logger.error(f"General error during update: {e}")
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
