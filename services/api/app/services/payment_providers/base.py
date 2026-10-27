import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class PaymentGateway(ABC):
    """Abstract base class for payment gateway integrations."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self._api_key = api_key
        self._base_url = base_url

    @property
    def api_key(self) -> Optional[str]:
        return self._api_key

    @property
    def base_url(self) -> Optional[str]:
        return self._base_url

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        ...

    @abstractmethod
    async def create_checkout(
        self,
        amount: int,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
    ) -> bool:
        ...

    @abstractmethod
    async def get_checkout_status(
        self,
        checkout_id: str,
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    async def expire_checkout(
        self,
        checkout_id: str,
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    async def process_refund(
        self,
        transaction_id: str,
        amount: Optional[int] = None,
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    async def get_provider_name(self) -> str:
        ...

    async def check_health(self) -> Dict[str, Any]:
        """Return a health report for this gateway."""
        return {
            "provider": await self.get_provider_name(),
            "is_configured": self.is_configured,
            "base_url": self.base_url,
            "timestamp": datetime.utcnow().isoformat(),
        }
