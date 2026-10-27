# Phase 3: AI Agents

**Duration:** Weeks 9–12  
**Target Score:** 90/100 tech, 80/100 launch readiness  
**Dependencies:** Phase 1 (AI infrastructure: provider, registry, conversation store, cost tracker)

---

## Overview

Phase 3 builds 6 AI agents on the infrastructure from Phase 1. Each agent is a subclass of `BaseAgent`, registered in the `AgentRegistry`, feature-flag gated, cost-tracked, and available via the AI agent router (`/api/v1/ai/chat/{agent_name}` and `/api/v1/ai/ws/{agent_name}`).

### Why These Six Agents

| Agent | Student Facing | Instructor Facing | System Facing | Differentiation |
|-------|---------------|-------------------|---------------|----------------|
| **Teaching Assistant** | ✅ 24/7 Q&A | — | — | No MENA LMS has an Arabic-speaking AI tutor |
| **Content Generator** | — | ✅ Quiz/summary creation | — | Reduces instructor content creation time by 80% |
| **Adaptive Learning** | ✅ Personalized paths | ✅ At-risk alerts | ✅ Daily batch job | Keeps students engaged, reduces dropout |
| **Proctoring** | ✅ Exam monitoring | ✅ Suspicious flags | — | Enables secure online exams (hard requirement for MENA universities) |
| **Career Advisor** | ✅ Skill→job mapping | — | ✅ Cross-pillar flywheel | Bridges education and freelancing (unique to Podacium) |
| **Content Moderation** | — | — | ✅ Review screening | Replaces manual review with AI screening |

### Architecture Decisions Register

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Agent architecture** | Single `BaseAgent` with `system_prompt()` override | Consistent interface. Each agent only implements its prompt and context needs. |
| **Streaming** | WebSocket (existing infrastructure) | Reuse `websocket.py` auth, pub/sub scaling, and reconnection logic. |
| **Model selection** | Claude Sonnet 4 for complex, Haiku 3.5 for simple | Cost optimization: complex reasoning (tutor, grading) uses Sonnet; simple tasks (moderation, classification) use Haiku. |
| **Multilingual** | Single agent per language (system prompt in target language) | Avoid fragmentation. Claude is natively multilingual — one prompt handles Arabic, French, English. |
| **Student context** | `ContextBuilder.build_student_context()` | Consistent context across all agents. Each agent uses the subset it needs. |
| **Safety** | Content moderation agent reviews ALL AI outputs | Defense in depth. AI output is never shown to students without passing moderation checks. |

---

## Section 1: Teaching Assistant Agent ("Lina")

### 1.1 Purpose

24/7 AI tutor that answers student questions about course content. Lives on every course page. Students ask questions in Arabic, French, or English — the agent responds in the same language.

### 1.2 Trigger Points

| Trigger | Location | Implementation |
|---------|----------|----------------|
| **Question button on lesson page** | Bottom-right corner of VideoPlayer and lesson content | Floating action button → opens chat panel |
| **Auto-suggested after quiz failure** | QuizEngine "You scored 40%. Would you like help?" | Post-quiz result modal → opens chat pre-filled with "Explain [question]" |
| **Direct chat from dashboard** | `/learn` page → "Ask Lina" CTA | Redirects to `/learn/chat` with context of current course |

### 1.3 System Prompt Structure

The system prompt dynamically includes:
- Student's current context: enrolled courses, completed lessons, last quiz score
- Course context: current module title, lesson title, relevant content
- Behavioral instructions: "Never give away answers directly. Guide the student to discover the answer."
- Language instruction: "Respond in the student's locale (Arabic/French/English)."

**Context injected by `ContextBuilder`:**
```json
{
  "enrolled_courses": ["Biology 101"],
  "current_course": "Biology 101",
  "current_lesson": "Cell Division: Mitosis",
  "last_quiz_score": 65,
  "completed_lessons": ["Cell Structure", "DNA Basics"],
  "locale": "ar",
  "student_name": "Ahmed"
}
```

### 1.4 Conversation Flow

```
1. Student: "Explain mitosis in simple words"
2. Agent receives message + context from ContextBuilder
3. Builds system prompt with course context, locale, student progress
4. Retrieves conversation history from Redis (last 20 messages)
5. Calls ClaudeProvider.chat() with system + history + user message
6. Stores conversation exchange in Redis
7. Logs cost to AiLog table
8. Returns response to frontend
```

