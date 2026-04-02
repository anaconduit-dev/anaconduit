# app/services/scheduler.py
import asyncio
import time
import logging

logger = logging.getLogger(__name__)

async def stats_updater_task(xray_service):
    # Весь твой цикл while True здесь. 
    # Передавай xray_service как аргумент, чтобы не зависеть от глобалов.
    # Переменная для отслеживания времени последнего сброса
    last_reset_check = 0 
    RESET_CHECK_INTERVAL = 3600  # Проверяем автосброс раз в час (3600 сек)

    while True:
        try:
            # 1. Быстрая задача (каждые 10 секунд)
            # Обновляем статистику в БД и отключаем тех, кто превысил лимит
            await xray_service.update_stats_in_db()
            await xray_service.check_limits_and_disable()

            # 2. Тяжелая задача (раз в час)
            current_time = time.time()
            if current_time - last_reset_check >= RESET_CHECK_INTERVAL:
                logger.info("⏰ Запуск плановой проверки автосброса трафика...")
                # Вызываем нашу новую логику (реализуем её в сервисе)
                await xray_service.check_and_reset_traffic()
                last_reset_check = current_time

            await asyncio.sleep(10) 

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"❌ Ошибка в фоновом планировщике: {e}")
            await asyncio.sleep(30)