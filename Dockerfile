FROM python:3.13-slim

# uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Зависимости (кешируем)
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

# Код
COPY . .

# Данные
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
