# app/api/endpoints/nodes.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.schemas.node import NodeCreate, NodeResponse, NodeConfigResponse, NodeUpdate 
from app.services.node_service import NodeService

router = APIRouter()

# --- АДМИНСКИЕ ЭНДПОИНТЫ ---

@router.post("/register", response_model=NodeResponse)
async def register_node(
    obj_in: NodeCreate, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    service = NodeService(db)
    return await service.register_node(obj_in)

@router.get("/all", response_model=List[NodeResponse])
async def list_nodes(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    service = NodeService(db)
    return await service.get_all_nodes()

# --- ЭНДПОИНТЫ ДЛЯ АГЕНТОВ (НОД) ---

@router.get("/config/{node_id}", response_model=NodeConfigResponse)
async def get_node_config(
    node_id: int,
    x_node_token: str = Header(...), # Нода передает свой secret_token в заголовках
    db: AsyncSession = Depends(get_db)
):
    """Эндпоинт, куда нода 'стучится' за обновлением конфига"""
    service = NodeService(db)
    config = await service.get_latest_config(node_id, x_node_token)
    
    if not config:
        raise HTTPException(status_code=404, detail="Config not found for this node")
    
    # Обновляем время последнего визита ноды
    await service.update_heartbeat(node_id, applied_version=config.version)
    
    return config

@router.patch("/update/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: int,
    obj_in: NodeUpdate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    service = NodeService(db)
    updated_node = await service.update_node(node_id, obj_in)
    if not updated_node:
        raise HTTPException(status_code=404, detail="Node not found")
    return updated_node

@router.delete("/delete/{node_id}")
async def delete_node(
    node_id: int,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    service = NodeService(db)
    success = await service.delete_node(node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Node not found")
    return {"status": "success", "message": f"Node {node_id} deleted"}

@router.post("/{node_id}/rotate-token")
async def rotate_node_token(
    node_id: int,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    """Смена токена безопасности ноды"""
    service = NodeService(db)
    new_token = await service.rotate_node_token(node_id)
    
    if not new_token:
        raise HTTPException(status_code=404, detail="Node not found")
        
    return {
        "status": "success",
        "new_token": new_token,
        "warning": "Update the token in your Node Agent config immediately. Connection will be lost until updated."
    }