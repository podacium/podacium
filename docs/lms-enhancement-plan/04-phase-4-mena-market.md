# Phase 4: MENA Market Domination

**Duration:** Weeks 13–16  
**Target Score:** 93/100 tech, 90/100 launch readiness  
**Dependencies:** Phase 2 (core LMS features), Phase 3 (AI agents)

---

## Overview

Phase 4 adapts Podacium for the MENA market across four dimensions: payments, mobile access, content interoperability, and localization. These features are what transform a good LMS into a *MENA market leader*.

### Why These Four Features

| Feature | Problem It Solves | Market Impact |
|---------|------------------|---------------|
| **MENA Payment Expansion** | Only Chargily Pay (Algeria) integrated | Unlocks Egypt (Fawry), Saudi (PayTabs), UAE/GCC (MyFatoorah) |
| **Mobile-First PWA** | No mobile experience; 85% of MENA users access via mobile | Opens the largest access channel in the region |
| **SCORM/xAPI Import** | Cannot import existing university content | Hard requirement for institutional sales |
| **Localization Depth** | Arabic/French is basic | Full cultural adaptation drives adoption |

---

## Section 1: MENA Payment Expansion (Week 13)

### 1.1 Current State

Only Chargily Pay (Algeria) is integrated via `payment_providers/chargily.py`. Currency is DZD only. Other payment gateways have config settings (`SATIM_WEBHOOK_SECRET`, `CIB_WEBHOOK_SECRET`, `EDAHABIA_WEBHOOK_SECRET`) but no implementations.

### 1.2 Target Payment Gateways

| Gateway | Countries | Currency | Integration Complexity | Priority |
|---------|-----------|----------|----------------------|----------|
| **Chargily Pay** (existing) | Algeria | DZD | Already done | Existing |
| **PayTabs** | Saudi Arabia, UAE, Egypt, Kuwait | SAR, AED, EGP | Medium | Highest — covers 3 largest markets |
| **Fawry** | Egypt | EGP | Medium | Highest — Egypt is largest MENA market |
| **MyFatoorah** | Saudi, UAE, Kuwait, Bahrain, Oman | SAR, AED, KWD, BHD, OMR | Low | High — GCC-wide coverage |
| **CashPlus/Edahabia** | Algeria | DZD | Medium (has config) | Medium — complements Chargily |
| **Bank Transfer** | All MENA | Local currencies | Low (manual) | Low — essential for B2B/institutional |

### 1.3 Integration Pattern

Each gateway follows the same pattern as Chargily:

```
services/api/app/services/payment_providers/
├── __init__.py           # Provider factory: get_payment_provider(name)
├── base_provider.py      # Abstract interface
├── chargily.py           # Existing
├── paytabs.py            # NEW
├── fawry.py              # NEW
└── myfatoorah.py         # NEW
```

**Abstract interface:**
```python
class PaymentProvider(ABC):
    async def create_checkout(self, amount_cents: int, currency: str, metadata: dict) -> dict:
        """Create checkout session. Returns {checkout_url, checkout_id}."""
    async def verify_webhook(self, payload: dict, signature: str) -> bool:
        """Verify webhook signature."""
    async def process_webhook(self, payload: dict) -> dict:
        """Process payment event. Returns {event_type, transaction_id, status}."""
```

### 1.4 Webhook Handling

All gateways POST to `/api/v1/webhooks/payment/{provider}`:
- Signatures verified before processing
- Idempotency checks via existing `idempotency_middleware`
- Events: `payment.succeeded`, `payment.failed`, `payment.refunded`
- On success: update `Transaction` record, grant enrollment access

### 1.5 Multi-Currency Strategy

| Currency | Countries | Display Format |
|----------|-----------|---------------|
| DZD | Algeria | 1,500 د.ج |
| EGP | Egypt | 500 ج.م |
| SAR | Saudi Arabia | 100 ر.س |
| AED | UAE | 100 د.إ |
| USD | International | $50 |

All prices stored in DB as `priceCents` with a `currency` field. Frontend renders based on user's locale.

**Exchange rate handling:**
- Fixed rates updated weekly (to avoid volatility surprises)
- Stored in `settings` table
- Admin can override per-course

---

## Section 2: Mobile-First PWA (Week 14)

### 2.1 Current State

A `manifest.json` exists but there is **no service worker**, no offline support, no push notifications. The `idb` (IndexedDB) package is in `package.json` and `SyncStatusIndicator.tsx` + `AutomaticProgressSyncManager.ts` exist in the course detail page — suggesting offline awareness was planned but not completed.

