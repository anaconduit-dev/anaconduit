#!/bin/bash

# Убираем set -e, так как мы хотим сами обрабатывать ошибки выхода
# set -e заставит скрипт упасть при любом ненулевом коде

while true; do
    echo "--- [1/2] Применение миграций БД ---"
    # Накатываем миграции перед каждым запуском (важно при обновлении кода)
    alembic upgrade head || echo "⚠️ Миграции не применились или не требуются"

    echo "--- [2/2] Запуск Anaconduit ---"
    
    # Запускаем без exec, чтобы скрипт продолжал жить
    uvicorn app.main:app --host 0.0.0.0 --port 8000
    
    # Сохраняем код выхода приложения
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 100 ]; then
        echo "--- [UPDATE] Получен сигнал на пересборку (Код 100) ---"
        cd /repo
        
        # Пробуем вызвать новый Compose
        if docker compose version > /dev/null 2>&1; then
            docker compose up -d --build
        else
            # Если плагин не подцепился, пробуем старый способ
            docker-compose up -d --build
        fi
        
        exit 0
    else
        echo "--- [STOP] Приложение завершилось с кодом $EXIT_CODE ---"
        # Если код не 100, значит это либо ошибка, либо штатная остановка
        exit $EXIT_CODE
    fi
done