# --- Этап 1: Сборка фронтенда ---
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY xray-frontend/package*.json ./
RUN npm install
COPY xray-frontend/ ./
RUN npm run build

# --- Этап 2: Финальный образ ---
FROM python:3.13-slim

# Установка uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Используем кэш для apt, чтобы не качать всё заново при каждом билде
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y \
    git \
    docker.io \
    docker-compose
# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем зависимости и устанавливаем их в систему
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .
# Копируем всё остальное (включая папку alembic и alembic.ini)
COPY . .

# Копируем собранный фронтенд
COPY --from=frontend-builder /build/dist ./app/static

# Настройка прав и папок
RUN mkdir -p /app/data && \
    chmod +x /app/entrypoint.sh

# Открываем порт
EXPOSE 8000

# Используем ENTRYPOINT для запуска скрипта инициализации
ENTRYPOINT ["/app/entrypoint.sh"]