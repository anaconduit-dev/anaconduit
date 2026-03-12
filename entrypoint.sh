#!/bin/bash
set -e

echo "--- [1/2] Применение миграций БД ---"
# Мы используем --system, так как зависимости в Docker ставились в систему через uv pip
# Вместо uv run alembic upgrade head
alembic upgrade head

echo "--- [2/2] Запуск Anaconduit ---"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000