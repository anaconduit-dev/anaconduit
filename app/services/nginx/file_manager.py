# app/services/nginx/file_manager.py

import os
import shutil
import anyio
import logging
from pathlib import Path
from typing import List, Dict
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class NginxFileManager:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.www_dir = (base_dir / "www").resolve()
        # Список разрешенных расширений для редактирования
        self.text_extensions = {'.html', '.css', '.js', '.json', '.txt', '.conf'}

    def _resolve_safe(self, filename: str) -> Path:
        """Централизованная защита: только внутри папки www"""
        # 1. Получаем строгий абсолютный путь к базовой папке
        base = self.www_dir.resolve()
        
        # 2. Убираем все попытки обмана в начале строки
        clean_name = filename.lstrip("./ ") 
        
        # 3. Соединяем и нормализуем
        # Используем .absolute() + .resolve(), чтобы раскрыть все переходы
        target = (base / clean_name).resolve()
        
        # 4. Самая надежная проверка: relative_to
        # Она выбросит ValueError, если target не является "ребенком" base
        try:
            target.relative_to(base)
        except ValueError:
            logger.warning(f"🚨 SECURITY ALERT: Path Traversal attempt: {filename}")
            raise HTTPException(status_code=403, detail="Forbidden: You cannot leave the landing directory")
            
        return target

    async def write(self, path: Path, content: str):
        """Безопасная запись с созданием подпапок"""
        # Гарантируем наличие родительских папок
        path.parent.mkdir(parents=True, exist_ok=True)
        await anyio.to_thread.run_sync(lambda: path.write_text(content.strip(), encoding="utf-8"))

    async def create_symlink(self, src_name: str, dst_path: Path):
        """Создание относительных симлинков"""
        def _link():
            src_relative = f"../sites-available/{src_name}"
            if dst_path.exists() or dst_path.is_symlink():
                dst_path.unlink()
            os.symlink(src_relative, dst_path)
        await anyio.to_thread.run_sync(_link)

    async def read_file(self, filename: str) -> str:
        """Восстановленная логика чтения с проверкой типов и кодировки"""
        path = self._resolve_safe(filename)
        
        if not path.exists():
            return ""

        if path.suffix.lower() not in self.text_extensions:
            return f"Error: File type {path.suffix} is not editable as text."

        try:
            return await anyio.to_thread.run_sync(lambda: path.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            return "Error: File contains binary data or invalid encoding."
        except Exception as e:
            return f"Error: {str(e)}"

    async def list_files(self, subpath: str = "") -> List[Dict]:
        """Рекурсивный листинг (уже был достаточно хорош, но добавим проверку существования)"""
        try:
            target = self._resolve_safe(subpath)
        except:
            return []

        if not target.exists() or not target.is_dir():
            return []

        files = []
        with os.scandir(target) as entries:
            for entry in entries:
                stat = entry.stat()
                files.append({
                    "name": entry.name,
                    "path": os.path.relpath(entry.path, self.www_dir),
                    "is_dir": entry.is_dir(),
                    "size": stat.st_size if entry.is_file() else 0,
                    "last_modified": stat.st_mtime
                })
        return sorted(files, key=lambda x: (not x["is_dir"], x["name"].lower()))

    async def delete_item(self, filename: str):
        """Восстановленная защита корня и index.html"""
        path = self._resolve_safe(filename)
        
        # Запрет на удаление корня или главного index.html
        if path == self.www_dir or (path.name == "index.html" and path.parent == self.www_dir):
            logger.warning(f"⚠️ Попытка удаления защищенного файла: {path}")
            raise Exception("Cannot delete root index.html or base directory")
            
        if not path.exists():
            # Если файла нет, возвращаем 404, а не 200
            raise HTTPException(status_code=404, detail=f"File {filename} not found")

        if path.is_dir():
            await anyio.to_thread.run_sync(shutil.rmtree, path)
            logger.info(f"🗑️ Директория удалена: {filename}")
        else:
            await anyio.to_thread.run_sync(path.unlink)
            logger.info(f"🗑️ Файл удален: {path}")