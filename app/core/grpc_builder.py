import os
import subprocess
import httpx
import sys
import re

# Базовые настройки
XRAY_REPO = "https://raw.githubusercontent.com/XTLS/Xray-core/main"
PROTO_DIR = os.path.join("app", "proto")
# Список необходимых файлов для работы API (основные сервисы)
# Полный список с путями
PROTO_FILES = [
    "app/stats/command/command.proto",
    "app/proxyman/command/command.proto",
    "common/serial/typed_message.proto",
    "common/net/address.proto",
    "common/net/port.proto",
    "common/protocol/user.proto",
    "proxy/vless/account.proto",
    "core/config.proto"
]

async def download_protos():
    os.makedirs(PROTO_DIR, exist_ok=True)
    # Создаем __init__.py в корне proto
    open(os.path.join(PROTO_DIR, "__init__.py"), "a").close()
    
    async with httpx.AsyncClient() as client:
        for path in PROTO_FILES:
            url = f"{XRAY_REPO}/{path}"
            target_path = os.path.join(PROTO_DIR, path)
            
            # Создаем папки и __init__.py в каждой из них
            current_dir = PROTO_DIR
            for part in os.path.dirname(path).split('/'):
                current_dir = os.path.join(current_dir, part)
                os.makedirs(current_dir, exist_ok=True)
                open(os.path.join(current_dir, "__init__.py"), "a").close()
            
            response = await client.get(url)
            if response.status_code == 200:
                with open(target_path, "wb") as f:
                    f.write(response.content)

def compile_protos():
    import grpc_tools.protoc
    for path in PROTO_FILES:
        target_file = os.path.join(PROTO_DIR, path)
        # Компилируем
        grpc_tools.protoc.main([
            "grpc_tools.protoc",
            f"--proto_path={PROTO_DIR}",
            f"--python_out={PROTO_DIR}",
            f"--grpc_python_out={PROTO_DIR}",
            target_file
        ])
    
    # Очень важный момент: исправляем импорты во ВСЕЙ папке рекурсивно
    fix_imports_recursive(PROTO_DIR)

def fix_imports_recursive(directory):
    import re
    for root, dirs, files in os.walk(directory):
        for filename in files:
            if filename.endswith("_pb2.py") or filename.endswith("_pb2_grpc.py"):
                path = os.path.join(root, filename)
                with open(path, 'r') as f:
                    content = f.read()
                
                # Заменяем 'import ..._pb2' на относительный импорт 'from . import ..._pb2'
                content = re.sub(r'(?m)^import\s+(\w+_pb2)', r'from . import \1', content)
                
                with open(path, 'w') as f:
                    f.write(content)

async def build_grpc_interface():
    """Главная функция для вызова при установке/обновлении ядра"""
    await download_protos()
    compile_protos()
