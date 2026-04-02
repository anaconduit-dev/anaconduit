# app/services/xray/generator.py
import logging
from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.models import Inbound, Client, User, Outbound, RoutingRule
from app.core.config import settings

logger = logging.getLogger(__name__)

class XrayConfigGenerator:
    def __init__(self, api_port: int = 10085):
        self.api_port = api_port

    def _get_xray_email(self, email: str, tag: str) -> str:
        """
        Единый стандарт формирования email для Xray.
        Всегда в нижнем регистре для избежания проблем десинхронизации.
        """
        clean_email = email.strip().lower()
        return f"{clean_email}#{tag}"

    async def build_config(self, session) -> dict:
        """Главная точка входа для сборки JSON конфига"""
        return {
            "log": {
                "access": "/var/log/xray/access.log", 
                "error": "/var/log/xray/error.log", 
                "loglevel": "warning"
            },
            "stats": {},
            "api": {
                "tag": "api",
                "listen": f"0.0.0.0:{self.api_port}",
                "services": ["HandlerService", "StatsService", "LoggerService"]
            },
            "policy": {
                "levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}},
                "system": {"statsInboundUplink": True, "statsInboundDownlink": True}
            },
            "inbounds": await self._build_inbounds(session),
            "outbounds": await self._build_outbounds(session),
            "routing": await self._build_routing(session)
        }

    async def _build_inbounds(self, session) -> List[dict]:
        """Сборка входящих соединений с учетом специфики транспорта и реальности"""
        # 1. Получаем все активные инбаунды
        result = await session.execute(
            select(Inbound).where(Inbound.is_active == True)
        )
        db_inbounds = result.scalars().all()
        
        xray_inbounds = []

        for ib in db_inbounds:
            network_type = ib.stream_settings.get("network", "tcp")
            security_type = ib.stream_settings.get("security", "none")
            
            clean_stream_settings = ib.stream_settings.copy()
            clean_settings = ib.settings.copy()
            listen_address = ib.listen

            # --- Логика Nginx Fallbacks ---
            if "fallbacks" in clean_settings:
                for fb in clean_settings["fallbacks"]:
                    dest = str(fb.get("dest", ""))
                    if dest.isdigit():
                        fb["dest"] = f"nginx:{dest}"
                    elif any(x in dest for x in ["127.0.0.1", "localhost"]):
                        fb["dest"] = dest.replace("127.0.0.1", "nginx").replace("localhost", "nginx")

            # --- Транспортные настройки (WS/gRPC/xHTTP) ---
            if network_type == "ws":
                ws_settings = clean_stream_settings.get("wsSettings", {})
                raw_path = ws_settings.get("path", "/").lstrip("/")
                ws_settings["path"] = f"/{ib.port}/{raw_path}"
                if "headers" in ws_settings and "Host" in ws_settings["headers"]:
                    del ws_settings["headers"]["Host"]
                    if not ws_settings["headers"]: del ws_settings["headers"]
                clean_stream_settings["wsSettings"] = ws_settings

            elif network_type == "grpc":
                grpc_settings = clean_stream_settings.get("grpcSettings", {})
                service = grpc_settings.get("serviceName", "")
                if service and not service.startswith(f"{ib.port}"):
                    grpc_settings["serviceName"] = f"/{ib.port}/{service.lstrip('/')}"
                clean_stream_settings["grpcSettings"] = grpc_settings

            elif network_type == "xhttp":
                if listen_address.startswith("/") and "," not in listen_address:
                    listen_address = f"{listen_address},0666"
                if "sockopt" not in clean_stream_settings:
                    clean_stream_settings["sockopt"] = {}

            # --- Reality Fix ---
            if security_type == "reality":
                reality_settings = clean_stream_settings.get("realitySettings", {})
                if settings.reality_dest_domain in reality_settings.get("dest", ""):
                    reality_settings["dest"] = "nginx:9443"
                    reality_settings["xver"] = 1
                    clean_stream_settings["realitySettings"] = reality_settings

            # --- Сбор клиентов ---
            client_result = await session.execute(
                select(Client)
                .join(User)
                .options(joinedload(Client.user))
                .where(Client.inbound_id == ib.id, Client.enable == True, User.is_active == True)
            )
            db_clients = client_result.scalars().all()
            
            xray_clients = []
            for c in db_clients:
                client_dict = {
                    "email": self._get_xray_email(c.user.email, ib.tag),
                    "level": c.level,
                }
                if ib.protocol == "vless":
                    client_dict["id"] = c.uuid
                    if network_type == "tcp" and security_type in ["reality", "tls"]:
                        client_dict["flow"] = c.flow or ""
                elif ib.protocol == "trojan":
                    client_dict["password"] = c.uuid
                xray_clients.append(client_dict)
            
            clean_settings["clients"] = xray_clients

            xray_inbounds.append({
                "listen": listen_address,
                "tag": ib.tag,
                "port": ib.port,
                "protocol": ib.protocol,
                "settings": clean_settings,
                "streamSettings": clean_stream_settings,
                "sniffing": ib.sniffing or {"enabled": True, "destOverride": ["http", "tls"]}
            })

        return xray_inbounds

    async def _build_outbounds(self, session) -> List[dict]:
        """Формирование выходов с поддержкой каскадирования (Proxy Chain)"""
        result = await session.execute(select(Outbound).where(Outbound.is_active == True))
        db_outbounds = result.scalars().all()
        
        xray_outbounds = []
        for ob in db_outbounds:
            # Базовая структура
            outbound_dict = {
                "protocol": ob.protocol,
                "tag": ob.tag,
            }

            # 1. Настройки протокола (Settings)
            if ob.settings and isinstance(ob.settings, dict) and len(ob.settings) > 0:
                outbound_dict["settings"] = ob.settings
                
            # 2. Настройки транспорта (StreamSettings)
            if ob.stream_settings and isinstance(ob.stream_settings, dict) and len(ob.stream_settings) > 0:
                outbound_dict["streamSettings"] = ob.stream_settings
            
            # 3. Мультиплексирование (Mux)
            if ob.mux and isinstance(ob.mux, dict) and ob.mux.get("enabled") is True:
                outbound_dict["mux"] = ob.mux

            # --- НОВОЕ: Каскадирование (Proxy Settings) ---
            # Если в БД заполнено proxy_settings и там есть валидный tag
            if ob.proxy_settings and isinstance(ob.proxy_settings, dict):
                p_tag = ob.proxy_settings.get("tag")
                if p_tag:
                    outbound_dict["proxySettings"] = {"tag": p_tag}
            # ----------------------------------------------

            # Сортировка: дефолтный всегда первый в списке
            if ob.is_default:
                xray_outbounds.insert(0, outbound_dict)
            else:
                xray_outbounds.append(outbound_dict)
                
        # Если список пуст, добавляем стандартный freedom
        if not xray_outbounds:
            xray_outbounds.append({"protocol": "freedom", "tag": "direct"})
            
        return xray_outbounds

    async def _build_routing(self, session) -> dict:
        result = await session.execute(
            select(RoutingRule).where(RoutingRule.is_active == True).order_by(RoutingRule.priority.desc())
        )
        rules = result.scalars().all()
        
        xray_rules = []
        for r in rules:
            rule_dict = {
                "type": "field",
                "outboundTag": r.outbound_tag
            }
            
            # Проверяем, что это не None И что список не пустой
            if r.domain and len(r.domain) > 0:
                rule_dict["domain"] = r.domain
                
            if r.ip and len(r.ip) > 0:
                rule_dict["ip"] = r.ip
                
            if r.port: # Порт у нас строка, тут достаточно простой проверки
                rule_dict["port"] = r.port
                
            if r.inbound_tags and len(r.inbound_tags) > 0:
                rule_dict["inboundTag"] = r.inbound_tags
                
            if r.client_emails:
                # Убеждаемся, что это список, даже если в БД каким-то чудом попала строка
                emails = r.client_emails if isinstance(r.client_emails, list) else [r.client_emails]
                if len(emails) > 0:
                    rule_dict["user"] = emails

            # Добавляем правило только если в нем есть хотя бы один критерий фильтрации
            # Иначе это будет "пустое" правило, которое перехватит ВЕСЬ трафик
            keys = set(rule_dict.keys())
            if keys.intersection({"domain", "ip", "port", "inboundTag", "user"}):
                xray_rules.append(rule_dict)
            else:
                logger.warning(f"Правило {r.id} (tag: {r.outbound_tag}) пропущено: нет критериев фильтрации")

        return {
            "domainStrategy": "AsIs",
            "rules": xray_rules
        }