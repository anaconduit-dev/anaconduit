from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class DomainStrategy(str, Enum):
    AsIs = "AsIs"
    IPIfNonMatch = "IPIfNonMatch"
    IPOnDemand = "IPOnDemand"

class LogLevel(str, Enum):
    debug = "debug"
    info = "info"
    warning = "warning"
    error = "error"
    none = "none"

class GlobalSettingsBase(BaseModel):
    domain_strategy: DomainStrategy = DomainStrategy.IPIfNonMatch
    log_level: LogLevel = LogLevel.warning
    stats_user_uplink: bool = True
    stats_user_downlink: bool = True

class GlobalSettingsUpdate(BaseModel):
    # Все поля опциональны, чтобы можно было обновить только одно
    domain_strategy: Optional[DomainStrategy] = None
    log_level: Optional[LogLevel] = None
    stats_user_uplink: Optional[bool] = None
    stats_user_downlink: Optional[bool] = None

class GlobalSettingsResponse(GlobalSettingsBase):
    id: int
    
    class Config:
        from_attributes = True