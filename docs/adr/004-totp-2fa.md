# ADR-004: TOTP Two-Factor Authentication

## Status
Accepted

## Context
The platform handles financial transactions (escrow, payouts, subscriptions) and sensitive user data. Single-factor authentication (password only) is insufficient for a financial platform. The README previously claimed 2FA support but it was not implemented.

## Decision
Implement TOTP (RFC 6238) two-factor authentication:
- Users can optionally enable 2FA via any authenticator app (Google Authenticator, Authy, etc.)
- TOTP secrets are stored encrypted in the `SecuritySettings` model
- 10 single-use backup codes are generated on enrollment (stored as hashed values)
- 2FA verification is required during login when enabled
- Disabling 2FA requires password confirmation

## Implementation
- `services/api/app/services/totp_service.py` — Core TOTP logic
- `services/api/app/routers/two_factor.py` — API endpoints
- Uses `pyotp` library (already in requirements.txt)
- Backup codes hashed with Argon2 (same as passwords)

## Consequences
- **Positive**: Significantly reduces account takeover risk for users who enable it
- **Positive**: Backup codes prevent lockout if authenticator device is lost
- **Negative**: Adds friction to login flow for enrolled users
- **Negative**: Support burden for users who lose both their device and backup codes

## Endpoints
- `GET /api/v1/2fa/status` — Check if 2FA is enabled
- `POST /api/v1/2fa/setup` — Generate secret + QR code URI
- `POST /api/v1/2fa/enable` — Verify first code and activate
- `POST /api/v1/2fa/verify` — Verify code during login
- `POST /api/v1/2fa/disable` — Disable with password confirmation
