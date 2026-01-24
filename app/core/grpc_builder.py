import os
import subprocess
import httpx
import sys
import re

# Базовые настройки
XRAY_REPO = "https://raw.githubusercontent.com/XTLS/Xray-core/main"
PROTO_DIR = os.path.join("app", "proto")
# Список необходимых файлов для работы API (основные сервисы)
PROTO_FILES = [
    "app/proxyman/command/command.proto",
    "app/stats/command/command.proto",
    "common/serial/typed_message.proto",
    "common/net/address.proto",
    "common/net/port.proto",
]

async def download_protos():
    """Скачивает актуальные .proto файлы из репозитория Xray"""
    os.makedirs(PROTO_DIR, exist_ok=True)
    async with httpx.AsyncClient() as client:
        for proto_path in PROTO_FILES:
            url = f"{XRAY_REPO}/{proto_path}"
            # Сохраняем структуру папок, но для простоты в одну директорию
            filename = os.path.basename(proto_path)
            target = os.path.join(PROTO_DIR, filename)
            
            print(f"Downloading {filename}...")
            response = await client.get(url)
            if response.status_code == 200:
                with open(target, "wb") as f:
                    f.write(response.content)
            else:
                print(f"Failed to download {filename}")

def compile_protos():
    """Компилирует .proto файлы в Python код"""
    import grpc_tools.protoc
    
    print("Compiling gRPC stubs...")
    proto_include = PROTO_DIR
    
    # Собираем список всех скачанных .proto файлов
    files = [os.path.join(PROTO_DIR, f) for f in os.listdir(PROTO_DIR) if f.endswith(".proto")]
    
    for proto_file in files:
        command = [
            "grpc_tools.protoc",
            f"--proto_path={PROTO_DIR}",
            f"--python_out={PROTO_DIR}",
            f"--grpc_python_out={PROTO_DIR}",
            proto_file
        ]
        # Выполняем компиляцию
        grpc_tools.protoc.main(command)
    
    # Маленький хак: исправление импортов внутри сгенерированных файлов
    # (protobuf часто генерирует относительные импорты, которые ломаются в пакетах)
    fix_imports(PROTO_DIR)
    print("Compilation complete.")



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
