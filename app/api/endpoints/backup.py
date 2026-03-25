from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from app.services.backup_service import BackupService
from app.core.dependencies import get_backup_service, get_current_admin
from pathlib import Path

router = APIRouter()



@router.post("/create")
async def manual_backup(
    backup_service = Depends(get_backup_service),
    current_admin=Depends(get_current_admin)
):
    path = await backup_service.create_backup(label="manual")
    return {"message": "Backup created", "filename": path.name}


@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    backup_service: BackupService = Depends(get_backup_service),
    current_admin=Depends(get_current_admin)
):
    # 1. Защита: извлекаем только имя файла, отсекая любые пути (../)
    safe_name = Path(filename).name
    file_path = backup_service.backup_dir / safe_name

    # 2. Проверка существования уже безопасного пути
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
    if not safe_name.endswith('.db'):
        raise HTTPException(status_code=400, detail="Only .db files are allowed")
    return FileResponse(
        path=file_path, 
        filename=safe_name, # Используем безопасное имя для скачивания
        media_type='application/x-sqlite3'
    )

@router.get("/list")
async def list_backups(
    backup_service: BackupService = Depends(get_backup_service),
    current_admin=Depends(get_current_admin)
):
    return await backup_service.list_backups()

@router.delete("/delete/{filename}")
async def delete_backup(
    filename: str,
    backup_service: BackupService = Depends(get_backup_service),
    current_admin=Depends(get_current_admin)
):
    try:
        await backup_service.delete_backup(filename)
        return {"message": f"Backup {filename} deleted successfully"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting backup: {e}")
        raise HTTPException(status_code=500, detail="Could not delete backup file")