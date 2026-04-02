# app/services/xray/security.py
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519

class XraySecurityService:
    @staticmethod
    async def generate_reality_keys() -> dict:
        private_key = x25519.X25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        def b64_xray(key_bytes: bytes) -> str:
            return base64.urlsafe_b64encode(key_bytes).decode('utf-8').rstrip('=')
        
        return {
            "private_key": b64_xray(private_key.private_bytes(
                encoding=serialization.Encoding.Raw, 
                format=serialization.PrivateFormat.Raw, 
                encryption_algorithm=serialization.NoEncryption())),
            "public_key": b64_xray(public_key.public_bytes(
                encoding=serialization.Encoding.Raw, 
                format=serialization.PublicFormat.Raw))
        }