### 2.2 What Needs to Be Built

| Feature | Implementation | Existing Assets |
|---------|---------------|-----------------|
| **Service Worker** | New file: `apps/web/public/sw.js` | None yet |
| **Offline content cache** | Cache course pages, lesson content, video metadata in IndexedDB | `idb` package, `AutomaticProgressSyncManager` |
| **Push notifications** | Web Push API + existing notification service | `notification_service` supports push (TODO stubbed) |
| **Add to Home Screen** | Already have manifest.json | Needs `beforeinstallprompt` event handler |
| **Offline progress sync** | Queue progress updates offline, sync when online | `AutomaticProgressSyncManager` exists |

### 2.3 Service Worker Strategy

| Resource | Cache Strategy | Rationale |
|----------|---------------|-----------|
| **Static assets** (JS, CSS, fonts) | Cache-first (precache on install) | Never change between deploys |
| **Course catalog pages** | Network-first with cache fallback | Fresh data preferred, stale cache when offline |
| **Lesson content** | Cache-after-read | First load = network, subsequent = cache |
| **Video metadata** | Cache-after-read | Title, duration, progress — not the video file itself |
| **API responses** | Network-only (offline = error with cached UI) | API data changes too frequently to cache safely |

### 2.4 Offline Progress Sync

The existing `AutomaticProgressSyncManager` pattern:

```
ONLINE: Progress saved → directly to API → DB
OFFLINE: Progress saved → IndexedDB queue → {pending: true}
ONLINE AGAIN: Queue flushed → API calls → queue cleared → SyncStatusIndicator updates
```

### 2.5 Push Notification Flow

```
1. Backend needs to send notification (e.g., grade posted, live session starting)
2. NotificationService.create_notification() creates DB record
3. For users with push enabled:
   a. Fetch user's push subscription from new `PushSubscription` table
   b. Send via Web Push API using `web-push` library
4. Service worker receives push event → shows notification
5. User clicks notification → opens relevant page
```

**New Prisma model: `PushSubscription`**
- `userId` → User
- `endpoint`, `p256dhKey`, `authKey` — Web Push subscription data
- `createdAt`, `updatedAt`

### 2.6 MENA Connectivity Considerations

| Challenge | Solution |
|-----------|----------|
| **Slow 3G connections** | Lazy-load non-critical resources. Default to audio-only video. |
| **Expensive data plans** | Cache aggressively. "Download for offline" option on lesson pages. |
| **Intermittent connectivity** | Offline-first architecture. Queue progress, sync when available. |
| **Small screens (budget phones)** | Responsive design already exists. Test on $100 Android devices. |

---

## Section 3: SCORM/xAPI Import/Export (Week 15)

### 3.1 What Is SCORM/xAPI

- **SCORM** (Sharable Content Object Reference Model): Industry standard for e-learning content packaging. Used by universities, corporates, and government training programs.
- **xAPI** (Experience API): Modern successor to SCORM. Tracks learning experiences across platforms.

### 3.2 Why It Matters for MENA

Many MENA universities and training centers already have SCORM content libraries. Without SCORM import, they cannot migrate to Podacium. This is a **hard blocker** for institutional sales.

### 3.3 SCORM Import Flow

```
1. Instructor uploads .zip file (SCORM 1.2 or 2004 package)
2. Backend extracts and validates:
   - Check imsmanifest.xml exists
   - Validate schema against SCORM standard
   - Extract metadata (title, description, objectives, duration)
3. Convert SCORM content to Podacium module structure:
   - SCORM "Organization" → Podacium "Module"
   - SCORM "Item" (with resource) → Podacium "Lesson"
   - SCORM SCO (Shareable Content Object) → Embedded iframe lesson type
4. Create module with lessons, preserving hierarchy
5. Notify instructor: import complete with [N] lessons created
```

### 3.4 SCORM Runtime Integration

SCORM packages expect a JavaScript API (`API_1484_11`) for communication:
- `LMSInitialize("")` → Called when SCO starts
- `LMSGetValue("cmi.core.lesson_status")` → Returns progress
- `LMSSetValue("cmi.core.score.raw", "85")` → Saves score
- `LMSFinish("")` → Called when SCO ends

**Frontend implementation:** Embed SCORM content in an iframe. Inject a JavaScript shim that proxies SCORM API calls to Podacium's API via `postMessage`.

### 3.5 xAPI Statement Generation

For non-SCORM content (videos, quizzes, PDFs), generate xAPI statements:

