import os
import json
import docker
from fastapi import HTTPException

client = docker.from_env()

# 1. Путь ВНУТРИ контейнера бэкенда (для записи файла через Python)
INTERNAL_DATA_DIR = "/app/data/xray"
INTERNAL_CONFIG_PATH = os.path.join(INTERNAL_DATA_DIR, "config.json")

# 2. Путь на ХОСТЕ (для передачи Docker-демону при запуске контейнера Xray)
# По умолчанию берем /app/data, если в .env не указано иное
HOST_DATA_PATH = os.getenv("HOST_DATA_PATH")
# Если переменная не дошла, Python упадет с понятной ошибкой при старте, а не Docker позже
if not HOST_DATA_PATH:
    raise RuntimeError("Критическая ошибка: HOST_DATA_PATH не задана в окружении!")

HOST_CONFIG_PATH = f"{HOST_DATA_PATH}/xray/config.json"


async def ensure_base_config():
    """Создает базовый конфиг через внутренний путь бэкенда"""
    if not os.path.exists(INTERNAL_DATA_DIR):
        os.makedirs(INTERNAL_DATA_DIR, exist_ok=True)
    
    # Если на месте файла оказалась ошибочная директория от Docker - удаляем её
    if os.path.isdir(INTERNAL_CONFIG_PATH):
        print(f"--- Исправление: удаление ошибочной директории {INTERNAL_CONFIG_PATH} ---")
        os.rmdir(INTERNAL_CONFIG_PATH)

    if not os.path.exists(INTERNAL_CONFIG_PATH):
        base_config = {
            "log": {"loglevel": "info"},
            "inbounds": [{
                "port": 10085,
                "protocol": "dokodemo-door",
                "settings": {"address": "127.0.0.1"}
            }],
            "outbounds": [{"protocol": "freedom"}]
        }
        with open(INTERNAL_CONFIG_PATH, "w") as f:
            json.dump(base_config, f, indent=4)
        print(f"--- Создан базовый конфиг: {INTERNAL_CONFIG_PATH} ---")

async def install_xray_container(version: str):
    # Гарантируем наличие файла на диске
    await ensure_base_config()
    
    image_tag = f"teddysun/xray:{version.lstrip('v')}"
    
    try:
        # Проверка и скачивание образа
        try:
            client.images.get(image_tag)
        except docker.errors.ImageNotFound:
            print(f"Pulling {image_tag}...")
            client.images.pull(image_tag)

        # Удаление старого контейнера
        try:
            old = client.containers.get("pyray-xray-core")
            old.stop()
            old.remove()
        except docker.errors.NotFound:
            pass

        # Запуск контейнера Xray
        # Важно: для монтирования (left side) используем HOST_CONFIG_PATH
        container = client.containers.run(
            image=image_tag,
            name="pyray-xray-core",
            detach=True,
            restart_policy={"Name": "always"},
            network_mode="host",
            volumes={
                HOST_CONFIG_PATH: {
                    'bind': '/etc/xray/config.json', 
                    'mode': 'ro'
                }
            }
        )
        return {"status": "success", "container_id": container.short_id}

    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Docker error: {str(e)}. Проверьте HOST_DATA_PATH в .env"
        )
