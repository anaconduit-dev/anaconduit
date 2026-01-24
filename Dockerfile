FROM python:3.13-slim

# Устанавливаем uv напрямую с официального источника
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Сначала копируем только файлы конфигурации зависимостей для кеширования слоев
COPY pyproject.toml uv.lock ./

# Устанавливаем зависимости (без самого проекта)
# --system установит пакеты в системный python образ, что удобно для Docker
RUN uv pip install --system --no-cache .

# Копируем остальной код
COPY . .

# Создаем директории для данных
RUN mkdir -p /app/data

# Запуск
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
