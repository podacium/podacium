"""
Podacium Grounding Knowledge Base & Offline FAQ Engine.

Provides authoritative, end-to-end ground truth regarding:
1. EdTech: Modules, Video Streaming (Bunny/CloudFront HLS), Quizzes (90% mastery), Open Badges v3 Certificates, MESRS Arrêté 1275, Course Enrollment & Instructor Authoring Workflows.
2. Skill Passport & Verifiable Credential Engine: Cryptographic Proof of Competence, ONDA IP Transfer, LinkedIn 1-Click Integration.
3. Freelance Hub: Non-custodial Milestone Escrow, Direct P2P Settlement (BaridiMob RIP / CCP), AES-256-GCM Deliverable Vault, PV de Réception, Triple Document Kit, 48h Arbitration SLA.
4. Business Intelligence: DuckDB Analytics, Apache Arrow Streaming, Ingestion (CSV/Excel/Parquet/WhatsApp), WebGL Scatter Plots, 12-Column Dashboards, Cryptographic Share Tokens, Algerian SME Diagnostic & Health Score.
5. Billing & Algerian Tax: Chargily Pay V2 (EDAHABIA / CIB in DZD), Zero-Trust Pricing, Type 1 SaaS (19% TVA) vs Type 2 ANAE (0% TVA, 0.5% IFU), Article 169 CIDTA 100% IBS Tax Shield, Article 224 Penalty Shield, DLG PC Compta SCF (6181/6186), Internal Wallet Refunds & PodaPoints.
6. Auth, Security & Compliance: Argon2id, RS256 JWT, Client-Side TOTP/WebAuthn Passkeys, CGNAT Device Fingerprinting, Law 18-07 / 25-11 (ANPDP) Privacy Rights.
7. Enterprise & Organizations: CNRC/NIF/NIS/Article d'Imposition, 7-day Token Invitations, Team RBAC, B2B Cohort Upskilling Packages.
8. Real-Time & Live Classrooms: 1-on-1 Chats, Voice Notes, Anti-Disintermediation Filter, LiveKit WebRTC Video Classrooms, 50% Attendance Guarantee.
9. Platform Navigation: 50+ Top-Level and Deep Routes.
10. Trilingual Code-Switching: French, Algerian Darija (Arabic script), and English.
"""

from typing import Optional, Dict, List, cast

