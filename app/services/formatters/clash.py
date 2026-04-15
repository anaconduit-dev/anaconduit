import yaml
import logging
import urllib.parse
from app.core.config import settings
from app.models import User, Client, Inbound

logger = logging.getLogger(__name__)

class ClashFormatter:
    def __init__(self, user: User):
        self.user = user
        self.domain = settings.panel_domain
        self.existing_remarks = []

    def _get_unique_remark(self, remark: str) -> str:
        if remark not in self.existing_remarks:
            return remark
        counter = 2
        while f"{remark} ({counter})" in self.existing_remarks:
            counter += 1
        return f"{remark} ({counter})"

    def make_node(self, client: Client, inbound: Inbound) -> dict:
        stream = inbound.stream_settings or {}
        net = stream.get("network", "tcp")
        security = stream.get("security", "none")
        
        raw_remark = f"{inbound.tag} | {net.upper()}"
        remark = self._get_unique_remark(raw_remark)
        self.existing_remarks.append(remark)

        node = {
            "name": remark,
            "type": inbound.protocol,
            "server": self.domain,
            "port": "443",
            "udp": True,
            "tls": True if security in ["tls", "reality"] else False,
            "skip-cert-verify": True,
            "client-fingerprint": "chrome",
        }

        if security != "reality":
            node["servername"] = self.domain
            if inbound.protocol == "trojan":
                node["sni"] = self.domain

        # VLESS
        if inbound.protocol == "vless":
            node["uuid"] = client.uuid
            node["xudp"] = True
            if security == "reality":
                reality = stream.get("realitySettings", {})
                node["servername"] = reality.get("serverNames", [self.domain])[0]
                node["reality-opts"] = {
                    "public-key": reality.get("publicKey", ""),
                    "short-id": reality.get("shortIds", [""])[0] if reality.get("shortIds") else ""
                }
                if net == "tcp":
                    node["flow"] = "xtls-rprx-vision"
                    node["network"] = "tcp"
                    node["http-opts"] = {"headers": {}, "path": ["/"]}

        # Trojan
        elif inbound.protocol == "trojan":
            node["password"] = client.uuid

        # Transport
        if net == "ws":
            ws = stream.get("wsSettings", {})
            # Генерируем или берем стандартный User-Agent
            default_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            
            headers = {
                "Host": ws.get("headers", {}).get("Host", self.domain),
                "User-Agent": ws.get("headers", {}).get("User-Agent", default_ua)
            }

            node["network"] = "ws"
            node["ws-opts"] = {
                "path": f"/{inbound.port}/{ws.get('path', '').lstrip('/')}",
                "headers": headers
            }
            node["tls"] = True
        elif net == "grpc":
            grpc = stream.get("grpcSettings", {})
            node["network"] = "grpc"
            node["grpc-opts"] = {
                "grpc-service-name": f"/{inbound.port}/{grpc.get('serviceName', '').lstrip('/')}"
            }
        elif net == "xhttp":
            xhttp = stream.get("xhttpSettings", {})
            node["network"] = "xhttp"
            node["xhttp-opts"] = {
                "mode": xhttp.get("mode", "packet-up"),
                "path": f"/{xhttp.get('path', '').lstrip('/')}"
            }
            node["tls"] = True
        return node

    def format(self, template_content: str, injection_tag: str, proxies: list) -> str:
        try:
            if not template_content:
                return yaml.dump({"proxies": proxies}, allow_unicode=True)

            config = yaml.safe_load(template_content)
            config['proxies'] = proxies
            
            if 'proxy-groups' in config and isinstance(config['proxy-groups'], list):
                for group in config['proxy-groups']:
                    group_proxies = group.get('proxies')
                    if isinstance(group_proxies, list) and injection_tag in group_proxies:
                        idx = group_proxies.index(injection_tag)
                        group_proxies.pop(idx)
                        # Вставляем имена созданных нод
                        for i, name in enumerate(self.existing_remarks):
                            group_proxies.insert(idx + i, name)

            return yaml.dump(config, allow_unicode=True, sort_keys=False, default_flow_style=False)
        except Exception as e:
            logger.error(f"Clash Formatting Error: {e}")
            return template_content.replace(injection_tag, yaml.dump(proxies))