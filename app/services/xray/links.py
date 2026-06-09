# app/services/xray/links.py

import urllib.parse
import base64
import logging
import yaml
import json
from fastapi import Response, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.config import settings
from app.models import UserGroup, SubscriptionTemplate
from app.models import Inbound, User, Client
from app.services.formatters.clash import ClashFormatter

logger = logging.getLogger(__name__)

class XrayLinkGenerator:
    def generate_config_link(self, client: Client, user: User, inbound: Inbound) -> str:
        domain = settings.panel_domain
        stream = inbound.stream_settings or {}
        net = stream.get("network", "tcp")
        security = stream.get("security", "none")
        
        # Порт для клиента всегда 443 (через Nginx)
        port = 443 
        
        params = {
            "security": security, 
            "type": net,
            "sni": domain 
        }

        # Логика Port-in-Path
        if net in ["ws", "grpc", "xhttp"] and security == "none":
            params["security"] = "tls"
            
        inbound_port = inbound.port

        if net == "ws":
            ws = stream.get("wsSettings", {})
            original_path = ws.get("path", "/").lstrip("/")
            params["path"] = f"/{inbound_port}/{original_path}"
            params["host"] = ws.get("headers", {}).get("Host", domain)
            
        elif net == "grpc":
            grpc = stream.get("grpcSettings", {})
            raw_service = grpc.get("serviceName", "").lstrip("/")
            params["serviceName"] = f"/{inbound_port}/{raw_service}"
            params["authority"] = domain
            params["sni"] = domain
            params["security"] = "tls"
            params["mode"] = "multi" if grpc.get("multiMode") else "gun"
            
        elif net == "xhttp":
            xhttp = stream.get("xhttpSettings", {})
            original_path = xhttp.get("path", "/").lstrip("/")
            params["path"] = f"/{original_path}"
            params["mode"] = xhttp.get("mode", "packet-up")
            params["security"] = "tls" 
            params["sni"] = domain

        if security == "reality":
            reality = stream.get("realitySettings", {})
            params.update({
                "security": "reality",
                "sni": reality.get("serverNames", [domain])[0],
                "pbk": reality.get("publicKey", ""),
                "sid": reality.get("shortIds", [""])[0] if reality.get("shortIds") else "",
                "fp": reality.get("fingerprint", "chrome"),
            })
            if net == "tcp":
                params["flow"] = "xtls-rprx-vision"

        query_params = {k: v for k, v in params.items() if v}
        query_str = urllib.parse.urlencode(query_params)
        remark = urllib.parse.quote(f"{user.email}@{inbound.tag}")

        if inbound.protocol == "trojan":
            return f"trojan://{client.uuid}@{domain}:{port}?{query_str}#{remark}"
        elif inbound.protocol == "vless":
            return f"vless://{client.uuid}@{domain}:{port}?{query_str}#{remark}"

        return ""

    def _detect_client_type(self, request: Request) -> str:
        fmt = request.query_params.get("format")
        if fmt == "base64":
            return "base64"
        """Определяет тип клиента на основе User-Agent или query-параметра"""
        client_param = request.query_params.get("client")
        if client_param:
            return client_param.lower()

        ua = request.headers.get("User-Agent", "").lower()
        
        # Clash & Stash
        if "clash" in ua or "stash" in ua:
            return "clash"
        
        return "base64"

    def _get_unique_remark(self, remark: str, existing_remarks: list) -> str:
        """Гарантирует уникальность имени ноды в списке прокси"""
        if remark not in existing_remarks:
            return remark
        counter = 2
        while f"{remark} ({counter})" in existing_remarks:
            counter += 1
        return f"{remark} ({counter})"

    

    def _get_sub_headers(self, user: User, filename: str) -> dict:
        total_traffic = user.traffic_limit or 0
        expiry = int(user.expiry_time.timestamp()) if user.expiry_time else 0
        remark = urllib.parse.quote(f"Anaconduit: {filename}")
        
        return {
            "Subscription-Userinfo": f"upload={user.total_up}; download={user.total_down}; total={total_traffic}; expire={expiry}",
            "Profile-Update-Interval": "6",
            "Content-Disposition": f'attachment; filename="{remark}"; filename*=UTF-8\'\'{remark}',
            "Content-Type": "text/plain; charset=utf-8"
        }

    async def generate_subscription(self, token: str, session, request: Request):
        # 1. Получаем пользователя
        result = await session.execute(
            select(User)
            .where(User.subscription_token == token)
            .options(
                joinedload(User.clients).joinedload(Client.inbound),
                joinedload(User.groups).joinedload(UserGroup.template)
            )
        )
        user = result.scalars().first()
        
        if not user or not user.is_active:
            raise HTTPException(status_code=404, detail="User not found or inactive")

        # 2. Определяем тип клиента
        client_type = self._detect_client_type(request)
        # 3. Подготавливаем базовые ссылки (для JSON и Base64)
        raw_links = []
        for client in user.clients:
            if client.inbound and client.inbound.is_active:
                link = self.generate_config_link(client, user, client.inbound)
                if link:
                    raw_links.append(link)

        # 4. Ищем шаблон в группах пользователя для текущего типа клиента
        target_template = None
        for group in user.groups:
            if group.template and group.template.client_type == client_type:
                target_template = group.template
                break

        # 5. Логика генерации ответа в зависимости от типа
        
        # --- CLASH ---
        if client_type == "clash":
            formatter = ClashFormatter(user)
            proxies = [
                formatter.make_node(c, c.inbound) 
                for c in user.clients if c.inbound and c.inbound.is_active
            ]
            
            
            if target_template:
                final_content = formatter.format(
                    target_template.content, 
                    target_template.injection_tag, 
                    proxies
                )
            else:
                # Если шаблона нет, отдаем просто список прокси в YAML
                final_content = yaml.dump({"proxies": proxies}, allow_unicode=True)

            return Response(
                content=final_content,
                media_type="text/yaml",
                headers=self._get_sub_headers(user, target_template.name if target_template else "Clash")
            )

        # --- FALLBACK (BASE64) ---
        payload = base64.b64encode("\n".join(raw_links).encode()).decode()
        return Response(
            content=payload, 
            headers=self._get_sub_headers(user, "Anaconduit-Base64")
        )