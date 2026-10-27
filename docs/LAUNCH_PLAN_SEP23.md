# Podacium — Sep 23, 2026 Launch Execution Plan

**Current date:** Jul 18, 2026 · **Target:** Sep 23, 2026 (68 days)
**EdTech Day** — ownable IP, academic year alignment

---

## Realistic Timeline Assessment

| Gate | Timeline (researched) | Start | Finish |
|------|----------------------|-------|--------|
| **CNRC SARL registration** | 21–42 days avg / ~14 days assisted (UpGrowth) | Jul 18 | Aug 8 |
| **ANPDP declaration** | 10 days review (simple) | Jul 25 | Aug 8 |
| **Bank account** | 1–2 weeks (deposit + attestation) | Aug 1 | Aug 15 |
| **Chargily live keys** | 1–3 weeks post-SARL submission | Aug 8 | Aug 25 |
| **Course recording (4 courses)** | 6–10 hrs per finished hr (founder DIY) | Jul 18 | Aug 20 |
| **Course editing** | 2–4 hrs per finished hr (outsourced) | Aug 1 | Sep 5 |
| **Engineering remaining** | ~120 hrs per IMPLEMENTATION_PLAN.md | Jul 18 | Aug 20 |
| **Social content pipeline** | 5 posts/week minimum, 6-week runway | Jul 25 | Sep 23 |
| **Waitlist growth** | Target 1,500+ by Sep 15 | Jul 25 | Sep 15 |
| **Production deployment** | 1 week (DNS, SSL, Docker, secrets) | Sep 8 | Sep 15 |
| **Testing + QA** | 1 week (10–20 testers) | Sep 15 | Sep 22 |

---

## Week-by-Week Plan

### Phase 0: Legal Sprint & Course Kickoff (Jul 18 – Aug 8)

**Principle:** All legal and admin tasks run in parallel. Course recording starts immediately — rough cuts are acceptable.

| Week | Dates | Legal & Admin | Course Production | Engineering | Marketing |
|------|-------|---------------|-------------------|-------------|-----------|
| **W1** | Jul 18–24 | **SARL**: Hire notary, draft statutes. File CNRC name reservation (already done). Submit SARL dossier to CNRC via agency (UpGrowth Connect ~14 days). **ANPDP**: Create account on portal. | **Scripting**: Outline all 4 courses. Write scripts/bullet-point notes for Python course (flagship, free). Target: 2 hrs scripted. | **Trending endpoint** (1 day). **Refund flow** (2 days). Deploy staging environment. | Create social accounts (TikTok, LinkedIn, Instagram, YouTube, Twitter). Post first 3 "coming soon" teasers. |
| **W2** | Jul 25–31 | **ANPDP**: File declaration (10-day review). **SARL**: Notary finalizes statutes. Publish BOAL announcement. | **Recording**: Batch-record Python course (target 5–6 hrs finished). Phone + basic mic OK. Daily target: ~45 min finished footage. | **Freelancer portfolio** backend + frontend (3 days). **Video transcoding pipeline** (2 days). | Begin daily Darja content: 3-3-3 formula (Educate ×3, Inspire ×3, Convert ×3 per week). Launch waitlist (Google Forms). |
| **W3** | Aug 1–7 | **SARL**: Deposit 100K DZD min capital at bank. Receive attestation de blocage. **Bank**: Submit professional account application. | **Recording**: Record AI Tools course (target 5–6 hrs). Begin Python course editing (outsource to freelance editor on UpWork/Fiverr — ~$200–$400). | **Skill matching service** (2 days). **BI templates** (2 days). Ops: Nginx config, Docker compose, SSL scripts. | Continue content cadence. Target: 200 waitlist signups. Start TikTok warm-up (scroll 20 min/day, engage with Algerian EdTech content). |
| **W4** | Aug 8–14 | **SARL**: Receive CNRC extract (target). **Chargily**: Submit application with CNRC extract for live keys. **NIF**: Obtain from DGI (48 hrs). | **Recording**: Excel & AI course (target 3–4 hrs). **Editing**: Python course final cut delivered. Begin AI Tools editing. | **BI export to PDF/PPTX** (2 days). **Payment refund frontend** (1 day). | Increase to 2 posts/day. Target: 500 waitlist. Start ambassador recruitment (ESE Oran students). |

