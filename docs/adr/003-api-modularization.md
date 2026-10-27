# ADR-003: Frontend API Client Modularization

## Status
Accepted

## Context
The frontend API client was a single 4,795-line file (`lib/api.ts`) containing all types, enums, interfaces, and API methods. This was unmaintainable, caused slow IDE performance, and made it impossible to tree-shake unused code.

## Decision
Split into domain modules under `lib/api/`:
- `client.ts` — Core HTTP client with auth, retry, error handling
- `errors.ts` — Shared error classes
- `types.ts` — Shared enums and generic types
- `endpoints.ts` — Centralized endpoint path constants
- `auth.ts` — Authentication endpoints
- `users.ts` — User profile, skills, settings
- `education.ts` — Courses, enrollments, certificates
- `payments.ts` — Payments, wallet, subscriptions
- `freelancing.ts` — Projects, proposals, contracts
- `notifications.ts` — Notification CRUD
- `bi.ts` — Business intelligence
- `compat.ts` — Backward compatibility types
- `index.ts` — Barrel export with unified `api` object

## Consequences
- **Positive**: Each module is <200 lines. Easy to find, modify, and test.
- **Positive**: Tree-shaking works — pages only load the API methods they use.
- **Positive**: Backward compatible — existing `import { api } from '@/lib/api'` still works.
- **Negative**: More files to navigate (mitigated by barrel exports and IDE go-to-definition).
