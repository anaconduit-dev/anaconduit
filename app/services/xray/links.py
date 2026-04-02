# app/services/xray/links.py
import urllib.parse
import base64
import logging
from fastapi import Response, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.config import settings
from app.models.models import Inbound, User, Client

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

    async def generate_subscription(self, token: str, session):
        result = await session.execute(
            select(User)
            .where(User.subscription_token == token)
            .options(joinedload(User.clients).joinedload(Client.inbound))
        )
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        raw_links_list = []
        for client in user.clients:
            if client.inbound.protocol in ["vless", "trojan"]:
                link = self.generate_config_link(client, user, client.inbound)
                raw_links_list.append(link)

        payload = base64.b64encode("\n".join(raw_links_list).encode()).decode()
        
        update_interval = 6 
        remark = urllib.parse.quote(f"Anaconduit:{user.email}")
        
        # Считаем лимиты для заголовка
        total_traffic = user.traffic_limit
        expiry = int(user.expiry_time.timestamp()) if user.expiry_time else 0
        
        headers = {
            "Subscription-Userinfo": (
                f"upload={user.total_up}; download={user.total_down}; "
                f"total={total_traffic}; expire={expiry}"
            ),
            "Profile-Update-Interval": str(update_interval),
            "Content-Disposition": f'attachment; filename="{remark}"; filename*=UTF-8\'\'{remark}',
            "Content-Type": "text/plain; charset=utf-8"
        }
        return Response(content=payload, headers=headers)