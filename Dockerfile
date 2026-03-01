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

WORKDIR /app

# Кеширование зависимостей бэкенда
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

# Копируем код бэкенда
COPY . .

# Копируем собранный фронтенд из первого этапа в папку static бэкенда
# (Убедись, что папка dist соответствует настройкам твоего фронтенда)
COPY --from=frontend-builder /build/dist ./app/static

# Создаём папку для данных
RUN mkdir -p /app/data

EXPOSE 8000

# Запуск. Обрати внимание: теперь бэкенд должен уметь отдавать статику
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
