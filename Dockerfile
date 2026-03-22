# --- Stage 1: frontend build ---
FROM node:20-slim AS frontend-builder
WORKDIR /build

COPY xray-frontend/package*.json ./
RUN npm ci

COPY xray-frontend/ ./
RUN npm run build


# --- Stage 2: backend ---
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# зависимости
# зависимости
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

# код
COPY . .

# фронт
COPY --from=frontend-builder /build/dist ./app/static

# Настройка прав и папок
RUN mkdir -p /app/data && \
    chmod +x /app/entrypoint.sh

# Открываем порт
EXPOSE 8000

# Используем ENTRYPOINT для запуска скрипта инициализации
ENTRYPOINT ["/app/entrypoint.sh"]