```
Actor: { "name": "Ahmed", "mbox": "mailto:ahmed@example.com" }
Verb: { "id": "http://adlnet.gov/expapi/verbs/completed",
        "display": { "en-US": "completed", "ar-SA": "أكمل" } }
Object: { "id": "http://podacium.com/lessons/123",
          "definition": { "name": { "ar-SA": "درس الخلايا" } } }
Result: { "score": { "raw": 85, "max": 100 }, "completion": true }
```

xAPI statements are stored in a new `XapiStatement` table and can be exported for integration with external LRS (Learning Record Store).

### 3.6 New Dependencies

| Package | Purpose |
|---------|---------|
| `python-scorm` or custom SCORM parser | Parse imsmanifest.xml |
| `web-push` (npm) | Push notifications |
| No new Python push lib | Use existing `notification_service` |
| `xmlschema` (Python) | Validate SCORM XML against XSD schemas |

---

## Section 4: Localization Depth (Week 16)

### 4.1 Current State

- 3 locales: `en`, `fr`, `ar`
- 19 i18n namespaces, 57 files
- RTL/BiDi utilities working
- `useBidi()` hook with margin/padding/flex direction mapping

### 4.2 What's Missing

| Gap | Impact | Fix |
|-----|--------|-----|
| **French locale incomplete** | Many namespace files exist but some are partial | Audit and complete all 19 namespaces |
| **No Islamic calendar** | Academic scheduling uses Gregorian only | Add Hijri calendar support for session dates |
| **No Arabic content search** | Search uses simple text match, no Arabic stemming | Integrate Arabic stemmer (e.g., Farasa, Camel Tools) |
| **French Canadian vs. French Maghreb** | Regional differences unhandled | Add locale variants: `fr-dz` (Algeria), `fr-ma` (Morocco) |
| **Tamazight/Berber** | Not supported | Differentiator for Algeria/Morocco. Low priority. |
| **RTL in admin panels** | Admin UI might not be fully RTL-compatible | Audit admin components |

### 4.3 Arabic Search Enhancement

The current search at `/education/search` uses PostgreSQL full-text search via `education_service.search_modules_and_paths()`. Arabic requires:
1. **Arabic stemming**: "كتاب" and "كتب" should match "كتابة" (root: ك-ت-ب)
2. **Broken plural handling**: "دروس" should match "درس"
3. **Diacritic-insensitive**: Remove tashkeel before matching

**Implementation options:**
| Option | Complexity | Accuracy | Recommendation |
|--------|-----------|----------|---------------|
| PostgreSQL Arabic config | Low (built-in) | Medium | Start here — `CREATE TEXT SEARCH CONFIGURATION arabic` |
| Farasa API | Medium | High | Arabic NLP toolkit. API or self-hosted. |
| Elasticsearch | High | Very high | Overkill for MVP. Save for Phase 5. |

### 4.4 Quality Assurance Checklist

- [ ] All 19 namespaces complete for `ar` and `fr`
- [ ] All error messages localized (new exception `code` → i18n key mapping)
- [ ] AI agent responses in student's locale (tested: ask in Arabic → response in Arabic)
- [ ] RTL tested on: course catalog, course detail, quiz engine, video player, chat panel
- [ ] Payment amounts formatted per locale (1,500.00 vs 1.500,00 vs ١٥٠٠)
- [ ] Date formats per locale (DD/MM/YYYY vs MM/DD/YYYY vs Islamic calendar)
- [ ] All admin/instructor pages RTL-compatible
- [ ] Search returns relevant results for Arabic queries

---

## Phase 4 Success Criteria

- [ ] PayTabs integration working for Saudi Arabia, UAE, Egypt
- [ ] Fawry integration working for Egypt
- [ ] MyFatoorah integration working for GCC
- [ ] Multi-currency pricing display (DZD, EGP, SAR, AED, USD)
- [ ] Service worker registered and precaching static assets
- [ ] Offline content caching in IndexedDB (course pages, lesson metadata)
- [ ] Push subscriptions stored in DB, push notifications sending
- [ ] Add to Home Screen prompt working
- [ ] Offline progress sync queue functional
- [ ] SCORM 1.2 and 2004 package import working
- [ ] SCORM runtime API shim for iframe-based content
- [ ] xAPI statements generated for video and quiz completions
- [ ] Arabic search with stemming (PostgreSQL config)
- [ ] All 19 locale namespaces complete for `ar` and `fr`
- [ ] RTL audit completed with no broken layouts
