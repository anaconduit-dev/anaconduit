import os
import datetime
import shutil
import logging
from pathlib import Path
from sqlalchemy import text
from app.core.config import settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(self):
        # Путь к текущей БД
        self.db_path = Path(settings.internal_data_path) / "anaconduit.db"
        # Папка для хранения бэкапов
        self.backup_dir = Path(settings.internal_data_path) / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    async def create_backup(self, label: str = "manual") -> Path:
        """Создает горячий бэкап БД"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{label}_{timestamp}.db"
        target_path = self.backup_dir / filename

        async with AsyncSessionLocal() as session:
            # SQLite команда для безопасного копирования занятого файла
            await session.execute(text(f"VACUUM INTO '{target_path}'"))
            logger.info(f"💾 Бэкап создан: {target_path}")
        
        return target_path

    async def list_backups(self):
        """Возвращает список всех доступных бэкапов с метаданными"""
        backups = []
        if not self.backup_dir.exists():
            return backups

        # Используем anyio для неблокирующего чтения файловой системы
        for f in self.backup_dir.glob("*.db"):
            stat = f.stat()
            backups.append({
                "filename": f.name,
                "size": stat.st_size,
                "created_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        
        # Сортировка: самые свежие вверху
        return sorted(backups, key=lambda x: x["created_at"], reverse=True)

    async def delete_backup(self, filename: str):
        """Безопасное удаление файла бэкапа"""
        # Защита от Path Traversal: берем только имя файла
        safe_name = Path(filename).name
        file_path = self.backup_dir / safe_name

        if not file_path.exists():
            raise FileNotFoundError(f"Backup file {safe_name} not found")

        # Удаляем файл
        file_path.unlink()
        logger.info(f"🗑️ Бэкап удален: {safe_name}")