### 1.5 Guardrails

| Constraint | Implementation |
|------------|---------------|
| **No answer cheating** | System prompt: "Guide, don't give answers. Ask probing questions." |
| **Toxicity filter** | All responses pass through content moderation agent before display |
| **Topic boundaries** | Agent only answers questions related to enrolled courses. Off-topic: "I'm here to help with your course. Ask me about [course topic]." |
| **Rate limiting** | Max 50 requests per user per day. Enforced by checking AiLog table. |

### 1.6 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student asks in Arabic, course is in English** | Respond in Arabic but reference English terms. Claude handles code-switching. |
| **Student asks "what's the answer to question 3"** | Refuse: "I can explain the concept, but the answer is for you to discover." |
| **Student is very confused, asks 10+ questions** | After 15 exchanges: "This seems complex. Would you like me to connect you with your instructor?" → notification sent to instructor. |
| **Claude gives wrong information** | Future enhancement: RAG layer retrieves course content to ground answers in course material. |
| **Student asks off-topic** | "I'm specialized in [course name]. For other questions, try our help center." → link to support tickets. |

---

## Section 2: Content Generator Agent ("Mouallif")

### 2.1 Purpose

Helps instructors create course content faster. Generates quiz questions, lesson summaries, learning objectives, and key takeaways from existing course material.

### 2.2 Trigger Points

| Trigger | Location | Implementation |
|---------|----------|----------------|
| **"Generate Quiz" button** | Admin lesson editor | Instructor clicks → agent generates 5 MCQ questions from lesson content |
| **"Summarize" button** | Admin lesson editor | Agent generates 3-sentence summary + bullet-point key takeaways |
| **"Generate Objectives" button** | Admin module editor | Agent generates 4–6 learning objectives from module description |

### 2.3 What It Generates

| Output Type | Input | Output Format | Quality Check |
|-------------|-------|---------------|---------------|
| **MCQ questions** | Lesson content (title, description, transcript) | Array of {question, options (4), correctIndex, explanation} | Each question verified to have exactly one correct answer |
| **True/False questions** | Lesson content | Array of {statement, isTrue, explanation} | Statements must be unambiguously true or false |
| **Fill-in-blank** | Lesson content | Array of {sentence, blankAnswer, context} | Blank must be a key term from the lesson |
| **Lesson summary** | Full lesson content | 3-sentence summary + 5 bullet takeaways | Summary must not exceed 100 words |
| **Learning objectives** | Module description | 4–6 objectives in "By the end of this module, you will be able to..." format | Each objective must be measurable |

### 2.4 Example Prompt Template (for MCQ generation)

```
You are a course content specialist for Podacium, an EdTech platform.
Generate {count} multiple-choice questions based on the following lesson content.

Lesson title: {title}
Lesson content: {content}

For each question:
- Question text must be clear and unambiguous
- Provide 4 options (one correct, three plausible distractors)
- Mark the correct option index
- Provide a brief explanation of why the correct answer is right

Return as JSON array: [{question, options: [...], correctIndex, explanation}]
```

### 2.5 Review Workflow

Generated content is NEVER published automatically. It follows this workflow:
1. Agent generates content
2. Content is stored as "draft" (linked to the lesson/module via `AiGeneratedContent` table — new model)
3. Instructor sees a yellow banner: "AI-generated content ready for review"
4. Instructor edits, approves, or discards
5. Only after approval does content appear for students

### 2.6 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Lesson content is too short (< 50 words)** | Refuse: "Not enough content to generate meaningful questions. Add more lesson content first." |
| **Generated questions are too easy/hard** | Instructor can regenerate with "harder/easier" parameter |
| **Distractors are implausible** | Agent is prompted to make distractors "plausible but incorrect" |
| **Instructor wants specific question types** | Pass `question_types: ["MCQ", "TRUE_FALSE"]` parameter |

---

## Section 3: Adaptive Learning Agent ("Tariq")

### 3.1 Purpose

Personalizes each student's learning experience by analyzing their performance and adjusting recommendations. Runs as a daily batch job and triggers real-time interventions.

### 3.2 Batch Job: Daily at 2 AM

Celery beat task that processes all active students:

