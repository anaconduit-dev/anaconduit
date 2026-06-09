# app/services/node_config_service.py

import hashlib
import json
import logging
from sqlalchemy import select
from app.models import Node, NodeConfig, Inbound
from app.services.nginx.generator import NginxConfigGenerator
from app.services.xray.generator import XrayConfigGenerator 
from app.core.config import settings

logger = logging.getLogger(__name__)

class NodeConfigService:
    @staticmethod
    async def _get_node_inbounds(session, node_id: int):
        """Загрузка данных инбаундов для конкретной ноды (для Nginx)"""
        reality_inbounds = []
        xhttp_inbounds = []
        
        stmt = select(Inbound).filter_by(is_active=True, node_id=node_id)
        result = await session.execute(stmt)
        db_inbounds = result.scalars().all()
        
        for ib in db_inbounds:
            s = ib.stream_settings or {}
            if s.get("security") == "reality":
                server_names = s.get("realitySettings", {}).get("serverNames", [])
                for name in server_names:
                    reality_inbounds.append({"sni": name, "port": ib.port})
            
            if s.get("network") == "xhttp":
                path = s.get("xhttpSettings", {}).get("path", "").strip("/")
                if path:
                    xhttp_inbounds.append({"tag": ib.tag, "path": path})
        
        return reality_inbounds, xhttp_inbounds

    @staticmethod
    async def build_and_save_all(session, node_id: int):
        """
        Сборка конфигов Xray и Nginx для конкретной ноды и сохранение в БД.
        """
        try:
            # 1. Получаем данные ноды
            result = await session.execute(select(Node).where(Node.id == node_id))
            node = result.scalars().first()
            if not node: raise Exception(f"Node {node_id} not found")

            is_master = (node.id == 1)
            
            # 2. Генерируем конфиг XRAY
            # Теперь мы создаем генератор прямо здесь, передавая node_id
            xray_gen = XrayConfigGenerator(node_id=node_id)
            xray_payload = await xray_gen.build_config(session)

            # 3. Генерируем конфиг NGINX
            nginx_gen = NginxConfigGenerator(
                domain=node.address,
                reality_domain=node.reality_server_address,
                is_master=is_master
            )

            reality_ib, xhttp_ib = await NodeConfigService._get_node_inbounds(session, node_id)
            
            static_ib = []
            if is_master:
                static_ib.append({"sni": settings.panel_domain, "port": 7443, "backend_host": "nginx"})
            if not reality_ib and is_master:
                reality_ib.append({"sni": "fallback", "port": 8443})

            nginx_files = {
                "nginx.conf": nginx_gen.generate_main_conf(),
                "stream-enabled/00-sni-router.conf": nginx_gen.generate_stream_conf(reality_ib, static_ib),
                "snippets/xui-common-locations.conf": nginx_gen.generate_snippet_conf(xhttp_ib),
            }
            sites = nginx_gen.generate_sites_conf()
            for filename, content in sites.items():
                nginx_files[f"sites-available/{filename}"] = content

            # 4. Формируем финальный пакет и считаем чексумму
            full_package = {
                "xray": xray_payload,
                "nginx": nginx_files
            }
            dumped = json.dumps(full_package, sort_keys=True, ensure_ascii=False)
            checksum = hashlib.sha256(dumped.encode()).hexdigest()

            # 5. Проверка на изменения (чтобы не плодить версии без правок)
            last_cfg_res = await session.execute(
                select(NodeConfig)
                .where(NodeConfig.node_id == node_id)
                .order_by(NodeConfig.version.desc())
                .limit(1)
            )
            last_cfg = last_cfg_res.scalars().first()
            if last_cfg and last_cfg.checksum == checksum:
                logger.info(f"ℹ️ No changes detected for Node {node_id}")
                return last_cfg

            # 6. Сохранение новой версии
            new_version = node.desired_version + 1
            new_config = NodeConfig(
                node_id=node_id,
                version=new_version,
                config_payload=xray_payload, # Чистый JSON для Xray
                nginx_payload=nginx_files,   # Словарь файлов для Nginx
                checksum=checksum
            )
            session.add(new_config)
            node.desired_version = new_version
            
            await session.commit()
            logger.info(f"✅ Version {new_version} saved for Node {node_id}")
            return new_config

        except Exception as e:
            await session.rollback()
            logger.error(f"❌ Config build failed for Node {node_id}: {e}")
            raise