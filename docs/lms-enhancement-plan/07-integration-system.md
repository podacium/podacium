# Integration System — Cross-Pillar Architecture

**Version:** 1.0  
**Status:** Planning  
**Target:** August 2026 (Wave 1)  
**Dependencies:** Phase 1 Architecture Foundation (router decomposition), Phase 2 AI Infrastructure

---

## 1. Why Integrations Matter

Integrations are the **cross-pillar force multiplier**. Each integration adds value to at least one pillar:

| Pillar | Integration Value | Example |
|--------|------------------|---------|
| **Learn** | Import content, sync LMS, embed videos | Google Classroom, YouTube, Zoom |
| **Hub** | Verify skills, showcase portfolio, communicate | GitHub, Behance, Slack |
| **BI** | Ingest live data, export dashboards | Google Sheets, MySQL, Tableau |

A student who connects GitHub gets automatic skill verification on their profile. A freelancer who connects Stripe gets paid in-platform. A business who connects Google Analytics sees live dashboards. **Each integration compounds the flywheel.**

---

## 2. Integration Inventory

### 2.1 Customer-Facing Integrations (50)

Users see these in **Settings > Integrations**. They authorize via OAuth or enter an API key. Grouped by pillar value:

#### Auth & Social Profile (3)
| Provider | Type | Pillar | Status |
|----------|------|--------|--------|
| LinkedIn | OAuth | Cross-pillar (profile) | Partial — OAuth callback exists |
| Facebook | OAuth | Cross-pillar (profile) | Not started |
| Twitter / X | OAuth | Cross-pillar (profile) | Not started |

#### Communication (5)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| WhatsApp | API key | Learn/Hub (notifications) | Backend exists |
| Slack | OAuth | Hub (alerts) | Partial — frontend mock |
| Discord | OAuth | Learn (community) | Not started |
| Gmail | OAuth | Hub (messaging) | Not started |
| Outlook | OAuth | Hub (messaging) | Not started |

#### Cloud Storage (3)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Google Drive | OAuth | Hub (deliverables) | Not started |
| Dropbox | OAuth | Hub (deliverables) | Not started |
| OneDrive | OAuth | Hub (deliverables) | Not started |

#### Calendar & Scheduling (3)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Google Calendar | OAuth | Learn (deadlines) | Not started |
| Outlook Calendar | OAuth | Learn (deadlines) | Not started |
| Calendly | OAuth | Hub (meetings) | Not started |

#### Video & Live (4)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| YouTube | OAuth | Learn (video hosting) | Not started |
| Zoom | OAuth | Learn (live classes) | Not started |
| Google Meet | OAuth | Learn (live classes) | Not started |
| Vimeo | OAuth | Learn (video hosting) | Not started |

#### Learning (5)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Google Classroom | OAuth | Learn (LMS sync) | Not started |
| Moodle | OAuth | Learn (LMS sync) | Not started |
| Notion | OAuth | Learn (notes) | Not started |
| Evernote | OAuth | Learn (notes) | Not started |
| Obsidian | OAuth | Learn (notes) | Not started |

#### Freelance Portfolio (7)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| GitHub | OAuth | Hub (code portfolio) | Partial — frontend mock |
| GitLab | OAuth | Hub (code portfolio) | Not started |
| Behance | OAuth | Hub (design portfolio) | Not started |
| Dribbble | OAuth | Hub (design portfolio) | Not started |
| Figma | OAuth | Hub (design portfolio) | Not started |
| Stack Overflow | OAuth | Hub (reputation) | Not started |
| Medium | OAuth | Hub (writing portfolio) | Not started |

#### Freelance Productivity (4)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Trello | OAuth | Hub (project mgmt) | Not started |
| Asana | OAuth | Hub (project mgmt) | Not started |
| Notion (dup) | OAuth | Hub (project mgmt) | See Learning above |
| Google Drive (dup) | OAuth | Hub (file sync) | See Cloud Storage above |

#### Payments (3)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Stripe | OAuth | Hub (payouts) | Not started |
| PayPal | OAuth | Hub (payouts) | Not started |
| Wise | OAuth | Hub (payouts) | Not started |

#### BI — Data Sources (6)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Google Sheets | OAuth | BI (data ingest) | Not started |
| Google Analytics | OAuth | BI (analytics) | Not started |
| MySQL | Connection string | BI (SQL query) | Not started |
| PostgreSQL | Connection string | BI (SQL query) | Not started |
| MongoDB | Connection string | BI (NoSQL query) | Not started |
| Airtable | API key | BI (spreadsheet DB) | Not started |

#### BI — Business Platforms (4)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| HubSpot | OAuth | BI (CRM data) | Not started |
| Salesforce | OAuth | BI (CRM data) | Not started |
| Shopify | OAuth | BI (e-commerce) | Not started |
| WooCommerce | API key | BI (e-commerce) | Not started |

