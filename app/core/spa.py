# app/core/spa.py
import os
import logging
from app.core.config import settings


logger = logging.getLogger(__name__)

SECRET_PATH = settings.panel_secret_path.strip('/')
SUB_PATH = settings.sub_path.strip('/')

async def get_spa_content(mode: str, static_path: str, ):
    """Готовит index.html с внедренным конфигом"""
    index_file = os.path.join(static_path, "index.html")
    if not os.path.exists(index_file):
        return None
        
    try:
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()

        basename = f"/{SECRET_PATH}" if mode == "admin" else f"/{SUB_PATH}"
        
        # Конфиг для React
        config_script = f"""
        <script>
            window.__PANEL_CONFIG__ = {{ 
                "basename": "{basename}",
                "mode": "{mode}" 
            }};
        </script>
        """
        # Важно: добавляем <base>, чтобы относительные пути в JS/CSS работали
        replacement = f'<head><base href="{basename}/">{config_script}'
        content = content.replace("<head>", replacement)
        return content
    except Exception as e:
        logger.error(f"Error reading index.html: {e}")
        return None