### Phase 1: Content & Engineering Finish (Aug 15 – Sep 7)

**Principle:** All courses delivered in rough-cut form by Aug 20. Editing continues through Sep 5. Engineering P0 items done.

| Week | Dates | Legal & Admin | Course Production | Engineering | Marketing |
|------|-------|---------------|-------------------|-------------|-----------|
| **W5** | Aug 15–21 | **Chargily**: Follow up on live key verification (typically 1–2 weeks). **CASNOS**: Affiliate non-salaried managers. | **Recording**: Cybersecurity course (target 3–4 hrs). **Editing**: AI Tools course final cut. | **All P0 engineering done** (trending, refunds, portfolio, video pipeline, BI exports). Begin load testing. | Target: 750 waitlist. First LinkedIn carousel post (Ahmed). Begin filming BOFU "payout proof" content. |
| **W6** | Aug 22–28 | **Chargily**: Receive live keys. Run 20+ test transactions (≥88% success). **ANPDP**: Récépissé received. | **Editing**: Excel & AI course final cut. Begin Cybersecurity editing. | **Staging freeze**. All features deployed to staging. Begin internal testing with 10–20 friends/family. | Target: 1,000 waitlist. Start "48 hours to launch" email sequence draft. |
| **W7** | Aug 29 – Sep 4 | **Bank**: Professional account active. Confirm Chargily settlement bank details. | **Editing**: Cybersecurity course final cut. **All 4 courses delivered in final form.** | Fix critical bugs from staging testing. Verify AI recommendations work. Run Chargily transaction flow end-to-end. | Target: 1,200 waitlist. Record TikTok Live Q&A demo. Reach out to press (Algérie Focus, Echorouk Digital, AlgeriaTech.news). |
| **W8** | Sep 5–7 | Final legal checks. Ensure all registrations are documents accessible. | Buffer for any course retakes or fixes. | **All engineering done.** Security headers, rate limiting, CSP verified. | Press releases drafted. Employer LOI outreach begins. |

### Phase 2: Deployment & Launch (Sep 8 – Sep 23)

**Principle:** Production deployment Sep 8–15. Final testing Sep 15–22. Launch Sep 23.

| Week | Dates | Ops | Content | Marketing |
|------|------|-----|---------|-----------|
| **W9** | Sep 8–14 | **Production deployment:** DNS (A records → VPS IP), SSL certs (Certbot), Docker build & deploy, secrets rotation (all new JWT, OAuth, DB passwords). Upload courses to production DB + CDN. | Verify all 4 courses play correctly in production. Test subscription flow (Starter, Plus, Pro). Test Chargily payment end-to-end. | Target: 1,500 waitlist. Email sequence: "Behind the scenes — platform build" (3 emails). |
| **W10** | Sep 15–21 | **Final QA:** 10–20 testers run through full funnel: signup → browse → subscribe → watch course → take quiz → get certificate. Fix any P0 bugs same day. | Record "Launch Day" video (2–3 min). Prepare Skill Passport demo. | "5 days to go" campaign. Employer LOI announcement (if secured). Press release distribution. |
| **W11** | Sep 22 | **LAUNCH EVE:** Final production check. Verify all secrets, DNS, SSL. Send "Tomorrow is the day" email to waitlist. Prepare monitoring dashboard (Sentry, Langfuse). | — | TikTok + Instagram: "See you tomorrow" countdown posts. |
| **Sep 23** | **🚀 LAUNCH** | Monitor Sentry every 2 hrs. Monitor Chargily webhooks. Fix any P0 within 1 hr. | **Go live at 07:30 DZ time.** Email blast to waitlist. Comment triggers activated. Launch video posted. | Press follow-up. TikTok Live Q&A at 18:00. |

---

## Course Production Plan

4 courses × ~5.5 hrs each = ~22 hrs finished content

| Course | Finished Hours | Est. Recording Time | Est. Edit Time (outsourced) | Deadline (rough cut) |
|--------|---------------|---------------------|----------------------------|---------------------|
| #1 Python (free) | 6 hrs | ~12–18 hrs (phone + basic mic) | ~12–24 hrs ($200–$400) | Aug 5 |
| #2 AI Tools | 6 hrs | ~12–18 hrs | ~12–24 hrs ($200–$400) | Aug 15 |
| #3 Excel & AI | 5 hrs | ~10–15 hrs | ~10–20 hrs ($150–$300) | Aug 20 |
| #4 Cybersecurity | 5 hrs | ~10–15 hrs | ~10–20 hrs ($150–$300) | Sep 1 |