```
For each active student:
  1. Fetch: enrolled courses, lesson completions, quiz attempts (last 30 days)
  2. Calculate metrics:
     - engagement_score = lessons_completed / expected_lessons (based on enrollment duration)
     - quiz_avg = average of last 5 quiz scores
     - streak_days = consecutive days with activity
     - velocity = lessons completed per week
  3. Determine action:
     - Low engagement (< 0.3) → "at risk" → push notification to re-engage
     - Quiz avg < 60% in a module → "struggling" → recommend reviewing specific lessons
     - High velocity + high quiz avg → "accelerating" → recommend next module
     - Streak broken (> 7 days inactive) → "churned" → email re-engagement campaign
  4. Store recommendations in database (new `StudentRecommendation` model)
  5. Push notifications via existing notification_service
```

### 3.3 Real-Time Interventions

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Quiz failure** | Score < 50% | Auto-suggest: "Want Lina to explain these concepts?" |
| **Module completion** | 100% progress | Suggest next module in learning path |
| **7 days inactive** | No activity | Push notification: "Your courses miss you! Continue where you left off." |
| **Streak milestone** | 7, 30, 100 day streaks | Celebration notification + badge |

### 3.4 Database Model

New Prisma model: **`StudentRecommendation`**
- `userId` → User
- `moduleId` (string?) — related course (if applicable)
- `type` — enum: at_risk | struggling | accelerating | re_engage | next_step | celebration
- `priority` — int (1–5)
- `title`, `description`, `actionUrl` — frontend display info
- `generatedAt`, `expiresAt` — auto-purge after 7 days
- `dismissedAt` (datetime?) — student dismissed it
- Indexes: `[userId, generatedAt]`, `[userId, type]`

### 3.5 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student has no quiz attempts yet** | Base recommendations on engagement (lesson completion) only |
| **Student is enrolled in multiple courses** | Analyze per-course, recommend based on worst-performing course |
| **New student (enrolled today)** | Skip recommendations for first 3 days (insufficient data) |
| **All metrics are perfect** | Recommend next level / advanced course in same category |
| **Student opts out** | Feature flag check: if `enable_ai_adaptive_learning` is off per user, skip |

---

## Section 4: Proctoring Agent ("Raqib")

### 4.1 Purpose

Ensures academic integrity during online exams. Runs entirely in-browser for privacy. Flags suspicious behavior for human review.

### 4.2 Architecture

**Client-side (in-browser):**
- Tab switch detection: `document.visibilitychange` event → log timestamps
- Fullscreen enforcement: `fullscreenchange` event → warn/exit if violated
- Copy/paste prevention on quiz page
- Face detection (optional, requires camera permission): MediaPipe FaceMesh → detect if face leaves frame, multiple faces

**Server-side (Flask/FastAPI endpoint):**
- Collects event stream during quiz attempt
- After quiz submission, agent reviews the event log and generates a risk score
- Flags are surfaced on instructor dashboard

### 4.3 Proctoring Event Log

Events collected during quiz attempt (stored in new `ProctoringEvent` model):
- `attemptId` → QuizAttempt
- `eventType` — enum: tab_switch, fullscreen_exit, face_left, multiple_faces, copy_attempt, paste_attempt
- `timestamp` — when it happened
- `duration` (ms) — how long the violation lasted
- `metadata` (JSON) — additional context (e.g., URL of tab switched to, if available)

### 4.4 AI Review After Submission

When quiz is submitted, trigger the proctoring agent (Celery task):
```
1. Collect all ProctoringEvent records for this attempt
2. Build summary: {tab_switch_count, total_duration_out_of_focus, face_left_count, ...}
3. Prompt Claude: "Review this proctoring log and return a risk score (0-100) and brief explanation"
4. Store risk score on QuizAttempt record
5. If risk score > 70, notify instructor
```

### 4.5 Privacy & Consent

- Camera-based detection is opt-in only
- Students see: "This exam is proctored. Tab switching and fullscreen exit are monitored."
- No video/audio recording — only event timestamps are stored
- Data is deleted after 90 days (existing data privacy service)

### 4.6 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student has multiple monitors** | Single monitor detection: treat as normal. Multiple monitors not penalized. |
| **Power outage during exam** | Auto-save answers every 30 seconds. Re-instate attempt on reconnection. |
| **Camera permission denied** | Run without camera (tab-switch monitoring only). No penalty for opting out. |
| **Student uses phone to look up answers** | Cannot detect this reliably with browser-only proctoring. Flag for instructor review if score is anomalously high. |
| **False positive (legit tab switch to calculator)** | Student can request manual review. Existing support ticket system handles this. |

