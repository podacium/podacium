# ADR-001: Refresh Token Rotation

## Status
Accepted

## Context
The platform handles financial transactions (escrow, payouts, subscriptions). Long-lived tokens are a security risk — if stolen, an attacker has extended access. The original implementation used 4-hour access tokens with no rotation.

## Decision
Implement refresh token rotation:
- Access tokens expire in 30 minutes
- Refresh tokens are single-use (stored as SHA-256 hashes in DB)
- On each refresh, old token is marked as used and a new pair is issued
- If a used token is replayed, ALL user tokens are revoked (replay attack detection)

## Consequences
- **Positive**: Stolen refresh tokens become useless after one use. Replay attacks are detected and neutralized.
- **Positive**: Shorter access token lifetime limits damage window.
- **Negative**: Slightly more complex client logic (must handle 401 → refresh → retry).
- **Negative**: One extra DB query per refresh (to verify token hash).

## Implementation
- `services/api/app/services/token_rotation_service.py`
- `services/api/app/core/security.py` (token creation)
- Frontend: `lib/api/client.ts` handles 401 → refresh → retry automatically