#### BI — Export & Automation (3)
| Provider | Type | Primary Pillar | Status |
|----------|------|----------------|--------|
| Tableau | API key | BI (export) | Not started |
| Google Looker Studio | OAuth | BI (export) | Not started |
| n8n / Zapier | API key | BI (automation) | Not started |

### 2.2 Admin-Only Integrations (20)

Never exposed to end users. Configured in admin panel. Already implemented in the stack:

| Category | Components | Status |
|----------|-----------|--------|
| **Payments (Algeria)** | Chargily, SATIM, CIB, Edahabia | Done — Chargily live, others stubbed |
| **AWS Stack** | S3, CloudFront, MediaConvert | Done |
| **Hosting / DB** | Supabase, PostgreSQL, Docker, Terraform | Done |
| **DevOps** | GitHub Actions, Prometheus/Grafana, Sentry | Done |
| **Communications** | SendGrid/SMTP, Crisp | Done |
| **Security** | FingerprintJS, Google reCAPTCHA | Done |
| **Background Processing** | Celery + Redis | Done |
| **SEO / Analytics** | Google Search Console | Done |

---

## 3. Architecture

### 3.1 Provider Registry

A single source of truth for all available providers. Can be a database table, a JSON config file, or a backend endpoint:

```
GET /api/integrations/providers → returns all 50 providers with metadata
```

Each provider record:

```json
{
  "id": "github",
  "name": "GitHub",
  "description": "Connect your GitHub account to sync repositories and verify your code portfolio.",
  "icon": "github",           // Maps to a known icon set
  "auth_type": "oauth",        // "oauth" | "api_key" | "connection_string"
  "pillars": ["hub"],          // Which pillars this integration enhances
  "category": "freelance_portfolio",
  "scopes": [
    { "id": "repo", "label": "Read access to public repositories" },
    { "id": "user", "label": "Read your profile information" }
  ],
  "status": "available"        // "available" | "coming_soon" | "beta"
}
```

This endpoint powers the dynamic Settings > Integrations UI. Adding a new integration = adding one row to the data. **No frontend code changes.**

### 3.2 Backend Integration Flow

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  Browser │────▶│  /authorize  │────▶│  OAuth Provider │────▶│  /callback   │
│ (User)   │     │  (Backend)   │     │  (Google, etc.) │     │  (Backend)   │
└──────────┘     └──────────────┘     └────────────────┘     └──────┬───────┘
                                                                    │
                                                                    ▼
                                                             ┌──────────────┐
                                                             │  User DB     │
                                                             │  (tokens)    │
                                                             └──────────────┘
                                                                    │
                                                                    ▼
                                                             ┌──────────────┐
                                                             │  Frontend    │
                                                             │  redirect    │
                                                             │  /settings   │
                                                             │  ?tab=...    │
                                                             └──────────────┘
```

For API-key-based integrations, the flow is simpler: user enters key in Settings > Integrations → `POST /api/integrations` with the key → backend stores it.

### 3.3 Token Storage

Current `UserIntegration` model already stores:
- `accessToken` — encrypted at rest
- `refreshToken` — encrypted at rest
- `scopes` — JSON array
- `metadata` — JSON blob (for provider-specific data)

A background Celery task (`refresh_expired_tokens`) runs hourly and refreshes tokens whose `expiresAt` is within 24 hours.

### 3.4 Frontend Dynamic Integration Grid

The current hardcoded integration list in `settings/page.tsx` becomes a dynamic component:

```tsx
<IntegrationGrid
  providers={providers}     // from GET /api/integrations/providers
  connected={connected}     // from GET /api/integrations (user's connections)
  onConnect={handleOAuthRedirect}
  onDisconnect={handleDisconnect}