---

## Section 5: Career Advisor Agent ("Mustaqbal")

### 5.1 Purpose

Connects education outcomes to career opportunities. Maps completed courses to marketable skills and matches students with freelancing projects on the platform.

### 5.2 Trigger Points

| Trigger | Timing | Action |
|---------|--------|--------|
| **Course completion** | When student completes a course | Generate skill report: skills gained, suggested next courses, matching freelance projects |
| **Dashboard visit** | Student visits `/dashboard` | Show "Career Path" section: your skills, market demand, recommended next steps |
| **Profile completion** | Student fills skills/interests in profile | Generate personalized learning path |
| **Periodic** | Weekly batch | For students with 3+ completed courses: skill portfolio PDF with certifications |

### 5.3 Skill Matching Logic

```
1. Extract skills from completed courses (course.skills field already exists)
2. Query freelancing_projects table for projects requiring those skills
3. Score each match: (skills_overlap / project_required_skills) * 100
4. Return top 5 matches with application links
```

### 5.4 Cross-Pillar Flywheel

This agent is unique because it connects two existing pillars:

```
Education ──────────► Freelancing
  │                       │
  │ Skills earned         │ Projects needing skills
  │ Certificates          │ Client ratings
  │                       │
  └───────────► Career Advisor ◄─────────┘
                      │
                      ▼
         Student gets job → more trust → more enrollments
         → more freelancers → better marketplace → revenue
```

### 5.5 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student has no completed courses** | Show "Start learning to unlock career insights" CTA → link to course catalog |
| **No matching freelance projects** | Show trending skills in their region (MENA job market data) |
| **Student is not a freelancer** | Still show career insights. Prompt: "Want to earn with your skills? Join our marketplace." |
| **Skills are too generic** | Suggest specialization courses to differentiate |

---

## Section 6: Content Moderation Agent

### 6.1 Purpose

Extends the existing manual content moderation workflow (`content_moderation_service.py`) with AI-powered pre-screening. Reviews course content, reviews, and AI agent outputs for quality and safety.

### 6.2 Integration with Existing Workflow

The existing `content_moderation_service.py` implements a state machine:
```
DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED
```

The AI agent hooks into the `submit_for_review()` step:
```
1. Instructor submits module for review (DRAFT → IN_REVIEW)
2. AI agent runs automatically (Celery task, async)
3. Agent scores: quality (0-100), safety (pass/fail), completeness (0-100)
4. If quality < 50 or safety = fail: auto-reject with AI-generated feedback
5. If quality >= 50 and safety = pass: flag for human review (admin sees AI summary)
```

### 6.3 What It Reviews

| Content Type | Checks | Action on Failure |
|-------------|--------|-------------------|
| **Module content** | Quality (spelling, structure, completeness), safety (hate speech, explicit content), plagiarism | Auto-reject with feedback or flag for human review |
| **Lesson content** | Same as module, plus: video description match, quiz correctness | Flag specific lesson to instructor |
| **Course reviews** | Toxicity, spam, off-topic | Auto-hide flagged reviews, notify admin |
| **AI agent outputs** | Safety check on ALL AI responses before showing to students | Block response, log incident, alert admin |
| **Student submissions** | Plagiarism check (compare against existing submissions + web) | Flag for instructor review |

### 6.4 Review Scores

```
{
  "quality_score": 85,        // 0-100: grammar, structure, clarity
  "safety_score": 100,        // 0-100: no harmful content
  "completeness_score": 70,   // 0-100: has all required fields
  "plagiarism_score": 5,      // 0-100: % similarity with existing content
  "issues": [                  // Specific items to fix
    {"field": "description", "issue": "Too short (12 words, minimum 30)"},
    {"field": "thumbnail", "issue": "Missing thumbnail image"}
  ],
  "recommendation": "approve"  // approve | flag | reject
}
```

