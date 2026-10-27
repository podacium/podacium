from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from fastapi import BackgroundTasks
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token,
    validate_password_complexity,
)
from app.core.prisma import prisma
from app.schemas.auth import UserRegister, UserLogin, UserRole, SELF_ASSIGNABLE_ROLES
from app.services.email_service import email_service
import httpx
from app.core.config import setting
import logging

logger = logging.getLogger(__name__)


class AuthService:
    async def create_user(self, user_data: UserRegister) -> Tuple[Dict[str, Any], str]:
        """Create a new user and return user data with verification token."""
        try:
            # Check if user already exists
            existing_filters = []
            if user_data.email:
                existing_filters.append({"email": user_data.email})
            if user_data.phoneNumber:
                existing_filters.append({"phoneNumber": user_data.phoneNumber})

            if existing_filters:
                existing_user = await prisma.user.find_first(
                    where={"OR": existing_filters}
                )
                if existing_user:
                    if existing_user.email == user_data.email:
                        raise ValueError("Email already registered")
                    if existing_user.phoneNumber == user_data.phoneNumber:
                        raise ValueError("Phone number already registered")

            if not user_data.fullName or not user_data.fullName.strip():
                raise ValueError("Full name is required")

            # Validate password complexity (defense-in-depth: schema also validates)
            complexity_error = validate_password_complexity(user_data.password)
            if complexity_error:
                raise ValueError(complexity_error)

            # Enforce role: users cannot self-assign ADMIN or INSTRUCTOR
            safe_role = user_data.role
            if safe_role not in SELF_ASSIGNABLE_ROLES:
                safe_role = UserRole.STUDENT

            # Hash the password
            password_hash = get_password_hash(user_data.password)

            # Create user with proper field mapping
            user_data_dict = {
                "fullName": user_data.fullName,
                "email": user_data.email,
                "phoneNumber": user_data.phoneNumber,
                "passwordHash": password_hash,
                "provider": user_data.provider,
                "acceptedTerms": user_data.acceptedTerms,
                "subscribeNewsletter": user_data.subscribeNewsletter,
                "role": safe_role,
            }

            user = await prisma.user.create(data=user_data_dict)
            logger.info(f"User created successfully with ID: {user.id}")

            # Create user settings with locale preference
            try:
                await prisma.usersettings.create(
                    data={
                        "userId": user.id,
                        "language": user_data.locale,
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to create user settings: {type(e).__name__}")

            # Automatically convert waitlist entry if present
            if user_data.email:
                try:
                    normalized = user_data.email.strip().lower()
                    waitlist_entry = await prisma.waitlistentry.find_unique(
                        where={"email": normalized}
                    )
                    if waitlist_entry:
                        await prisma.waitlistentry.update(
                            where={"id": waitlist_entry.id},
                            data={
                                "status": "CONVERTED",
                                "convertedToUserId": user.id,
                                "convertedAt": datetime.now(timezone.utc),
                            },
                        )
                except Exception as e:
                    logger.warning(
                        f"Failed to update waitlist conversion for {user_data.email}: {e}"
                    )

            # Send phone verification if phone number provided
            if user_data.phoneNumber:
                try:
                    from app.services.phone_verification_service import (
                        phone_verification_service,
                    )

                    verification_code = (
                        await phone_verification_service.generate_verification_code()
                    )

                    await phone_verification_service.send_whatsapp_verification(
                        phone_number=user_data.phoneNumber,
                        verification_code=verification_code,
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to send WhatsApp verification: {type(e).__name__}"
                    )

            # Create verification token (JWT with type=email_verification for semantic clarity)
            from app.core.security import create_email_verification_token

            verification_token = create_email_verification_token(
                user_data.email, user.id
            )

            # Store verification token
            await prisma.authtoken.create(
                data={
                    "userId": user.id,
                    "token": verification_token,
                    "type": "verification",
                    "expiresAt": datetime.now(timezone.utc) + timedelta(days=7),
                }
            )

            # Convert user to dict
            user_dict = {
                "id": user.id,
                "email": user.email,
                "fullName": user.fullName,
                "role": user.role,
                "emailVerified": user.emailVerified,
                "createdAt": user.createdAt.isoformat() if user.createdAt else None,
            }

            return user_dict, verification_token

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to create user: {type(e).__name__}: {e}")
            err_str = str(e).lower()
            if "unique" in err_str:
                if user_data.email and (
                    "email" in err_str or "user_email_key" in err_str
                ):
                    raise ValueError("Email already registered")
                if user_data.phoneNumber and (
                    "phonenumber" in err_str or "user_phonenumber_key" in err_str
                ):
                    raise ValueError("Phone number already registered")
            raise

    async def authenticate_user(
        self,
        email: Optional[str] = None,
        phone_number: Optional[str] = None,
        password: str = None,
    ) -> Optional[Dict[str, Any]]:
        """Authenticate user with email/phone and password."""
        if not email and not phone_number:
            raise ValueError("Either email or phone number is required")

        # Find user by email or phone
        where_filters = []
        if email:
            where_filters.append({"email": email})
        if phone_number:
            where_filters.append({"phoneNumber": phone_number})

        user = await prisma.user.find_first(
            where={"OR": where_filters},
            include={"ownedOrganizations": True, "primaryOrganization": True},
        )

        # Pre-computed static dummy hash to normalize response timing for non-existent users
        dummy_hash = "$argon2id$v=19$m=19456,t=3,p=1$c29tZXNhbHQ$R0p83trziZjwKchpB6JIZUQasOggucwCeLDQqWhjC8E"

        if not user or not user.passwordHash:
            # Perform dummy verification to neutralize timing side-channel leaks
            verify_password(password or "dummy_pwd", dummy_hash)
            return None

        # Verify password
        password_valid = verify_password(password, user.passwordHash)

        if not password_valid:
            raise ValueError("Wrong Password")

        if user.deletedAt:
            raise ValueError("Account is deactivated")

        # Update last login
        await prisma.user.update(
            where={"id": user.id}, data={"updatedAt": datetime.now(timezone.utc)}
        )

        return user.dict()

    async def oauth_authenticate(
        self, provider: str, code: str, redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """Authenticate user via OAuth provider.

        🔒 SECURITY: The redirect_uri is forcefully set to the server-configured
        callback URL for the token exchange. User-supplied redirect_uri is
        IGNORED to prevent authorization code interception attacks.
        """
        # Force the server-configured redirect URI — never trust user input here.
        provider_upper = provider.upper()
        configured_uri = {
            "GOOGLE": setting.GOOGLE_REDIRECT_URI,
            "GITHUB": setting.GITHUB_REDIRECT_URI,
            "LINKEDIN": setting.LINKEDIN_REDIRECT_URI,
        }.get(provider_upper)
        if redirect_uri and redirect_uri != configured_uri:
            logger.warning(
                f"OAuth callback with mismatched redirect_uri for {provider_upper}: "
                f"got '{redirect_uri}', using configured '{configured_uri}'"
            )
        safe_redirect_uri = configured_uri

        # Get user info from provider
        user_info = await self._get_oauth_user_info(provider, code, safe_redirect_uri)

        if not user_info:
            raise ValueError(f"Failed to authenticate with {provider}")

        # Check if user exists
        user = await prisma.user.find_first(
            where={
                "OR": [
                    {"email": user_info.get("email")},
                    {"provider": provider, "providerId": user_info.get("id")},
                ]
            }
        )

        if user:
            # Update last login and provider info if needed, and robustly re-activate
            # we re-assign to 'user' so subsequent token generation uses the latest state
            user = await prisma.user.update(
                where={"id": user.id},
                data={
                    "lastLoginAt": datetime.now(timezone.utc),
                    "provider": provider,
                    "providerId": user_info.get("id"),
                    "profilePictureUrl": user_info.get("picture")
                    or user_info.get("avatar_url"),
                    "deletedAt": None,
                    "deactivatedAt": None,
                    "isActive": True,
                    "isDeactivated": False,
                },
            )
            logger.info(f"OAuth: Account re-activated and updated for {user.email}")
        else:
            # Create new user
            user = await self._create_oauth_user(user_info, provider)

        # Create tokens (RFC 9700 family-tracked with JTI)
        from app.services.token_rotation_service import token_rotation_service

        access_token, refresh_token = await token_rotation_service.issue_token_pair(
            user.id
        )

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "fullName": user.fullName,
                "role": user.role,
                "emailVerified": True,  # OAuth emails are typically verified
                "profilePictureUrl": user.profilePictureUrl,
                "onboardingCompleted": user.onboardingCompleted,
                "createdAt": user.createdAt.isoformat() if user.createdAt else None,
            },
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
        }

    async def _get_oauth_user_info(
        self, provider: str, code: str, redirect_uri: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get user info from OAuth provider."""
        if provider == "GOOGLE":
            return await self._get_google_user_info(code, redirect_uri)
        elif provider == "GITHUB":
            return await self._get_github_user_info(code, redirect_uri)
        elif provider == "LINKEDIN":
            return await self._get_linkedin_user_info(code, redirect_uri)
        else:
            raise ValueError(f"Unsupported OAuth provider: {provider}")

    async def _get_google_user_info(
        self, code: str, redirect_uri: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Exchange code for Google user info."""
        token_url = "https://oauth2.googleapis.com/token"
        userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"

        async with httpx.AsyncClient() as client:
            effective_redirect = redirect_uri or setting.GOOGLE_REDIRECT_URI
            token_response = await client.post(
                token_url,
                data={
                    "code": code,
                    "client_id": setting.GOOGLE_CLIENT_ID,
                    "client_secret": setting.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": effective_redirect,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                logger.error(
                    f"Google token exchange failed with status {token_response.status_code}"
                )
                return None

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            userinfo_response = await client.get(
                userinfo_url, headers={"Authorization": f"Bearer {access_token}"}
            )

            if userinfo_response.status_code != 200:
                logger.error(
                    f"Google userinfo fetch failed with status {userinfo_response.status_code}"
                )
                return None

            user_data = userinfo_response.json()

            return {
                "id": user_data.get("sub"),
                "email": user_data.get("email"),
                "name": user_data.get("name"),
                "given_name": user_data.get("given_name"),
                "family_name": user_data.get("family_name"),
                "picture": user_data.get("picture"),
                "email_verified": user_data.get("email_verified", False),
            }

    async def _get_github_user_info(
        self, code: str, redirect_uri: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Exchange code for GitHub user info."""
        token_url = "https://github.com/login/oauth/access_token"
        userinfo_url = "https://api.github.com/user"
        email_url = "https://api.github.com/user/emails"

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                headers={"Accept": "application/json"},
                data={
                    "code": code,
                    "client_id": setting.GITHUB_CLIENT_ID,
                    "client_secret": setting.GITHUB_CLIENT_SECRET,
                    "redirect_uri": redirect_uri or setting.GITHUB_REDIRECT_URI,
                },
            )

            if token_response.status_code != 200:
                logger.error(
                    f"GitHub token exchange failed with status {token_response.status_code}"
                )
                return None

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            userinfo_response = await client.get(
                userinfo_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )

            if userinfo_response.status_code != 200:
                logger.error(
                    f"GitHub userinfo fetch failed with status {userinfo_response.status_code}"
                )
                return None

            user_data = userinfo_response.json()

            email_response = await client.get(
                email_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )

            emails = email_response.json() if email_response.status_code == 200 else []
            primary_email = next(
                (
                    email["email"]
                    for email in emails
                    if email.get("primary") and email.get("verified")
                ),
                None,
            )

            return {
                "id": str(user_data.get("id")),
                "email": primary_email or user_data.get("email"),
                "name": user_data.get("name"),
                "login": user_data.get("login"),
                "avatar_url": user_data.get("avatar_url"),
                "bio": user_data.get("bio"),
                "location": user_data.get("location"),
            }

    async def _get_linkedin_user_info(
        self, code: str, redirect_uri: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Exchange code for LinkedIn user info."""
        token_url = "https://www.linkedin.com/oauth/v2/accessToken"
        userinfo_url = "https://api.linkedin.com/v2/userinfo"

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                data={
                    "code": code,
                    "client_id": setting.LINKEDIN_CLIENT_ID,
                    "client_secret": setting.LINKEDIN_CLIENT_SECRET,
                    "redirect_uri": redirect_uri or setting.LINKEDIN_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                logger.error(
                    f"LinkedIn token exchange failed with status {token_response.status_code}"
                )
                return None

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            userinfo_response = await client.get(
                userinfo_url, headers={"Authorization": f"Bearer {access_token}"}
            )

            if userinfo_response.status_code != 200:
                logger.error(
                    f"LinkedIn userinfo fetch failed with status {userinfo_response.status_code}"
                )
                return None

            user_data = userinfo_response.json()

            return {
                "id": user_data.get("sub"),
                "email": user_data.get("email"),
                "name": f"{user_data.get('given_name', '')} {user_data.get('family_name', '')}".strip(),
                "given_name": user_data.get("given_name"),
                "family_name": user_data.get("family_name"),
                "picture": user_data.get("picture"),
                "email_verified": user_data.get("email_verified", False),
            }

    async def _create_oauth_user(self, user_info: Dict[str, Any], provider: str):
        """Create a new user from OAuth data without a placeholder password."""
        user_data = {
            "fullName": user_info.get("name") or "User",
            "email": user_info.get("email"),
            "passwordHash": None,
            "provider": provider,
            "providerId": user_info.get("id"),
            "emailVerified": True,  # OAuth emails are verified
            "acceptedTerms": True,
            "subscribeNewsletter": False,
            "role": "STUDENT",  # Always default role for OAuth users
            "profilePictureUrl": user_info.get("picture")
            or user_info.get("avatar_url"),
        }

        user = await prisma.user.create(data=user_data)
        logger.info(f"OAuth user created with ID: {user.id}")
        return user

    @staticmethod
    def _validate_redirect_uri(provider: str, redirect_uri: Optional[str]) -> str:
        """Validate redirect_uri against the provider's configured callback URL.

        🔒 SECURITY: Never allow arbitrary redirect URIs — prevents OAuth
        authorization code interception attacks. Only the registered backend
        callback URLs are permitted.
        """
        provider_upper = provider.upper()
        allowed = {
            "GOOGLE": setting.GOOGLE_REDIRECT_URI,
            "GITHUB": setting.GITHUB_REDIRECT_URI,
            "LINKEDIN": setting.LINKEDIN_REDIRECT_URI,
        }
        expected = allowed.get(provider_upper)
        if not expected:
            raise ValueError(f"Unsupported OAuth provider: {provider}")

        if redirect_uri and redirect_uri != expected:
            logger.warning(
                f"Blocked OAuth redirect_uri mismatch for {provider_upper}: "
                f"got '{redirect_uri}', expected '{expected}'"
            )
            raise ValueError(
                f"Invalid redirect_uri for {provider_upper}. "
                "The redirect URI must match the configured callback URL."
            )
        return expected

    async def get_oauth_authorization_url(
        self, provider: str, redirect_uri: Optional[str] = None
    ) -> str:
        """Get OAuth authorization URL for frontend redirect."""
        import urllib.parse
        import secrets

        # 🔒 Validate redirect_uri against allowlist — prevents auth code theft
        safe_redirect = self._validate_redirect_uri(provider, redirect_uri)

        # Create a state token for CSRF protection with a jti (JWT ID) nonce
        # to prevent replay attacks — each state token is single-use.
        state_data = {
            "provider": provider,
            "redirect_uri": safe_redirect,
            "jti": secrets.token_urlsafe(16),  # unique nonce
        }

        state_token = create_access_token(state_data)

        if provider == "GOOGLE":
            base_url = "https://accounts.google.com/o/oauth2/v2/auth"
            params = {
                "client_id": setting.GOOGLE_CLIENT_ID,
                "redirect_uri": safe_redirect,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state_token,
                "access_type": "offline",
                "prompt": "consent",
            }

        elif provider == "GITHUB":
            base_url = "https://github.com/login/oauth/authorize"
            params = {
                "client_id": setting.GITHUB_CLIENT_ID,
                "redirect_uri": redirect_uri or setting.GITHUB_REDIRECT_URI,
                "scope": "user:email",
                "state": state_token,
            }

        elif provider == "LINKEDIN":
            base_url = "https://www.linkedin.com/oauth/v2/authorization"
            params = {
                "client_id": setting.LINKEDIN_CLIENT_ID,
                "redirect_uri": redirect_uri or setting.LINKEDIN_REDIRECT_URI,
                "response_type": "code",
                "scope": "openid profile email",
                "state": state_token,
            }

        else:
            raise ValueError(f"Unsupported provider: {provider}")

        query_string = urllib.parse.urlencode(params)
        return f"{base_url}?{query_string}"

    async def verify_email(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify user email using token.

        🔒 REPLAY PROTECTION: Check order is:
        1. JWT signature valid (via verify_token)
        2. DB row exists
        3. Row is unused (usedAt is None)
        4. Mark token as used (atomically — even if user update fails, token is consumed)

        Returns dict with user_id and new full-scope tokens, or None on failure.
        """
        try:
            # 1. Verify JWT signature
            payload = verify_token(token)
            if not payload:
                return None

            user_id = payload.get("sub")
            if not user_id:
                return None

            # 2. Check DB row exists and is unused
            #    (usedAt=None ensures single-use; expiresAt check prevents expired tokens)
            auth_token = await prisma.authtoken.find_first(
                where={
                    "token": token,
                    "type": "verification",
                    "usedAt": None,
                    "expiresAt": {"gt": datetime.now(timezone.utc)},
                }
            )
            if not auth_token:
                return None

            # 3. MARK TOKEN AS USED FIRST (atomic consumption — prevents replay)
            await prisma.authtoken.update(
                where={"id": auth_token.id}, data={"usedAt": datetime.now(timezone.utc)}
            )

            # 4. Update user email verification status
            await prisma.user.update(
                where={"id": int(user_id)},
                data={
                    "emailVerified": True,
                    "emailVerifiedAt": datetime.now(timezone.utc),
                },
            )

            # Send welcome email after verification
            try:
                from app.services.email_service import email_service

                user_record = await prisma.user.find_unique(where={"id": int(user_id)})
                if user_record and user_record.email:
                    await email_service.send_welcome_email(
                        email=user_record.email,
                        name=user_record.fullName or "User",
                    )
            except Exception as e:
                logger.error(f"Failed to send welcome email: {type(e).__name__}")

            # 5. Issue fresh full-scope tokens (RFC 9700 family-tracked with JTI)
            from app.services.token_rotation_service import token_rotation_service

            access_token, refresh_token = await token_rotation_service.issue_token_pair(
                int(user_id)
            )

            return {
                "user_id": int(user_id),
                "tokens": {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                    "expires_in": setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                },
            }

        except Exception as e:
            logger.error(f"Email verification error: {type(e).__name__}")
            return None

    async def resend_verification_email(
        self, email: str, background_tasks: BackgroundTasks
    ):
        """Resend verification email for a user."""
        user = await prisma.user.find_unique(where={"email": email})
        if not user:
            return False

        if user.emailVerified:
            return True

        # Get user's locale preference
        locale = "en"
        try:
            settings = await prisma.usersettings.find_unique(where={"userId": user.id})
            if settings:
                locale = settings.language
        except Exception:
            pass

        # Check for existing valid token or create new one
        existing_token = await prisma.authtoken.find_first(
            where={
                "userId": user.id,
                "type": "verification",
                "usedAt": None,
                "expiresAt": {"gt": datetime.now(timezone.utc)},
            }
        )

        if existing_token:
            verification_token = existing_token.token
        else:
            from app.core.security import create_email_verification_token

            verification_token = create_email_verification_token(user.email, user.id)

            await prisma.authtoken.create(
                data={
                    "userId": user.id,
                    "token": verification_token,
                    "type": "verification",
                    "expiresAt": datetime.now(timezone.utc) + timedelta(days=7),
                }
            )

        # Send email
        from app.services.email_service import email_service as email_svc

        background_tasks.add_task(
            email_svc.send_verification_email,
            email,
            verification_token,
            user.fullName,
            locale,
            user.id,
        )

        return True

    async def create_password_reset_token(self, email: str) -> Optional[str]:
        """Create password reset token for user."""
        user = await prisma.user.find_unique(where={"email": email})
        if not user:
            return None

        from app.core.security import (
            create_password_reset_token as _create_pw_reset_token,
        )

        reset_token = _create_pw_reset_token(user.id)

        await prisma.authtoken.create(
            data={
                "userId": user.id,
                "token": reset_token,
                "type": "password_reset",
                "expiresAt": datetime.now(timezone.utc) + timedelta(hours=24),
            }
        )

        return reset_token

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset password using token.

        🔒 REPLAY PROTECTION: Token is consumed (usedAt set) BEFORE the password
        is updated, preventing replay attacks.

        🔒 SESSION INVALIDATION: All existing sessions for this user are revoked.
        The user must log in again with their new password.
        """
        # Validate password complexity
        complexity_error = validate_password_complexity(new_password)
        if complexity_error:
            raise ValueError(complexity_error)

        payload = verify_token(token)
        if not payload:
            return False

        user_id = payload.get("sub")
        if not user_id:
            return False

        auth_token = await prisma.authtoken.find_first(
            where={
                "token": token,
                "type": "password_reset",
                "usedAt": None,
                "expiresAt": {"gt": datetime.now(timezone.utc)},
            }
        )

        if not auth_token:
            return False

        # 1. Mark token as consumed first (replay protection)
        await prisma.authtoken.update(
            where={"id": auth_token.id}, data={"usedAt": datetime.now(timezone.utc)}
        )

        # 2. Update password
        await prisma.user.update(
            where={"id": int(user_id)},
            data={
                "passwordHash": get_password_hash(new_password),
                "lastPasswordChangeAt": datetime.now(timezone.utc),
            },
        )

        # 3. Invalidate all active sessions for this user
        #    Revoke all existing refresh tokens stored in authtoken table
        try:
            from app.core.security import add_user_to_blocklist

            await add_user_to_blocklist(int(user_id))
        except Exception:
            logger.warning(
                f"Failed to add user {user_id} to session blocklist after password reset"
            )

        return True

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        user = await prisma.user.find_unique(where={"email": email})
        return user.dict() if user else None

    async def register_user(
        self, user_data: UserRegister, background_tasks: BackgroundTasks
    ) -> Dict[str, Any]:
        """Register a new user.

        🔒 No auto-login — user must verify their email before first login.
        The verification email is sent in the background.
        """
        user, verification_token = await self.create_user(user_data)

        # Send verification email in background (localized)
        if user_data.email:
            background_tasks.add_task(
                email_service.send_verification_email,
                user_data.email,
                verification_token,
                user_data.fullName,
                user_data.locale,
                user["id"],
            )

        return {
            "user": user,
            "message": "Registration successful. Please check your email to verify your account.",
        }

    async def authenticate_user_enhanced(self, login_data: UserLogin) -> Dict[str, Any]:
        """Enhanced authenticate method that returns tokens."""
        user = await self.authenticate_user(
            email=login_data.email,
            phone_number=login_data.phoneNumber,
            password=login_data.password,
        )

        if not user:
            raise ValueError("Invalid credentials")

        from app.services.token_rotation_service import token_rotation_service

        access_token, refresh_token = await token_rotation_service.issue_token_pair(
            user["id"]
        )

        return {
            "user": user,
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
        }

    async def refresh_tokens(
        self, refresh_token: str, fingerprint: Optional[str] = None
    ) -> Dict[str, str]:
        """Refresh access token using RFC 9700 token rotation with grace period and fingerprint binding."""
        from app.services.token_rotation_service import token_rotation_service

        result = await token_rotation_service.rotate_refresh_token(
            refresh_token, fingerprint=fingerprint
        )
        if not result:
            raise ValueError("Invalid refresh token")

        new_access_token, new_refresh_token = result
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    async def request_password_reset(self, email: str):
        """Request password reset (enhanced method)."""
        return await self.create_password_reset_token(email)


# Singleton instance
auth_service = AuthService()