/>
```

The `IntegrationGrid` component:
- Groups by category
- Shows connection status per provider
- Handles OAuth redirect or API key modal
- Shows scope badges
- Shows last-connected timestamp

A new `IntegrationCard` component renders each provider with:
- Icon (SVG or image URL from provider registry)
- Name + description (from locale file, keyed by provider ID)
- Connect/disconnect button
- Status badge (connected / not connected / coming soon)

---

## 4. Implementation Plan

### Phase 1: Foundation (1-2 weeks)

| Task | Files | Description |
|------|-------|-------------|
| Provider registry endpoint | `integrations_routers/providers.py` | `GET /api/integrations/providers` returning all 50 providers |
| Provider data store | `integrations_service.py` or JSON config | Seed data with all 50 providers |
| Dynamic `IntegrationGrid` component | `components/settings/IntegrationGrid.tsx` | Dynamic grid reading from providers endpoint |
| `IntegrationCard` component | `components/settings/IntegrationCard.tsx` | Reusable card with icon, name, description, connect/disconnect |
| Locale keys for all 50 providers | `locales/{en,fr,ar}/integrations.json` | Namespace per provider for name/description/category |
| Remove hardcoded integrations from settings page | `app/settings/page.tsx` | Replace with `<IntegrationGrid />` |

### Phase 2: High-ROI Integrations (Wave 1, ~2 weeks)

10 integrations that deliver immediate value:

| Provider | Backend (OAuth config) | Frontend (icon + locale) | Priority |
|----------|----------------------|--------------------------|----------|
| GitHub | 1 hour | 15 min | P1 — portfolio verification |
| LinkedIn | 1 hour | 15 min | P1 — profile enrichment |
| Google Drive | 1 hour | 15 min | P1 — file uploads |
| Google Calendar | 1 hour | 15 min | P1 — deadline sync |
| Slack | 30 min | 15 min | P1 — notifications |
| WhatsApp | 30 min | 15 min | P1 — alerts |
| YouTube | 1 hour | 15 min | P2 — video hosting |
| Zoom | 1 hour | 15 min | P2 — live classes |
| Stripe | 1 hour | 15 min | P2 — payouts |
| PayPal | 1 hour | 15 min | P2 — payouts |

**Effort:** ~10 hours backend + ~2.5 hours frontend = ~12.5 hours total.

### Phase 3: Freelance & Learning (Wave 2, ~2 weeks)

12 integrations supporting the Hub and Learn pillars:

GitLab, Behance, Dribbble, Figma, Trello, Asana, Notion, Google Classroom, Discord, Calendly, Google Meet, Outlook

**Effort:** ~12 hours backend + ~3 hours frontend = ~15 hours total.

### Phase 4: BI Integrations (Wave 3, ~3 weeks)

10 integrations for data sources and business platforms:

Google Sheets, Google Analytics, MySQL, PostgreSQL, MongoDB, Airtable, HubSpot, Salesforce, Shopify, WooCommerce

**Effort:** ~15 hours backend (connection-string auth is more work) + ~2.5 hours frontend = ~17.5 hours total.

---

## 5. Additive Pattern

Every integration follows the additive architecture convention:

```
Backend:
  No changes to existing routers or services
  New provider config → integrations_service.py or config file (append)
  New OAuth handler → providers/<name>.py (new file, if custom logic needed)
  Feature flag → FeatureFlag table (default: false, per-provider)

Frontend:
  New icon + locale keys → locales/<locale>/integrations.json (append)
  No changes to IntegrationGrid or IntegrationCard (fully dynamic)
```

---

## 6. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| OAuth token leakage | Encrypt tokens at rest (AES-256-GCM), never expose in API responses |
| Expired tokens | Background Celery task refreshes tokens; if refresh fails, mark integration as `status: "expired"` |
| Connection-string auth (MySQL, etc.) | Store encrypted; only connect from isolated Celery workers; never expose to browser |
| Scope creep | Store granted scopes on connect; warn user if scope changes on re-auth |
| API key storage | Same encryption as OAuth tokens; mask in UI (`••••••••••••••••`) |
| Revocation | User-facing disconnect button calls provider's revoke endpoint when available |
| Rate limiting | Per-provider rate limit tracking in metadata; throttle Celery tasks |

---

## 7. Future Considerations

| Feature | When | Why |
|---------|------|-----|
| **Webhook receiver** | Wave 3 | Stripe, PayPal, HubSpot, Zapier need webhooks for real-time data |
| **Unified notification routing** | After Wave 1 | Let users choose which integrations receive which notification types |
| **Integration health dashboard** | After Wave 2 | Show token expiry dates, last sync times, error rates per integration |
| **OAuth consent re-scoping** | After Wave 2 | Let users update scopes without disconnecting and reconnecting |
| **Integration marketplace** | Post-launch | Allow 3rd-party developers to add providers via a plugin API |
| **Automated integration testing** | Wave 3 | Sandbox OAuth flows with each provider in CI using test accounts |

---

## 8. Relation to LMS Enhancement

The integration system directly supports the LMS Enhancement Plan's goals:

- **Phase 3 (AI Agents):** Integrations like Google Classroom and Moodle feed content into the RAG pipeline
- **Phase 4 (Instructor Tools):** Calendar integrations power deadline management; Zoom/Meet power live classes
- **Phase 5 (Cross-Pillar):** GitHub/LinkedIn portfolio integrations bridge Learn → Hub by verifying skills automatically
- **PWA/Offline:** Cloud storage integrations (Google Drive, Dropbox) enable offline file access

Each integration is a new file, a new route, a new component — never a modification of existing code. The additive pattern guarantees zero regressions.
