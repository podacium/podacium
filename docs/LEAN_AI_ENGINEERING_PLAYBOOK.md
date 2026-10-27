# Podacium — Lean AI Engineering Playbook
**Version 2.0 · July 2026 · Author: Ahmed MERHAB (CDO/DPO)**
**Reviewed by: Zakarya ROUBHI (CTO)**

> *"RAG for facts that change. Fine-tune for behavior that doesn't. Skip everything else until users demand it."*

This playbook governs all AI/ML decisions at Podacium from September 2026 through November 2026 and sets the architectural direction through January 2027. It is written for a team of one part-time AI engineer (Ahmed) with near-zero compute budget and a hard September 23 launch date. Every decision has a number, a cost, and an anti-recommendation. Nothing in this document is aspirational — every recommendation is grounded in cited 2024–2026 research and constrained by Podacium's actual resources.

**Hard constraints this document respects:**
- Ahmed: ~10–15 hrs/week available for AI work (part-time CDO/DPO role)
- Compute budget: $0–$50/month hard cap for September–November 2026
- Infrastructure: AWS free tier + Google Colab free tier + existing PostgreSQL
- Launch date: September 23, 2026 — AI features must not block platform launch
- Legal: ANPDP Law 25-11 compliance required before any user data is collected for training

---

## TABLE OF CONTENTS