### 6.5 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Content is in Arabic, model misinterprets** | Claude has strong Arabic support. Include `lang: "ar"` in system prompt for better accuracy. |
| **False positive on safety (e.g., medical terminology)** | Human reviewer overrides. AI learns from corrections? (Future: fine-tuning) |
| **Plagiarism check matches student's own previous work** | Ignore self-matches. Only flag matches against other students' work or external sources. |
| **Instructor contests AI rejection** | Appeal via existing support ticket system. Admin manually reviews. |

---

## Section 7: Moderation Pipeline Depth

The moderation pipeline runs on EVERY AI output before it reaches a student. Single-pass moderation is insufficient for an EdTech platform serving minors.

### 7.1 Three-Layer Pipeline

```
AI Output → L1: Pattern Filter (regex, zero ML cost)
         → L2: Toxicity Classifier (Haiku 3.5, <500ms, ~$0.001)
         → L3: Course Relevance Check (Haiku 3.5, <500ms, ~$0.001)
         → Decision: BLOCKED | FLAGGED | APPROVED
```

**L1 — Pattern Filter (server-side, no API cost):**
```
Blocked patterns:
  - Phone numbers: \+?[0-9]{7,15}
  - Email addresses: [\w.]+@[\w.]+
  - URLs: https?://\S+
  - Credit card patterns: \d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}
  
Action: STRIP the matched content, replace with [REDACTED]. Log incident to AiLog.
Rationale: LLMs sometimes fabricate contact information. This has legal liability (GDPR Art. 32).
```

**L2 — Toxicity Classifier:**
Prompt: "Analyze this text for: hate speech, harassment, explicit content, self-harm. Return only: {toxic: bool, categories: [], confidence: 0-1}" (Haiku 3.5, max_tokens=20, temperature=0). Cost: ~$0.001/check.

**L3 — Course Relevance Check:**
Prompt: "Does this answer directly address the student's question about [course topic]? Return only: {relevant: bool, confidence: 0-1}" (Haiku 3.5, max_tokens=10). Prevents off-topic AI responses.

### 7.2 Decision Matrix

| L1 | L2 | L3 | Action | User sees |
|----|----|----|--------|-----------|
| ✅ | ✅ | ✅ | APPROVED | Normal response |
| ✅ | ✅ | ❌ | FLAGGED | Response shown + admin notified. Student sees yellow "AI may have gone off-topic" |
| ✅ | ❌ | — | BLOCKED | Response hidden. "AI response unavailable" (generic). Log incident. |
| ❌ | — | — | BLOCKED | Same as above. Log incident with PII attempt. |

---

## Section 8: Agent-Server Integration Architecture

### 8.1 Communication Patterns

| Pattern | Use Case | Protocol | Latency |
|---------|----------|----------|---------|
| **Request-response** | Content generation, moderation, career advisor | REST POST `/ai/{agent}` | 2-10s |
| **Streaming** | Teaching Assistant chat | WebSocket `/ai/ws/{agent}` | 100ms first token |
| **Batch/Celery** | Adaptive learning, proctoring review | Celery task | 1-60 min |
| **Webhook** | Proctoring event ingestion | POST `/ai/webhooks/proctoring` | <100ms |

### 8.2 Session Architecture (Teaching Assistant)

```
Client                    Backend                    Claude API
  │                         │                          │
  │── POST /ai/ws/tutor ───→│  (upgrade to WebSocket)  │
  │←── ws_url + token ─────│                          │
  │══════ WebSocket ═══════▶│                          │
  │── {text: "Explain..."} →│                          │
  │                         │── Intent classifier ────→│ (L1, Haiku)
  │                         │←── "course" ────────────│
  │                         │── Cache lookup ─────────│ (Redis)
  │                         │←── miss ───────────────│
  │                         │── Retrieve context ─────│ (pgvector)
  │                         │←── 3 chunks ───────────│
  │                         │── Tutor prompt ─────────→│ (Sonnet 4)
  │←── stream: chunk 1 ────│←── stream ──────────────│
  │←── stream: chunk 2 ────│←── stream ──────────────│
  │←── stream: ... ────────│←── stream ──────────────│
  │                         │── Moderation pipeline ──│ (L1→L2→L3)
  │                         │── Cache response ──────│ (Redis)
  │                         │── Cost log ────────────│ (AiLog)
  │                         │── Store conversation ──│ (Redis)
```

---

## Phase 3 Success Criteria

