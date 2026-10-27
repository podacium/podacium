"""
Chargily Pay Integration

A dedicated payment provider for integrating with Chargily Pay (Algerian payment gateway).
This module provides direct API calls without relying on external libraries.

API Documentation: https://dev.chargily.com/pay-v2/api-reference
"""

import logging
import hashlib
import hmac
import httpx
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

from app.core.config import setting
from app.services.payment_providers.base import PaymentGateway

logger = logging.getLogger(__name__)


@dataclass
class ChargilyCheckout:
    """Represents a Chargily checkout response"""

    id: str
    checkout_url: str
    amount: int
    currency: str
    status: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class ChargilyProvider(PaymentGateway):
    """
    Payment provider for Chargily Pay API v2.

    Uses a shared httpx.AsyncClient with connection pooling to avoid
    memory leaks from per-request client creation.

    Usage:
        provider = ChargilyProvider()
        checkout = await provider.create_checkout(...)
        await provider.close()  # On app shutdown
    """

    # API Endpoints
    BASE_URL_TEST = "https://pay.chargily.net/test/api/v2"
    BASE_URL_LIVE = "https://pay.chargily.net/api/v2"

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        mode: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        resolved_api_key = api_key or setting.CHARGILY_API_KEY
        resolved_mode = mode or getattr(setting, "CHARGILY_MODE", "test")
        if base_url:
            resolved_base_url = base_url
        else:
            resolved_base_url = (
                self.BASE_URL_LIVE if resolved_mode == "live" else self.BASE_URL_TEST
            )

        super().__init__(api_key=resolved_api_key, base_url=resolved_base_url)

        self.api_secret = api_secret or setting.CHARGILY_SECRET_KEY
        self.mode = resolved_mode
        self._client: Optional[httpx.AsyncClient] = None
        logger.info(
            f"ChargilyProvider initialized in {self.mode} mode: {self.base_url}"
        )

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create the shared httpx client with connection pooling."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            )
        return self._client

    async def close(self) -> None:
        """Close the shared httpx client. Call on app shutdown."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def is_configured(self) -> bool:
        """Check if API credentials are configured"""
        return bool(self.api_secret)

    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers for API requests"""
        return {
            "Authorization": f"Bearer {self.api_secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @staticmethod
    def _validate_return_url(url: Optional[str], label: str) -> str:
        """Validate a return URL is within the configured frontend domain.

        🔒 SECURITY: Prevents open redirect via payment gateway callbacks.
        Attacker-controlled success/failure URLs could redirect users to
        phishing pages after payment completion.

        Accepts both www and non-www variants of the frontend URL.
        """
        if not url:
            default = f"{setting.FRONTEND_URL}/billing"
            logger.warning(f"No {label} provided, using default: {default}")
            return default

        frontend = setting.FRONTEND_URL.rstrip("/")

        # Build allowed prefixes: honor both www and non-www variants
        allowed_prefixes = [frontend]
        if "www." in frontend:
            alt = frontend.replace("www.", "", 1)
            allowed_prefixes.append(alt)
        else:
            alt = frontend.replace("://", "://www.")
            allowed_prefixes.append(alt)

        if any(url.startswith(p) for p in allowed_prefixes):
            return url

        logger.warning(
            f"Blocked {label} '{url}' — does not start with "
            f"any allowed frontend URL {allowed_prefixes}"
        )
        # Force the safe default
        fallback_urls = {
            "success_url": f"{frontend}/billing?success=true",
            "failure_url": f"{frontend}/billing?failure=true",
        }
        return fallback_urls.get(label, f"{frontend}/billing")

    async def create_checkout(  # type: ignore[override]
        self,
        amount: int,
        currency: str = "dzd",
        success_url: Optional[str] = None,
        failure_url: Optional[str] = None,
        webhook_url: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        locale: str = "ar",
        **kwargs: Any,
    ) -> ChargilyCheckout:
        """
        Create a new checkout session.

        Args:
            amount: Amount in DZD (e.g. 100.50 for 100.50 DZD)
            currency: Currency code (default: "dzd")
            success_url: URL to redirect after successful payment
            failure_url: URL to redirect after failed/cancelled payment
            webhook_url: URL for webhook notifications
            customer_name: Customer's full name
            customer_email: Customer's email address
            customer_phone: Customer's phone number
            description: Payment description
            metadata: Additional metadata to attach to checkout
            locale: Checkout page language ("ar", "en", "fr")

        Returns:
            ChargilyCheckout with checkout_url for redirecting user

        Raises:
            ChargilyError: If API request fails
        """
        if not self.is_configured:
            raise ChargilyError("Chargily API credentials not configured")

        # Build payload
        payload = {
            "amount": amount,
            "currency": currency.lower(),
            "success_url": self._validate_return_url(success_url, "success_url"),
            "failure_url": self._validate_return_url(failure_url, "failure_url"),
            "locale": locale,
        }

        # Add optional fields
        if webhook_url:
            payload["webhook_url"] = webhook_url

        # Move customer details and description to metadata as they are not valid top-level params in V2
        if metadata is None:
            metadata = {}

        if customer_name:
            metadata["customer_name"] = customer_name

        if customer_email:
            metadata["customer_email"] = customer_email

        if customer_phone:
            metadata["customer_phone"] = customer_phone

        if description:
            metadata["description"] = description

        if metadata:
            payload["metadata"] = metadata

        logger.info(f"Creating Chargily checkout: {amount} {currency}")

        try:
            client = self._get_client()
            response = await client.post(
                f"{self.base_url}/checkouts", json=payload, headers=self._get_headers()
            )

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                logger.error(
                    f"Chargily API error: {response.status_code} - {error_data}"
                )
                raise ChargilyError(
                    f"Checkout creation failed: {error_data.get('message', 'Unknown error')}",
                    status_code=response.status_code,
                    response=error_data,
                )

            data = response.json()
            logger.info(f"Chargily checkout created: {data.get('id')}")

            return ChargilyCheckout(
                id=data.get("id"),
                checkout_url=data.get("checkout_url"),
                amount=data.get("amount"),
                currency=data.get("currency"),
                status=data.get("status", "pending"),
                metadata=data.get("metadata"),
            )

        except httpx.RequestError as e:
            logger.error(f"Chargily request failed: {str(e)}")
            raise ChargilyError(f"Network error: {str(e)}")

    async def get_checkout_status(self, checkout_id: str) -> Dict[str, Any]:
        """
        Get checkout details by ID (ABC interface).

        Delegates to get_checkout for backward compatibility.
        """
        return await self.get_checkout(checkout_id)

    async def get_checkout(self, checkout_id: str) -> Dict[str, Any]:
        """
        Get checkout details by ID.

        Args:
            checkout_id: The checkout ID returned from create_checkout

        Returns:
            Checkout details from Chargily
        """
        if not self.is_configured:
            raise ChargilyError("Chargily API credentials not configured")

        try:
            client = self._get_client()
            response = await client.get(
                f"{self.base_url}/checkouts/{checkout_id}", headers=self._get_headers()
            )

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise ChargilyError(
                    f"Failed to get checkout: {error_data.get('message', 'Unknown error')}",
                    status_code=response.status_code,
                )

            return response.json()

        except httpx.RequestError as e:
            raise ChargilyError(f"Network error: {str(e)}")

    async def expire_checkout(self, checkout_id: str) -> Dict[str, Any]:
        """
        Expire/cancel a pending checkout on Chargily.

        Only works for checkouts in 'pending' or 'inprogress' status.
        For already-paid checkouts, Chargily has no refund endpoint,
        so the refund is handled internally via wallet credit.

        Args:
            checkout_id: The checkout ID to expire

        Returns:
            Chargily API response confirming the expiry

        Raises:
            ChargilyError: If API request fails or checkout cannot be expired
        """
        if not self.is_configured:
            raise ChargilyError("Chargily API credentials not configured")

        logger.info(f"Expiring Chargily checkout: {checkout_id}")

        try:
            client = self._get_client()
            response = await client.post(
                f"{self.base_url}/checkouts/{checkout_id}/expire",
                headers=self._get_headers(),
            )

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                logger.error(
                    f"Chargily expire error: {response.status_code} - {error_data}"
                )
                raise ChargilyError(
                    f"Failed to expire checkout: {error_data.get('message', 'Unknown error')}",
                    status_code=response.status_code,
                    response=error_data,
                )

            data = response.json()
            logger.info(f"Chargily checkout expired: {checkout_id}")
            return data

        except httpx.RequestError as e:
            logger.error(f"Chargily expire request failed: {str(e)}")
            raise ChargilyError(f"Network error: {str(e)}")

    async def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify webhook signature using HMAC-SHA256.

        Args:
            payload: Raw request body bytes
            signature: Signature from 'signature' header

        Returns:
            True if signature is valid
        """
        if not self.api_secret:
            logger.warning("Cannot verify webhook: API secret not configured")
            return False

        try:
            expected = hmac.new(
                self.api_secret.encode("utf-8"), payload, hashlib.sha256
            ).hexdigest()

            is_valid = hmac.compare_digest(expected, signature)

            if not is_valid:
                logger.warning(
                    f"Webhook signature mismatch: expected={expected[:16]}..., got={signature[:16]}..."
                )

            return is_valid

        except Exception as e:
            logger.error(f"Webhook signature verification error: {str(e)}")
            return False

    async def get_provider_name(self) -> str:
        """Return the name of this payment provider."""
        return "chargily"

    async def process_refund(
        self,
        transaction_id: str,
        amount: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Process a refund via Chargily.

        ⚠️ Chargily does not provide a refund API endpoint.
        Refunds are handled internally via wallet credit.
        See tasks/refund_tasks.py for the internal flow.

        Raises:
            ChargilyError: Always — Chargily has no refund endpoint.
        """
        logger.warning(
            f"Chargily refund requested for {transaction_id} "
            f"but Chargily has no refund API — use internal wallet flow instead."
        )
        raise ChargilyError(
            "Chargily does not support API refunds. "
            "Use the internal wallet credit flow via refund tasks.",
            status_code=501,
        )

    def parse_webhook_event(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse and normalize webhook event data.

        Args:
            data: Raw webhook payload

        Returns:
            Normalized event data with standard fields
        """
        return {
            "event_type": data.get("type"),
            "checkout_id": data.get("data", {}).get("id"),
            "status": data.get("data", {}).get("status"),
            "amount": data.get("data", {}).get("amount"),
            "currency": data.get("data", {}).get("currency"),
            "metadata": data.get("data", {}).get("metadata", {}),
            "paid_at": data.get("data", {}).get("paid_at"),
            "raw": data,
        }


class ChargilyError(Exception):
    """Exception for Chargily API errors"""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


# Singleton instance
chargily_client = ChargilyProvider()

# Backward-compatible alias for code importing the old class name
ChargilyClient = ChargilyProvider
