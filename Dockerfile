FROM python:3.13-slim

# Установка uv (быстрый сервер)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Кеширование зависимостей
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

# Копируем код
COPY . .

# Создаём папку для данных
RUN mkdir -p /app/data

# Открываем порт для FastAPI
EXPOSE 8000

# ⚡ Запуск FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
