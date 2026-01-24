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
    async with httpx.AsyncClient() as client:
        for path in PROTO_FILES:
            url = f"{XRAY_REPO}/{path}"
            # Создаем вложенные папки, чтобы структура совпадала с Xray
            target_path = os.path.join(PROTO_DIR, path)
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            
            response = await client.get(url)
            if response.status_code == 200:
                with open(target_path, "wb") as f:
                    f.write(response.content)

def compile_protos():
    import grpc_tools.protoc
    # Компилируем, указывая PROTO_DIR как корень поиска (proto_path)
    for path in PROTO_FILES:
        target_file = os.path.join(PROTO_DIR, path)
        grpc_tools.protoc.main([
            "grpc_tools.protoc",
            f"--proto_path={PROTO_DIR}",
            f"--python_out={PROTO_DIR}",
            f"--grpc_python_out={PROTO_DIR}",
            target_file
        ])



def fix_imports(directory):
    """Корректно исправляет импорты в сгенерированных файлах"""
    for filename in os.listdir(directory):
        if filename.endswith("_pb2.py") or filename.endswith("_pb2_grpc.py"):
            path = os.path.join(directory, filename)
            with open(path, 'r') as f:
                content = f.read()

            # Исправляем импорты: ищем 'import name_pb2' и меняем на 'from . import name_pb2'
            # Но только если перед 'import' нет слова 'from'
            patterns = [
                (r'(?m)^import\s+(\w+_pb2)', r'from . import \1'),
            ]
            
            for pattern, replacement in patterns:
                content = re.sub(pattern, replacement, content)
            
            with open(path, 'w') as f:
                f.write(content)

async def build_grpc_interface():
    """Главная функция для вызова при установке/обновлении ядра"""
    await download_protos()
    compile_protos()
