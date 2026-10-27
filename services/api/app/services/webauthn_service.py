"""WebAuthn / Passkey Service for passwordless 2FA.

Uses the `webauthn` Python library for FIDO2 WebAuthn
registration and authentication flows. Challenges are stored
in Redis with 5-minute TTL using the existing blocklist infrastructure.
"""

import json
import logging
import base64
from datetime import datetime, timezone
from typing import Optional

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
)
from webauthn.helpers.options_to_json import options_to_json

from app.core.config import setting
from app.core.prisma import prisma
from app.core.redis_blocklist import token_blocklist

logger = logging.getLogger(__name__)

RP_NAME = "Podacium"
CHALLENGE_TTL = 300  # 5 minutes


def _get_rp_id() -> str:
    """Extract the Relying Party ID from FRONTEND_URL or domain."""
    url = setting.FRONTEND_URL or "https://podacium.com"
    clean = url.replace("https://", "").replace("http://", "").split(":")[0]
    if "podacium.com" in clean:
        return "podacium.com"
    return clean or "localhost"


def _get_origins() -> list[str]:
    origins = [
        "https://podacium.com",
        "https://www.podacium.com",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    if setting.FRONTEND_URL and setting.FRONTEND_URL not in origins:
        origins.append(setting.FRONTEND_URL)
    return origins


class WebAuthnService:
    """WebAuthn registration and authentication for 2FA."""

    @staticmethod
    async def generate_registration_options(
        user_id: int, user_name: str
    ) -> Optional[dict]:
        """Generate PublicKeyCredentialCreationOptions for WebAuthn registration."""
        existing = await prisma.webauthncredential.find_many(
            where={"userId": user_id},
        )
        exclude_creds = [c.credentialId for c in existing]

        try:
            options = generate_registration_options(
                rp_id=_get_rp_id(),
                rp_name=RP_NAME,
                user_id=str(user_id).encode(),
                user_name=user_name,
                exclude_credentials=exclude_creds,
                authenticator_selection=AuthenticatorSelectionCriteria(
                    resident_key=ResidentKeyRequirement.PREFERRED,
                    user_verification=UserVerificationRequirement.PREFERRED,
                ),
            )
        except Exception as e:
            logger.error(f"WebAuthn reg options generation failed: {e}")
            return None

        challenge_str = base64.b64encode(options.challenge).decode()
        await token_blocklist.set(
            f"webauthn_challenge_{user_id}",
            challenge_str,
            CHALLENGE_TTL,
        )
        await token_blocklist.set(
            f"webauthn:challenge:reg:{user_id}",
            challenge_str,
            CHALLENGE_TTL,
        )
        return json.loads(options_to_json(options))

    @staticmethod
    async def verify_registration(user_id: int, response: dict) -> Optional[dict]:
        """Verify the authenticator's attestation and store the credential with one-time challenge semantics."""
        # Atomically delete the challenge key from Redis immediately upon reading
        challenge_b64 = await token_blocklist.get_and_delete(
            f"webauthn_challenge_{user_id}"
        )
        if not challenge_b64:
            challenge_b64 = await token_blocklist.get_and_delete(
                f"webauthn:challenge:reg:{user_id}"
            )
        if not challenge_b64:
            logger.warning(
                f"WebAuthn registration challenge missing or already consumed for user {user_id}"
            )
            return None

        # Clean up any alias keys
        await token_blocklist.delete_key(f"webauthn_challenge_{user_id}")
        await token_blocklist.delete_key(f"webauthn:challenge:reg:{user_id}")

        challenge = base64.b64decode(challenge_b64)

        try:
            verification = verify_registration_response(
                credential=response,
                expected_challenge=challenge,
                expected_rp_id=_get_rp_id(),
                expected_origin=_get_origins(),
                require_user_verification=False,
            )
        except Exception as e:
            logger.error(f"WebAuthn registration verification failed: {e}")
            return None

        raw_cred_id = verification.credential_id
        cred_id_str = response.get("id") or base64.urlsafe_b64encode(
            raw_cred_id
        ).decode().rstrip("=")

        credential = await prisma.webauthncredential.create(
            data={
                "userId": user_id,
                "credentialId": cred_id_str,
                "publicKey": base64.b64encode(
                    verification.credential_public_key
                ).decode(),
                "counter": verification.sign_count,
                "transports": response.get("response", {}).get("transports", []),
            }
        )

        await prisma.securitysettings.upsert(
            where={"userId": user_id},
            data={
                "update": {"webauthnEnabled": True},
                "create": {"userId": user_id, "webauthnEnabled": True},
            },
        )

        return {"id": credential.id, "credentialId": credential.credentialId}

    @staticmethod
    async def generate_authentication_options(
        user_id: int,
    ) -> Optional[dict]:
        """Generate PublicKeyCredentialRequestOptions for WebAuthn login."""
        credentials = await prisma.webauthncredential.find_many(
            where={"userId": user_id},
        )
        if not credentials:
            return None

        try:
            options = generate_authentication_options(
                rp_id=_get_rp_id(),
                allow_credentials=[c.credentialId for c in credentials],
                user_verification=UserVerificationRequirement.PREFERRED,
            )
        except Exception as e:
            logger.error(f"WebAuthn auth options generation failed: {e}")
            return None

        challenge_str = base64.b64encode(options.challenge).decode()
        await token_blocklist.set(
            f"webauthn_auth_challenge_{user_id}",
            challenge_str,
            CHALLENGE_TTL,
        )
        await token_blocklist.set(
            f"webauthn:challenge:auth:{user_id}",
            challenge_str,
            CHALLENGE_TTL,
        )
        await token_blocklist.set(
            f"webauthn:challenge:{user_id}",
            challenge_str,
            CHALLENGE_TTL,
        )
        return json.loads(options_to_json(options))

    @staticmethod
    async def verify_authentication(user_id: int, response: dict) -> Optional[dict]:
        """Verify the authenticator's assertion and update counter (clone detection) with atomic challenge invalidation."""
        # Atomically delete the challenge key from Redis immediately upon reading to eliminate assertion replay
        challenge_b64 = await token_blocklist.get_and_delete(
            f"webauthn_auth_challenge_{user_id}"
        )
        if not challenge_b64:
            challenge_b64 = await token_blocklist.get_and_delete(
                f"webauthn:challenge:auth:{user_id}"
            )
        if not challenge_b64:
            challenge_b64 = await token_blocklist.get_and_delete(
                f"webauthn:challenge:{user_id}"
            )
        if not challenge_b64:
            logger.warning(
                f"WebAuthn auth challenge missing or already consumed for user {user_id} — possible replay attack blocked"
            )
            return None

        # Clean up any remaining aliases immediately
        await token_blocklist.delete_key(f"webauthn_auth_challenge_{user_id}")
        await token_blocklist.delete_key(f"webauthn:challenge:auth:{user_id}")
        await token_blocklist.delete_key(f"webauthn:challenge:{user_id}")

        challenge = base64.b64decode(challenge_b64)

        credential_id = response.get("id", "")
        stored = await prisma.webauthncredential.find_first(
            where={
                "userId": user_id,
                "OR": [
                    {"credentialId": credential_id},
                    {"credentialId": credential_id.rstrip("=")},
                ],
            }
        )
        if not stored:
            return None

        pub_key_bytes = base64.b64decode(stored.publicKey)

        try:
            verification = verify_authentication_response(
                credential=response,
                expected_challenge=challenge,
                expected_rp_id=_get_rp_id(),
                expected_origin=_get_origins(),
                credential_public_key=pub_key_bytes,
                credential_current_sign_count=stored.counter,
                require_user_verification=False,
            )
        except Exception as e:
            logger.error(f"WebAuthn auth verification failed: {e}")
            return None

        await prisma.webauthncredential.update(
            where={"id": stored.id},
            data={
                "counter": verification.new_sign_count,
                "lastUsedAt": datetime.now(timezone.utc),
            },
        )

        return {
            "credentialId": stored.credentialId,
            "counter": verification.new_sign_count,
        }


webauthn_service = WebAuthnService()
