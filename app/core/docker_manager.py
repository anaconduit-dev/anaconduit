async def ensure_base_config():
    """Создает базовый конфиг с поддержкой gRPC API и защитой от петель маршрутизации"""
    if not os.path.exists(INTERNAL_DATA_DIR):
        os.makedirs(INTERNAL_DATA_DIR, exist_ok=True)
    
    # Если это директория (ошибка монтирования), удаляем
    if os.path.isdir(INTERNAL_CONFIG_PATH):
        os.rmdir(INTERNAL_CONFIG_PATH)

    # Принудительно перезаписываем конфиг для актуализации маршрутов
    base_config = {
        "log": {
            "loglevel": "info"
        },
        "stats": {},
        "api": {
            "tag": "api",
            "services": [
                "HandlerService",
                "StatsService",
                "LoggerService"
            ]
        },
        "policy": {
            "levels": {
                "0": {
                    "statsUserUplink": True,
                    "statsUserDownlink": True
                }
            },
            "system": {
                "statsInboundUplink": True,
                "statsInboundDownlink": True
            }
        },
        "inbounds": [
            {
                "listen": "127.0.0.1",
                "port": 10085,
                "protocol": "dokodemo-door",
                "settings": {
                    "address": "127.0.0.1"
                },
                "tag": "api"
            }
        ],
        "outbounds": [
            {
                "protocol": "freedom",
                "tag": "direct"
            },
            {
                "protocol": "blackhole",
                "tag": "block"
            }
        ],
        "routing": {
            "domainStrategy": "AsIs",
            "rules": [
                {
                    # КРИТИЧЕСКИЙ МОМЕНТ: Запросы от API должны обрабатываться внутри
                    "type": "field",
                    "inboundTag": ["api"],
                    "outboundTag": "direct"
                }
            ]
        }
    }
    
    # Удаляем старый файл перед записью, чтобы избежать проблем с правами Docker
    if os.path.exists(INTERNAL_CONFIG_PATH):
        os.remove(INTERNAL_CONFIG_PATH)
        
    with open(INTERNAL_CONFIG_PATH, "w") as f:
        json.dump(base_config, f, indent=4)
    
    print(f"--- Конфиг обновлен (routing fixed): {INTERNAL_CONFIG_PATH} ---")