1. [RAG vs Fine-Tuning: The 2026 Decision Matrix](#1-rag-vs-fine-tuning-the-2026-decision-matrix)
2. [Minimum Viable Training Data](#2-minimum-viable-training-data)
3. [Zero-Cost Fine-Tuning Stack](#3-zero-cost-fine-tuning-stack)
4. [Multi-Agent Architecture on a Budget](#4-multi-agent-architecture-on-a-budget)
5. [Evaluation Without Enterprise Budget](#5-evaluation-without-enterprise-budget)
6. [The Enforcement Ladder](#6-the-enforcement-ladder)
7. [Cost Optimization: Squeezing Every Token](#7-cost-optimization-squeezing-every-token)
8. [The Darja/Arabic Language Layer](#8-the-darjaarabic-language-layer)
9. [90-Day AI Roadmap: August–October 2026](#9-90-day-ai-roadmap-augustoctober-2026)
10. [The Anti-Roadmap: What NOT to Build](#10-the-anti-roadmap-what-not-to-build)

---

## 1. RAG vs Fine-Tuning: The 2026 Decision Matrix

### 1.1 The Governing Principle

The 2026 consensus across [FutureAGI](https://futureagi.com/blog/rag-vs-fine-tuning-decision-framework-2026/), [MarsDevs](https://www.marsdevs.com/compare/rag-vs-fine-tuning), and [Redwerk](https://redwerk.com/blog/fine-tuning-vs-rag-decision-framework/) is unified and precise:

> **RAG solves the knowledge problem. Fine-tuning solves the behavior problem. Most startups need RAG first and fine-tuning second — if at all.**

These are two orthogonal interventions. Fine-tuning does not give a model new knowledge — it changes *how the model responds*: its tone, format, task adherence, and domain vocabulary. RAG gives the model access to facts it was never trained on, retrieved at inference time from a live index. Conflating these two leads to the single most expensive failure mode in applied AI: [Gartner 2025 AI Implementation Survey](https://meek.media/blog/rag-vs-fine-tuning) found that **42% of enterprise AI project failures** trace back to selecting the wrong technical approach.

The second principle: exhaust the prompt engineering hierarchy first. Fine-tuning is expensive in time, not just money. Before any fine-tune, run this ladder in order:

```
Level 1 — Zero-shot with a detailed system prompt encoding Algerian context
Level 2 — Few-shot (3–5 examples embedded in the prompt)
Level 3 — Chain-of-thought prompting ("Think step by step...")
Level 4 — RAG + few-shot (dynamic context injection)
Level 5 — Fine-tuning (only when Levels 1–4 are demonstrably insufficient)
```

[Rubrik's 2024 study](https://www.rubrik.com/blog/ai/24/how-to-generate-synthetic-data-and-fine-tune-a-slm-that-beats-gpt-4o) demonstrated that even 10 real examples plus synthetic augmentation outperformed 10-shot GPT-4o on a grounded task. You may not need fine-tuning as early as you think.

### 1.2 Decision Matrix: Five Questions

Apply these five questions to any new AI feature before writing a single line of training code:

| Question | RAG Signal | Fine-Tune Signal | Hybrid Signal |
|----------|-----------|-----------------|---------------|
| **Knowledge volatility** — How often does the source data change? | High: changes weekly or monthly (course catalog, gig prices, market data) | Low: stable for 6+ months (contract templates, platform rules) | Medium: some components change, others don't |
| **Behavior specificity** — Do you need a custom style, tone, or output format the base model doesn't naturally produce? | No — generic quality responses are sufficient | Yes — Darja dialect register, Algerian DZD contract language, structured JSON output with local business logic | Partially — some behavioral adjustment needed alongside fresh data |
| **Query volume at launch** — How many inferences per day? | < 1,000/day: RAG is cheaper on API costs | > 10,000/day: fine-tune reduces per-token cost significantly | Depends on component split |
| **Latency budget** — What is the acceptable p95 response time? | < 2,000ms: RAG adds 150–400ms for vector lookup + reranking overhead | < 500ms hard requirement: fine-tune eliminates retrieval step entirely | Context-dependent |
| **Audit need** — Must outputs be traceable to a specific source document? | Yes — RAG provides native citation support (retrieved chunks are logged) | No — behavioral change only; no source citation required | Partially — some outputs need citation, others don't |

### 1.3 Per-Pillar Decision

| Pillar | Decision | Rationale | Start Date |
|--------|----------|-----------|------------|
| **EdTech** | **RAG-first** | Course content, quiz questions, and learning path recommendations change with every new course published (high volatility). The base model needs access to Podacium's live course catalog, not behavioral retraining. A pgvector store of course descriptions + lesson summaries handles this at zero extra infrastructure cost. At <500 daily AI queries in September 2026, retrieval costs are negligible. Hybrid BM25+vector search improves recall by 25–40% over pure vector search — worthwhile given the short catalog size. | September 23 |
| **Freelancing** | **Fine-tuning (August 2026)** | The proposal generator and contract drafting assistant require a highly specific *behavioral output*: DZD-denominated contract language, Algerian labor law boilerplate, and Darja-inflected project scoping questions. No base model produces this naturally. Data volatility is low — contract templates change quarterly, not daily. Volume at launch is low enough that a self-hosted fine-tuned Qwen3-4B (zero inference cost) beats the API cost of repeated few-shot prompting within 2 months. This is the textbook fine-tuning use case. | August 31 |
| **BI** | **Hybrid (December 2026)** | Two distinct sub-problems requiring different solutions simultaneously: (1) Algerian SME terminology, sector-specific insight language, and Carnet/Kridi informal credit vocabulary → fine-tuning on Algerian business vocabulary; (2) real-time dashboard data interpretation and anomaly explanation → RAG over the user's own uploaded dataset. Neither alone is sufficient. **Do not build this before December 2026** — BI monetization does not start until then per the business plan, and the data density required for meaningful insights is not available at launch. | December 2026 |

### 1.4 RAG Architecture: What to Actually Build

Podacium's RAG stack uses the existing PostgreSQL instance with the pgvector extension — no new infrastructure required. This is the highest-leverage AI infrastructure decision at launch.

```
INGESTION PIPELINE (runs once per content change):
  New course/lesson published
    → Extract text from content fields
    → Chunk into 400–600 token windows with 15% overlap  ← single biggest quality lever
    → Embed via text-embedding-3-small ($0.02/1M tokens)
    → Store vectors in pgvector table with metadata (course_id, pillar, language)
    → Build HNSW index (5× faster than ivfflat at p95 recall = 0.95)

QUERY PIPELINE (runs per user request):
  User query
    → Embed query (same model as ingestion)
    → Hybrid search: semantic (pgvector cosine) + keyword (PostgreSQL tsvector BM25)
    → Reciprocal Rank Fusion (RRF) to merge both result lists
    → Return top-K=5 chunks
    → Inject into LLM context with Claude Haiku
    → Validate output with grounding check (Constraint 4 in Section 6)
    → Return to user
```

**Why hybrid retrieval matters:** Pure vector search silently fails on exact matches (course codes, instructor names, specific DZD amounts). BM25 keyword search fails on semantic paraphrases. Combining both via RRF improves recall by 25–40% with no added infrastructure cost — it is all inside PostgreSQL ([markaicode.com, 2026](https://markaicode.com/architecture/hybrid-retrieval-architecture-with-postgres/)).

**Chunking rule:** 400–600 tokens with 15% overlap. This is the single biggest lever on retrieval quality ([jusdb.com, 2026](https://www.jusdb.com/blog/rag-pipelines-postgresql-pgvector)). Shorter chunks lose context; longer chunks dilute relevance.

**Production RAG targets (from [marsdevs.com, 2026](https://www.marsdevs.com/guides/agentic-rag-2026-guide)):**
- Faithfulness ≥ 0.90 (every claim supported by retrieved context)
- Answer relevancy ≥ 0.85
- Context precision ≥ 0.80
- p95 latency ≤ 500ms for retrieval step alone

```python
# Minimal pgvector hybrid search implementation for Podacium
from pgvector.psycopg2 import register_vector
from openai import OpenAI

def hybrid_search(query: str, k: int = 5) -> list[dict]:
    """
    Combines semantic (pgvector) + keyword (tsvector) search via RRF.
    Returns top-k chunks ranked by fused score.
    No new infrastructure — runs on existing PostgreSQL.
    """
    query_embedding = embed(query)  # text-embedding-3-small

    sql = """
    WITH semantic AS (
        SELECT id, content, course_id, language,
               1 - (embedding <=> %s::vector) AS sem_score,
               ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) AS sem_rank
        FROM course_chunks
        ORDER BY embedding <=> %s::vector
        LIMIT 50
    ),
    keyword AS (
        SELECT id, content, course_id, language,
               ts_rank(to_tsvector('arabic', content), plainto_tsquery('arabic', %s)) AS kw_score,
               ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('arabic', content),
                                  plainto_tsquery('arabic', %s)) DESC) AS kw_rank
        FROM course_chunks
        WHERE to_tsvector('arabic', content) @@ plainto_tsquery('arabic', %s)
        LIMIT 50
    ),
    -- Reciprocal Rank Fusion: 1/(k + rank), k=60 standard
    rrf AS (
        SELECT COALESCE(s.id, kw.id) AS id,
               COALESCE(s.content, kw.content) AS content,
               COALESCE(1.0/(60 + s.sem_rank), 0) +
               COALESCE(1.0/(60 + kw.kw_rank), 0) AS rrf_score
        FROM semantic s FULL OUTER JOIN keyword kw ON s.id = kw.id
    )
    SELECT id, content FROM rrf ORDER BY rrf_score DESC LIMIT %s;
    """
    return execute_query(sql, [query_embedding]*3 + [query]*3 + [k])
```


---

## 2. Minimum Viable Training Data

### 2.1 The Research Landscape (2024–2026)

The minimum viable training data question has a precise answer in 2026, and it is far smaller than most engineers expect:

| Research Finding | Number | Source |
|-----------------|--------|--------|
| Minimum to *activate* pre-trained QA capability via SFT | **60 examples** | [arXiv 2409.15825](https://arxiv.org/html/2409.15825v2) |
| Practical task-specific SFT floor (matched GPT-4o on target task) | **250 examples** | [HuggingFace, Gemma-3 27B ablations, June 2025](https://huggingface.co/blog/tawnymanticore/gemma3-ablations) |
| Darja/Maghrebi dialect improvement via LoRA on small model | **~5,000 mixed instructions** → +14.7% on DarijaMMLU | [arXiv 2505.17082, GemMaroc, May 2025](https://arxiv.org/html/2505.17082v1) |
| Data quality threshold: % incorrect data before degradation begins | **10–25% bad data** causes measurable performance degradation | [arXiv 2509.19325](https://arxiv.org/html/2509.19325v1) |
| Synthetic data generation speed (GPT-4o) | **200 examples in <60 seconds** at ~$0.30 in API costs | [MarkAICode, March 2026](https://markaicode.com/fine-tune-synthetic-data-gpt4o-dataset-generation/) |
| Synthetic data quality collapse risk | Never use your own fine-tuned model to generate its own training data | [tianpan.co, April 2026](https://tianpan.co/blog/2026-04-09-synthetic-training-data-quality-collapse) |

**Key insight:** Quality beats quantity at every scale. Models trained on high-quality validated data consistently outperform models trained on larger unvalidated datasets ([arXiv 2409.16341](https://arxiv.org/html/2409.16341v2)). 850 verified examples will outperform 5,000 unreviewed synthetic ones.

### 2.2 Podacium's Dataset Strategy for the August 2026 Fine-Tune

**Target:** Freelancing proposal and contract assistant — DZD-denominated language, Algerian labor context, Darja/French register.

#### 2.2.1 Dataset Composition

| Component | Count | Source Method | Estimated Cost | Quality Gate |
|-----------|-------|---------------|----------------|--------------|
| **Real beta interactions** | 150–200 | Collected from closed freelancing beta (September 23–November 4). Real proposals submitted, contracts viewed, user questions asked. ANPDP opt-in required. | $0 | Ahmed reviews 100% of real examples |
| **Founder-authored gold examples** | 100 | Ahmed and Zakarya write 50 examples each. Focus on edge cases, Algerian regulatory language, DZD ranges (500–500,000 DZD), dispute resolution language, Ramadan seasonality context. | $0 | Both founders cross-review each other's 50 |
| **Synthetic augmentation via GPT-4o** | 600–700 | Seed with 10 gold examples → generate diverse variations via chain-of-thought seeding. Validate ALL before inclusion. Cost: 700 examples × ~800 tokens = ~560K tokens × $2.50/1M input = ~$1.40 | ~$3–$5 | 3-step validation (see below) |
| **Total verified dataset** | **850–1,000** | — | **< $5** | <5% known errors in final set |

#### 2.2.2 Synthetic Generation Protocol

Do not simply prompt GPT-4o to "generate 700 examples." Use a structured seeding approach:

```python
# Synthetic data generation — structured seeding protocol
SEED_TOPICS = [
    "Data analysis project proposal (DZD 15,000-50,000)",
    "Web development contract (DZD 20,000-80,000)",
    "Translation/localization work (Darja ↔ French)",
    "Social media management retainer (monthly DZD)",
    "Algerian business compliance consulting (post-ANPDP)",
    "AI-augmented report writing for SME client",
    "Dispute: client delays payment past agreed milestone",
    "Ramadan project timeline negotiation",
    "Wilaya-specific pricing (Oran vs Algiers rate difference)",
    "First-time freelancer onboarding questions",
]

GENERATION_PROMPT = """
You are generating training examples for a Darja/French bilingual contract assistant
operating in the Algerian freelancing market. Generate {n} diverse Q&A pairs for the
topic: "{topic}". 

Requirements:
- All monetary values in DZD (range: 500 to 10,000,000)
- Mix of Darja and French (never English unless quoting code/tools)
- Include Algerian-specific context (CNRC, ANPDP, Chargily Pay, wilaya names)
- Vary the formality level (casual inquiry to formal contract clause)
- Ensure factual accuracy about Algerian tax rates and labor law

Output format: JSONL with fields: instruction, context, response, language (ar/fr/dz)
"""
```

#### 2.2.3 The Three-Step Validation Gate

Every synthetic example must pass all three steps. Reject on any failure — do not fix and include.

```
Step 1 — Factual check (Ahmed, 15 min/batch of 50)
  □ DZD amounts are in realistic range (500–10M DZD)
  □ Referenced laws/regulations exist (CNRC, ANPDP Law 25-11, Code du travail)
  □ No hallucinated Algerian institutions or regulations
  □ Seasonal references are accurate (Ramadan timing, school year)

Step 2 — Format check (automated, 0 min)
  □ JSONL parses without error
  □ All required fields present (instruction, context, response, language)
  □ Language field matches actual detected language (langdetect check)
  □ No personally identifiable information (regex scan for phone numbers, names)

Step 3 — Fluency check (any native Darja speaker on the team, 30 min/100 examples)
  □ Darja register is natural (not Arabic translated to French and back)
  □ Business vocabulary matches Algerian SME norms
  □ Code-switching patterns are natural (Darja/French mixing follows real patterns)
```

**Hard rule: Never exceed 25% unverified examples in the final training set.** Even 10% corrupt data causes measurable degradation ([arXiv 2509.19325](https://arxiv.org/html/2509.19325v1)).

#### 2.2.4 Phase-Gated Collection Timeline

| Phase | Date | Strategy | Gate |
|-------|------|----------|------|
| **Gold authoring** | Sep 8 – Sep 22 | Ahmed + Zakarya write 100 gold examples covering the 10 seed topics above | 100 examples done before launch |
| **Beta collection** | Sep 23 – Oct 19 | Collect real interactions (ANPDP opt-in active). Anonymize before storage. | 150+ real examples collected |
| **Synthetic augmentation** | Oct 19–26 | GPT-4o generation. Three-step validation. | 700 synthetic examples validated |
| **Dataset freeze** | Oct 27 | Final dataset: 850–1,000 examples, <5% known errors, README + data card written | Ready for training run |

### 2.3 Future Dataset Growth (Q4 2026 Onwards)

The August 2026 dataset is v1 — intentionally limited. Dataset growth is continuous:

| Milestone | Date | Additional Data | Cumulative |
|-----------|------|-----------------|------------|
| First fine-tune | Aug 2026 | 850–1,000 examples | 1,000 |
| Second iteration | Oct 2026 | +500 real interactions + 300 synthetic | ~1,800 |
| BI pillar seed | Dec 2026 | 400 Algerian SME business term Q&A pairs | ~2,200 |
| Algerian Labor LLM v0.1 | Q1 2027 | Real transaction language from 500+ gigs | ~5,000 |

---

## 3. Zero-Cost Fine-Tuning Stack

### 3.1 Hardware Reality Check

| Resource | Specification | VRAM | Cost | Verdict |
|----------|--------------|------|------|---------|
| **Google Colab Free Tier** | NVIDIA T4 16 GB, ~12 hrs/session runtime | 16 GB | **$0** | ✅ Primary for training runs <90 min |
| **Google Colab Pro** | NVIDIA A100 40 GB, uninterrupted sessions | 40 GB | $10–12/month | Use only if T4 is insufficient |
| **Kaggle Free Kernels** | NVIDIA P100 16 GB, 30 hrs/week, no timeout | 16 GB | **$0** | ✅ Backup option for longer runs |
| Local machine (no GPU) | CPU only | N/A | $0 | ❌ Not viable for fine-tuning |

**Unsloth efficiency gains:** Unsloth's 2025 custom RoPE + MLP Triton kernels deliver 3–5× faster training and 30–90% less VRAM versus vanilla HuggingFace ([unsloth.ai](https://unsloth.ai/docs/blog/3x-faster-training-packing)). This is what makes Colab free tier viable for a 4B model.

### 3.2 The Full Stack

```
Base model:     Qwen3-4B-Instruct  (Apache 2.0, 119 languages, Arabic-strong)
Fine-tune lib:  Unsloth >= 2025.11  (3-5x speed, 70% less VRAM)
PEFT method:    QLoRA (4-bit base + LoRA adapters) — viable in < 10 GB VRAM
LoRA config:    rank=8, alpha=16, dropout=0.05  (see tuning guide below)
Quantization:   4-bit NF4 during training; export to GGUF Q4_K_M for deployment
Data format:    ShareGPT / ChatML  (Unsloth's preferred format)
Tracking:       Weights & Biases free tier  (100 GB, unlimited public runs)
Export:         GGUF → llama.cpp server OR Groq free tier OR HuggingFace Inference API
```

### 3.3 Why Qwen3-4B-Instruct

| Criterion | Qwen3-4B | Llama-3.2-3B | Gemma-3-4B | Why It Matters for Podacium |
|-----------|----------|--------------|------------|----------------------------|
| **Arabic / Maghrebi capability** | ✅ 119 languages; strong MSA, Maghrebi Arabic, French | ⚠️ Weak Arabic | ⚠️ Limited Arabic | Darja/French bilingual output is non-negotiable |
| **Instruction following** | ✅ RL-based alignment; dynamic thinking mode; leads open-source agent benchmarks | ✅ Good | ✅ Good | Contract drafting requires precise format adherence |
| **Agentic / tool use** | ✅ "Leading performance among open-source models in complex agent-based tasks" ([HuggingFace](https://huggingface.co/Qwen/Qwen3-4B)) | ✅ Adequate | ⚠️ Limited | Future agent integration |
| **License** | ✅ Apache 2.0 — unrestricted commercial use | ✅ Llama community license | ✅ Apache 2.0 | No licensing risk |
| **Unsloth support** | ✅ Full support, free Colab notebook, GGUF export | ✅ Full | ✅ Full | Critical for $0 training |
| **VRAM at 4-bit QLoRA** | ~7–9 GB | ~4–5 GB | ~6–8 GB | Fits comfortably in T4 16 GB |
| **Thinking mode** | ✅ Dynamic on/off — useful for complex contract reasoning | ❌ | ❌ | Can be disabled for latency-sensitive paths |

> **Note on Qwen3.5:** As of June 2026, the released model line is Qwen3. If Qwen3.5 ships before the August training run, evaluate it using the same table. Unsloth support typically follows within 2 weeks of any major Qwen release.

*Sources: [Unsloth Qwen3 guide](https://www.unsloth.ai/docs/models/tutorials/qwen3-how-to-run-and-fine-tune), [Qwen3 Technical Report arXiv 2505.09388](https://arxiv.org/html/2505.09388v1)*

### 3.4 LoRA vs QLoRA vs DoRA: The Decision

| Method | What It Does | Memory | Speed | Quality | Podacium Verdict |
|--------|-------------|--------|-------|---------|-----------------|
| **LoRA** | Low-rank adapter matrices; base model in full precision | High (full base) | Fast | Best perplexity | ❌ Needs too much VRAM for Colab free |
| **QLoRA** | 4-bit quantized base + LoRA adapters | **Low (~7–9 GB)** | 2–3× slower than LoRA | ~1–3% below LoRA on most tasks | ✅ **Podacium's choice** — best memory/quality tradeoff |
| **DoRA** | Weight-decomposed LoRA with dropout; better for noisy data | Similar to QLoRA | Similar | Slightly better on noisy data | Consider for v2 if synthetic data quality issues emerge |

*Source: [medium.com comparative study, May 2026](https://medium.com/@ali.jadalaoun/comparative-study-of-quantized-and-parameter-efficient-fine-tuning-methodabstract-7556b648fbf4)*

### 3.5 VRAM Budget and Training Time Estimates

| Configuration | VRAM Required | Training Time (1,000 examples, 3 epochs) | Colab Tier | Cost |
|---------------|--------------|------------------------------------------|------------|------|
| Qwen3-4B + QLoRA rank=8 + 4-bit | **~7–9 GB** | ~45–60 minutes on T4 | **Free** | **$0** |
| Qwen3-4B + QLoRA rank=16 + 4-bit | ~9–11 GB | ~70–90 minutes on T4 | Free | $0 |
| Qwen3-4B + QLoRA rank=32 + 4-bit | ~12–14 GB | ~100–130 minutes on T4 | Free (tight) | $0 |
| Qwen3-4B + full fine-tune (no LoRA) | ~28–32 GB | Not feasible on T4 | A100 only | $10–12/mo |

**Recommendation:** QLoRA rank=8 on Colab free tier. If eval shows insufficient quality, try rank=16 before spending on Colab Pro.

### 3.6 Training Configuration (Production-Ready)

```python
# Podacium Qwen3-4B QLoRA Fine-Tune — August 2026
# Run on Google Colab Free Tier (T4, 16 GB VRAM)

from unsloth import FastLanguageModel
from trl import SFTTrainer, TrainingArguments
from datasets import load_dataset

# ── Model loading ──────────────────────────────────────────────────────────────
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen3-4B-unsloth-bnb-4bit",  # Pre-quantized by Unsloth
    max_seq_length=2048,      # Adequate for contract Q&A (avg ~600 tokens)
    load_in_4bit=True,        # QLoRA: 4-bit base
    dtype=None,               # Auto-detect (bfloat16 on A100, float16 on T4)
)

# ── LoRA adapter configuration ─────────────────────────────────────────────────
model = FastLanguageModel.get_peft_model(
    model,
    r=8,                      # LoRA rank — start here, increase to 16 if quality insufficient
    lora_alpha=16,            # Standard: 2× rank
    lora_dropout=0.05,        # Small dropout reduces overfitting on <1K examples
    target_modules=[          # All attention + MLP projection layers
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ],
    use_gradient_checkpointing="unsloth",  # Reduces VRAM ~30%
    bias="none",
    use_rslora=False,         # Set True if rank=32+ for better stability
)

# ── Training arguments ─────────────────────────────────────────────────────────
training_args = TrainingArguments(
    output_dir="./podacium-qwen3-4b-freelance-v1",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,   # Effective batch = 8
    warmup_steps=15,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    fp16=not torch.cuda.is_bf16_supported(),
    bf16=torch.cuda.is_bf16_supported(),
    logging_steps=10,
    save_strategy="epoch",
    evaluation_strategy="epoch",     # Requires eval split in dataset
    load_best_model_at_end=True,
    report_to="wandb",               # W&B free tier logging
    run_name="podacium-freelance-v1-aug2026",
)

# ── Dataset ────────────────────────────────────────────────────────────────────
# Expected format: ShareGPT (list of conversations)
# {"conversations": [{"from": "human", "value": "..."}, {"from": "gpt", "value": "..."}]}
dataset = load_dataset("json", data_files="podacium_freelance_v1.jsonl")
dataset = dataset["train"].train_test_split(test_size=0.1, seed=42)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    dataset_text_field="text",
    max_seq_length=2048,
    packing=True,               # Unsloth smart packing: 3× faster training
    args=training_args,
)
trainer.train()
```

### 3.7 Deployment Path (Zero Inference Cost)

```
OPTION A — Self-hosted (recommended for production at <500 req/day):
  Colab training → Export GGUF Q4_K_M → EC2 t3.micro (free tier, 1 GB RAM)
  Run: llama.cpp server --model podacium-qwen3-4b.gguf --port 8080 --n-predict 512
  Cost: $0–$8/month (EC2 t3.micro or existing instance)
  Latency: ~800ms–2s for 512 tokens on CPU (acceptable for non-realtime drafting)

OPTION B — Groq free tier (zero infra, fast):
  Upload fine-tuned GGUF to Groq (if they accept custom models — verify at training time)
  Fallback: HuggingFace Inference API free tier (cold start latency ~3–5s)
  Cost: $0
  Latency: ~200–400ms (GPU inference)

OPTION C — A/B against Claude Haiku (recommended for launch):
  50% traffic → Claude Haiku 4.5 ($1/1M input, $5/1M output)
  50% traffic → Self-hosted Qwen3-4B
  Compare: user rejection rate, format compliance, latency
  Graduate winner at Aug 31 to 100% traffic
```

**Total fine-tuning cost estimate (August 2026):** $0–$15
- Synthetic data GPT-4o generation: ~$5
- Colab Pro (if T4 session timeout during training): $0–$12 for 1 month
- EC2 hosting: $0 (free tier) or $8/month existing instance

### 3.8 Pre-Deployment Checklist

```
Before deploying the fine-tuned model to ANY production traffic:

□ Perplexity on held-out eval set is lower than base model
□ Format compliance rate ≥ 95% on 100 contract-format examples
□ No DZD amount hallucinations on 50 edge-case examples (values outside 500–10M DZD range)
□ Language consistency: Darja/French register maintained in ≥ 90% of outputs
□ Zero personally identifying information generated when no PII is in the prompt
□ CI golden eval gate passes (Section 6, Constraint 5)
□ Fallback behavior tested: if model returns malformed output, Pydantic catches it
   and falls back to Claude Haiku without surfacing error to user
```


---

## 4. Multi-Agent Architecture on a Budget

### 4.1 The Sobering Production Reality

Before choosing a framework, internalize these numbers:

- **86–89% of enterprise AI agent pilots never reach production at scale** (March 2026 data, [ashutosh.dev](https://www.ashutosh.dev/the-agentic-ai-reality-check-why-86-of-multi-agent-systems-never-reach-production/))
- **95% of multi-agent pilots stall** due to three root causes: stateless handoffs, race conditions, and infinite loop drift ([medium.com, 2026](https://medium.com/@Travel4Fun4U/multi-agent-coordination-hell-the-6-patterns-that-actually-survive-production-in-2026-e22b1072668c))
- **Compounding failure math:** An agent with 85% accuracy per step completes a 10-step workflow successfully only **20% of the time** ([medium.com](https://medium.com/data-science-collective/why-ai-agents-keep-failing-in-production-cdd335b22219))
- **~80% of use cases** are correctly handled by a single-agent pattern ([daily.dev, 2026](https://daily.dev/blog/ai-agents-guide-for-developers-langchain-crewai))

The implication for Podacium: **defaulting to simplicity is not a compromise — it is an engineering decision grounded in production data.**

### 4.2 Framework Decision

| Framework | Architecture | Dev Speed | Production Control | Token Cost | Ahmed's Verdict |
|-----------|-------------|-----------|-------------------|------------|-----------------|
| **Simple ReAct loop** | Single agent, sequential tool calls | ⚡ Minutes | ✅ Full | 💲 Lowest | ✅ **Default for August 2026** |
| **LangGraph** | Stateful graph, typed nodes, checkpointing | 🔨 Hours | ✅✅ Best-in-class | 💲💲 Low | ✅ **Use when HITL or branching required** |
| **CrewAI** | Role-based agent teams | ⚡ 20 lines | ⚠️ Limited | 💲💲💲 Higher token spend | Use only for spike/PoC |
| **AutoGen** | Async event-driven | 🔨 Complex | ✅✅ Good | 💲💲 Low | Azure-specific; skip |

**Specific data on LangGraph:** LangGraph reached v1.0 GA in October 2025 and is running in production at Klarna, LinkedIn, Uber, and Replit. It is **1.7× faster per agent step than CrewAI** (95ms vs 158ms on a T4) and supports full graph state inspection and checkpointing — essential for Podacium's ANPDP audit requirements ([markaicode.com, 2026](https://markaicode.com/vs/langgraph-vs-crewai)).

**Rule:** Start with a simple ReAct loop. Graduate to LangGraph *only* when you need: (a) human-in-the-loop approval, (b) conditional branching with crash recovery, or (c) an audit trail required by ANPDP. Do not reach for multi-agent because it sounds more sophisticated.

### 4.3 The "One Brain, Many Feeders" Pattern

Podacium's agent architecture follows the orchestrator-worker pattern with a critical constraint: **only the orchestrator makes LLM calls**. All feeder functions are deterministic Python.

```
┌──────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR (Brain)                    │
│         Qwen3-4B (fine-tuned) or Claude Haiku 4.5       │
│   Reads user intent → selects feeder → assembles output  │
│   System prompt cached (90% token cost reduction)        │
└──────────────┬─────────────────────┬────────────────────┘
               │                     │
        [Feeder A]             [Feeder B]               [Feeder C]
     Course RAG Search      Proposal Template       BI Insight Fetch
       (EdTech)              (Freelancing)             (BI Pillar)
     Deterministic           Deterministic         Deterministic
     pgvector query         SQL template lookup    aggregation query
     ~30ms                  ~10ms                  ~50ms
       ↑                        ↑                       ↑
    No LLM call             No LLM call             No LLM call
```

This keeps the chain short and the reliability high. A single orchestrator at 95% reliability + deterministic feeders = **~95% end-to-end reliability** versus a 3-agent chain at 95% each = 86%.

### 4.4 Agent Inventory (August–October 2026)

| Agent / Feature | Pillar | Type | Model | Estimated Cost per 1K queries | Ship Date |
|-----------------|--------|------|-------|-------------------------------|-----------|
| **Course Recommender** | EdTech | ReAct + hybrid RAG | Claude Haiku 4.5 | ~$0.25–$0.50 | September 23 |
| **Quiz Question Generator** | EdTech | Single chain (no retrieval) | Claude Haiku 4.5 | ~$0.30–$0.60 | September 23 |
| **Smart Search** | Platform | Hybrid BM25 + pgvector | No LLM (pure SQL) | **$0** | September 23 |
| **Proposal Drafter** | Freelancing | Fine-tuned Qwen3-4B | Self-hosted GGUF | **~$0** | August 31 |
| **Contract Validator** | Freelancing | Pydantic schema + rule engine | No LLM | **$0** | August 31 |
| **BI Insight Narrator** | BI | ReAct + RAG (user data) | Claude Haiku 4.5 | ~$0.20–$0.40 | December 2026 |

**Budget estimate at 100 DAU (August):** Claude Haiku 4.5 at ~$1/1M input × ~500 tokens/query × 100 queries/day = **~$0.05/day = $1.50/month**. Even at 1,000 DAU: **$15/month**. The budget is safe.

**Updated Claude Haiku pricing (June 2026):** Claude Haiku 4.5 is priced at approximately $1/1M input tokens, $5/1M output tokens ([intuitionlabs.ai, 2026](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)). This is materially cheaper than previous estimates — good news for the budget.

### 4.5 Human-in-the-Loop (HITL) Design

HITL is non-negotiable for exactly two Podacium workflows. For everything else, automate.

| Workflow | HITL Gate | Trigger | Legal Basis |
|----------|-----------|---------|-------------|
| **Certificate issuance** | Ahmed manually reviews first 50 auto-issued certs; system then auto-issues with 10% spot-check sampling | Any new certificate type OR user dispute | ANPDP Law 25-11 data liability; Decree 1275 compliance |
| **High-value contract generation** | Human (Redha or Ahmed) reviews before AI-generated contract template reaches both parties | Contract total > 100,000 DZD | Algerian contract law: machine-generated contracts are unenforceable without demonstrated human intent above threshold |

**LangGraph HITL implementation:**

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Optional

class CertificateState(TypedDict):
    user_id: str
    course_id: str
    completion_data: dict
    generated_cert: Optional[dict]
    human_approved: bool
    audit_log: list[str]

def generate_certificate(state: CertificateState) -> CertificateState:
    """Generate certificate content — deterministic, no LLM."""
    cert = {
        "hash": generate_verification_hash(state["user_id"], state["course_id"]),
        "issued_at": datetime.utcnow().isoformat(),
        "verify_url": f"https://podacium.dz/verify/{cert_hash}",
        "completion_score": state["completion_data"]["score"],
    }
    state["generated_cert"] = cert
    state["audit_log"].append(f"Certificate generated at {datetime.utcnow()}")
    return state

def human_review_node(state: CertificateState) -> CertificateState:
    """
    Graph pauses here. External system sends webhook/email to Ahmed.
    Resumes only when human calls graph.invoke() with human_approved=True.
    """
    # This node runs AFTER the interrupt — it records the approval
    state["audit_log"].append(
        f"Human reviewed by {state.get('reviewer_id', 'Ahmed')} "
        f"at {datetime.utcnow()}"
    )
    state["human_approved"] = True
    return state

def issue_certificate(state: CertificateState) -> CertificateState:
    """Issue cert to user — only runs after human approval."""
    if not state["human_approved"]:
        raise ValueError("Certificate cannot be issued without human approval")
    CertificateRepository.publish(state["generated_cert"])
    state["audit_log"].append("Certificate issued to user")
    return state

# Build graph
builder = StateGraph(CertificateState)
builder.add_node("generate", generate_certificate)
builder.add_node("human_review", human_review_node)
builder.add_node("issue", issue_certificate)

builder.set_entry_point("generate")
builder.add_edge("generate", "human_review")
builder.add_edge("human_review", "issue")
builder.add_edge("issue", END)

# Compile with checkpoint + interrupt before human_review
graph = builder.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["human_review"]   # Graph pauses here awaiting external resume
)
```

**ANPDP audit requirement:** Every certificate must have a complete, queryable audit log entry. The `audit_log` field in `CertificateState` satisfies this. Log it to the database on graph completion.

---

## 5. Evaluation Without Enterprise Budget

### 5.1 The Three-Tier Reality Gap

Industry state as of 2026 ([FutureAGI](http://futureagi.com/blog/llm-evaluation-2025)):
- **89%** of production teams have basic observability (logging traces)
- **52%** run offline evaluations on sampled outputs
- **<20%** run systematic benchmarking with golden datasets

The gap between 89% and 52% is where most startups leak quality silently. Logging exists; judgment does not. Podacium's evaluation stack closes that gap at a total cost of $10–$15/month.

### 5.2 Evaluation Stack

#### Tier 1: Observability — $0/month (Langfuse self-hosted)

Langfuse is MIT-licensed and [fully self-hostable at zero cost](https://langfuse.com/pricing-self-host). Deploy on the same EC2 instance as the application — no additional infrastructure required.

```bash
# One-command deployment (Docker Compose)
git clone https://github.com/langfuse/langfuse && cd langfuse
docker-compose up -d
# Exposes dashboard at http://localhost:3000
```

**Instrument every LLM call with these fields:**

```python
from langfuse import Langfuse

langfuse = Langfuse()  # Reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY from env

def traced_llm_call(
    user_id: str,
    feature: str,
    prompt: str,
    context_chunks: list[str],
    model: str
) -> str:
    trace = langfuse.trace(
        name=feature,
        user_id=hash_user_id(user_id),     # Anonymized per ANPDP
        metadata={"model": model, "pillar": feature.split("/")[0]}
    )
    span = trace.span(name="llm_call")

    response = call_llm(prompt, model)     # Your LLM wrapper

    span.end(
        input={"prompt": prompt, "context_chunks": len(context_chunks)},
        output={"response": response},
        usage={"input_tokens": count_tokens(prompt),
               "output_tokens": count_tokens(response)},
    )
    return response
```

**What Langfuse gives you for $0:**
- Complete trace of every LLM call (input, output, latency, token count)
- Session-level tracking (chain of calls for a single user action)
- Cost tracking per model and feature
- Latency percentiles (p50, p95, p99)
- Anomaly detection via alert thresholds

#### Tier 2: Offline Evaluation — $2–$10/month (LLM-as-Judge)

**Research basis:** LLM-as-judge achieves 72–96% agreement with human annotators when properly configured ([arXiv 2411.15594](https://arxiv.org/abs/2411.15594)). At Podacium's scale (<10K outputs/month), this is both affordable and accurate.

| Option | Input Cost/1M tokens | When to Use | Agreement with Humans |
|--------|---------------------|-------------|----------------------|
| **Galileo Luna-2** | $0.02/1M | Real-time production guardrails at scale | ~97% cost reduction vs GPT-4; specialized eval model |
| **Claude Haiku 4.5 as judge** | ~$1/1M | Weekly offline batch eval (recommended) | ~85% agreement |
| **Qwen3-4B self-hosted as judge** | $0 (EC2) | Daily automated format/language checks | ~72–80% agreement |
| GPT-4o as judge | $2.50/1M | Gold standard creation only | ~90% agreement |

**Recommended configuration for Podacium:**
1. **Daily:** Qwen3-4B self-hosted judge checks format compliance and language consistency on 100% of outputs (automated, $0)
2. **Weekly:** Claude Haiku 4.5 judge batch-evaluates 200 randomly sampled outputs for faithfulness, relevance, and hallucination (~$0.10–$0.50/week)
3. **Pre-deployment:** GPT-4o evaluates the full 50-example golden set (one-time ~$0.04/run per CI trigger)

**Do not use your own fine-tuned model as its own judge.** This creates circular validation.

#### Tier 3: The Five Metrics That Matter

Do not track everything. Track these five. Everything else is noise at Podacium's current scale.

| Metric | Definition | Measurement Method | Acceptable Threshold | Alert If |
|--------|-----------|-------------------|---------------------|----------|
| **Faithfulness** | % of RAG responses where every claim is supported by a retrieved chunk | RAGAS faithfulness score via Claude Haiku judge weekly | ≥ 0.90 | < 0.80 two weeks in a row |
| **Format compliance rate** | % of structured outputs passing Pydantic schema validation | Automated at API boundary (zero cost) | ≥ 99% | < 97% in any 24-hour window |
| **Hallucination flag rate** | % of outputs flagged by judge as containing unverifiable claims | Qwen3-4B self-hosted judge, daily batch | < 5% | > 8% on consecutive days |
| **User rejection rate** | % of AI suggestions the user edits or ignores before saving | PostHog (free tier, 1M events/month included) | < 30% | > 40% signals prompt or model failure |
| **p95 response latency** | 95th percentile end-to-end AI feature response time | Langfuse trace percentiles | < 3,000ms | > 4,000ms p95 sustained |

**PostHog setup for user rejection tracking:**

```python
# Track AI suggestion acceptance vs rejection
import posthog

posthog.capture(
    distinct_id=hash_user_id(user_id),   # Anonymized
    event="ai_suggestion_outcome",
    properties={
        "feature": "proposal_drafter",
        "action": "accepted" if user_saved_without_edit else "rejected",
        "model": model_used,
        "edit_distance": levenshtein_distance(ai_output, final_submitted_text),
        "pillar": "freelancing",
    }
)
```

PostHog's free tier includes 1M events/month — Podacium will not exceed this for at least 18 months at projected scale.

### 5.3 RAGAS Evaluation for RAG Pipelines

RAGAS is the standard framework for automated RAG evaluation. It computes the four metrics that matter for EdTech recommendations:

```python
# Weekly RAG eval — runs via GitHub Actions or manually
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

# Sample 200 traces from Langfuse from the past 7 days
samples = langfuse.fetch_traces(feature="course_recommender", limit=200)

dataset = {
    "question": [s.input["query"] for s in samples],
    "answer": [s.output["response"] for s in samples],
    "contexts": [s.metadata["retrieved_chunks"] for s in samples],
    "ground_truth": []  # Optional — omit if no ground truth available
}

results = evaluate(
    dataset,
    metrics=[faithfulness, answer_relevancy, context_precision],
    llm=claude_haiku_judge,   # Use Haiku as judge — ~$0.50 for 200 samples
)

# Log results to Langfuse dataset for trend tracking
langfuse.score(name="weekly_ragas_eval", value=results["faithfulness"])
```

**Target scores (from production RAG benchmarks, [marsdevs.com 2026](https://www.marsdevs.com/guides/agentic-rag-2026-guide)):**
- Faithfulness ≥ 0.90
- Answer relevancy ≥ 0.85
- Context precision ≥ 0.80

### 5.4 Evaluation Cadence

| Cadence | Action | Time Investment | Cost |
|---------|--------|-----------------|------|
| **Real-time** | Pydantic schema validation on every output | 0 min (automated) | $0 |
| **Daily (automated)** | Qwen3-4B judge scans previous day's outputs for format + language failures | 5 min review | $0 |
| **Weekly (Ahmed)** | Claude Haiku batch eval on 200 random samples (RAGAS + hallucination rate) | 30 min | $0.10–$0.50 |
| **Pre-deployment** | Full regression on 50-example golden set (CI/CD gate, blocks bad deploys) | 0 min (automated) | ~$0.04 per run |
| **Monthly** | Human spot-check 20 outputs per AI feature + update golden set if needed | 1 hour | $0 |

**Monthly evaluation budget ceiling: $2–$10.**


---

## 6. The Enforcement Ladder

### 6.1 The Problem

Production AI reliability requires constraints that execute *before* outputs reach users. These are not evaluation — they are enforcement. The failure mode without enforcement: a model outputs a contract with a 0 DZD value, a certificate with a blank name field, a course recommendation in Spanish, or a BI insight citing a hallucinated Algerian company. Each is a trust-destroying user experience.

Three enforcement layers from the production AI literature ([tianpan.co, April 2026](https://tianpan.co/blog/2026-04-20-structured-output-reliability-production)):

```
L5 (pre-commit gate): Prompt regression tests in CI/CD — block deployment if golden evals degrade
L4 (API boundary):    Pydantic schema validation — reject and retry or fall back on schema failure
L3 (runtime guard):   Content policy + language consistency — flag or replace before user sees output
```

OpenAI's structured outputs strict mode achieves **< 0.1% schema failure rate** as of August 2024. Anthropic added native structured output support in late 2025. Use provider-level structured outputs wherever possible — do not rely on prompt instructions alone ([tianpan.co](https://tianpan.co/blog/2026-04-20-structured-output-reliability-production)).

### 6.2 Constraint 1: Typed Output Schema (All AI Endpoints)

Every AI response that reaches production code must be typed. Zero raw LLM strings surface to users without schema validation.

```python
from pydantic import BaseModel, validator, Field
from typing import Literal, Optional
from enum import Enum

class SupportedLanguage(str, Enum):
    ARABIC = "ar"
    FRENCH = "fr"
    DARJA = "dz"
    ENGLISH = "en"

class CourseRecommendation(BaseModel):
    course_id: str = Field(..., min_length=1, description="Must exist in course catalog")
    title: str = Field(..., min_length=3, max_length=200)
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str = Field(..., min_length=10, description="Explanation in user's language")
    language: SupportedLanguage

    @validator("course_id")
    def course_must_exist_in_catalog(cls, v):
        # Prevents hallucinated course IDs reaching users
        if not CourseRepository.exists(v):
            raise ValueError(f"Hallucinated course ID: {v} does not exist in catalog")
        return v

    @validator("confidence")
    def confidence_must_be_calibrated(cls, v):
        # Flag overconfident outputs — models that always say 0.99 are miscalibrated
        if v > 0.95:
            logger.warning(f"Suspiciously high confidence: {v}. Check calibration.")
        return v

class ContractDraft(BaseModel):
    total_amount_dzd: float = Field(
        ..., gt=500, lt=10_000_000,
        description="Minimum 500 DZD (spam floor), max 10M DZD (manual review above)"
    )
    commission_rate: float = Field(..., ge=0.0, le=0.20)
    deliverables: list[str] = Field(..., min_items=1, max_items=20)
    payment_milestones: list[dict] = Field(..., min_items=1)
    language: SupportedLanguage
    requires_human_review: bool = Field(default=False)

    @validator("total_amount_dzd")
    def flag_high_value_contracts(cls, v):
        if v > 100_000:
            # Log for HITL review — do not auto-reject
            AuditLogger.flag_for_human_review(f"High-value contract: {v} DZD")
        return v

# Enforcement wrapper — use on every AI endpoint
def validated_ai_response(schema: type[BaseModel], llm_call_fn, fallback_fn, max_retries=2):
    """
    Calls LLM, validates schema, retries on failure, falls back to deterministic response.
    Never surfaces a raw LLM error or malformed output to the user.
    """
    for attempt in range(max_retries + 1):
        try:
            raw = llm_call_fn()
            return schema.model_validate_json(raw)
        except Exception as e:
            logger.warning(f"Schema validation failed (attempt {attempt+1}): {e}")
            if attempt == max_retries:
                AuditLogger.log_fallback(schema.__name__, str(e))
                return fallback_fn()   # Deterministic fallback: never fail open
```

### 6.3 Constraint 2: Monetary Value Guard

Any AI output containing DZD amounts must pass a range check before reaching any user or system.

```python
# Integrated into ContractDraft schema above, but also enforced at service layer
class MonetaryGuard:
    DZD_MIN = 500           # Below this = spam or test data
    DZD_MAX = 10_000_000    # Above this = requires manual human review
    SUSPICIOUS_ROUND = [    # Hallucinated amounts are often suspiciously round
        0, 1, 100, 1000, 10000, 100000, 1000000
    ]

    @classmethod
    def validate(cls, amount: float, context: str) -> bool:
        if not (cls.DZD_MIN <= amount <= cls.DZD_MAX):
            AuditLogger.flag(f"Out-of-range DZD amount: {amount} in {context}")
            return False
        if amount in cls.SUSPICIOUS_ROUND:
            AuditLogger.warn(f"Suspiciously round DZD amount: {amount} — verify not hallucinated")
        return True
```

### 6.4 Constraint 3: Language Consistency Gate

Podacium serves Darja, Arabic, French, and English. An AI response in the wrong language is a product failure that directly violates the platform's core value proposition.

```python
from langdetect import detect, LangDetectException

LANGUAGE_ALIASES = {
    "ar": ["ar"],           # Arabic (MSA and Darja detected as "ar")
    "fr": ["fr"],           # French
    "dz": ["ar", "fr"],     # Darja: code-switches between Arabic and French, detect either
    "en": ["en"],
}

def enforce_language_consistency(
    text: str,
    expected_lang: SupportedLanguage,
    fallback_fn: callable,
    sample_chars: int = 300
) -> str:
    """
    Detect output language and fall back to deterministic response if mismatched.
    Never silently serves wrong-language content to users.
    """
    try:
        detected = detect(text[:sample_chars])
        valid_detections = LANGUAGE_ALIASES.get(expected_lang.value, [expected_lang.value])

        if detected not in valid_detections:
            AuditLogger.warn(
                f"Language mismatch: expected {expected_lang.value}, "
                f"detected {detected}. Text sample: {text[:100]}"
            )
            return fallback_fn()
        return text

    except LangDetectException:
        # Too short to detect — log and pass through (don't reject <20-char responses)
        logger.debug("Language detection failed: text too short")
        return text
```

### 6.5 Constraint 4: Hallucination Circuit Breaker (RAG Outputs)

For any RAG response, enforce that numerical claims and named entities in the output appear in the retrieved context. A hallucinated statistic about Algerian SME salaries is a reputational liability.

```python
import re
from typing import Sequence

def grounding_check(answer: str, retrieved_chunks: Sequence[str]) -> tuple[bool, list[str]]:
    """
    Extracts numbers and named entities from answer and verifies they appear
    in at least one retrieved chunk. Fast lexical check — not semantic.

    Returns: (is_grounded, list_of_ungrounded_claims)
    """
    # Extract numbers (potential statistics, DZD amounts, percentages)
    numbers_in_answer = re.findall(r'\b\d[\d,. ]*(?:DZD|%)?\b', answer)
    ungrounded = []

    for number in numbers_in_answer:
        number_clean = number.strip()
        if not any(number_clean in chunk for chunk in retrieved_chunks):
            ungrounded.append(number_clean)

    # Also check for known Algerian institutions/laws (common hallucination targets)
    institutions = re.findall(
        r'\b(?:CNRC|ANPDP|CNAS|CACOBATPH|ANDI|ASF|Law\s+\d+[-/]\d+)\b',
        answer
    )
    for institution in institutions:
        if not any(institution in chunk for chunk in retrieved_chunks):
            ungrounded.append(f"[institution] {institution}")

    is_grounded = len(ungrounded) == 0
    return is_grounded, ungrounded

# API handler usage
def rag_response(query: str, user_id: str) -> str:
    chunks = hybrid_search(query, k=5)
    llm_output = call_llm_with_context(query, chunks)

    is_grounded, ungrounded = grounding_check(llm_output, [c["content"] for c in chunks])

    if not is_grounded:
        AuditLogger.flag(f"Hallucination detected for user {hash_user_id(user_id)}: "
                         f"ungrounded claims: {ungrounded}")
        return deterministic_fallback_response(query)  # Safe, cited fallback

    return llm_output
```

### 6.6 Constraint 5: Pre-Deployment Regression Gate (CI/CD)

A golden set of 50 prompt/expected-output pairs runs on every pull request touching any AI-related code, model configuration, or prompt. Any deployment that degrades pass rate by > 5% is blocked automatically.

```yaml
# .github/workflows/ai-regression.yml
name: AI Regression Gate
on:
  pull_request:
    paths:
      - "app/ai/**"
      - "app/prompts/**"
      - "scripts/eval_*"
      - "requirements*.txt"

jobs:
  regression-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install -r requirements-eval.txt

      - name: Run golden eval suite
        run: |
          python scripts/eval_golden_set.py \
            --golden-set data/eval/golden_set_v1.jsonl \
            --threshold 0.90 \
            --model claude-haiku-4-5 \
            --output eval_results.json
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Check threshold and comment on PR
        run: python scripts/check_eval_threshold.py --results eval_results.json --threshold 0.90
        # Exits with code 1 if pass_rate < 90%, blocking the PR merge
```

**Cost per CI run:** 50 examples × ~300 tokens × Claude Haiku 4.5 ~$1/1M = **~$0.015 per run**. Negligible.

**Golden set maintenance rule:** Add 2–5 new examples to the golden set every time a new AI feature ships or a production failure occurs. Never delete examples — only add. Tag each with the date added and the failure mode it covers.

---

## 7. Cost Optimization: Squeezing Every Token

### 7.1 The Single Biggest Lever: Prompt Caching

Anthropic's prompt caching is the most underutilized cost optimization available in 2026. Cached tokens cost **10% of the standard input rate** — a 90% discount on repeated content ([markaicode.com](https://markaicode.com/anthropic-prompt-caching-reduce-api-costs/)). Cache writes cost 125% of standard (a one-time surcharge), but cache reads are 10%.

**What to cache at Podacium:**

```python
# Cache the system prompt + few-shot examples (changes rarely)
# This eliminates 60-90% of input token costs on repeat queries

def build_cached_prompt(user_query: str, context_chunks: list[str]) -> list[dict]:
    """
    Mark system prompt and few-shot examples as cacheable.
    Only the user query and retrieved context are uncached (they change every call).
    """
    return [
        {
            "role": "user",
            "content": [
                # CACHED PREFIX — reused across all users (TTL: 5 minutes default)
                {
                    "type": "text",
                    "text": PODACIUM_SYSTEM_PROMPT,    # ~2,000 tokens — cached
                    "cache_control": {"type": "ephemeral"}
                },
                {
                    "type": "text",
                    "text": FEW_SHOT_EXAMPLES_DARJA,   # ~1,500 tokens — cached
                    "cache_control": {"type": "ephemeral"}
                },
                # UNCACHED — changes per request
                {
                    "type": "text",
                    "text": f"Context:\n{format_chunks(context_chunks)}\n\nQuery: {user_query}"
                }
            ]
        }
    ]
```

**Savings estimate:** System prompt (2,000 tokens) + few-shot examples (1,500 tokens) = 3,500 cached tokens per query. At Claude Haiku 4.5 $1/1M input standard rate vs $0.10/1M cached rate: **$0.90/1M tokens saved per query**. At 1,000 queries/day: **$0.90/day = $27/month saved** — more than the entire evaluation budget.

### 7.2 Token Budget Enforcement

```python
# Hard token limits per feature — prevents runaway costs from long user inputs
TOKEN_LIMITS = {
    "course_recommender": {"input": 2000, "output": 512},
    "quiz_generator": {"input": 1500, "output": 800},
    "proposal_drafter": {"input": 3000, "output": 1500},
    "bi_insight_narrator": {"input": 4000, "output": 1000},
}

def enforce_token_budget(feature: str, prompt: str, max_output: int | None = None) -> str:
    """Truncate input if needed, cap max_tokens on output."""
    limit = TOKEN_LIMITS.get(feature, {"input": 2000, "output": 512})
    truncated_prompt = truncate_to_tokens(prompt, limit["input"])
    output_cap = max_output or limit["output"]
    return call_llm(truncated_prompt, max_tokens=output_cap)
```

### 7.3 Model Routing: Use the Cheapest Model That Works

Not every request needs the best model. Route by complexity:

| Task | Model | Cost/1K queries | Rationale |
|------|-------|-----------------|-----------|
| Format validation, simple lookup | Rule-based (no LLM) | **$0** | Don't use AI where a function works |
| Course search autocomplete | pgvector (no LLM) | **$0** | Pure retrieval |
| Quiz generation (single course context) | Claude Haiku 4.5 | ~$0.30 | Short, constrained task |
| Contract draft (Freelancing) | Qwen3-4B self-hosted | **~$0** | After August fine-tune |
| Complex BI insight narration | Claude Haiku 4.5 | ~$0.50 | Requires Arabic business reasoning |
| Gold eval label creation | GPT-4o | ~$2.50/1M | Only for ground-truth labeling |

### 7.4 Running 90-Day Cost Ledger

| Item | One-Time | Monthly (est.) | 90-Day Total |
|------|----------|----------------|--------------|
| Synthetic data generation (GPT-4o, Aug) | $5 | — | $5 |
| Claude Haiku 4.5 (production AI features) | — | $1–$5 | $3–$15 |
| Prompt caching savings (offset) | — | -$15–$30 | -$45–$90 |
| LLM-as-judge eval (weekly Haiku batch) | — | $1–$3 | $3–$9 |
| Langfuse (self-hosted on existing EC2) | — | $0 | $0 |
| PostHog (free tier, product analytics) | — | $0 | $0 |
| Colab Pro (if needed for training, 1 month) | — | $12 (Aug only) | $12 |
| CI eval (GitHub Actions, ~$0.015/run × 20 runs/month) | — | $0.30 | $0.90 |
| **GROSS TOTAL** | **$5** | **$2–$20** | **$11–$42** |
| **NET (after caching savings)** | **$5** | **~$0–$5** | **$5–$20** |

**90-day AI budget with prompt caching: $5–$20. Well within the $50 hard cap.**


---

## 8. The Darja/Arabic Language Layer

### 8.1 Why This Is a Separate Section

Darja (Algerian spoken Arabic) is Podacium's primary competitive moat in AI. No global AI platform serves Algerian-specific professional vocabulary, labor law context, or the French/Arabic code-switching patterns that characterize Algerian business communication. This section codifies exactly what Podacium must do — and what is already available — to exploit this moat from Day 1.

### 8.2 Available Datasets (Free, Open Source)

| Dataset | Size | Content | Use Case for Podacium |
|---------|------|---------|----------------------|
| **ayoubkirouane/Algerian-Darija** ([HuggingFace](https://huggingface.co/datasets/ayoubkirouane/Algerian-Darija)) | 171K rows | General Darja text | Seed corpus for understanding Darja register; augment training data |
| **alger-ia/dziribert** ([HuggingFace](https://huggingface.co/alger-ia/dziribert)) | Pre-trained BERT | Darja BERT (Arabic + Latin scripts) | Candidate for embedding model if Arabic embedding quality is insufficient |
| **CAFE dataset** ([pubmed](https://pubmed.ncbi.nlm.nih.gov/41311731/)) | ~37 hrs speech, 100+ speakers | Algerian Darja/French/English code-switching | Validates code-switching patterns for synthetic data quality check |
| **SemRel Algerian Arabic** ([arXiv 2402.08638](https://arxiv.org/abs/2402.08638)) | Semantic relatedness pairs | Algerian Arabic semantic pairs | Embedding quality evaluation for Algerian context |
| **Arabic Cultural QA** ([arXiv 2503.00151](https://arxiv.org/abs/2503.00151)) | 20 topics, 44 researchers | MSA + dialectal Arabic Q&A | Supplement fine-tune data with cultural context |

**Practical use:** Download `ayoubkirouane/Algerian-Darija` immediately. Use 2,000–5,000 rows as negative examples (what good Darja looks like) during synthetic data quality validation in Step 3 of the three-step validation gate.

### 8.3 Qwen3-4B Arabic Capability Assessment

Qwen3-4B-Instruct officially supports 100+ languages and dialects with "strong capabilities for multilingual instruction following and translation" ([HuggingFace Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B)). For Maghrebi Arabic specifically:

- **GemMaroc study (arXiv 2505.17082, May 2025):** A LoRA-tuned Gemma-3 4B on ~5,000 mixed instructions lifted DarijaMMLU from 32.8% to 42.7% (+9.9pp). Adding reasoning-dense TULU instructions pushed it to 47.5% — all with no English regression. This establishes that **5,000 examples is sufficient for meaningful dialect improvement on a 4B model**.
- **Dialect benchmarking (arXiv 2510.27543):** Tested 19 open-weight LLMs (1B–13B); all showed substantial variation across dialects. Qwen3's multilingual RL training gives it a baseline advantage, but fine-tuning is still necessary for specialized Algerian business vocabulary.
- **Practical implication:** Qwen3-4B already "speaks Arabic." The fine-tune teaches it Podacium-specific vocabulary (DZD amounts, Chargily Pay, CNRC, Wilaya names, Ramadan seasonality), not the Arabic language itself.

### 8.4 Darja-Specific Prompting Rules

Before the fine-tune, enforce these in system prompts:

```python
DARJA_SYSTEM_PROMPT = """
You are Podacium's AI assistant for Algerian freelancers and businesses.

LANGUAGE RULES:
- Default to Darja (Algerian spoken Arabic) for conversational responses
- Switch to French for technical or legal terminology (e.g., "le contrat", "la facture")
- Switch to MSA Arabic for formal documents (contracts, certificates)
- Never default to English unless the user explicitly writes in English
- Natural code-switching between Darja and French is expected and correct

ALGERIAN CONTEXT:
- All monetary amounts are in DZD (Algerian Dinar)
- Reference local institutions: CNRC (business registration), ANPDP (data protection),
  Chargily Pay (payments), CASNOS (freelancer social security)
- Acknowledge Ramadan seasonality in project timelines (workday is 6 hours during Ramadan)
- Wilaya-level pricing norms exist — prices in Oran are typically 15-20% lower than Algiers
- Informal credit ("Kridi") is normal — mention it naturally when discussing payment terms

PROHIBITED:
- Do not reference USD or EUR in pricing contexts — always DZD
- Do not suggest foreign payment platforms (PayPal, Payoneer, Stripe)
- Do not use Egyptian or Levantine Arabic dialectal forms
- Do not reference non-Algerian labor law (French or Moroccan law is not applicable)
"""
```

### 8.5 Darja Data Quality Checklist

When reviewing synthetic training examples, validate against these Algerian-specific checks:

```
□ Code-switching follows natural Algerian patterns (Arabic sentence structure + French nouns)
□ DZD amounts use correct Algerian conventions (spaces in thousands: "10 000 DZD" not "10,000")
□ Seasonal references are accurate (Ramadan 2026: March 1 – March 30 approximately)
□ Wilaya references are real (48 wilayas; common: Oran, Alger, Constantine, Annaba, Sétif)
□ Local slang is contemporary (avoid 1990s-era Darja or MSA that doesn't match spoken usage)
□ French-Arabic mixing is natural (NOT machine-translated Arabic of French sentences)
□ Business vocabulary matches Algerian SME norms (not Moroccan or Tunisian equivalents)
```

---

## 9. 90-Day AI Roadmap: August–October 2026

### 9.1 Ahmed's Constraint Profile

| Constraint | Value | Implication |
|------------|-------|-------------|
| Available time | 10–15 hrs/week | Ruthless prioritization required — no exploration tasks |
| Budget | $0–$50/month hard cap | Every tool must be free or $0 by default |
| Infrastructure | AWS free tier + existing PostgreSQL + Colab free | No new paid services before fine-tune proves value |
| Launch date | September 23, 2026 (Education Technology Day) | AI features are additive — they must not block launch |
| Legal | ANPDP Law 25-11 DPO obligations | Ahmed is DPO — data collection requires explicit opt-in consent UI before any collection |
| Team | Part-time, 1 engineer | No framework that requires ongoing maintenance >2 hrs/week to operate |

### 9.2 Week-by-Week Plan

#### SEPTEMBER: Pre-Launch Prep — Ship, Don't Train

**Principle:** Pre-launch period is about infrastructure, data collection, and shipping non-blocking AI features. No model training until post-launch.

| Week | Tasks | Est. Hours | Go/No-Go Gate | Success Metric |
|------|-------|-----------|---------------|----------------|
| **W1 (Sep 8–14)** | 1. Deploy Langfuse self-hosted on EC2 (docker-compose) · 2. Instrument all existing LLM calls with traces · 3. Add ANPDP opt-in consent toggle to user profile settings · 4. Enforce Pydantic schemas on all existing AI API endpoints · 5. Write 50 of the 100 gold fine-tune examples | 13 hrs | ✅ Langfuse dashboard live; all LLM calls traced; ANPDP consent UI deployed | Zero unhandled LLM exceptions at launch; consent opt-in visible |
| **W2 (Sep 15–22)** | 1. Build hybrid RAG pipeline (pgvector + tsvector BM25, RRF merge) for Course Recommender · 2. Finish 50 remaining gold fine-tune examples · 3. Run first LLM-as-judge batch eval (200 samples, Claude Haiku) using RAGAS · 4. Document top 3 failure modes | 13 hrs | ✅ RAG returns relevant results for > 80% of 20 manual test queries | Course click-through rate on AI recommendations > 15% |
| **W3 (Sep 23–29)** | **LAUNCH DAY September 23** · Monitor Langfuse traces every 4 hrs · Fix any Pydantic schema failures immediately · Collect first real user interaction data from opt-in users | 8 hrs | ✅ No AI-caused user-facing errors in first 72 hours | LLM error rate < 1%; p95 latency < 3,000ms |
| **W4 (Sep 30 – Oct 6)** | 1. Reach 150 real beta interactions collected · 2. Begin synthetic data generation protocol (seed GPT-4o with 10 gold examples) · 3. Begin generating 700 synthetic training examples with GPT-4o seeding protocol | 14 hrs | ✅ 150+ real interactions collected; synthetic generation started | Hallucination flag rate < 10% on RAG; judge eval cost < $2 |

**Pre-launch anti-tasks (do NOT do these before launch):**
- ❌ Fine-tuning (no data yet, platform stability is priority)
- ❌ Multi-agent architecture (single ReAct loops handle all launch features)
- ❌ New LLM providers (Claude Haiku is working; don't switch)
- ❌ Vector database migration from pgvector (pgvector is sufficient for < 100K embeddings)

#### AUGUST–SEPTEMBER: Fine-Tune and Deploy

| Week | Tasks | Est. Hours | Go/No-Go Gate | Success Metric |
|------|-------|-----------|---------------|----------------|
| **W5 (Aug 26 – Sep 1)** | 1. Complete 700 synthetic training example generation · 2. Run three-step validation on all 700 (30 examples/hr = ~23 hrs — batch across week) · 3. Run Unsloth + Qwen3-4B QLoRA fine-tune on Colab (T4, ~60 min) | 14 hrs | ✅ 850–1,000 verified examples; data card written; <5% known errors | Validation complete; dataset frozen Sep 1 |
| **W6 (Sep 2–8)** | 1. Export fine-tune to GGUF Q4_K_M · 2. Run pre-deployment checklist (Section 3.8) · 3. Run CI golden eval (50 examples) vs base model · 4. Deploy fine-tuned model to EC2 (llama.cpp server) | 10 hrs | ✅ Fine-tuned model scores ≥ 10% better than base on Algerian contract Q&A | Contract format compliance > 95% vs base ~60%; language consistency ≥ 90% |
| **W7 (Sep 9–15)** | 1. A/B test: 50% traffic → fine-tuned Qwen3-4B; 50% traffic → Claude Haiku · 2. Monitor user rejection rate and latency · 3. Analyze A/B results (n ≥ 100 comparisons per variant) | 10 hrs | ✅ No regression in latency or error rate post-deployment; A/B running cleanly | User rejection rate on AI proposals < 25% |
| **W8 (Sep 16–22)** | 1. Graduate winner to 100% traffic · 2. Document fine-tune process, lessons learned, improvements for v2 · 3. Add 10 new golden set examples based on failure modes | 6 hrs | ✅ Winner selected with statistical confidence; shipped to 100% | Proposal adoption rate > 60%; monthly AI cost < $15 |

**Fine-tune Go/No-Go gate (hard):** If fine-tuned model does NOT beat base model by ≥ 10% on contract format compliance by September 8, **roll back to Claude Haiku immediately** and postpone fine-tuning to November with more data. Do not ship an inferior model to save face.

#### OCTOBER–NOVEMBER: Automate and Harden

| Week | Tasks | Est. Hours | Go/No-Go Gate | Success Metric |
|------|-------|-----------|---------------|----------------|
| **W9 (Oct 19–25)** | 1. Build CI/CD AI regression gate (GitHub Actions, 50-example golden set) · 2. Build LangGraph HITL flow for certificate issuance (Section 4.5) · 3. Implement human approval webhook for contracts > 100,000 DZD | 10 hrs | ✅ CI pipeline blocks any PR that degrades golden eval by > 5%; runs in < 5 min | Zero regressions deployed to production without automated detection |
| **W10 (Oct 26 – Nov 1)** | 1. BI pillar data collection instrumentation (schema design for SME interaction logs) · 2. Draft Algerian SME vocabulary list (400 terms — seed for March fine-tune) · 3. Test ANPDP audit log completeness | 12 hrs | ✅ BI data schema validated against ≥ 5 real SME pilot interactions | 50+ Algerian business terms tagged; BI pilot has ≥ 10 SMEs onboarded |
| **W11 (Nov 2–8)** | 1. Begin second fine-tune data collection (target +500 real interactions by Nov 30) · 2. Begin BI fine-tune spec preparation · 3. Freelancing public launch prep (Nov 30) | 10 hrs | ✅ HITL flow tested with real approvals; ANPDP-compliant audit trail on 100% of issued certs | Certificate issuance audit trail complete |
| **W12 (Nov 9–30)** | 1. 90-day retrospective: audit all AI costs, latency percentiles, eval scores · 2. Write Q4 AI roadmap (Nov–Dec 2026) with BI fine-tune spec · 3. Evaluate March BI launch readiness · 4. Freelancing public launch (Nov 30) | 8 hrs | ✅ Total AI spend Sep–Nov < $50; no major production reliability incidents | Cost per active user < $0.10/month; faithfulness score trending ≥ 0.90 |

### 9.3 Go/No-Go Summary Gates

| Gate | Date | Pass Condition | Fail Action |
|------|------|----------------|-------------|
| Launch readiness | Sep 22 | Zero AI-caused P0 errors in staging; all LLM endpoints have Pydantic schemas | Remove AI features from launch; ship platform without them |
| ANPDP compliance | Jul 18 | Consent opt-in UI live; data anonymization confirmed | Block data collection until compliant — do not collect without consent |
| RAG quality | Aug 11 | Faithfulness ≥ 0.85; > 80% relevant results on 20 manual test queries | Revert to popularity-based recommendations; delay RAG to post-launch |
| Fine-tune viability | Sep 8 | ≥ 10% improvement over base on contract format compliance | Roll back to Claude Haiku; reschedule fine-tune for November with 2× data |
| Production deployment | Sep 22 | User rejection rate < 25%; no latency regression vs Claude Haiku baseline | A/B at 10% traffic only; do not graduate to 100% |
| HITL compliance | Oct 6 | 100% certificate audit trail; HITL flow tested with real approvals | Block certificate issuance feature until compliant |
| 90-day cost | Oct 31 | Total AI cost Aug–Oct < $50 gross; < $25 net (after caching savings) | Review model selection; apply cost optimization levers from Section 7 |


---

## 10. The Anti-Roadmap: What NOT to Build

This section is as important as the roadmap. Each item is a real engineering temptation that will consume Ahmed's limited hours and return nothing measurable before the November 2026 pre-seed raise.

| Do NOT Build | Why | Production Impact of Building It Anyway | When to Revisit |
|--------------|-----|----------------------------------------|-----------------|
| **Separate vector database (Pinecone, Weaviate, Qdrant)** | pgvector on existing Postgres handles < 1M vectors with HNSW indexing at zero added cost. A separate vector DB adds: one more service to operate, sync lag, networking costs, and an additional failure point | Operational complexity with zero quality improvement at < 100K embeddings | After 500K document chunks confirmed in production |
| **Custom embedding model** | `text-embedding-3-small` at $0.02/1M tokens delivers sufficient quality for Arabic content. DziriBERT exists but has no instruction-tuning — it produces embeddings, not useful recommendations without significant additional work | 3 weeks of engineering for < 5% quality improvement over OpenAI embeddings | After Series A with a dedicated ML engineer on staff |
| **Multi-agent swarm (3+ autonomous agents)** | Compounding failure math destroys reliability below 10K DAU where the cost of complex debugging exceeds the value. 86–89% of multi-agent pilots never reach production ([ashutosh.dev](https://www.ashutosh.dev/the-agentic-ai-reality-check-why-86-of-multi-agent-systems-never-reach-production/)) | Very high probability of shipping an unreliable product that breaks under load | After 10K DAU with dedicated SLA monitoring |
| **Self-hosted GPU server for base inference (pre-Sep)** | At < 200 daily AI queries in August, a GPU server costs more in engineering time (setup, monitoring, uptime) than it saves in API costs. Math: 200 queries × 500 tokens × $1/1M = $0.10/day in API cost vs hours of ops work | Engineering debt with no cost saving until > 5K daily queries | After fine-tune proves value AND query volume exceeds 5K/day |
| **RLHF or DPO preference fine-tuning** | Requires 5,000+ human preference pairs (A vs B comparisons rated by native Darja speakers). Podacium does not have the annotators, the volume, or the tooling. Standard SFT with GPT-4o synthetic data + real examples is sufficient for v1 | Months of work for marginal improvement over SFT at current data scale | After 100K+ real user interactions and a dedicated annotation pipeline |
| **Conversational memory (persistent cross-session)** | Full conversation history adds token cost, storage complexity, and ANPDP data minimization obligations. Session-scoped memory handles 98% of Podacium's use cases at launch. Users are not running week-long agent conversations | Engineering cost + legal complexity for a feature < 2% of users need at launch | When users explicitly request it (track this in PostHog) |
| **Real-time AI moderation pipeline** | At < 2,000 daily AI requests, daily batch moderation is sufficient. Real-time adds 200–400ms latency and operational complexity for no measurable user protection improvement at this scale | Latency regression and complexity with no real user benefit at current scale | After 10K daily AI requests where batch scanning becomes a 24-hour lag |
| **LLM-powered course generation (full courses)** | AI-generated courses will fail every standard in Podacium's Course Architecture & Production Playbook (Section 4.2.5 of Business Plan). The 2026 research showing that short micro-content (<3 min) harms memory encoding means fully automated courses are lower quality — not higher. AI assists instructors; it does not replace them | Credibility and quality damage that undermines the Skill Passport's entire value proposition | Never for core curriculum content |
| **Custom OCR or document parsing pipeline** | Tempting for Algerian business document automation (CNRC extracts, CNS forms, tax certificates). Zero users have requested this. Build when the first 10 users ask for it — then only if they would pay extra | Engineering months building for a problem users haven't confirmed they have | When > 10 users explicitly request it AND WTP is confirmed |
| **Separate ML serving infrastructure (K8s, Triton, model registry)** | Kubernetes + model registry is enterprise infrastructure for a 4-person startup. `llama.cpp` + a single EC2 instance handles Podacium's load for 12+ months with zero orchestration overhead | Massive engineering time sink with no user-facing benefit at current scale | After Series A with a dedicated ML/infrastructure engineer |
| **Algerian Arabic speech recognition** | Relevant in the long term but requires a dedicated ASR project. CAFE dataset exists but building a production-grade Darja ASR requires 6+ months of dedicated work and is completely out of scope before Series A | Major scope creep; zero core product value in first 18 months | Series B, if user research confirms voice-first interaction demand |
| **Real-time personalization model** | Collaborative filtering works on cold-start data. A real-time personalization model requires hundreds of thousands of interactions before it beats simple "most enrolled" ranking. You don't have the data | Engineering complexity for a model that would perform worse than popularity ranking for first 18 months | After 50K+ enrollments with rich behavioral signal |

---

## Appendix A: Quick Reference Card

```
══════════════════════════════════════════════════════
PODACIUM AI DECISION TREE (30 seconds)
══════════════════════════════════════════════════════

Data changes weekly?           → YES → RAG (pgvector + BM25 hybrid)
Need custom Algerian behavior? → YES → Fine-tune Qwen3-4B (August)
Both?                          → YES → Hybrid (BI pillar, December 2026)
Neither?                       → Prompt engineering first (exhaust 5 levels)

══════════════════════════════════════════════════════
FULL STACK (August–October 2026)
══════════════════════════════════════════════════════

Production model:  Claude Haiku 4.5 (API) + Qwen3-4B (fine-tuned, from Aug 31)
Retrieval:         pgvector HNSW + tsvector BM25 + RRF merge (existing Postgres)
Chunking:          400–600 tokens, 15% overlap (quality lever #1)
Framework:         Simple ReAct loops (August) → LangGraph (when HITL needed)
Observability:     Langfuse self-hosted (MIT, $0)
Eval:              Claude Haiku judge weekly batch (~$0.50/week) + Qwen3-4B daily ($0)
Analytics:         PostHog free tier (1M events/month free)
Enforcement:       Pydantic schemas + grounding check + language gate + CI golden evals
Cost optimization: Anthropic prompt caching (10% of standard rate on repeated prefixes)

══════════════════════════════════════════════════════
DATA TARGET (August fine-tune)
══════════════════════════════════════════════════════

Total:         850–1,000 verified examples
Breakdown:     150–200 real · 100 gold · 650–700 synthetic (GPT-4o, validated)
Bad data cap:  < 5% in final set (10% causes measurable degradation)
Cost:          < $5 (GPT-4o API only)

══════════════════════════════════════════════════════
PRODUCTION TARGETS
══════════════════════════════════════════════════════

Faithfulness:         ≥ 0.90  (RAG grounding)
Format compliance:    ≥ 99%   (Pydantic schema pass rate)
Hallucination rate:   < 5%    (LLM judge flag rate)
User rejection rate:  < 30%   (PostHog acceptance tracking)
p95 latency:          < 3,000ms (Langfuse traces)

══════════════════════════════════════════════════════
90-DAY BUDGET (net with caching)
══════════════════════════════════════════════════════

$5–$20 total · $50 absolute ceiling
```

---

## Appendix B: ANPDP Data Protection Checkpoints

Ahmed holds the DPO designation under ANPDP Law 25-11. These checkpoints are mandatory gates — none of them can be skipped or deferred.

| Checkpoint | Required By | Specific Action | Gate Date |
|------------|-------------|-----------------|-----------|
| **User consent UI for AI training data** | Law 25-11, Art. 5 (purpose limitation + consent) | Explicit opt-in toggle in user profile settings with clear description: "Allow Podacium to use my interactions to improve AI features" | Before September 23 (W1) |
| **Data anonymization before training** | Law 25-11, Art. 9 (data minimization) | Strip all PII (names, phone numbers, payment details, wilaya/address specifics) from training examples BEFORE adding to dataset. Use regex + NER scan. | Before Aug 10 (dataset freeze) |
| **Third-party processor disclosure** | Law 25-11, Art. 17 (data transfer) | Privacy policy must disclose: "We use OpenAI API for AI feature generation. Prompts may be processed by OpenAI under their data processing agreement." | Before September 23 |
| **ANPDP declaration covers AI processing** | Filed July 18, 2026 | Confirm with legal counsel that the July 18 ANPDP declaration explicitly covers AI-driven data processing (inference + training). Update filing if needed. | July 18 (existing deadline) |
| **Right to deletion from training data** | Law 25-11, Art. 14 (right to erasure) | Build a mechanism to flag and remove user-generated training examples by user_id on deletion request. Log which training version included their data. | Before first training run (Aug 10) |
| **GPT-4o synthetic generation disclosure** | Law 25-11 (data transfer to third parties) | Document in data processing records that GPT-4o was used to generate synthetic training data seeded from Podacium's gold examples (not from real user data). | Aug 10 (dataset freeze) |

---

## Appendix C: Model Selection Log

Keep this log updated every time a model decision is made. This is the audit trail for technical decisions.

| Date | Decision | Model Selected | Rejected Alternative | Reason |
|------|----------|---------------|---------------------|--------|
| Jun 2026 | Production inference (EdTech RAG) | Claude Haiku 4.5 | GPT-4o-mini, Gemini Flash | Best Arabic reasoning at lowest cost tier; ~$1/1M input |
| Jun 2026 | Fine-tuning base | Qwen3-4B-Instruct | Gemma-3-4B, Llama-3.2-3B | Only model with strong Maghrebi Arabic + commercial license + Unsloth support |
| Jun 2026 | Embedding | text-embedding-3-small | DziriBERT, multilingual-e5 | $0.02/1M; sufficient Arabic quality; no infrastructure overhead |
| Jun 2026 | Eval judge (weekly) | Claude Haiku 4.5 | GPT-4o, Luna-2 | Cost/accuracy balance; same provider reduces integration complexity |
| Jun 2026 | Eval judge (daily, automated) | Qwen3-4B self-hosted | None | $0; adequate for format/language checks |
| Jun 2026 | Synthetic data generation | GPT-4o | Claude Sonnet, Gemini Pro | Best quality for complex Algerian business context generation; justified for one-time $5 cost |

---

## Appendix D: Dependency Map

```
CORE DEPENDENCIES (all free or self-hosted)
  langfuse>=2.0.0               # Observability — MIT licensed, self-hosted
  langchain>=0.3.0              # LLM orchestration
  langgraph>=1.0.10             # Stateful agents (HITL only)
  pydantic>=2.6.0               # Schema enforcement
  pgvector>=0.3.0               # Vector storage (on existing Postgres)
  langdetect>=1.0.9             # Language consistency gate
  ragas>=0.2.0                  # RAG evaluation metrics
  posthog>=3.0.0                # Product analytics (free tier)

TRAINING DEPENDENCIES (Colab only — not in production requirements)
  unsloth>=2025.11              # Fast fine-tuning
  trl>=0.12.0                   # SFT trainer
  peft>=0.13.0                  # LoRA/QLoRA
  wandb>=0.18.0                 # Training tracking (free tier)
  datasets>=3.0.0               # HuggingFace datasets

INFERENCE DEPENDENCIES (production)
  anthropic>=0.40.0             # Claude Haiku (primary)
  openai>=1.50.0                # text-embedding-3-small only
  llama-cpp-python>=0.3.0       # Self-hosted Qwen3-4B GGUF (from August)
```

---

*Playbook owner: Ahmed MERHAB (CDO/DPO) · Version 2.1 · July 2026*
*Next review: October 31, 2026 · Trigger for immediate review: any production AI incident or pre-seed investor technical due diligence request*
*Supersedes: Playbook v1.0 (July 2026)*
