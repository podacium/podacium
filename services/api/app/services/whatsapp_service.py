# app/services/whatsapp_service.py
import httpx
import logging
import hmac
import hashlib
from typing import Optional
from app.core.config import setting

logger = logging.getLogger(__name__)

SUPPORTED_WHATSAPP_LANGUAGES = {
    "ar": "ar",
    "fr": "fr",
    "en": "en_US",
    "en_US": "en_US",
}


def _resolve_whatsapp_language(locale: Optional[str]) -> str:
    """
    Resolve and normalize user locale to Meta WhatsApp supported language codes.
    Meta's WhatsApp Business Cloud API strictly supports standardized ISO 639-1
    language codes and returns HTTP 400 (Error 132001) for unsupported codes like 'kab'.
    Falls back 'kab' to 'fr' (Algerian bilingual standard).
    """
    if not locale:
        return "fr"
    clean = locale.strip().lower()
    normalized = clean.split("-")[0].split("_")[0]
    if normalized == "kab":
        return "fr"  # Fallback Kabyle to French for Meta WhatsApp templates
    return SUPPORTED_WHATSAPP_LANGUAGES.get(
        clean, SUPPORTED_WHATSAPP_LANGUAGES.get(normalized, "fr")
    )


class WhatsAppService:
    def __init__(self):
        self.access_token = setting.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = setting.WHATSAPP_PHONE_NUMBER_ID
        self.api_version = setting.WHATSAPP_API_VERSION
        self.api_url = f"{setting.WHATSAPP_API_URL}/{self.api_version}/{self.phone_number_id}/messages"
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def send_template_message(
        self,
        phone_number: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[list] = None,
    ) -> bool:
        """
        Send a WhatsApp template message to a phone number

        Args:
            phone_number: Recipient phone number in international format (e.g., 213XXXXXXXXX)
            template_name: Name of the WhatsApp template
            language_code: Language code (default: en_US)
            components: Optional message components for template variables

        Returns:
            bool: True if message sent successfully, False otherwise
        """
        # Ensure phone number is in correct format (without +)
        if phone_number.startswith("+"):
            phone_number = phone_number[1:]

        # Ensure Algerian phone numbers start with 213
        if phone_number.startswith("0"):
            phone_number = "213" + phone_number[1:]

        is_kabyle = bool(
            language_code
            and (
                language_code.lower() == "kab"
                or language_code.lower().startswith("kab-")
                or language_code.lower().startswith("kab_")
            )
        )
        resolved_lang = _resolve_whatsapp_language(language_code)
        template_data: dict = {
            "name": template_name,
            "language": {"code": resolved_lang},
        }

        # Add components if provided (for dynamic content like verification codes)
        processed_components = components
        if is_kabyle and components:
            import copy

            processed_components = copy.deepcopy(components)
            for comp in processed_components:
                if comp.get("type") == "body" and "parameters" in comp:
                    for param in comp["parameters"]:
                        if param.get("type") == "text" and "text" in param:
                            orig_text = param["text"]
                            if not orig_text.startswith("Azul"):
                                param["text"] = f"Azul! {orig_text}"
                            break

        if processed_components:
            template_data["components"] = processed_components

        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "template",
            "template": template_data,
        }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        try:
            client = self._get_client()
            response = await client.post(self.api_url, headers=headers, json=payload)

            if response.status_code == 200:
                logger.info(f"WhatsApp message sent successfully to {phone_number}")
                return True
            else:
                logger.error(
                    f"WhatsApp API error: {response.status_code} - {response.text}"
                )
                return False

        except httpx.RequestError as e:
            logger.error(f"WhatsApp request error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected WhatsApp error: {e}")
            return False

    async def send_text_message(self, phone_number: str, message: str) -> bool:
        """
        Send a plain text message via WhatsApp

        Args:
            phone_number: Recipient phone number in international format
            message: Message text to send

        Returns:
            bool: True if message sent successfully, False otherwise
        """
        # Ensure phone number is in correct format (without +)
        original_number = phone_number
        if phone_number.startswith("+"):
            phone_number = phone_number[1:]

        # Ensure Algerian phone numbers start with 213
        if phone_number.startswith("0"):
            phone_number = "213" + phone_number[1:]

        logger.info(
            f"WhatsApp: Original number: {original_number} → Formatted: {phone_number}"
        )

        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "text",
            "text": {"body": message},
        }

        logger.info(f"WhatsApp: Sending payload: {payload}")
        logger.info(f"WhatsApp: API URL: {self.api_url}")

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        try:
            client = self._get_client()
            response = await client.post(self.api_url, headers=headers, json=payload)

            logger.info(f"WhatsApp: Response status: {response.status_code}")
            logger.info(f"WhatsApp: Response body: {response.text}")

            if response.status_code == 200:
                logger.info(
                    f"WhatsApp text message sent successfully to {phone_number}"
                )
                return True
            else:
                logger.error(
                    f"WhatsApp API error: {response.status_code} - {response.text}"
                )
                return False

        except httpx.RequestError as e:
            logger.error(f"WhatsApp request error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected WhatsApp error: {e}")
            return False

    async def send_verification_code(
        self, phone_number: str, verification_code: str
    ) -> bool:
        """
        Send verification code via WhatsApp as a plain text message

        Args:
            phone_number: Recipient phone number
            verification_code: 6-digit verification code

        Returns:
            bool: True if message sent successfully, False otherwise
        """
        message = f"Your verification code is: {verification_code}"
        return await self.send_text_message(phone_number=phone_number, message=message)

    async def send_welcome_message(self, phone_number: str, user_name: str) -> bool:
        """
        Send welcome message to new users

        Args:
            phone_number: Recipient phone number
            user_name: User's name

        Returns:
            bool: True if message sent successfully, False otherwise
        """
        components = [
            {"type": "body", "parameters": [{"type": "text", "text": user_name}]}
        ]

        return await self.send_template_message(
            phone_number=phone_number,
            template_name="welcome_message",  # You need to create this template
            language_code="en_US",
            components=components,
        )

    async def send_transaction_notification(
        self,
        phone_number: str,
        amount: float,
        currency: str = "DZD",
        transaction_id: Optional[str] = None,
    ) -> bool:
        """
        Send transaction notification via WhatsApp

        Args:
            phone_number: Recipient phone number
            amount: Transaction amount
            currency: Currency code
            transaction_id: Optional transaction ID

        Returns:
            bool: True if message sent successfully, False otherwise
        """
        amount_str = f"{amount:,.2f} {currency}"

        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": amount_str},
                    {"type": "text", "text": transaction_id or "N/A"},
                ],
            }
        ]

        return await self.send_template_message(
            phone_number=phone_number,
            template_name="transaction_notification",  # Create this template
            language_code="en_US",
            components=components,
        )

    @staticmethod
    def verify_webhook_signature(
        raw_body: bytes,
        signature_header: Optional[str],
        app_secret: Optional[str] = None,
    ) -> bool:
        """
        Verify Meta WhatsApp Cloud API webhook signature (X-Hub-Signature-256).
        Uses constant-time comparison (hmac.compare_digest) to prevent timing attacks.
        """
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        secret = (
            app_secret
            or getattr(setting, "WHATSAPP_APP_SECRET", "")
            or getattr(setting, "WHATSAPP_ACCESS_TOKEN", "")
        )
        if not secret:
            return False
        expected_sig = (
            "sha256="
            + hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        )
        return hmac.compare_digest(expected_sig, signature_header)


# Singleton instance
whatsapp_service = WhatsAppService()