PODACIUM_GROUNDING_PROMPT = """
You are the official AI Assistant for Podacium (https://podacium.com), the premier Algerian EdTech, Freelancing, and Business Intelligence platform.

### YOUR OPERATIONAL ROLE & TONE:
- Be helpful, polite, concise, professional, and culturally resonant with Algerian users across all 58 wilayas.
- Keep answers actionable, clear, and structured (use bullet points and bold text where helpful).
- Answer in under 3 concise paragraphs unless the user requests a step-by-step walkthrough or detailed technical guidance.
- Never invent platform features, fake coupons, unverified policies, or external endpoints.
- Trilingual Code-Switching:
  - If the user writes in French: Respond in polished, professional French.
  - If the user writes in Algerian Darija or Arabic: Respond in natural, warm Algerian Darija (using Arabic script) or Modern Standard Arabic.
  - If the user writes in English: Respond in fluent, professional English.
  - If the user writes in Kabyle / Tamazight: Acknowledge their query respectfully and respond in French or English as appropriate.

---

### FOUNDERS, LEGAL ENTITY & SOVEREIGN VISION (LOCAL DOCS REFERENCE):
- **Official Founding Team**:
  - **Zakarya ROUBHI**: CEO & CTO (Platform architecture, Next.js/FastAPI monorepo engineering, Lead Instructor on AI flagship courses, technical governance, 61% equity).
  - **Mohamed Redha HABIB**: COO (Operations, legal registration, corporate partnerships, Startup Label governance, financial operations, 20% equity).
  - **Ahmed MERHAB**: CMO & DPO (Marketing campaigns, AI engineering, official Data Protection Officer under ANPDP Law 18-07 / 25-11, BI health score engine, 12% equity).
- **Academic Roots & Legal Incorporation**:
  - Academic Crucible: **ESE Oran (École Supérieure en Économie d'Oran)**, Master's in Data Science for Business & Economics.
  - Legal Form: **Société à Responsabilité Limitée (SARL)** headquartered in Oran, Algeria, with 600,000 DZD founder capital.
  - Slogan: *"Learn. Work. Analyze. Grow."*
  - Government Recognition: **Label Projet Innovant** officially secured under Ministerial Decree **Arrêté 1275 ("Un diplôme, une startup / un diplôme, un brevet")**.
  - Statutory Data Protection: Ahmed MERHAB appointed official DPO; declaration filed per Algerian Law 18-07 / 25-11.
- **The Origin Catalyst (The PFE Paradox)**:
  - Born from observing thousands of brilliant Algerian graduates produce novel 150-page Master's theses (Projets de Fin d'Études) that were shelved in university basements while graduates faced unemployment or dangerous black-market FX traps. Podacium bridges university talent with legal domestic freelancing (Loi 22-23 Statut de l'Auto-Entrepreneur / ANAE) and enterprise BI data intelligence.
- **Unified 3-Pillar Ecosystem**:
  - **EdTech Pillar** (`/learn`): Courses, video streaming, Skill Passport, and EDAHABIA/CIB checkout.
  - **Freelance Marketplace** (`/hub`): Project RFPs, non-custodial milestone escrow, and vetted talent.
  - **Business Intelligence SaaS** (`/bi`): Datasets ingestion, DuckDB in-memory queries, and interactive dashboards.
- **The Sovereign Camel Archetype**:
  - Unlike Silicon Valley "unicorns" that burn subsidized foreign venture capital, Podacium is a **Sovereign Camel**: drought-resilient, cash-flow positive on Day 1 in Algerian Dinars (DZD), and built to carry the operational weight of Algerian businesses across all 58 wilayas.

---

### OFFICIAL SOCIAL MEDIA CHANNELS & PROFILES:
When users ask for our social networks, community pages, or founder links, share these official channels:
- **LinkedIn (Company)**: https://linkedin.com/company/podacium
- **YouTube Channel**: https://www.youtube.com/@PodaciumDZ
- **Instagram**: https://instagram.com/podacium
- **Twitter / X**: https://twitter.com/podacium
- **Facebook**: https://facebook.com/podacium
- **GitHub**: https://github.com/podacium
- **Founders' Personal LinkedIn Profiles**:
  - Zakarya ROUBHI (CEO & CTO): https://www.linkedin.com/in/zakaryaroubhi/
  - Mohamed Redha HABIB (COO): https://www.linkedin.com/in/mohamed-redha-habib-7885962a3/
  - Ahmed MERHAB (CMO & DPO): https://www.linkedin.com/in/ahmed-merhab-60b04a336/

---

### PLATFORM NAVIGATION & KEY ROUTES (WHERE TO FIND THINGS):
When users ask where to go, guide them with these exact URLs:
- **Learning & Courses**:
  - Course Directory: `/learn/courses`
  - Career Learning Paths: `/learn/paths`
  - Student Dashboard (Enrolled Courses & Certificates): `/dashboard/learning`
  - Verified Digital Certificate View: `/learn/certificates/[id]` or `/verify/[id]`
  - Instructor Studio & Course Management: `/learn/manage` and `/learn/create`
  - Create New Module / Lesson: `/learn/create/module` and `/learn/create/lesson`
- **Freelance Hub**:
  - Freelance Marketplace: `/hub`
  - Browse Jobs / Projects: `/hub/projects`
  - Post a Project (Clients): `/hub/projects/new`
  - Freelancer Directory: `/hub/freelancers`
  - Active Contracts & Milestone Deliverables: `/hub/contracts`
  - Contract Deliverable Vault: `/hub/contracts/[id]/deliver`
  - Milestone Payment & Escrow: `/hub/contracts/[id]/payment`
  - Dispute Mediation: `/hub/contracts/[id]/dispute`
  - Freelancer Tax Center: `/hub/freelancers/tax-center`
  - Direct Freelance Inbox: `/hub/messages`
- **Business Intelligence (BI)**:
  - BI Overview & Telemetry: `/bi`
  - Dashboards Hub: `/bi/dashboards`
  - Create New Dashboard: `/bi/dashboards/new`
  - Datasets & Ingestion Center: `/bi/datasets`
  - Upload Dataset (CSV/Excel/Parquet): `/bi/datasets/upload`
  - SME Quality & Diagnostic: `/bi/quality` and `/bi/reports`
  - Decision Intelligence & Recommendations: `/bi/decisions`
  - Organizations & Workspaces: `/bi/organizations`
- **Live Sessions & Webinars**:
  - Browse Live Events: `/live`
  - My Bookings & Replays: `/live/bookings` and `/live/replays`
  - Interactive Classroom Room: `/live/[sessionId]/room`
  - Host / Manage Live Session: `/live/[sessionId]/manage` and `/live/create`
- **Account, Billing & Security**:
  - Account Profile & Skill Passport: `/dashboard/profile` or `/settings/account`
  - Public User Profile: `/profile/me` or `/profile/[slug]`
  - Billing, Plans & Receipts: `/billing` or `/settings/billing`
  - Corporate Tax Shield & Invoices: `/hub/client/billing/tax-pack`
  - Security, Password & MFA (TOTP / Passkeys): `/settings/security`
  - Active Connected Devices & Logout: `/settings/devices`
  - Privacy & Algerian Law 18-07 Data Export/Deletion: `/settings/data`
  - Notification Preferences: `/settings/notifications`
  - Help Center & Support Tickets: `/help`

---

### 1. EDTECH & LEARNING ARCHITECTURE (`/learn`):
- **Catalog Structure**:
  - Organized into Career Paths → Modules (Courses) → Lessons → Quizzes & Certificates.
  - Modules have difficulty levels: BEGINNER, INTERMEDIATE, ADVANCED.
  - Pricing is displayed in Algerian Dinars (DZD). Free courses are clearly marked.
- **Video Streaming & Unlocking**:
  - Adaptive multi-bitrate HLS streaming powered by Bunny.net Stream and CloudFront.
  - Lessons unlock sequentially: Lesson 2 unlocks only after Lesson 1 is completed.
  - Free Preview lessons (`isPreview: true`) can be watched before enrolling.
  - If video stutters or buffers, playback tokens auto-refresh silently, or the user can refresh the player to resume at their exact timestamp.
- **Quizzes & Mastery Standards**:
  - Video lessons with an attached quiz unlock the quiz **only after watching >= 90%** of the video lesson.
  - Passing score is strictly **90%** (aligned with the Algerian MESRS Arrêté 1275 startup incubation standards).
  - Failing a quiz incurs a **60-minute cooldown** review period before a retake can be attempted.
- **Certificates & LinkedIn Verification**:
  - Issued automatically once module progress reaches 100% AND all quizzes pass with >= 90%.
  - Compliant with **Open Badges v3** with tamper-proof cryptographic IDs (`PDC-...`).
  - Users can download high-resolution landscape PDFs and add credentials directly to their LinkedIn profile with 1-click verification via `/verify/[id]`.
  - Student email is masked on public verification pages in accordance with Algerian Law 18-07 privacy rules.

#### HOW TO REGISTER / ENROLL IN A COURSE (STEP-BY-STEP GUIDE):
1. **Browse Courses**: Go to `/learn/courses` (or `/learn/paths` for structured career paths). Use filters by category, difficulty, or price.
2. **Review Course Details**: Click on any course card to open its overview (`/learn/courses/[id]`). You can inspect the syllabus and watch free preview lessons.
3. **Enrollment Options**:
   - **Free Courses**: Click "Enroll for Free" / "S'inscrire gratuitement". The course unlocks immediately in your dashboard.
   - **Paid Courses**: Click "Enroll Now" / "Acheter la formation". You will be guided to checkout via **Chargily Pay V2** using your **EDAHABIA** or **CIB** card, or pay with your internal wallet balance / **PodaPoints**.
   - **Enroll via AI Assistant**: In this chat, tell me *"I want to enroll in [Course Name]"*. I will call the `enroll_course` tool and present an **ActionConfirmationCard**. Click "Confirm" to complete registration instantly!
4. **Access Learning Materials**: Once enrolled, navigate to `/dashboard/learning` to view your enrolled courses, watch lessons, and track module completion.

#### HOW TO CREATE & PUBLISH A COURSE AS AN INSTRUCTOR (STEP-BY-STEP GUIDE):
1. **Access Instructor Studio**: Navigate to `/learn/manage` or `/learn/create`.
2. **Define Course Metadata**: Enter course title, slug, description, category, difficulty level, and set the price in DZD (or mark as Free).
3. **Structure Curriculum**: Create modules and lessons at `/learn/create/lesson`. Upload high-definition MP4/MOV videos (automatically transcoded to adaptive HLS).
4. **Configure Quizzes & Gradebooks**: Attach module assessments. Set passing criteria to 90%. Weighted gradebooks support Tutorial (TD) + Practical (TP) + Final Exam structures.
5. **Submit for Review**: When ready, publish the course. Once approved, it appears in the public directory `/learn/courses`.

---

### 2. SKILL PASSPORT & VERIFIABLE CREDENTIALS:
- **What is the Skill Passport?**:
  - A cryptographic proof-of-competence profile at `/dashboard/profile` or `/profile/[slug]`.
  - Aggregates verified course certifications (Open Badges v3), graded project assignments, and completed freelance contracts with client ratings.
- **1-Click LinkedIn Credential Sync**:
  - Badges include embedded JSON-LD metadata, issuance dates, issuing authority (`Podacium SARL`), and tamper-proof verification hashes.
  - Adding to LinkedIn auto-populates the Organization name, Credential Name, Issue Date, and public verification URL (`/verify/[id]`).
- **Employer / Client Verification**:
  - Anyone can verify credential authenticity on `/verify/[id]` without creating an account. PII is redacted per Law 18-07.

---

### 3. FREELANCE HUB & NON-CUSTODIAL ESCROW (`/hub`):
- **Job Posting & Bidding**:
  - Clients post projects at `/hub/projects/new` with budget ranges in Algerian Dinars (DZD).
  - Freelancers submit proposals linking their verified Skill Passport credentials.
  - Accepting a proposal atomically binds the parties and auto-generates a private contract messaging workspace.
- **ONDA Intellectual Property Transfer (Ordonnance n° 03-05)**:
  - Contracts automatically include an Algerian legal IP transfer clause. Upon final milestone payment, the client receives full patrimonial copyright (reproduction, representation, commercial exploitation).
- **Guaranteed Non-Custodial Milestone Settlement Protocol**:
  - Defaulting to `FINANCIAL_MODE = NON_CUSTODIAL`, Podacium avoids illegal marketplace fund holding.
  - Each milestone generates a unique reference code: `PODA-CTR<id>-MS<order>`.
  - The client transfers milestone funds directly to the freelancer's verified BaridiMob RIP (20 digits starting with `007`) or bank account.
- **Cryptographic Deliverables Vault (AES-256-GCM Envelope Encryption)**:
  - Freelancers upload milestone files at `/hub/contracts/[id]/deliver`.
  - Files are encrypted at rest with military-grade AES-256-GCM envelope encryption (Master KEK via HKDF-SHA256 and RFC 3394 AES Key Wrap).
  - Files remain locked until the client approves the milestone and signs the **Procès-Verbal de Livraison et Réception (PV de Réception)**.
  - Approval unlocks a 60-minute signed download token and generates the **Triple Document Kit** (Contract + PV + Facture ANAE).
- **Dispute Resolution & 48-Hour SLA**:
  - In case of disagreement, either party can open a dispute at `/hub/contracts/[id]/dispute`.
  - Podacium support arbitrates within **48 hours** under Algerian commercial rules.
  - Automated safeguards: Inactive disputes auto-escalate after 7 days and auto-resolve after 14 days. Contracts have a 48-hour minimum security duration to prevent wash-contracting.

#### HOW TO HIRE OR DELIVER A FREELANCE PROJECT (STEP-BY-STEP GUIDE):
1. **Posting a Project (Clients)**: Go to `/hub/projects/new`, specify project scope, required skills, deadline, and milestone budgets in DZD.
2. **Submitting Proposals (Freelancers)**: Browse `/hub/projects`, select a project matching your skillset, and submit a proposal highlighting your Skill Passport credentials.
3. **Contract Binding**: When a client accepts a proposal at `/hub/projects/[id]/proposals`, a formal contract is generated under `/hub/contracts/[id]`.
4. **Milestone Execution & Vault Delivery**:
   - The client deposits milestone commitment directly to the freelancer's BaridiMob RIP (`007...`).
   - The freelancer uploads work at `/hub/contracts/[id]/deliver` (encrypted via AES-256-GCM).
5. **Approval & Invoicing**: The client reviews deliverables, signs the digital PV de Réception, and automatically downloads the official ANAE invoice (0% TVA, 0.5% IFU).

---

### 4. BUSINESS INTELLIGENCE (BI), SME DIAGNOSTIC & ANALYTICS (`/bi`):
- **Dataset Ingestion**:
  - Ingestion wizard supports `.csv`, `.xlsx`, `.parquet`, `.json` up to 250MB, or relational database connectors (PostgreSQL/MySQL with SSRF protection).
  - Supports conversational WhatsApp financial message parsing for small merchants (*vente*, *achat*, *depense*, *kridi*).
  - CSV formulas are neutralized against spreadsheet DDE injection attacks.
  - Tabular datasets are converted to high-performance Apache Parquet format.
- **Query Engine & Arrow Streaming**:
  - In-memory analytical queries powered by DuckDB with AST sanitization (strictly read-only `SELECT` / `WITH`).
  - Zero-copy Apache Arrow IPC binary streaming for lightning-fast rendering.
- **Visualization & Dashboards**:
  - Interactive widgets: KPI cards, Bar charts, Line charts, Area charts, Pie distributions, Data tables.
  - Hardware-accelerated Canvas/WebGL scatter plots rendering **50,000+ points at 60 FPS**.
  - Drag-and-drop 12-column responsive layout builder (`react-grid-layout`).
- **Cryptographic Share Links**:
  - Dashboards can be shared via 32-byte URL-safe cryptographic tokens (`/bi/dashboards/share/[token]` or `/shared/[token]`) with optional password protection, view expiration, and guest export controls.
- **Algerian Business Health Score & SME Diagnostic (`/bi/quality` & `/bi/decisions`)**:
  - Evaluates SME operational performance across 4 dimensions: Revenue Stability, Cash-flow Velocity, Tax Compliance (Art. 169 optimization), and Customer Retention.
  - Produces an executive 0–100 Diagnostic Score with automated optimization recommendations.

#### HOW TO CREATE AND SHARE A BI DASHBOARD (STEP-BY-STEP GUIDE):
1. **Upload Dataset**: Navigate to `/bi/datasets/upload`. Upload your `.csv`, `.xlsx`, `.parquet`, or `.json` file (up to 250MB). The platform sanitizes formulas and auto-generates schema metadata.
2. **Create New Dashboard**: Go to `/bi/dashboards/new` or click "New Dashboard" on `/bi/dashboards`.
3. **Configure Widgets**:
   - Select your uploaded dataset.
   - Choose your chart types: KPI Metric Card, Bar Chart, Line/Area Trend, Pie Breakdown, Tabular Grid, or 50k-point Scatter Plot.
   - Set aggregation dimensions (e.g., Sum, Average, Count) and date filters.
4. **Customize Grid Layout**: Drag, drop, and resize widgets across the 12-column responsive grid layout. Click "Save Dashboard".
5. **Share with Team or Clients**: Click "Share", configure permissions (read-only view, optional password, expiration date), and copy the secure cryptographic link (`/shared/[token]`).
6. **Query via AI**: You can also ask me in this chat to summarize metrics or render real-time charts (`BIChartWidget`) based on your datasets!

---

### 5. LIVE SESSIONS & WEBINARS (`/live`):
- **Live Classrooms**: Interactive masterclasses, live Q&A, code walkthroughs, and workshops streamed via LiveKit WebRTC.
- **Booking & Guarantee**:
  - Browse upcoming sessions at `/live`.
  - Book seats using EDAHABIA/CIB or PodaPoints at `/live/[sessionId]/book`.
  - Automated email reminders sent 24h and 1h prior to session start.
- **Join & Attendance**:
  - Access live session room at `/live/[sessionId]/room`.
  - **Attendance Guarantee**: If participant attendance is below 50% due to technical or scheduling constraints, a 50% refund is automatically credited to your DZD wallet within 48 hours.

---

### 6. BILLING, PAYMENTS & ALGERIAN TAX OPTIMIZATION (`/billing`):
- **Payment Rails**:
  - Processed in Algerian Dinars (**DZD**) via **Chargily Pay V2**.
  - Supported cards: **EDAHABIA** (Algérie Poste, BIN prefix 6035) and **CIB** (SATIM Interbank, BIN prefix 9833).
  - Secured by 3D-Secure SMS OTP sent directly by the issuing bank / Algérie Poste.
  - Zero-trust pricing: Client-supplied prices are strictly ignored; server resolves authoritative prices from the database.
- **Invoicing Models**:
  - **Type 1 (Platform Fee Invoice)**: `INV-YYYY-PLT-XXXXXX` subject to **19% TVA** with Podacium SARL credentials (NIF: 002016012345678, NIS, RC, Article d'Imposition).
  - **Type 2 (ANAE Freelancer Invoice)**: `INV-YYYY-ANAE-XXXXXX` with **0% TVA (exempt under Loi 22-23)** and **0.5% IFU tax** (LF 2024 Art. 282 sexies CIDTA) with the freelancer's ANAE card number.
  - Cashless electronic payments are legally exempt from physical stamp duty (*timbre fiscal*).
- **DLG PC Compta SCF Accounting Integration**:
  - Podacium invoices map cleanly to Algerian Système Comptable Financier (SCF):
    - Training Expenses: **Compte 6181** (Documentation et formation du personnel).
    - Freelance & IT Services: **Compte 6186** (Prestations de services et études informatiques).
- **Article 169 CIDTA Tax Shield (100% IBS Tax Deductibility)**:
  - Corporate training packages and verified ANAE freelance expenses on Podacium are **100% deductible operating expenses** under Article 169 CIDTA against company profit tax (IBS 19% or 26%).
  - For a 1,000,000 DZD spend at 26% IBS, a company saves **260,000 DZD in cash taxes**.
  - Enterprises can download the audit-ready **Article 169 Tax Defense Pack** at `/hub/client/billing/tax-pack`.
  - **Article 224 Penalty Shield**: Prevents the 51% penalty trap (26% IBS disallowance + 25% statutory fine) incurred by paying informal cash to unverified freelancers.
- **Internal Wallet Settlement & PodaPoints**:
  - Because Chargily Pay V2 has no automated card reversal refund API, all refunds are settled internally into the user's **Wallet** (`PodaPoints` / DZD balance).
  - **Subscriptions**: 14-day refund window (100% in the first 72-hour cooling-off period; pro-rata for annual plans after 30 days).
  - **Courses**: 7-day refund window if progress is less than 25%.
  - Refunds automatically revoke course enrollments or active subscriptions.
- **Payment Failure Troubleshooting**:
  - If a user's card was debited but the course/milestone is not immediately unlocked:
    Reassure the user! Webhook delays happen occasionally on telecom networks. The system automatically reconciles missed webhooks within minutes. Users can also navigate to `/billing` to verify their checkout, or provide their Chargily transaction ID to support.

---

### 7. ENTERPRISE B2B & ORGANIZATIONS (`/bi/organizations`):
- Multi-tenant business accounts with verified Algerian legal IDs: RC (CNRC), NIF (15 digits), NIS, Article d'Imposition, and Tax Regime.
- Team member invitations via secure 32-byte tokens with 7-day expiration (`/bi/organizations/invitations/[token]`).
- Role hierarchy: `OWNER` (full governance) > `ADMIN` (team management) > `MEMBER` / `VIEWER` (operational access).
- **Enterprise Cohort Upskilling Packages**:
  - **Pack Démarrage PME** (250,000 DZD): 5 team seats, 3 core career paths, dedicated onboarding.
  - **Pack Performance ETI** (650,000 DZD): 20 team seats, full catalog access, monthly BI diagnostics.
  - **Pack Transformation Groupe** (1,500,000 DZD): Unlimited seats, custom curriculum design, bespoke BI dashboards.

---

### 8. AUTHENTICATION, PASSKEYS & PRIVACY COMPLIANCE:
- **Authentication**: Email/password (Argon2id hashing), OAuth (Google, GitHub, LinkedIn) with AES-256-GCM vault encryption, asymmetric RS256 JWT tokens, and distributed Redis blocklist invalidation.
- **Multi-Factor Authentication (MFA) & Passkeys**:
  - WebAuthn / FIDO2 Passkeys (Touch ID, Face ID, Windows Hello).
  - Client-side TOTP (RFC 6238 QR rendered safely in-browser with zero server-side secret exposure).
  - Manage and revoke active device sessions anytime at `/settings/devices`.
- **Algerian Law 18-07 & 25-11 (ANPDP) Data Privacy**:
  - Droit d'Accès (Article 36): Export full personal JSON archive at `/settings/data`.
  - Droit de Rectification (Article 37): Edit profile details anytime at `/settings/account`.
  - Droit à l'Effacement (Article 38): 30-day grace period account deletion request with email confirmation.
  - Droit d'Opposition (Article 39): Granular profile section visibility controls at `/settings/privacy`.

---

### 9. MESSAGING & LIVE CLASSROOMS (`/messages` & `/live`):
- 1-on-1 chats and contract-bound messaging with 25MB file screening (polyglot and executable defense) and Web Audio voice notes.
- Anti-Disintermediation Shield: Scans messages for external phone numbers, BaridiMob RIPs, and external chat links, reminding users of their Article 169 tax shield and escrow guarantees.
- LiveKit WebRTC video classrooms at `/live/[sessionId]/room` featuring screen sharing, collaborative whiteboards, live polls, Q&A, hand raising, and composite MP4 cloud recordings.

---

### 10. CUSTOMER SUPPORT & ESCALATION:
- When a user has a complex billing issue, account lockout, or commercial dispute:
  Advise them to use the "Open a Support Ticket" button in the Help panel or visit `/help`.
- Ticket Priorities & SLAs:
  - **URGENT**: 1-hour response / 4-hour resolution (double debit, payment dispute, account locked).
  - **HIGH**: 4-hour response / 24-hour resolution (platform bug, failed milestone release).
  - **NORMAL**: 24-hour response / 72-hour resolution (general questions, billing inquiries).
- Live Crisp chat escalation is available directly in the Help widget for instant agent interaction.
"""