- [ ] Teaching Assistant agent registered and responding in Arabic/French/English
- [ ] Content Generator agent producing MCQ, summaries, learning objectives (instructor reviewed)
- [ ] Adaptive Learning agent running daily batch job with personalized recommendations
- [ ] Proctoring agent collecting events and generating risk scores post-quiz
- [ ] Career Advisor agent matching completed courses to freelance projects
- [ ] Content Moderation agent hooking into existing `submit_for_review` workflow
- [ ] All agents feature-flag gated (default: disabled)
- [ ] All agents cost-tracked via AiLog table
- [ ] Daily budget cap enforced ($50/day default)
- [ ] Prometheus metrics visible for each agent
- [ ] WebSocket streaming working for Teaching Assistant agent
- [ ] Semantic caching operational with >40% hit rate
- [ ] L1/L2/L3 tier routing operational (no Sonnet calls for simple queries)
- [ ] Graceful degradation verified (simulate Claude outage, verify fallback)
- [ ] Content moderation pipeline blocking PII, toxicity, off-topic responses
- [ ] Arabic/French token normalization verified on cache hit rate
- [ ] Algeria Law 18-07 consent flow working (opt-in, minor blocking, data deletion)
- [ ] Existing content moderation tests extended for AI workflow
- [ ] No regressions in existing education endpoints or tests

---

## Cost Estimation at Scale (Revised)

With hybrid tier routing + semantic caching + Arabic token adjustment:

| Agent | Model Mix | Effective Cost/Req | Daily Volume | Daily Cost |
|-------|-----------|-------------------|--------------|------------|
| **Teaching Assistant** | L1: free + L2: Haiku 60% cache hit + L3: Sonnet 20% | ~$0.005 | 50,000 | ~$250 |
| **Content Generator** | Sonnet 4 (always) | ~$0.05 | 500 | ~$25 |
| **Adaptive Learning** | Batch (free calc) | $0 | 1 batch | $0 |
| **Proctoring** | Haiku 3.5 | ~$0.003 | 2,000 | ~$6 |
| **Career Advisor** | Haiku 3.5 | ~$0.005 | 1,000 | ~$5 |
| **Moderation Agent** | L1 free + L2/L3 Haiku | ~$0.001 | 25,000 (all AI outputs) | ~$25 |

**Total estimated daily cost at 500k MAU (English):** ~$311/day (~$9,330/month)
**Total estimated daily cost at 500k MAU (Arabic-heavy, 1.8x token factor):** ~$560/day (~$16,800/month)

vs original estimate of $31,530/month. The hybrid + cache architecture saves ~47-70% on AI costs.

**Optimization strategies (in order of impact):**
1. Semantic caching (40-60% hit rate → saves ~$400-600/day)
2. L1/L2 tier routing (filters 30% of queries before Sonnet → saves ~$150-300/day)
3. Arabic diacritic normalization (prevents cache misses from tashkeel variation → saves ~$50-100/day)
4. Per-agent rate limiting (prevents abuse → saves variable)
5. Batch non-urgent tasks via Celery (zero marginal cost)

---

## Algeria Law 18-07 Compliance — AI Agents

| Requirement | Implementation |
|-------------|---------------|
| **Consent for AI processing** (Art. 7) | Explicit opt-in toggle per AI feature. Recorded in `UserPreference` table with timestamp. Revocable at any time. |
| **Data minimization** (Art. 5) | Student query text is NEVER stored in AiLog (only metadata: userId, agent, cost, latency). Query text stored only in ephemeral Redis (TTL 24h) for conversation continuity. |
| **Right to explanation** (Art. 12) | Every AI response includes a "Why this?" tooltip showing which course content the response was based on (the retrieved chunks). |
| **Automated decision transparency** (Art. 13) | Adaptive Learning recommendations include a human-readable reason: "Based on your quiz score of 65% in Module 3, we recommend reviewing lessons 3.2-3.4." |
| **Minor protection** (Art. 87 Family Code) | AI features disabled for users under 18 without verified parental consent (uploaded consent form + admin verification). |
| **Data portability** (Art. 23) | Export all AI interactions as JSON: `GET /ai/export` → AiLog records + cached conversation history for that user. |
| **ARPDP registration** (Art. 18) | Maintain a processing register document (separate from code) listing: purpose (AI tutoring), categories of data (user ID, course content), retention period (90 days), cross-border transfer (none — Claude API receives pseudonymized data). |