**Recording tips:**
- Batch 3–5 lessons per session (reduces setup overhead 40%)
- Accept rough cuts — don't aim for cinematic quality at launch
- Outsource editing to Fiverr/UpWork Algerian freelancers (~$150–$400 total per course)
- 6–12 min per video (engagement drops 50% after 12 min per research)

---

## Budget Estimates

| Item | Cost (DZD) | Cost (USD) |
|------|------------|------------|
| CNRC name reservation | ~10,000 | ~$75 |
| SARL registration (via UpGrowth Connect) | ~188,610 | ~$1,420 |
| Capital social (blocked in bank) | 100,000 | ~$750 |
| ANPDP declaration | Free | $0 |
| Chargily Pay | Free (no setup fee) | $0 |
| Course recording equipment (phone + mic) | ~15,000 | ~$115 |
| Course editing (4 courses, outsourced) | ~100,000 | ~$750 |
| VPS (8GB RAM, 4 CPU, 80GB SSD) month 1 | ~18,000 | ~$135 |
| Domain + SSL (free via Certbot) | ~2,000 | ~$15 |
| Social media ads (TikTok Spark Ads, $20/day × 14 days) | ~37,200 | ~$280 |
| **TOTAL (one-time)** | **~470,810** | **~$3,540** |
| **TOTAL (excluding blocked capital)** | **~370,810** | **~$2,790** |

---

## Go/No-Go Gates

| Gate | Date | Pass Condition | Fail Action |
|------|------|---------------|-------------|
| **SARL registration** | Aug 8 | CNRC extract received | Push launch 3–4 weeks. Use contingency: launch Oct 15. |
| **Chargily live keys** | Aug 25 | Test transactions passing (≥88%) | Delay launch until keys arrive. Can launch EdTech with free tier only + manual payment collection. |
| **Course readiness** | Sep 1 | 4 courses in rough-cut form, 2 in final cut | Launch with 2–3 courses instead of 4. Add remaining post-launch. |
| **Staging QA** | Sep 15 | Zero P0 bugs in full funnel test | Push launch 1 week (Sep 30). |
| **Production deploy** | Sep 22 | All DNS, SSL, secrets verified | Soft launch (email list only, no press) on Sep 23. Full press push Oct 1. |

---

## Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **SARL processing delay** | Medium | HIGH | Use UpGrowth Connect (~14 days vs 42). File early. If delayed past Aug 15, push launch to Oct. |
| **Chargily verification delay** | Medium | HIGH | Start Chargily process same day CNRC extract received. Follow up weekly. Have manual payment fallback (bank transfer). |
| **Course recording takes longer** | Medium | MEDIUM | Launch with 2–3 courses. Plan B: Python + AI Tools at launch, Excel & Cybersecurity within 2 weeks post-launch. |
| **Bank account opening delay** | Low-Medium | MEDIUM | BNA and CPA both accept SARL. Apply to two banks simultaneously. Use Algérie Poste as backup. |
| **ANPDP declaration flagged as authorization** | Low | MEDIUM | If ANPDP requires authorization (2 months), launch with consent-only data collection. Full compliance completes post-launch. |

---

## Comparison: Sep 23 vs Original Aug 12 Timeline

| Metric | Aug 12 Plan | Sep 23 Plan | Delta |
|--------|-------------|-------------|-------|
| SARL registration | Jul 17 (aggressive) | Jul 18–Aug 8 | +3 weeks buffer ✅ |
| Course recording | Jul 15–30 (2 weeks) | Jul 18–Sep 1 (6 weeks) | +4 weeks ✅ |
| Waitlist target | 2,500 | 1,500 (realistic) | -1,000 ⚠️ |
| Social content runway | 4 weeks | 8 weeks | +4 weeks ✅ |
| Engineering buffer | None | 4 weeks | +4 weeks ✅ |
| Press/media push | UN Youth Day hook | EdTech Day (ownable IP) | Neutral |
| Academic alignment | Summer (low enrollment) | Start of academic year | ✅ Stronger |
| Pre-seed data months | ~3 (Aug–Oct) | ~2 (Sep–Oct) | ⚠️ 1 month less |