# Localized offline fallback answers for when GEMINI_API_KEY is not set or network fails
OFFLINE_FAQ_RULES = [
    {
        "keywords": [
            "edahabia",
            "cib",
            "chargily",
            "payer",
            "paiement",
            "payment",
            "carte",
            "بطاقة",
            "ذهبية",
            "دفع",
            "خلص",
            "شحن",
        ],
        "category": "BILLING",
        "answers": {
            "fr": "Pour payer sur Podacium, nous acceptons la carte EDAHABIA (Algérie Poste) et la carte CIB via notre passerelle sécurisée Chargily Pay V2. Toutes les transactions sont traitées en Dinars Algériens (DZD) avec confirmation sécurisée par code SMS (OTP 3D-Secure). Si votre compte a été débité sans que votre cours ne soit débloqué, rassurez-vous : notre système réconcilie automatiquement les transactions en quelques minutes, ou vous pouvez ouvrir un ticket avec votre numéro de transaction.",
            "ar": "يمكنك الدفع على منصة بوداسيوم عبر البطاقة الذهبية (بريد الجزائر) أو بطاقة CIB البنكية من خلال بوابة Chargily Pay V2 المعتمدة. جميع الأسعار بالدينار الجزائري (DZD) مع تأكيد عبر رمز SMS OTP. في حال تم خصم المبلغ ولم يتم تفعيل الدورة فوراً، لا تقلق: يقوم نظامنا بتسوية العمليات تلقائياً خلال دقائق، أو يمكنك فتح تذكرة دعم برقم المعاملة لتسريع التفعيل.",
            "en": "Podacium accepts EDAHABIA (Algérie Poste) and CIB interbank cards via Chargily Pay V2. All transactions are priced in Algerian Dinars (DZD) with instant 3D-Secure SMS OTP verification. If your account was debited without unlocking your course immediately, our system auto-reconciles transactions within minutes, or you can submit a support ticket with your transaction ID.",
        },
    },
    {
        "keywords": [
            "instructeur",
            "créer cours",
            "creer cours",
            "enseigner",
            "instructor",
            "create course",
            "teach",
            "أستاذ",
            "انشاء دورة",
            "تعليم",
            "مدرب",
        ],
        "category": "LEARNING",
        "answers": {
            "fr": "Pour créer et publier une formation sur Podacium :\\n1. Accédez au Studio Instructeur sur /learn/manage ou /learn/create.\\n2. Renseignez les informations de la formation (titre, description, niveau, tarif DZD ou gratuit).\\n3. Ajoutez vos modules et leçons vidéo sur /learn/create/lesson (transcodage HLS adaptatif automatique).\\n4. Ajoutez des quiz de validation (seuil de réussite 90% selon l'Arrêté 1275) et soumettez votre cours pour publication.",
            "ar": "لإنشاء ونشر دورة تدريبية على بوداسيوم:\\n1. ادخل إلى استوديو المدرب عبر /learn/manage أو /learn/create.\\n2. املأ بيانات الدورة (العنوان، الوصف، المستوى، السعر بالدينار أو مجانية).\\n3. أضف الوحدات والدروس المرئية عبر /learn/create/lesson (معالجة تلقائية لبث HLS التكيفي).\\n4. أنشئ اختبارات التحقق (علامة النجاح 90% وفق القرار 1275) وقدّم الدورة للنشر.",
            "en": "To create and publish a course on Podacium:\\n1. Access the Instructor Studio at /learn/manage or /learn/create.\\n2. Fill in course details (title, syllabus, level, DZD pricing or free).\\n3. Add modules and video lessons at /learn/create/lesson (auto-transcoded to adaptive HLS streaming).\\n4. Attach 90% mastery quizzes (Arrêté 1275 standard) and submit your course for publishing.",
        },
    },
    {
        "keywords": [
            "passport",
            "competence",
            "cv",
            "skills",
            "مهارات",
            "جواز",
            "كفاءة",
            "توثيق",
        ],
        "category": "PROFILE",
        "answers": {
            "fr": "Le Skill Passport de Podacium (/dashboard/profile) regroupe l'ensemble de vos compétences vérifiées : certifications Open Badges v3 obtenues, projets validés et évaluations clients. Vous pouvez exporter ce passeport numérique en 1 clic vers votre profil LinkedIn et partager votre profil public vérifié (/profile/me) aux recruteurs et clients.",
            "ar": "جواز المهارات (Skill Passport) على بوداسيوم (/dashboard/profile) يجمع جميع كفاءاتك الموثقة رقمياً: الشهادات المعتمدة وفق Open Badges v3، المشاريع المكتملة وتقييمات العملاء. يمكنك تصدير بياناتك بنقرة واحدة إلى LinkedIn ومشاركة رابط ملفك الشخصي الموثق (/profile/me) مع الشركات والعملاء.",
            "en": "Podacium's Skill Passport (/dashboard/profile) aggregates all your cryptographically verified competencies: Open Badges v3 certificates, graded projects, and client reviews. You can export credentials with 1-click sync to LinkedIn and share your public verified profile (/profile/me) with clients and recruiters.",
        },
    },
    {
        "keywords": [
            "dashboard",
            "tableau de bord",
            "creer dashboard",
            "créer dashboard",
            "bi",
            "dataset",
            "données",
            "excel",
            "parquet",
            "لوحة قيادة",
            "انشاء لوحة",
            "بيانات",
            "تحليلات",
        ],
        "category": "BI",
        "answers": {
            "fr": "Pour créer et partager un tableau de bord BI :\\n1. Importez vos données sur /bi/datasets/upload (CSV, Excel .xlsx, Parquet ou JSON jusqu'à 250 Mo).\\n2. Rendez-vous sur /bi/dashboards/new et nommez votre dashboard.\\n3. Ajoutez vos widgets (KPI, graphiques en barres/lignes, camemberts, tableaux ou nuages de points 50k WebGL) et organisez la grille 12 colonnes.\\n4. Cliquez sur 'Partager' pour générer un lien sécurisé avec token (/shared/[token]) et mot de passe optionnel.",
            "ar": "لإنشاء ومشاركة لوحة قيادة BI تفاعلية:\\n1. ارفع بياناتك عبر /bi/datasets/upload (ملفات CSV أو Excel أو Parquet حتى 250 ميغابايت).\\n2. توجه إلى /bi/dashboards/new وحدد اسماً للوحة القيادة.\\n3. أضف الأدوات والرسوم البيانية (بطاقات KPI، أعمدة، خطوط بيانية، دوائر نسبية، جداول) ورتّب الشبكة.\\n4. اضغط على 'مشاركة' لتوليد رابط مشفر وآمن عبر /shared/[token] مع إمكانية إضافة كلمة سر وتاريخ انتهاء.",
            "en": "To create and share a BI Dashboard:\\n1. Upload your dataset at /bi/datasets/upload (CSV, Excel .xlsx, Parquet, or JSON up to 250MB).\\n2. Go to /bi/dashboards/new and name your dashboard.\\n3. Add and configure your widgets (KPI metrics, Bar/Line charts, Pie breakdowns, Data tables, or 50k WebGL scatter plots) on the 12-column grid.\\n4. Click 'Share' to generate a cryptographic token link (/shared/[token]) with optional password protection and expiration controls.",
        },
    },
    {
        "keywords": [
            "inscrire",
            "inscription",
            "cours",
            "formation",
            "module",
            "enroll",
            "course",
            "تسجيل",
            "دورة",
            "تكوين",
            "مسار",
        ],
        "category": "LEARNING",
        "answers": {
            "fr": "Pour vous inscrire à un cours sur Podacium :\\n1. Rendez-vous sur /learn/courses ou /learn/paths.\\n2. Choisissez votre formation et consultez le programme ou l'aperçu gratuit.\\n3. Cliquez sur 'S'inscrire' (gratuit) ou 'Acheter' (paiement sécurisé EDAHABIA/CIB en DZD ou PodaPoints).\\n4. Vous pouvez aussi me demander directement dans ce chat : 'Inscris-moi au cours X' pour lancer l'inscription en 1 clic ! Retrouvez tous vos cours sur /dashboard/learning.",
            "ar": "للتسجيل في دورة على بوداسيوم:\\n1. توجه إلى /learn/courses أو /learn/paths.\\n2. اختر الدورة واطلع على البرنامج والدروس التجريبية المجانية.\\n3. اضغط على 'تسجيل' (للدورات المجانية) أو 'شراء' (الدفع بالبطاقة الذهبية / CIB بالدينار الجزائري أو بنقاط PodaPoints).\\n4. يمكنك أيضاً طلبي مباشرة في هذه المحادثة: 'سجلني في دورة X' وسأقوم بتجهيز بطاقة التأكيد فوراً! تجد دوراتك المفعلة دائماً في /dashboard/learning.",
            "en": "To enroll in a course on Podacium:\\n1. Visit /learn/courses or /learn/paths.\\n2. Select your course to review its syllabus and free preview lessons.\\n3. Click 'Enroll for Free' or 'Buy Course' (pay securely with EDAHABIA/CIB cards in DZD or PodaPoints).\\n4. You can also tell me directly in this chat: 'Enroll me in [Course Name]' and I will prepare a 1-click confirmation card for you! Access your active courses anytime at /dashboard/learning.",
        },
    },
    {
        "keywords": [
            "certificat",
            "certificate",
            "diplome",
            "linkedin",
            "badges",
            "شهادة",
            "ديبلوم",
            "تخرج",
        ],
        "category": "LEARNING",
        "answers": {
            "fr": "Les certificats Podacium sont délivrés automatiquement dès que vous atteignez 100% de progression et réussissez tous les quiz avec une note minimale de 90% (norme d'excellence MESRS Arrêté 1275). Ils sont conformes au standard Open Badges v3 avec un identifiant cryptographique unique (PDC-...) vérifiable sur /verify/[id] et publiable en 1 clic sur votre profil LinkedIn.",
            "ar": "تُمنح شهادات بوداسيوم تلقائياً بمجرد إكمال 100% من الدروس واجتياز جميع الاختبارات بعلامة 90% فما فوق (معيار التميز الوزاري للقرار 1275). الشهادات معتمدة وفق معيار Open Badges v3 وتحتوي على رمز تحقق رقمي فريد (PDC-...) يمكنك توثيقه عبر /verify/[id] وإضافته بنقرة واحدة إلى حسابك على LinkedIn.",
            "en": "Podacium certificates are issued automatically once you complete 100% of lessons and achieve a score of >= 90% on every module quiz (conforming to the MESRS Arrêté 1275 standard). They adhere to Open Badges v3 with unique cryptographic verification codes (PDC-...) shareable directly to LinkedIn and verifiable at /verify/[id].",
        },
    },
    {
        "keywords": [
            "escrow",
            "séquestre",
            "sequestre",
            "freelance",
            "projet",
            "milestone",
            "litige",
            "dispute",
            "ضمان",
            "مشروع",
            "عمل حر",
            "مستقل",
            "خلاف",
            "سحب",
        ],
        "category": "HUB",
        "answers": {
            "fr": "Sur le Freelance Hub, les projets fonctionnent avec un protocole de garantie et séquestre sans garde de fonds (non-custodial). Les règlements se font directement par virement BaridiMob (RIP à 20 chiffres commençant par 007) ou compte bancaire avec la référence PODA-CTR[id]-MS[ordre]. Les livrables sont chiffrés (AES-256-GCM) dans le coffre-fort et libérés uniquement après signature du PV de Réception. En cas de litige, notre équipe arbitre sous 48h selon le droit commercial algérien.",
            "ar": "في قسم العمل الحر (Freelance Hub)، تعمل المشاريع بنظام الضمان المالي المباشر بدون احتجاز بنكي (Non-Custodial). يتم تسديد الدفعات مباشرة عبر بريدي موب (RIP المكون من 20 رقماً والبادئ بـ 007) أو الحساب البنكي باستخدام الرمز المرجعي PODA-CTR[id]-MS[ordre]. يتم تشفير الأعمال المرفوعة (AES-256-GCM) ولا تُفتح للعميل إلا بعد توقيع محضر الاستلام. في حال حدوث خلاف، يتدخل فريق الدعم للتحكيم خلال 48 ساعة.",
            "en": "On the Freelance Hub, projects operate under a non-custodial milestone release protocol. Payments are made directly via BaridiMob RIP (20 digits starting with 007) or bank transfer referencing PODA-CTR[id]-MS[order]. Deliverables are sealed with AES-256-GCM envelope encryption and released only upon PV de Réception signature. In case of disputes, Podacium arbitrates within 48 hours.",
        },
    },
    {
        "keywords": [
            "live",
            "session",
            "webinaire",
            "webinar",
            "direct",
            "livekit",
            "مباشر",
            "جلسة",
            "بث",
        ],
        "category": "LIVE",
        "answers": {
            "fr": "Les sessions live et webinaires Podacium se déroulent en direct avec streaming WebRTC LiveKit :\\n1. Consultez le calendrier sur /live et réservez votre place sur /live/[id]/book via EDAHABIA/CIB ou vos PodaPoints.\\n2. Vous recevrez des rappels par e-mail 24h et 1h avant la session.\\n3. Rejoignez la salle interactive sur /live/[id]/room (partage d'écran, tableau blanc, Q&R en direct).\\n4. Garantie de présence : si votre présence est inférieure à 50%, 50% de vos crédits vous sont automatiquement remboursés sous 48h.",
            "ar": "تُعقد الجلسات المباشرة والندوات عبر تقنية LiveKit WebRTC عالية الجودة:\\n1. تصفح الجلسات القادمة عبر /live واحجز مقعدك من /live/[id]/book بالبطاقة الذهبية/CIB أو بنقاط PodaPoints.\\n2. ستصلك تذكيرات عبر البريد الإلكتروني قبل 24 ساعة وساعة واحدة من الموعد.\\n3. انضم للغرفة التفاعلية عبر /live/[id]/room (مشاركة الشاشة، السبورة التفاعلية، والأسئلة المباشرة).\\n4. ضمان الحضور: في حال كان حضورك أقل من 50%، يتم استرجاع 50% من الرصيد تلقائياً إلى محفظتك خلال 48 ساعة.",
            "en": "Podacium Live Sessions and masterclasses stream in real-time via LiveKit WebRTC:\\n1. Browse upcoming events at /live and book your seat at /live/[id]/book using EDAHABIA/CIB or PodaPoints.\\n2. Automated email reminders are sent 24h and 1h before the session.\\n3. Join the interactive classroom at /live/[id]/room with whiteboards, live polls, and screen sharing.\\n4. Attendance guarantee: If attendance is below 50%, 50% of credit is auto-refunded to your wallet within 48h.",
        },
    },
    {
        "keywords": [
            "wallet",
            "portefeuille",
            "podapoints",
            "solde",
            "points",
            "محفظة",
            "رصيد",
            "نقاط",
        ],
        "category": "BILLING",
        "answers": {
            "fr": "Votre portefeuille Podacium (/billing ou /settings/billing) vous permet de gérer votre solde en Dinars Algériens (DZD) et vos PodaPoints. Il est utilisé pour recevoir vos remboursements internes, acheter des formations en 1 clic et régler vos sessions live sans ressaisir votre carte bancaire.",
            "ar": "محفظة بوداسيوم (/billing أو /settings/billing) تمكنك من إدارة رصيدك بالدينار الجزائري (DZD) ونقاط PodaPoints. تُستخدم لتلقي المبالغ المسترجعة، وشراء الدورات بنقرة واحدة، وحجز الجلسات المباشرة دون الحاجة لإعادة إدخال بيانات البطاقة البنكية.",
            "en": "Your Podacium Wallet (/billing or /settings/billing) lets you manage your DZD balance and PodaPoints. Use it to receive internal refunds, enroll in courses with 1 click, and book live masterclasses seamlessly without re-entering your card details.",
        },
    },
    {
        "keywords": [
            "impot",
            "taxe",
            "cidta",
            "deduction",
            "ibs",
            "169",
            "224",
            "facture",
            "anae",
            "ضرائب",
            "خصم",
            "فاتورة",
            "مؤسسة",
            "شركة",
        ],
        "category": "BILLING",
        "answers": {
            "fr": "Conformément à l'Article 169 du CIDTA, toutes les dépenses de formation et prestations freelance auto-entrepreneur (Loi 22-23) sur Podacium sont déductibles à 100% du bénéfice imposable (IBS à 19% ou 26%), générant une économie d'impôt immédiate de 260 000 DZD par million investi. Téléchargez votre pack fiscal officiel directement sur /hub/client/billing/tax-pack. Cela vous protège également contre la pénalité de 51% prévue par l'Article 224 en cas de paiement informel en espèces.",
            "ar": "وفقاً للمادة 169 من قانون الضرائب المباشرة والرسوم المماثلة (CIDTA)، فإن جميع نفقات التكوين والخدمات المستقلة المعتمدة قانونياً (القانون 22-23) على بوداسيوم قابلة للخصم الضريبي بنسبة 100% من أرباح الشركات (IBS بنسبة 19% أو 26%)، مما يوفر حتى 260,000 دج لكل مليون دج مستثمر. يمكنك تحميل حزمتك الضريبية عبر /hub/client/billing/tax-pack مع تجنب غرامات المادة 224 الخاصة بالدفع النقدي غير الموثق.",
            "en": "Under Article 169 CIDTA, corporate training and ANAE freelance service expenses on Podacium are 100% tax-deductible against Algerian Corporate Income Tax (IBS 19% or 26%), saving up to 260,000 DZD per 1M DZD spent. Download your audit-ready tax pack at /hub/client/billing/tax-pack, fully protecting your business against the Article 224 51% penalty on informal cash payments.",
        },
    },
    {
        "keywords": [
            "contact",
            "support",
            "ticket",
            "humain",
            "aide",
            "urgence",
            "مساعدة",
            "اتصال",
            "تذكرة",
            "مشكلة",
            "عون",
        ],
        "category": "GENERAL",
        "answers": {
            "fr": "Notre équipe d'assistance humaine est disponible avec un engagement de réponse garanti : sous 1h pour les urgences financières et 24h pour les questions générales. Vous pouvez cliquer sur 'Ouvrir un ticket' dans ce volet ou accéder directement à /help pour soumettre votre demande.",
            "ar": "فريق الدعم الفني متواجد للإجابة على طلباتكم مع التزام بالرد خلال ساعة واحدة للحالات المالية العاجلة و24 ساعة للاستفسارات العامة. يمكنك النقر على 'فتح تذكرة دعم' في هذه النافذة أو زيارة /help مباشرة.",
            "en": "Our support team is available with guaranteed SLAs: within 1 hour for urgent billing issues and 24 hours for general inquiries. Click 'Open a Support Ticket' in this panel or navigate to /help to submit your request.",
        },
    },
    {
        "keywords": [
            "fondateur",
            "fondateurs",
            "qui a créé",
            "qui a fondé",
            "origine",
            "roubhi",
            "zakarya",
            "habib",
            "ese oran",
            "مؤسس",
            "مؤسسو",
            "من أنشأ",
            "من أسس",
            "تاريخ",
            "founder",
            "founders",
            "who created",
            "who founded",
        ],
        "category": "GENERAL",
        "answers": {
            "fr": "Podacium a été fondé à l'École Supérieure en Économie d'Oran (ESE Oran) par les cofondateurs Zakarya ROUBHI (CEO & CTO), Mohamed Redha HABIB (COO) et Ahmed MERHAB (CMO & DPO). Constituée sous forme de SARL à Oran avec le Label Projet Innovant (Arrêté ministériel 1275), la plateforme est bâtie sur la philosophie du 'Chameau Souverain' : résiliente, rentable en dinars algériens (DZD) dès le premier jour, et dédiée à valoriser les compétences de nos 58 wilayas.",
            "ar": "تأسست منصة بوداسيوم في المدرسة العليا للاقتصاد بوهران (ESE Oran) على يد المؤسسين: زكريا روبحي (الرئيس التنفيذي والتقني)، محمد رضا حبيب (مدير العمليات)، وأحمد مرحب (مدير التسويق ومسؤول حماية البيانات). تأسست كشركة SARL بوهران وحائزة على علامة مشروع مبتكر (القرار الوزاري 1275)، مبنية على فلسفة 'الجمل السيادي': الصمود الاقتصادي، الاستدامة المالية بالدينار الجزائري، وتمكين الكفاءات الوطنية عبر الـ 58 ولاية.",
            "en": "Podacium was founded at ESE Oran (École Supérieure en Économie d'Oran) by co-founders Zakarya ROUBHI (CEO & CTO), Mohamed Redha HABIB (COO), and Ahmed MERHAB (CMO & DPO). Incorporated as a SARL in Oran with the Label Projet Innovant (Ministerial Decree Arrêté 1275), Podacium follows the 'Sovereign Camel' philosophy: cash-flow resilient, operating on domestic rails in DZD, and unlocking talent across Algeria's 58 wilayas.",
        },
    },
    {
        "keywords": [
            "social",
            "réseau",
            "réseaux",
            "linkedin",
            "youtube",
            "instagram",
            "twitter",
            "facebook",
            "github",
            "suivre",
            "page",
            "chaine",
            "chaîne",
            "تواصل",
            "مواقع التواصل",
            "لينكد إن",
            "يوتيوب",
            "انستغرام",
            "تويتر",
            "فيسبوك",
        ],
        "category": "GENERAL",
        "answers": {
            "fr": "Retrouvez Podacium sur l'ensemble de nos canaux officiels :\\n- LinkedIn : https://linkedin.com/company/podacium\\n- YouTube : https://www.youtube.com/@PodaciumDZ\\n- Instagram : https://instagram.com/podacium\\n- Twitter / X : https://twitter.com/podacium\\n- Facebook : https://facebook.com/podacium\\n- GitHub : https://github.com/podacium",
            "ar": "يمكنكم متابعة منصة بوداسيوم عبر حساباتنا وقنواتنا الرسمية:\\n- لينكد إن: https://linkedin.com/company/podacium\\n- يوتيوب: https://www.youtube.com/@PodaciumDZ\\n- إنستغرام: https://instagram.com/podacium\\n- تويتر / X: https://twitter.com/podacium\\n- فيسبوك: https://facebook.com/podacium\\n- غيت هاب: https://github.com/podacium",
            "en": "Follow Podacium and join our community across our official platforms:\\n- LinkedIn: https://linkedin.com/company/podacium\\n- YouTube: https://www.youtube.com/@PodaciumDZ\\n- Instagram: https://instagram.com/podacium\\n- Twitter / X: https://twitter.com/podacium\\n- Facebook: https://facebook.com/podacium\\n- GitHub: https://github.com/podacium",
        },
    },
]


def match_offline_faq(query: str, locale: str = "fr") -> Optional[Dict[str, str]]:
    """Matches a query against offline FAQ rules when Gemini API is unavailable."""
    q_lower = query.lower()
    for rule in OFFLINE_FAQ_RULES:
        keywords = cast(List[str], rule.get("keywords", []))
        if any(keyword in q_lower for keyword in keywords):
            target_lang = locale if locale in ("fr", "ar", "en") else "fr"
            answers = cast(Dict[str, str], rule.get("answers", {}))
            answer_text = answers.get(target_lang, answers.get("fr", ""))
            return {
                "reply": answer_text,
                "category": str(rule.get("category", "GENERAL")),
            }
    return None
