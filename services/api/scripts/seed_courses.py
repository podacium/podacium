"""
=============================================================================
Podacium — Launch Course Catalog Seed Script
=============================================================================
Seeds the complete education data for the September 23, 2026 launch:
  - 2 instructor users (Zakarya ROUBHI, Mohamed Redha HABIB)
  - 1 Learning Path ("AI-Augmented Professional")
  - 4 Modules (courses): Python for Data Analysis, AI Tools for Work,
    Excel & AI for Business, Cybersecurity for Everyone
  - 30+ lessons with video URLs, transcripts, learning objectives
  - Quizzes & questions for every lesson
  - Demo enrollments and reviews

Usage:
    cd services/api
    python3 scripts/seed_courses.py
=============================================================================
"""

import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

if os.path.exists("/opt/podacium/.env.prod"):
    load_dotenv("/opt/podacium/.env.prod")
load_dotenv()

from app.generated.prisma import Prisma, Json
from app.generated.prisma import enums
from ai_builder_lessons import AI_BUILDER_LESSONS

prisma = Prisma()

# =============================================================================
# CONSTANTS
# =============================================================================

NOW = datetime.now(timezone.utc)
TOMORROW = NOW + timedelta(days=1)

# Instructor IDs (deterministic for references)
HOUARI_ID = 1001
ZAKARYA_ID = HOUARI_ID
REDHA_ID = HOUARI_ID

# Module ID slugs
MODULE_PYTHON_ID = "mod-python-data-analysis"
MODULE_AI_BUILDER_ID = "mod-ai-fullstack-builder"
MODULE_EXCEL_ID = "mod-excel-ai-business"
MODULE_CYBERSECURITY_ID = "mod-cybersecurity-everyone"

# Path ID
PATH_AI_PROFESSIONAL_ID = "path-ai-augmented-professional"


# =============================================================================
# HELPER: generate UUID-based IDs for lessons
# =============================================================================


def gen_lesson_id(prefix: str, n: int) -> str:
    return f"les-{prefix}-{n:02d}-{uuid.uuid4().hex[:8]}"


def quiz_id(n: int) -> int:
    return 1000 + n


def enrollment_id(n: int) -> int:
    return 5000 + n


from app.core.security import get_password_hash

# =============================================================================
# 1. SEED USERS (Instructors)
# =============================================================================


async def seed_users():
    """Create or update the instructor account."""
    global HOUARI_ID, ZAKARYA_ID, REDHA_ID
    print("\n👤 Seeding instructors...")

    pwd_hash = get_password_hash("Podacium=2026+ESE")

    users_data = [
        {
            "id": HOUARI_ID,
            "email": "instructor@podacium.com",
            "fullName": "Houari Ibrahim",
            "role": enums.UserRole.INSTRUCTOR,
            "passwordHash": pwd_hash,
            "emailVerified": True,
            "bio": "Lead Instructor at Podacium. Full-stack developer, AI specialist, and operations consultant who built core educational modules. Expert in Python, AI integration, LLMs, and business intelligence.",
            "skills": [
                "Python",
                "AI/ML",
                "FastAPI",
                "Next.js",
                "Data Analysis",
                "LLM Integration",
                "Business Intelligence",
                "Operations Management",
            ],
            "city": enums.City.ORAN,
            "country": enums.Country.ALGERIA,
            "isActive": True,
            "acceptedTerms": True,
            "onboardingCompleted": True,
            "provider": enums.AuthProvider.EMAIL,
            "createdAt": NOW,
            "updatedAt": NOW,
        },
    ]

    for u in users_data:
        existing = await prisma.user.find_first(where={"email": u["email"]})
        if existing:
            # Update existing instructor with latest data
            actual_id = existing.id
            HOUARI_ID = actual_id
            ZAKARYA_ID = actual_id
            REDHA_ID = actual_id
            await prisma.user.update(
                where={"id": actual_id},
                data={k: v for k, v in u.items() if k not in ("skills", "id")},
            )
            print(f"  • {u['fullName']} — updated (id={actual_id})")
        else:
            created = await prisma.user.create(
                data={k: v for k, v in u.items() if k not in ("skills", "id")}
            )
            actual_id = created.id
            HOUARI_ID = actual_id
            ZAKARYA_ID = actual_id
            REDHA_ID = actual_id
            print(f"  ✓ {u['fullName']} — created (id={actual_id})")

    # Re-seed skills for each instructor (delete all first, then re-create)
    for u in users_data:
        await prisma.userskill.delete_many(where={"userId": HOUARI_ID})
        for skill_name in u["skills"]:
            await prisma.userskill.create(
                data={
                    "userId": HOUARI_ID,
                    "name": skill_name,
                }
            )
        print(f"  ✓ Skills seeded for {u['fullName']}")


# =============================================================================
# 2. SEED LEARNING PATH
# =============================================================================


async def seed_path():
    """Create the AI-Augmented Professional learning path."""
    print("\n📚 Seeding learning path...")

    await prisma.path.create(
        data={
            "id": PATH_AI_PROFESSIONAL_ID,
            "title": "AI-Augmented Professional",
            "description": "Master the four essential skills for the Algerian digital economy: Python data analysis, AI-powered productivity, Excel & AI for business intelligence, and cybersecurity fundamentals. This path transforms you from a beginner into a job-ready, AI-augmented professional.",
            "featured": True,
            "price": Json(
                {
                    "original": 15000,
                    "discounted": 12000,
                    "currency": "DZD",
                    "billing": "one-time",
                }
            ),
            "thumbnailUrl": "/images/paths/ai-augmented-professional.jpg",
            "createdAt": NOW,
            "updatedAt": NOW,
        }
    )
    print(f"  ✓ Path created: AI-Augmented Professional")


# =============================================================================
# 3. SEED MODULES (Courses)
# =============================================================================


async def seed_modules():
    """Create the 4 launch modules with full metadata."""
    print("\n📖 Seeding modules...")

    modules = [
        # ── Course 1: Python for Data Analysis (Free / Redha) ──────────────
        {
            "id": MODULE_PYTHON_ID,
            "title": "Python for Data Analysis",
            "description": "Learn Python from scratch and use it to analyze real data. No prior coding experience needed. By the end, you'll write Python scripts to clean, explore, and visualize datasets — the foundational skill for data work.",
            "fullDescription": "Python has become the lingua franca of data work — adopted by 57.9% of developers worldwide (Stack Overflow 2025). This course takes you from absolute zero to writing real data analysis scripts. You'll learn variables, data structures, control flow, and functions in Python, then immediately apply them to real-world datasets. The course is built around a single project: analyzing Algerian economic indicators, so everything you learn is immediately contextualized. Each section includes hands-on exercises and a quiz to reinforce learning. No prior programming experience required — just a willingness to think systematically.",
            "durationMinutes": 360,
            "estimatedEffort": "6 hours total — 1 hour per lesson",
            "totalLessons": 10,
            "level": "Beginner",
            "instructorId": REDHA_ID,
            "status": enums.ModuleStatus.PUBLISHED,
            "publishedAt": NOW,
            "skills": [
                "Python",
                "Data Analysis",
                "Pandas",
                "Data Visualization",
                "Jupyter",
            ],
            "tags": ["python", "data-analysis", "beginner", "algeria", "programming"],
            "featured": True,
            "lastUpdated": NOW,
            "price": Json(
                {
                    "original": 0,
                    "discounted": 0,
                    "currency": "DZD",
                    "billing": "free",
                    "isFree": True,
                }
            ),
            "thumbnailUrl": "/images/courses/python-data-analysis.jpg",
            "createdAt": NOW,
            "updatedAt": NOW,
        },
        # ── Course 2: Build & Launch Any Web App with AI (Zakarya) ──────────
        {
            "id": MODULE_AI_BUILDER_ID,
            "title": "Build & Launch Any Web App with AI: From Idea to Online Business (No Coding Needed)",
            "description": "Turn any idea into a real, money-making web application in 48 hours using AI. Learn to create beautiful pages, user logins, EDAHABIA/CIB payments, and deploy online — zero coding background required.",
            "fullDescription": "You don't need a computer science degree or months of coding bootcamps to build real web applications. In this course, Zakarya Roubhi (CEO & CTO of Podacium) opens up the exact AI playbook used to build Podacium itself. You'll learn how to talk to AI to design your product, generate 80% of your app in minutes on free cloud tools, customize responsive designs in French and Arabic, store customer data, and accept Algerian EDAHABIA and CIB card payments via Chargily Pay. We cover automated WhatsApp lead recovery, Algerian e-commerce legal compliance (Law 18-05 & ANPDP), and deploying your project live on a .dz domain for just 5€/month. Complete the capstone project to earn your verified Podacium Skill Passport and start offering 50,000 to 250,000 DZD freelance web build services to local businesses.",
            "durationMinutes": 410,
            "estimatedEffort": "7 hours total — 39 micro-lessons (8-12 min each)",
            "totalLessons": 39,
            "level": "All Levels",
            "instructorId": ZAKARYA_ID,
            "status": enums.ModuleStatus.PUBLISHED,
            "publishedAt": NOW,
            "skills": [
                "AI Web Building",
                "Prompt Engineering",
                "Web App Creation",
                "Chargily Pay (EDAHABIA/CIB)",
                "Bilingual & Arabic RTL Design",
                "WhatsApp Lead Automation",
                "Cloud Deployment",
                "Freelancing & Monetization",
            ],
            "tags": [
                "ai",
                "no-code",
                "web-apps",
                "chargily",
                "algeria",
                "freelance",
                "business",
                "entrepreneurship",
            ],
            "featured": True,
            "lastUpdated": NOW,
            "price": Json(
                {
                    "original": 7000,
                    "discounted": 4900,
                    "currency": "DZD",
                    "billing": "one-time",
                }
            ),
            "thumbnailUrl": "/images/courses/ai-fullstack-builder.jpg",
            "createdAt": NOW,
            "updatedAt": NOW,
        },
        # ── Course 3: Excel & AI for Business (Zakarya) ────────────────────
        {
            "id": MODULE_EXCEL_ID,
            "title": "Excel & AI for Business: From Data to Decisions",
            "description": "Master Excel formulas, PivotTables, and AI-powered data cleaning. Build professional business dashboards that turn raw data into actionable insights.",
            "fullDescription": "Excel remains the most widely used business analysis tool — and AI has made it exponentially more powerful. This course takes you from comfortable Excel user to confident business analyst. You'll learn advanced formulas, PivotTables, data cleaning techniques, and how to use AI copilots (Copilot in Excel, ChatGPT data analysis) to automate your workflow. All examples use Algerian business scenarios: revenue seasonality, wilaya-level sales patterns, and Carnet/Kridi cash flow analysis. By the end, you'll produce a complete business dashboard from raw data.",
            "durationMinutes": 360,
            "estimatedEffort": "6 hours total — ~45 min per lesson",
            "totalLessons": 8,
            "level": "Beginner",
            "instructorId": ZAKARYA_ID,
            "status": enums.ModuleStatus.PUBLISHED,
            "publishedAt": NOW,
            "skills": [
                "Excel",
                "PivotTables",
                "AI Copilot",
                "Data Cleaning",
                "Business Dashboards",
            ],
            "tags": [
                "excel",
                "ai",
                "business",
                "dashboards",
                "algeria",
                "data-analysis",
            ],
            "featured": True,
            "lastUpdated": NOW,
            "price": Json(
                {
                    "original": 6000,
                    "discounted": 4900,
                    "currency": "DZD",
                    "billing": "one-time",
                }
            ),
            "thumbnailUrl": "/images/courses/excel-ai-business.jpg",
            "createdAt": NOW,
            "updatedAt": NOW,
        },
        # ── Course 4: Cybersecurity for Everyone (External Phase 1) ─────────
        {
            "id": MODULE_CYBERSECURITY_ID,
            "title": "Cybersecurity for Everyone: Protect Your Data & Career",
            "description": "Learn to protect yourself and your business from digital threats — phishing, password attacks, and data breaches — with practical, no-tech skills you can use today.",
            "fullDescription": "Cybersecurity is no longer optional — Presidential Decree 26-07 mandates cybersecurity units in all Algerian enterprises. Yet 92% of Algerian SMEs have no basic digital protection. This course covers: recognizing phishing attempts in Darja and French, password management with a password manager, enabling 2FA everywhere, securing your phone and laptop, safe social media practices, understanding ANPDP (Law 25-11) compliance basics, and creating a personal security plan. No technical background required — just a phone or computer you want to keep safe.",
            "durationMinutes": 360,
            "estimatedEffort": "6 hours total — ~45 min per lesson",
            "totalLessons": 8,
            "level": "Beginner",
            "instructorId": None,
            "status": enums.ModuleStatus.PUBLISHED,
            "publishedAt": NOW,
            "skills": [
                "Cybersecurity",
                "Phishing",
                "Password Management",
                "2FA",
                "ANPDP Compliance",
            ],
            "tags": [
                "security",
                "cybersecurity",
                "phishing",
                "anpdp",
                "privacy",
                "algeria",
            ],
            "featured": True,
            "lastUpdated": NOW,
            "price": Json(
                {
                    "original": 7000,
                    "discounted": 5900,
                    "currency": "DZD",
                    "billing": "one-time",
                }
            ),
            "thumbnailUrl": "/images/courses/cybersecurity.jpg",
            "createdAt": NOW,
            "updatedAt": NOW,
        },
    ]

    for m in modules:
        await prisma.module.create(data=m)
        print(f"  ✓ Module created: {m['title']}")


# =============================================================================
# 4. SEED PATH-MODULE LINKS
# =============================================================================


async def seed_path_links():
    """Link the 4 modules to the learning path in order."""
    print("\n🔗 Seeding path-module links...")

    links = [
        {"pathId": PATH_AI_PROFESSIONAL_ID, "moduleId": MODULE_PYTHON_ID, "order": 1},
        {
            "pathId": PATH_AI_PROFESSIONAL_ID,
            "moduleId": MODULE_AI_BUILDER_ID,
            "order": 2,
        },
        {"pathId": PATH_AI_PROFESSIONAL_ID, "moduleId": MODULE_EXCEL_ID, "order": 3},
        {
            "pathId": PATH_AI_PROFESSIONAL_ID,
            "moduleId": MODULE_CYBERSECURITY_ID,
            "order": 4,
        },
    ]

    for link in links:
        await prisma.pathmodule.create(data=link)
    print(f"  ✓ {len(links)} path-module links created")


# =============================================================================
# 5. SEED LESSONS, QUIZZES & QUESTIONS
# =============================================================================

# ──────────────────────────────────────────────────────────────────────────────
# 5a. Python for Data Analysis — 10 lessons
# ──────────────────────────────────────────────────────────────────────────────

PYTHON_LESSONS = [
    {
        "order": 1,
        "title": "Welcome & Why Python?",
        "description": "Understand what Python is, why it dominates data analysis, and set up your coding environment — all in your browser, no installation needed.",
        "durationMinutes": 25,
        "videoUrl": "/videos/python/01-welcome.mp4",
        "transcript": "Welcome to Python for Data Analysis! In this first lesson, we'll understand why Python has become the world's most popular programming language for data work — 57.9% of developers use it (Stack Overflow 2025). You'll set up your first Jupyter Notebook in the browser using Google Colab — no software to install. By the end of this short lesson, you'll write your first Python code: printing 'Hello from Algeria!' to the screen.",
        "learningObjectives": [
            "Explain why Python dominates data analysis",
            "Set up a Jupyter Notebook environment in Google Colab",
            "Write and execute your first Python statement",
        ],
        "keyTakeaways": [
            "Python is the #1 language for data analysis globally",
            "Jupyter Notebooks let you combine code, notes, and visualizations",
            "You can run Python entirely in your browser — no installation needed",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "setup", "jupyter", "welcome"],
        "estimatedCompletionTime": 25,
        "quiz": {
            "title": "Python Setup & Basics Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What percentage of developers use Python according to the Stack Overflow 2025 survey?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "37.2%"},
                        {"id": "b", "text": "57.9%"},
                        {"id": "c", "text": "77.3%"},
                        {"id": "d", "text": "27.5%"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Python reached 57.9% adoption among developers in the Stack Overflow 2025 survey, making it the fastest-growing major programming language.",
                    "points": 10,
                },
                {
                    "order": 2,
                    "question": "What tool do we use in this course to write and run Python code in the browser?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Microsoft Excel"},
                        {"id": "b", "text": "Google Colab"},
                        {"id": "c", "text": "Adobe Photoshop"},
                        {"id": "d", "text": "VS Code Desktop"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Google Colab is a free, browser-based Jupyter Notebook environment that requires zero installation — perfect for beginners.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 2,
        "title": "Variables & Data Types",
        "description": "Learn how Python stores information — numbers, text, and booleans — and how to use variables to hold your data.",
        "durationMinutes": 35,
        "videoUrl": "/videos/python/02-variables.mp4",
        "transcript": "Variables are like labeled boxes where Python stores information. In this lesson, you'll learn the four fundamental data types: integers (whole numbers), floats (decimal numbers), strings (text), and booleans (True/False). You'll practice assigning values to variables, checking their types with type(), and converting between types. Real-world example: we'll store Algeria's population (46M) as an integer, the unemployment rate (29.76%) as a float, and the country name as a string.",
        "learningObjectives": [
            "Create and assign values to variables",
            "Distinguish between int, float, str, and bool data types",
            "Convert between data types using type casting",
        ],
        "keyTakeaways": [
            "Variables store data in named containers",
            "Python has 4 basic types: int, float, str, bool",
            "Use type() to check any variable's data type",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "variables", "data-types", "fundamentals"],
        "estimatedCompletionTime": 35,
        "quiz": {
            "title": "Variables & Types Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What data type is the value 29.76?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "int"},
                        {"id": "b", "text": "float"},
                        {"id": "c", "text": "str"},
                        {"id": "d", "text": "bool"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "29.76 has a decimal point, making it a float (floating-point number).",
                    "points": 10,
                },
                {
                    "order": 2,
                    "question": "What does type('Algeria') return?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "<class 'int'>"},
                        {"id": "b", "text": "<class 'float'>"},
                        {"id": "c", "text": "<class 'str'>"},
                        {"id": "d", "text": "<class 'bool'>"},
                    ],
                    "correctAnswer": "c",
                    "explanation": "'Algeria' is a string (text) enclosed in quotes, so type() returns <class 'str'>.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 3,
        "title": "Lists & Dictionaries: Storing Collections",
        "description": "Go beyond single values — learn to store and organize collections of data using Python's most versatile data structures.",
        "durationMinutes": 40,
        "videoUrl": "/videos/python/03-collections.mp4",
        "transcript": "Real-world data comes in collections — not single values. You'll learn two essential structures: lists (ordered sequences, like ['Algiers', 'Oran', 'Constantine']) and dictionaries (key-value pairs, like {'city': 'Oran', 'population': 1.5M}). We'll practice adding, removing, and accessing elements, and use a real Algerian dataset: wilaya names and their populations.",
        "learningObjectives": [
            "Create and manipulate lists with .append(), .remove(), and indexing",
            "Create and access dictionaries using key-value pairs",
            "Choose between lists and dictionaries for different data scenarios",
        ],
        "keyTakeaways": [
            "Lists store ordered sequences — use them for ranked or sequential data",
            "Dictionaries store key-value pairs — use them for structured records",
            "Both are mutable: you can add, remove, and change elements",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "lists", "dictionaries", "collections"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Collections Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which method adds an element to the end of a list?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": ".add()"},
                        {"id": "b", "text": ".insert()"},
                        {"id": "c", "text": ".append()"},
                        {"id": "d", "text": ".push()"},
                    ],
                    "correctAnswer": "c",
                    "explanation": ".append() adds an element to the end of a list in Python.",
                    "points": 10,
                },
                {
                    "order": 2,
                    "question": "What is the correct syntax to access the value associated with key 'name' in a dictionary?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "dict['name']"},
                        {"id": "b", "text": "dict['name']"},
                        {"id": "c", "text": "dict.get('name')"},
                        {
                            "id": "d",
                            "text": "Both a and b are correct — they do the same thing",
                        },
                    ],
                    "correctAnswer": "c",
                    "explanation": "Both dict['name'] and dict.get('name') access the value, but .get() is safer because it returns None (instead of an error) if the key doesn't exist.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 4,
        "title": "Control Flow: Making Decisions",
        "description": "Teach Python to make decisions with if/elif/else statements and repeat actions with for loops — the core logic of any program.",
        "durationMinutes": 40,
        "videoUrl": "/videos/python/04-control-flow.mp4",
        "transcript": "Programs need to make decisions and repeat actions. In this lesson, you'll learn if/elif/else statements (e.g., 'if unemployment_rate > 20: print('High') else: print('Moderate')') and for loops to iterate over data. We'll analyze a real scenario: classifying Algerian wilayas by population size and looping through a list of cities to generate a report.",
        "learningObjectives": [
            "Write if/elif/else conditional statements",
            "Use for loops to iterate over lists and dictionaries",
            "Combine conditionals and loops to filter data",
        ],
        "keyTakeaways": [
            "if/elif/else lets Python make decisions based on conditions",
            "for loops repeat an action for each item in a collection",
            "Combining loops and conditionals is how real data analysis works",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "control-flow", "loops", "conditionals"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Control Flow Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What will this code print?\nx = 15\nif x > 20:\n    print('Big')\nelse:\n    print('Small')",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Big"},
                        {"id": "b", "text": "Small"},
                        {"id": "c", "text": "Error"},
                        {"id": "d", "text": "None"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "x=15 is not greater than 20, so the else branch executes and prints 'Small'.",
                    "points": 10,
                },
                {
                    "order": 2,
                    "question": "What is the output of: for i in range(3): print(i)",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "1 2 3"},
                        {"id": "b", "text": "0 1 2"},
                        {"id": "c", "text": "0 1 2 3"},
                        {"id": "d", "text": "Error"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "range(3) generates numbers 0, 1, 2 — Python uses zero-based indexing.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 5,
        "title": "Functions: Reusable Code",
        "description": "Write reusable blocks of code with functions — the building block of clean, organized Python programs.",
        "durationMinutes": 35,
        "videoUrl": "/videos/python/05-functions.mp4",
        "transcript": "Functions are reusable recipes — you write the instructions once and use them many times. You'll learn to define functions with def, pass arguments, return values, and write docstrings. Real example: a function that takes a wilaya name and returns its estimated population, handling the lookup and formatting in one reusable block.",
        "learningObjectives": [
            "Define functions using the def keyword",
            "Use parameters and return values",
            "Write docstrings to document your functions",
        ],
        "keyTakeaways": [
            "Functions eliminate repetition — write once, use many times",
            "Parameters let functions work with different inputs each time",
            "Docstrings (''') document what your function does for others",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "functions", "reusability", "best-practices"],
        "estimatedCompletionTime": 35,
        "quiz": {
            "title": "Functions Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which keyword defines a function in Python?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "function"},
                        {"id": "b", "text": "def"},
                        {"id": "c", "text": "func"},
                        {"id": "d", "text": "define"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Python uses the 'def' keyword to define functions.",
                    "points": 10,
                },
                {
                    "order": 2,
                    "question": "What does a function return if there is no return statement?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "0"},
                        {"id": "b", "text": "True"},
                        {"id": "c", "text": "None"},
                        {"id": "d", "text": "Error"},
                    ],
                    "correctAnswer": "c",
                    "explanation": "Functions without a return statement implicitly return None in Python.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 6,
        "title": "Introduction to Pandas",
        "description": "Meet Pandas — Python's most powerful data analysis library. Learn to load CSV files and inspect your data in seconds.",
        "durationMinutes": 40,
        "videoUrl": "/videos/python/06-pandas-intro.mp4",
        "transcript": "Pandas is the Swiss Army knife of data analysis in Python. In this lesson, you'll learn to import Pandas, load a CSV file into a DataFrame (a spreadsheet-like structure), and inspect it using .head(), .info(), .describe(), and .shape. We'll use a real dataset: Algerian unemployment rates by wilaya and year. You'll see how Pandas turns raw CSV files into something you can explore in seconds.",
        "learningObjectives": [
            "Import Pandas with the alias pd",
            "Load a CSV file into a DataFrame",
            "Use .head(), .info(), .describe(), and .shape to explore data",
        ],
        "keyTakeaways": [
            "Pandas DataFrames are like spreadsheets with superpowers",
            ".head() shows the first rows; .info() shows column types and missing values",
            ".describe() gives summary statistics for all numeric columns",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "pandas", "dataframe", "csv", "data-loading"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Pandas Basics Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which Pandas method shows the first 5 rows of a DataFrame?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": ".show()"},
                        {"id": "b", "text": ".first()"},
                        {"id": "c", "text": ".head()"},
                        {"id": "d", "text": ".top()"},
                    ],
                    "correctAnswer": "c",
                    "explanation": ".head() returns the first 5 rows by default. You can pass a number, like .head(10).",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 7,
        "title": "Data Cleaning with Pandas",
        "description": "Real data is messy. Learn to handle missing values, remove duplicates, and fix incorrect data types — the most important skill in data analysis.",
        "durationMinutes": 45,
        "videoUrl": "/videos/python/07-data-cleaning.mp4",
        "transcript": "80% of data analysis is cleaning data. In this lesson, you'll learn the essential cleaning techniques: detecting missing values with .isnull(), filling or dropping them with .fillna() and .dropna(), removing duplicates with .drop_duplicates(), and converting data types with .astype(). We'll clean a real messy dataset of Algerian import/export figures — complete with missing values and inconsistent formatting.",
        "learningObjectives": [
            "Detect missing values using .isnull() and .isna()",
            "Handle missing data with .fillna() and .dropna()",
            "Remove duplicate rows and fix data types",
        ],
        "keyTakeaways": [
            "Real data always has missing values — don't panic, handle them systematically",
            ".isnull().sum() gives you a quick count of missing values per column",
            "Choose between filling (fillna) or dropping (dropna) based on context",
        ],
        "difficulty": "Beginner",
        "tags": ["python", "pandas", "data-cleaning", "missing-values"],
        "estimatedCompletionTime": 45,
        "quiz": {
            "title": "Data Cleaning Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 12,
            "questions": [
                {
                    "order": 1,
                    "question": "What does df.isnull().sum() tell you?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Total number of cells in df"},
                        {"id": "b", "text": "Number of missing values per column"},
                        {"id": "c", "text": "Number of duplicate rows"},
                        {"id": "d", "text": "Sum of all numeric values"},
                    ],
                    "correctAnswer": "b",
                    "explanation": ".isnull() creates a boolean mask, and .sum() counts the True values per column — giving you the count of missing values in each column.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 8,
        "title": "Exploratory Data Analysis (EDA)",
        "description": "Explore and summarize your data like a data scientist. Learn to compute statistics, group data, and find patterns.",
        "durationMinutes": 40,
        "videoUrl": "/videos/python/08-eda.mp4",
        "transcript": "Exploratory Data Analysis (EDA) is the process of investigating your data to discover patterns and relationships. You'll learn to compute grouped statistics with .groupby(), create summary tables with .pivot_table(), and identify correlations between columns. We'll analyze a dataset of Algerian freelance projects — looking at average project values by wilaya, seasonal trends, and correlations between project duration and payment amount.",
        "learningObjectives": [
            "Compute grouped statistics using .groupby()",
            "Create summary tables with .pivot_table()",
            "Identify correlations between numeric columns",
        ],
        "keyTakeaways": [
            ".groupby() splits your data into groups and computes statistics per group",
            "Pivot tables are the Python equivalent of Excel pivot tables",
            "Correlation reveals relationships — but doesn't prove causation",
        ],
        "difficulty": "Intermediate",
        "tags": ["python", "pandas", "eda", "groupby", "statistics"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "EDA Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What does df.groupby('wilaya')['price'].mean() do?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Groups by price and shows mean wilaya"},
                        {"id": "b", "text": "Shows the mean price for each wilaya"},
                        {"id": "c", "text": "Filters rows where wilaya equals 'price'"},
                        {
                            "id": "d",
                            "text": "Calculates the mean of all columns per wilaya",
                        },
                    ],
                    "correctAnswer": "b",
                    "explanation": "It groups rows by wilaya, selects the 'price' column, and computes the mean for each group.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 9,
        "title": "Data Visualization with Matplotlib",
        "description": "A picture is worth a thousand spreadsheets. Learn to create bar charts, line plots, and histograms that tell a story.",
        "durationMinutes": 35,
        "videoUrl": "/videos/python/09-visualization.mp4",
        "transcript": "Visualization turns numbers into insights. Using Matplotlib (and Seaborn for prettier charts), you'll learn to create bar charts for comparing categories, line plots for trends over time, and histograms for distributions. We'll visualize Algerian economic data: unemployment trends from 2019-2025, sector-by-sector GDP contribution, and the distribution of freelance project values. You'll leave with a template you can reuse for any dataset.",
        "learningObjectives": [
            "Create bar charts and line plots with Matplotlib",
            "Customize charts with titles, labels, and legends",
            "Choose the right chart type for different kinds of data",
        ],
        "keyTakeaways": [
            "Bar charts compare categories; line charts show trends over time",
            "plt.plot() for lines, plt.bar() for bars, plt.hist() for distributions",
            "Always label your axes — a chart without labels is meaningless",
        ],
        "difficulty": "Intermediate",
        "tags": ["python", "matplotlib", "visualization", "charts"],
        "estimatedCompletionTime": 35,
        "quiz": {
            "title": "Visualization Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which Matplotlib function creates a bar chart?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "plt.plot()"},
                        {"id": "b", "text": "plt.bar()"},
                        {"id": "c", "text": "plt.hist()"},
                        {"id": "d", "text": "plt.scatter()"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "plt.bar() creates vertical bar charts. plt.barh() creates horizontal ones.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 10,
        "title": "Final Project: Analyze Your Own Dataset",
        "description": "Bring it all together — load, clean, analyze, and visualize a real dataset of your choice. This is your first portfolio piece.",
        "durationMinutes": 25,
        "videoUrl": "/videos/python/10-final-project.mp4",
        "transcript": "This is where everything comes together. You'll choose a dataset (we provide Algerian economic data, but you can use your own), load it with Pandas, clean it, explore it with summary statistics, create at least two visualizations, and write a brief interpretation of what you found. The result is a Jupyter Notebook you can share as your first data analysis portfolio piece. We'll walk through a complete example first: analyzing 2024 Algerian olive oil exports by destination country.",
        "learningObjectives": [
            "Apply the full data analysis workflow to a new dataset",
            "Produce a complete Jupyter Notebook with code, charts, and interpretation",
            "Share your analysis as a portfolio piece",
        ],
        "keyTakeaways": [
            "The full workflow is: load → clean → explore → visualize → interpret",
            "A well-documented notebook is a powerful portfolio piece",
            "You now have the foundation to learn any data tool or library",
        ],
        "difficulty": "Intermediate",
        "tags": ["python", "final-project", "portfolio", "capstone"],
        "estimatedCompletionTime": 25,
        "quiz": {
            "title": "Final Project Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the correct order of the data analysis workflow taught in this course?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {
                            "id": "a",
                            "text": "Visualize → Clean → Load → Explore → Interpret",
                        },
                        {
                            "id": "b",
                            "text": "Load → Clean → Explore → Visualize → Interpret",
                        },
                        {
                            "id": "c",
                            "text": "Clean → Load → Interpret → Visualize → Explore",
                        },
                        {
                            "id": "d",
                            "text": "Explore → Load → Clean → Visualize → Interpret",
                        },
                    ],
                    "correctAnswer": "b",
                    "explanation": "The correct workflow is: load the data, clean it, explore it, visualize patterns, then interpret the results.",
                    "points": 10,
                },
            ],
        },
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# 5b. The AI Full-Stack Masterclass — 39 lessons (imported from ai_builder_lessons)
# ──────────────────────────────────────────────────────────────────────────────

EXCEL_LESSONS = [
    {
        "order": 1,
        "title": "Excel Beyond Basics: What You'll Build",
        "description": "See what you'll accomplish in this course — a complete business dashboard from raw data — and learn the mental model for combining Excel with AI.",
        "durationMinutes": 30,
        "videoUrl": "/videos/excel/01-welcome.mp4",
        "transcript": "Excel is still the world's most popular business analysis tool — and AI has made it smarter. In this course, you'll go from comfortable Excel user to confident business analyst. You'll learn advanced formulas, PivotTables, data cleaning, and how to use AI copilots to automate repetitive work. Your final project: a complete business dashboard that turns raw Algerian SME data into actionable insights.",
        "learningObjectives": [
            "Describe the data-to-dashboard workflow",
            "Explain how AI enhances Excel capabilities",
            "Set up your Excel environment for business analysis",
        ],
        "keyTakeaways": [
            "Excel + AI is the most accessible business analysis stack available",
            "The course builds toward one deliverable: a complete business dashboard",
            "All examples use real Algerian business scenarios",
        ],
        "difficulty": "Beginner",
        "tags": ["excel", "ai", "welcome", "business-analysis"],
        "estimatedCompletionTime": 30,
        "quiz": {
            "title": "Excel & AI Introduction Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the main deliverable you will build in this course?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "A Python script"},
                        {"id": "b", "text": "A business dashboard"},
                        {"id": "c", "text": "A mobile app"},
                        {"id": "d", "text": "A website"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "The course builds toward creating a complete business dashboard from raw data.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 2,
        "title": "Formulas That Actually Matter for Business",
        "description": "Stop memorizing every Excel formula. Learn the 10 formulas that solve 90% of real business analysis problems.",
        "durationMinutes": 45,
        "videoUrl": "/videos/excel/02-formulas.mp4",
        "transcript": "There are over 400 Excel formulas. You need exactly 10 for business analysis. This lesson covers: SUMIFS (conditional summing), COUNTIFS (conditional counting), AVERAGEIFS, XLOOKUP (find any value), IF with AND/OR (business logic), TEXT formulas (cleaning messy data), DATE functions (working with dates), and LET (writing clean formulas). Real example: calculating total sales by month for a specific product category in Oran.",
        "learningObjectives": [
            "Write SUMIFS, COUNTIFS, and AVERAGEIFS for conditional analysis",
            "Use XLOOKUP to cross-reference data across sheets",
            "Combine IF with AND/OR for business logic",
        ],
        "keyTakeaways": [
            "10 formulas cover 90% of business analysis scenarios",
            "XLOOKUP replaces VLOOKUP entirely — it's simpler and more powerful",
            "Break complex formulas into steps using LET()",
        ],
        "difficulty": "Intermediate",
        "tags": ["excel", "formulas", "sumifs", "xlookup", "business"],
        "estimatedCompletionTime": 45,
        "quiz": {
            "title": "Excel Formulas Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which function adds values that meet multiple criteria?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "SUM"},
                        {"id": "b", "text": "SUMIFS"},
                        {"id": "c", "text": "VLOOKUP"},
                        {"id": "d", "text": "COUNTIFS"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "SUMIFS adds cells that meet multiple criteria. SUM adds everything. COUNTIFS counts instead of summing.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 3,
        "title": "PivotTables: Summarize Thousands of Rows in Seconds",
        "description": "Turn massive datasets into one-page summaries with drag-and-drop. The single most powerful Excel feature for business.",
        "durationMinutes": 40,
        "videoUrl": "/videos/excel/03-pivottables.mp4",
        "transcript": "PivotTables are Excel's superpower. In this lesson, you'll learn: creating a PivotTable from any dataset, adding rows, columns, and values, filtering and slicing, grouping dates by month/quarter/year, creating calculated fields, and formatting for professional presentation. Real example: a year of sales data from an Algerian electronics retailer — total sales by month, by product category, by wilaya, all in one compact table.",
        "learningObjectives": [
            "Create a PivotTable from a raw dataset",
            "Group and filter data within a PivotTable",
            "Create calculated fields for custom metrics",
        ],
        "keyTakeaways": [
            "PivotTables summarize thousands of rows into a one-page report",
            "Drag fields between areas (rows, columns, values, filters) to explore",
            "Add a Slicer for interactive filtering",
        ],
        "difficulty": "Intermediate",
        "tags": ["excel", "pivottable", "analysis", "summarize"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "PivotTable Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is a PivotTable best used for?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Creating charts"},
                        {"id": "b", "text": "Summarizing large datasets interactively"},
                        {"id": "c", "text": "Writing formulas"},
                        {"id": "d", "text": "Importing data"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "PivotTables are designed for interactively summarizing, analyzing, and exploring large datasets.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 4,
        "title": "Data Cleaning: The 80% of Analysis Nobody Talks About",
        "description": "Real business data is always messy. Learn a repeatable system for cleaning data in minutes.",
        "durationMinutes": 40,
        "videoUrl": "/videos/excel/04-cleaning.mp4",
        "transcript": "80% of analysis time is spent cleaning data. In this lesson, you'll learn a repeatable cleaning workflow: remove duplicates, fix inconsistent text (TRIM, PROPER, UPPER), split combined columns (Text to Columns, Flash Fill), handle missing values, standardize date formats, and use Power Query for repeatable cleaning. Real example: cleaning a year of messy supplier invoices with inconsistent naming and formats.",
        "learningObjectives": [
            "Apply a repeatable data cleaning workflow",
            "Use Power Query to automate cleaning steps",
            "Handle common data quality issues",
        ],
        "keyTakeaways": [
            "Build a cleaning checklist and reuse it on every dataset",
            "Power Query records your cleaning steps — reuse them on new data",
            "Never clean raw data — always work on a copy",
        ],
        "difficulty": "Intermediate",
        "tags": ["excel", "cleaning", "power-query", "data-quality"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Data Cleaning Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What percentage of analysis time is typically spent on data cleaning?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "20%"},
                        {"id": "b", "text": "50%"},
                        {"id": "c", "text": "80%"},
                        {"id": "d", "text": "10%"},
                    ],
                    "correctAnswer": "c",
                    "explanation": "Industry data consistently shows that data cleaning takes about 80% of analysis time.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 5,
        "title": "AI Copilot in Excel: Let AI Do the Heavy Lifting",
        "description": "Use Copilot in Excel and ChatGPT to analyze data, write formulas, and generate insights without remembering syntax.",
        "durationMinutes": 45,
        "videoUrl": "/videos/excel/05-ai-copilot.mp4",
        "transcript": "Microsoft Copilot is built directly into Excel 365 — and it can write formulas, create charts, and analyze data on your command. In this lesson, you'll learn: asking Copilot to write complex formulas in plain language, using ChatGPT to analyze pasted data tables, generating chart recommendations, and creating a workflow where you describe what you need and AI writes the formula. Real example: 'Show me total sales by product category for Q4, excluding returns' — Copilot writes the formula instantly.",
        "learningObjectives": [
            "Use Copilot in Excel to generate formulas from natural language",
            "Paste data into ChatGPT/Claude for instant analysis",
            "Create a human-AI workflow for business analysis",
        ],
        "keyTakeaways": [
            "Copilot turns 'I need to see X by Y' into a working formula",
            "AI is not replacing analysis — it's removing the syntax barrier",
            "You still need to verify AI output and ask the right questions",
        ],
        "difficulty": "Beginner",
        "tags": ["excel", "ai", "copilot", "chatgpt", "automation"],
        "estimatedCompletionTime": 45,
        "quiz": {
            "title": "AI Copilot Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the best way to use Copilot in Excel?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Let it make all decisions"},
                        {
                            "id": "b",
                            "text": "Describe what you need in plain language and verify the result",
                        },
                        {"id": "c", "text": "Only use it for charts"},
                        {
                            "id": "d",
                            "text": "Don't use it — write all formulas manually",
                        },
                    ],
                    "correctAnswer": "b",
                    "explanation": "Describe what you need in natural language, let Copilot generate it, then verify the output. You remain the analyst.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 6,
        "title": "Charts That Tell a Story",
        "description": "Turn numbers into clear, professional charts — and learn which chart type to use for every business scenario.",
        "durationMinutes": 40,
        "videoUrl": "/videos/excel/06-charts.mp4",
        "transcript": "A great chart communicates in 2 seconds. This lesson covers: choosing the right chart (bar for comparisons, line for trends, combo charts for mixed data), Excel chart best practices (clean labels, consistent colors, no chart junk), creating sparklines for compact trends, using Recommended Charts, and building a dashboard layout. Real examples: revenue breakdown by product, monthly trend with forecast, and a before/after chart makeover.",
        "learningObjectives": [
            "Choose the right chart type for any business question",
            "Apply professional chart formatting",
            "Build a multi-chart dashboard layout",
        ],
        "keyTakeaways": [
            "Bar charts for comparisons, line charts for trends, pie charts rarely",
            "Remove gridlines, use clean labels, let the data speak",
            "A dashboard tells a story across multiple charts on one page",
        ],
        "difficulty": "Intermediate",
        "tags": ["excel", "charts", "visualization", "dashboard"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Charting Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which chart type is best for showing a trend over time?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Pie chart"},
                        {"id": "b", "text": "Bar chart"},
                        {"id": "c", "text": "Line chart"},
                        {"id": "d", "text": "Scatter plot"},
                    ],
                    "correctAnswer": "c",
                    "explanation": "Line charts are ideal for showing trends over continuous time periods.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 7,
        "title": "Algerian Business Scenarios: Seasonality & Local Context",
        "description": "Generic analysis misses what matters in Algeria. Learn to account for Ramadan, wilaya differences, and the Carnet system.",
        "durationMinutes": 40,
        "videoUrl": "/videos/excel/07-algeria-context.mp4",
        "transcript": "This is where Excel meets Algerian reality. In this lesson, you'll analyze: Ramadan seasonality (consumption shifts 20-40%), wilaya-level economic variation (Oran vs Tamanrasset), the Carnet/Kridi informal credit impact on cash flow, and Algerian holiday effects. Using PivotTables and charts, you'll discover patterns in real data that generic analysis would miss.",
        "learningObjectives": [
            "Adjust business analysis for Ramadan and Algerian holidays",
            "Analyze wilaya-level sales variations",
            "Account for informal credit in cash flow analysis",
        ],
        "keyTakeaways": [
            "Ramadan shifts consumption 20-40% — always compare like periods",
            "National averages hide local truth — analyze by wilaya",
            "Carnet/Kridi means 'sales' ≠ 'cash received'",
        ],
        "difficulty": "Intermediate",
        "tags": ["excel", "algeria", "seasonality", "ramadan", "carnet"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Algerian Context Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Why is it important to account for Ramadan in business analysis?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "It doesn't affect business data"},
                        {
                            "id": "b",
                            "text": "Consumption shifts 20-40%, affecting comparisons",
                        },
                        {"id": "c", "text": "Only food businesses are affected"},
                        {
                            "id": "d",
                            "text": "It only matters for international companies",
                        },
                    ],
                    "correctAnswer": "b",
                    "explanation": "Ramadan drives 20-40% consumption shifts across many categories. Comparing Ramadan data to non-Ramadan data without adjustment leads to wrong conclusions.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 8,
        "title": "Final Project: Build Your Business Dashboard",
        "description": "Bring everything together — clean data, build PivotTables, create charts, and produce a complete business dashboard.",
        "durationMinutes": 30,
        "videoUrl": "/videos/excel/08-final-project.mp4",
        "transcript": "This is your capstone. Using provided Algerian business data (or your own), you'll: clean the raw data with Power Query, build PivotTables to explore patterns, create at least two charts, use Copilot/AI for one analysis step, and arrange everything into a professional dashboard. We'll walk through a complete example first: a dashboard for an Oran-based electronics retailer showing monthly revenue, top products, and wilaya performance.",
        "learningObjectives": [
            "Apply the full Excel + AI workflow independently",
            "Produce a complete business dashboard",
            "Present data-driven insights with confidence",
        ],
        "keyTakeaways": [
            "You now have a repeatable workflow: clean → analyze → visualize → present",
            "Your dashboard is a portfolio piece for BI or data analysis roles",
            "The same workflow works for any business in any sector",
        ],
        "difficulty": "Intermediate",
        "tags": ["excel", "final-project", "dashboard", "capstone"],
        "estimatedCompletionTime": 30,
        "quiz": {
            "title": "Final Project Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the first step in the data-to-dashboard workflow?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Create charts"},
                        {"id": "b", "text": "Clean the data"},
                        {"id": "c", "text": "Write formulas"},
                        {"id": "d", "text": "Share the dashboard"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Always clean data first. Garbage in = garbage out. Clean data is the foundation of everything else.",
                    "points": 10,
                },
            ],
        },
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# 5d. Cybersecurity for Everyone — 8 lessons
# ──────────────────────────────────────────────────────────────────────────────

CYBERSECURITY_LESSONS = [
    {
        "order": 1,
        "title": "Why Cybersecurity Matters for Every Algerian",
        "description": "Understand the real threats facing Algerians online — phishing in Darja, phone scams, and data breaches — and why Presidential Decree 26-07 makes this urgent.",
        "durationMinutes": 30,
        "videoUrl": "/videos/security/01-why-matters.mp4",
        "transcript": "Cybersecurity is not just for IT professionals. In Algeria, cybercrime is rising fast: phishing messages in Darja targeting EDAHABIA card users, fake CNRC registration sites, and social media account takeovers. Add Presidential Decree 26-07 (2026), which mandates cybersecurity units in every enterprise, and this is now a legal requirement, not an option. In this lesson, you'll learn the real threat landscape for Algerians — your phone, your bank card, your social media, and your business are all targets. By the end, you'll understand why 'it won't happen to me' is the most dangerous mindset.",
        "learningObjectives": [
            "Identify the top cyber threats facing Algerians today",
            "Explain why Presidential Decree 26-07 affects you",
            "Adopt a security-first mindset for daily digital life",
        ],
        "keyTakeaways": [
            "Cybercrime is rising in Algeria — phishing, scams, and data breaches",
            "Decree 26-07 makes cybersecurity mandatory for enterprises",
            "Everyone is a target — size or industry doesn't matter",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "cybersecurity", "algeria", "threats", "decree-26-07"],
        "estimatedCompletionTime": 30,
        "quiz": {
            "title": "Cybersecurity Awareness Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "Which Algerian decree mandates cybersecurity units in enterprises?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Decree 1275"},
                        {"id": "b", "text": "Presidential Decree 26-07"},
                        {"id": "c", "text": "Law 25-11"},
                        {"id": "d", "text": "Commercial Code Article 34"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Presidential Decree 26-07 (2026) mandates cybersecurity units in all Algerian enterprises.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 2,
        "title": "Phishing: Don't Take the Bait",
        "description": "Learn to spot phishing attempts in Darja, French, and English — the #1 way Algerians get hacked.",
        "durationMinutes": 45,
        "videoUrl": "/videos/security/02-phishing.mp4",
        "transcript": "Phishing is the #1 cyber threat in Algeria. Fake messages pretending to be from EDAHABIA, Algérie Poste, or your bank — asking you to 'verify your account' or 'claim a refund'. In this lesson, you'll learn: the 5 signs of a phishing message (urgency, generic greeting, bad grammar, suspicious links, requests for personal info), how to inspect a link before clicking, what to do if you receive a suspicious message, and real examples of Darja-language phishing attempts. By the end, you'll be able to spot a phishing attempt in seconds.",
        "learningObjectives": [
            "Identify the 5 signs of a phishing message",
            "Inspect URLs before clicking",
            "Respond correctly to suspicious messages",
        ],
        "keyTakeaways": [
            "Phishing is the #1 threat — most hacks start with a fake message",
            "Never click links in unsolicited messages — navigate to the site directly",
            "When in doubt, don't click — contact the organization through official channels",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "phishing", "scams", "awareness"],
        "estimatedCompletionTime": 45,
        "quiz": {
            "title": "Phishing Awareness Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the best action when you receive a message saying your EDAHABIA card is blocked and you must click a link to reactivate?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Click the link immediately to fix it"},
                        {
                            "id": "b",
                            "text": "Ignore it — it's likely a phishing attempt",
                        },
                        {"id": "c", "text": "Forward it to friends to warn them"},
                        {"id": "d", "text": "Reply with your card number to verify"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Unsolicited messages asking you to click links are almost always phishing. Ignore and delete. If concerned, contact Algérie Poste through official channels.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 3,
        "title": "Password Management: Your First Line of Defense",
        "description": "Stop using weak passwords and reuse. Learn to create strong passwords and manage them with a password manager.",
        "durationMinutes": 40,
        "videoUrl": "/videos/security/03-passwords.mp4",
        "transcript": "The most common password in Algeria is '123456'. The second is 'algeria2024'. If you use the same password for Facebook, your email, and your bank account — you're one breach away from losing everything. In this lesson, you'll learn: what makes a password strong, why password managers are essential (free options: Bitwarden, Apple Passwords, Google Password Manager), how to set up a password manager, enabling two-factor authentication (2FA) everywhere, and creating a 'master password' you can remember but nobody can guess.",
        "learningObjectives": [
            "Create strong, unique passwords without memorizing them",
            "Set up a password manager on your phone and computer",
            "Enable 2FA on all important accounts",
        ],
        "keyTakeaways": [
            "A password manager is not optional — it's essential",
            "Use a different password for every account — the manager remembers them",
            "2FA stops 99.9% of automated account takeovers",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "passwords", "password-manager", "2fa"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Password Security Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the best way to manage passwords for all your accounts?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Use the same strong password everywhere"},
                        {"id": "b", "text": "Write them in a notebook"},
                        {
                            "id": "c",
                            "text": "Use a password manager with different passwords per account",
                        },
                        {"id": "d", "text": "Use simple passwords you can remember"},
                    ],
                    "correctAnswer": "c",
                    "explanation": "A password manager generates and stores unique, strong passwords for each account. You only need to remember one master password.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 4,
        "title": "Secure Your Phone and Computer",
        "description": "Practical steps to secure the devices you use every day — updates, encryption, backups, and safe browsing habits.",
        "durationMinutes": 35,
        "videoUrl": "/videos/security/04-devices.mp4",
        "transcript": "Your phone and computer are the gateways to your digital life. In this lesson, you'll learn: keeping software updated (the #1 thing people skip), enabling device encryption (iPhone: Face ID + passcode, Android: PIN + encryption, Windows: BitLocker), backing up your data (the 3-2-1 rule: 3 copies, 2 media types, 1 offsite), safe browsing habits (checking for HTTPS, avoiding public Wi-Fi for banking), and what to do if your device is lost or stolen.",
        "learningObjectives": [
            "Keep your devices updated and encrypted",
            "Implement the 3-2-1 backup rule",
            "Practice safe browsing habits",
        ],
        "keyTakeaways": [
            "Updates fix security holes — never postpone them",
            "Encryption protects your data if your device is stolen",
            "A backup is your insurance against ransomware and hardware failure",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "devices", "phone", "computer", "backup"],
        "estimatedCompletionTime": 35,
        "quiz": {
            "title": "Device Security Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What is the 3-2-1 backup rule?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "3 backups, 2 locations, 1 day"},
                        {"id": "b", "text": "3 copies, 2 media types, 1 offsite"},
                        {"id": "c", "text": "3 devices, 2 passwords, 1 backup"},
                        {"id": "d", "text": "3GB, 2 drives, 1 cloud"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "3 copies of your data, on 2 different types of media (e.g., external drive + cloud), with 1 copy stored offsite.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 5,
        "title": "Social Media Safety: Protect Your Reputation",
        "description": "Secure your social media accounts and avoid the most common traps — fake profiles, impersonation, and reputation damage.",
        "durationMinutes": 35,
        "videoUrl": "/videos/security/05-social-media.mp4",
        "transcript": "In Algeria, social media is central to daily life — but it's also the #1 target for impersonation, scams, and reputation attacks. In this lesson, you'll learn: securing your Facebook, Instagram, and LinkedIn accounts, recognizing fake profiles and impersonators, privacy settings that protect your information, what not to post (travel plans, ID documents, financial info), and handling harassment or account takeovers. Real examples: fake freelancer profiles on Facebook groups, and LinkedIn impersonation targeting professionals.",
        "learningObjectives": [
            "Configure privacy settings on major social platforms",
            "Spot fake profiles and impersonation attempts",
            "Respond to harassment or account compromise",
        ],
        "keyTakeaways": [
            "Lock down your social media privacy settings today",
            "Never post your ID card, flight tickets, or financial information",
            "Enable login alerts — know when someone tries to access your account",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "social-media", "privacy", "impersonation"],
        "estimatedCompletionTime": 35,
        "quiz": {
            "title": "Social Media Safety Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What should you do if someone creates a fake profile using your name and photos?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Ignore it — it will go away"},
                        {"id": "b", "text": "Report it to the platform immediately"},
                        {"id": "c", "text": "Create another fake profile to compete"},
                        {"id": "d", "text": "Post about it publicly"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Report impersonation to the platform immediately. Most social media platforms have dedicated reporting flows for impersonation.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 6,
        "title": "Understanding ANPDP: Your Data Rights Under Law 25-11",
        "description": "Algeria's data protection law affects everyone. Learn your rights and obligations under ANPDP (Law 25-11).",
        "durationMinutes": 40,
        "videoUrl": "/videos/security/06-anpdp.mp4",
        "transcript": "Law 25-11 established the ANPDP — Algeria's data protection authority. This law affects every Algerian who uses digital services. In this lesson, you'll learn: what personal data is protected under the law, your rights (access, rectification, erasure, objection), obligations for businesses that collect customer data, the ANPDP registration process, and penalties for non-compliance (up to 500,000 DZD fines). You'll also learn how to spot companies that mishandle your data.",
        "learningObjectives": [
            "Explain your rights under Law 25-11 (ANPDP)",
            "Identify when a business is violating data protection rules",
            "Exercise your data rights with companies that hold your information",
        ],
        "keyTakeaways": [
            "ANPDP gives you the right to know what data companies hold about you",
            "Businesses must register with ANPDP to collect personal data",
            "You can request deletion of your data from any company",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "anpdp", "privacy", "law", "data-rights"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "ANPDP Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What does ANPDP stand for?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {
                            "id": "a",
                            "text": "Autorité Nationale de Protection des Données Personnelles",
                        },
                        {
                            "id": "b",
                            "text": "Algérie Nationale des Politiques Digitales",
                        },
                        {
                            "id": "c",
                            "text": "Agence Nationale de Protection des Données",
                        },
                        {
                            "id": "d",
                            "text": "Association des Professionnels du Numérique",
                        },
                    ],
                    "correctAnswer": "a",
                    "explanation": "ANPDP = Autorité Nationale de Protection des Données Personnelles (National Authority for Personal Data Protection), established by Law 25-11.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 7,
        "title": "Secure Freelancing: Protect Your Business and Clients",
        "description": "If you freelance or run a business online, this lesson covers client data protection, secure payments, and incident response.",
        "durationMinutes": 40,
        "videoUrl": "/videos/security/07-freelance-security.mp4",
        "transcript": "As a freelancer or business owner, you're responsible for your clients' data too. This lesson covers: handling client data securely (never store unencrypted, use cloud storage with access controls), secure payment practices (escrow, never accept overpayments), recognizing business-targeted scams (fake invoices, supplier impersonation), what to do if you experience a data breach, and creating a simple incident response plan. Real scenario: a freelancer receives a message from a 'client' who overpays and asks for a refund — the classic overpayment scam.",
        "learningObjectives": [
            "Handle client data securely",
            "Recognize business-targeted scams",
            "Respond to a data breach or security incident",
        ],
        "keyTakeaways": [
            "Client data is your responsibility — treat it as carefully as your own",
            "Never accept overpayments — it's a common scam pattern",
            "Have a simple plan for what to do if you're hacked",
        ],
        "difficulty": "Intermediate",
        "tags": ["security", "freelancing", "business", "client-data", "scams"],
        "estimatedCompletionTime": 40,
        "quiz": {
            "title": "Business Security Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "A client sends you 50,000 DZD for a 5,000 DZD project and asks you to refund the difference. What should you do?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Refund the difference immediately"},
                        {
                            "id": "b",
                            "text": "This is a common scam — return the full payment and ask them to resend the correct amount",
                        },
                        {"id": "c", "text": "Keep the extra money"},
                        {"id": "d", "text": "Ignore the message"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Overpayment is a classic scam. The initial payment may be from a stolen card, and when you 'refund the difference' you're sending your own money to the scammer. Return the full payment and ask them to resend the correct amount through escrow.",
                    "points": 10,
                },
            ],
        },
    },
    {
        "order": 8,
        "title": "Your Personal Security Plan",
        "description": "Create a personalized, actionable security plan you can implement this week — with specific steps for your phone, passwords, social media, and data.",
        "durationMinutes": 30,
        "videoUrl": "/videos/security/08-security-plan.mp4",
        "transcript": "Knowledge without action is useless. In this final lesson, you'll create your personal security plan with a 7-day implementation schedule. Day 1: Set up a password manager. Day 2: Enable 2FA on your email and bank accounts. Day 3: Update all your devices. Day 4: Review social media privacy settings. Day 5: Set up backups. Day 6: Review and delete unused accounts. Day 7: Create your incident response card. We'll provide a checklist template you can download and follow. By the end of this week, you'll be more secure than 95% of Algerians online.",
        "learningObjectives": [
            "Create a prioritized 7-day security implementation plan",
            "Apply all the techniques from this course to your own digital life",
            "Maintain good security habits going forward",
        ],
        "keyTakeaways": [
            "One week is all it takes to go from vulnerable to protected",
            "Start with the password manager — everything else builds on it",
            "Security is a habit, not a one-time setup",
        ],
        "difficulty": "Beginner",
        "tags": ["security", "plan", "action", "checklist", "final"],
        "estimatedCompletionTime": 30,
        "quiz": {
            "title": "Security Plan Quiz",
            "passingScore": 70,
            "timeLimitMinutes": 10,
            "questions": [
                {
                    "order": 1,
                    "question": "What should you do FIRST when implementing your security plan?",
                    "questionType": "MULTIPLE_CHOICE",
                    "options": [
                        {"id": "a", "text": "Buy a new computer"},
                        {"id": "b", "text": "Set up a password manager"},
                        {"id": "c", "text": "Delete all social media"},
                        {"id": "d", "text": "Call your bank"},
                    ],
                    "correctAnswer": "b",
                    "explanation": "Start with a password manager. It's the foundation for everything else — strong passwords, 2FA setup, and account management all build on it.",
                    "points": 10,
                },
            ],
        },
    },
]


# =============================================================================
# LESSON CREATION FUNCTION
# =============================================================================


async def create_lessons_for_module(
    module_id: str,
    instructor_id: int,
    lessons_data: list,
    quiz_start_id: int,
):
    """Create all lessons, quizzes, and questions for a module."""
    print(f"\n  📝 Creating lessons for {module_id}...")

    for lesson_data in lessons_data:
        # Copy the quiz payload: these lesson dicts are module-level constants and
        # are also used for the end-of-run summary, so popping would erase the
        # question counts from it.
        quiz_info = dict(lesson_data["quiz"])
        new_lesson_id = gen_lesson_id(module_id.split("-")[-1], lesson_data["order"])

        quiz_questions = quiz_info.pop("questions")

        # Create the quiz first
        quiz_id = quiz_start_id
        quiz_start_id += 1

        await prisma.quiz.create(
            data={
                "id": quiz_id,
                "title": quiz_info["title"],
                "description": None,
                "passingScore": quiz_info["passingScore"],
                "timeLimitMinutes": quiz_info["timeLimitMinutes"],
                "allowRetake": True,
                "shuffleQuestions": True,
                "retakeCooldownMinutes": 60,
                "createdAt": NOW,
                "updatedAt": NOW,
            }
        )

        # Create questions for the quiz
        for q_data in quiz_questions:
            await prisma.quizquestion.create(
                data={
                    "quizId": quiz_id,
                    "question": q_data["question"],
                    "questionType": q_data["questionType"],
                    "options": Json(q_data["options"]),
                    "correctAnswer": q_data["correctAnswer"],
                    "explanation": q_data["explanation"],
                    "points": q_data["points"],
                    "order": q_data["order"],
                }
            )

        # Create the lesson, linking to the quiz
        await prisma.lesson.create(
            data={
                "id": new_lesson_id,
                "moduleId": module_id,
                "title": lesson_data["title"],
                "description": lesson_data["description"],
                "durationMinutes": lesson_data["durationMinutes"],
                "type": "video",
                "status": enums.LessonStatus.PUBLISHED,
                "videoUrl": lesson_data["videoUrl"],
                "storageProvider": "supabase",
                "hlsPath": lesson_data["videoUrl"]
                .replace("/videos/", "/hls/")
                .replace(".mp4", "/index.m3u8"),
                "rawPath": lesson_data["videoUrl"],
                "transcodingStatus": "COMPLETED",
                "transcript": lesson_data.get("transcript"),
                "order": lesson_data["order"],
                "learningObjectives": lesson_data.get("learningObjectives", []),
                "keyTakeaways": lesson_data.get("keyTakeaways", []),
                "estimatedCompletionTime": lesson_data.get("estimatedCompletionTime"),
                "difficulty": lesson_data.get("difficulty"),
                "tags": lesson_data.get("tags", []),
                "quizId": quiz_id,
                "requiredPassScore": 70,
                "isPreview": lesson_data.get("isPreview", False),
                "createdAt": NOW,
                "updatedAt": NOW,
            }
        )
        print(
            f"    ✓ Lesson {lesson_data['order']}: {lesson_data['title']} ({len(quiz_questions)} questions)"
        )

    return quiz_start_id


# =============================================================================
# 6. SEED DEMO ENROLLMENTS & REVIEWS
# =============================================================================


async def seed_demo_enrollments():
    """Create demo enrollments and course reviews for testing."""
    print("\n📝 Seeding demo enrollments...")

    # Create a demo student user if not exists
    existing = await prisma.user.find_first(where={"email": "xerxes@podacium.com"})
    if existing:
        demo_student_id = existing.id
        print(f"  • Demo student found: Xerxes Megistos (id={demo_student_id})")
    else:
        created_student = await prisma.user.create(
            data={
                "email": "xerxes@podacium.com",
                "fullName": "Xerxes Megistos",
                "role": enums.UserRole.STUDENT,
                "emailVerified": True,
                "bio": "Student at ESE Oran, learning data analysis and freelancing.",
                "city": enums.City.ORAN,
                "country": enums.Country.ALGERIA,
                "isActive": True,
                "acceptedTerms": True,
                "onboardingCompleted": True,
                "provider": enums.AuthProvider.EMAIL,
                "createdAt": NOW - timedelta(days=30),
                "updatedAt": NOW,
            }
        )
        demo_student_id = created_student.id
        print(f"  ✓ Demo student created: Xerxes Megistos (id={demo_student_id})")

    # Enrollments
    enrollments = [
        {
            "userId": demo_student_id,
            "moduleId": MODULE_PYTHON_ID,
            "progress": 100.0,
            "startedAt": NOW - timedelta(days=14),
            "completedAt": NOW - timedelta(days=7),
        },
        {
            "userId": demo_student_id,
            "moduleId": MODULE_AI_BUILDER_ID,
            "progress": 62.5,
            "startedAt": NOW - timedelta(days=7),
        },
        {
            "userId": demo_student_id,
            "moduleId": MODULE_EXCEL_ID,
            "progress": 25.0,
            "startedAt": NOW - timedelta(days=2),
        },
    ]

    for idx, e in enumerate(enrollments):
        await prisma.enrollment.create(
            data={
                "id": enrollment_id(idx + 1),
                "userId": e["userId"],
                "moduleId": e["moduleId"],
                "progress": e["progress"],
                "startedAt": e["startedAt"],
                "completedAt": e.get("completedAt"),
                "createdAt": e["startedAt"],
                "updatedAt": NOW,
            }
        )
        print(f"  ✓ Enrollment created: {e['moduleId']} (progress: {e['progress']}%)")

    # Course reviews
    reviews = [
        {
            "userId": demo_student_id,
            "moduleId": MODULE_PYTHON_ID,
            "rating": 5,
            "comment": "Excellent course! The hands-on exercises with real Algerian data made learning Python actually useful. I went from zero to analyzing datasets in two weeks.",
        },
        {
            "userId": demo_student_id,
            "moduleId": MODULE_AI_BUILDER_ID,
            "rating": 4,
            "comment": "Very practical. The PROMPT framework alone was worth the price. I'm using AI at work every day now.",
        },
    ]

    for r in reviews:
        await prisma.coursereview.create(
            data={
                "userId": r["userId"],
                "moduleId": r["moduleId"],
                "rating": r["rating"],
                "comment": r["comment"],
                "createdAt": NOW - timedelta(days=3),
                "updatedAt": NOW - timedelta(days=3),
            }
        )
        print(f"  ✓ Review created for {r['moduleId']}: {r['rating']} stars")


async def cleanup_education_data():
    """Delete all education data in FK-safe order before re-seeding."""
    print("\n🧹 Cleaning up existing education data...")
    tables = [
        "PathModule",
        "Enrollment",
        "CourseReview",
        "LessonProgress",
        "QuizUserAnswer",
        "QuizAttempt",
        "QuizQuestion",
        "Lesson",
        "Quiz",
        "Certificate",
        "Module",
        "Path",
    ]
    for table in tables:
        await prisma.execute_raw(f'DELETE FROM "{table}"')
    print(f"  ✓ Cleared {len(tables)} tables")


# =============================================================================
# MAIN SEED FUNCTION
# =============================================================================


async def main():
    """Run all seed functions."""
    print("🌱 ==========================================")
    print("🌱  Podacium Course Catalog Seed")
    print("🌱  Launch: September 23, 2026")
    print("🌱 ==========================================\n")

    await prisma.connect()

    try:
        # Phase 0: Clean up existing education data
        await cleanup_education_data()
        # Phase 1: Users
        await seed_users()

        # Phase 2: Learning Path
        await seed_path()

        # Phase 3: Modules
        await seed_modules()

        # Phase 4: Path-Module Links
        await seed_path_links()

        # Phase 5: Lessons, Quizzes & Questions
        print("\n📖 Seeding lessons with quizzes...")
        next_quiz_id = 1001
        next_quiz_id = await create_lessons_for_module(
            MODULE_PYTHON_ID, REDHA_ID, PYTHON_LESSONS, next_quiz_id
        )
        next_quiz_id = await create_lessons_for_module(
            MODULE_AI_BUILDER_ID, ZAKARYA_ID, AI_BUILDER_LESSONS, next_quiz_id
        )
        next_quiz_id = await create_lessons_for_module(
            MODULE_EXCEL_ID, ZAKARYA_ID, EXCEL_LESSONS, next_quiz_id
        )
        next_quiz_id = await create_lessons_for_module(
            MODULE_CYBERSECURITY_ID, None, CYBERSECURITY_LESSONS, next_quiz_id
        )

        # Phase 6: Demo data
        await seed_demo_enrollments()

        # Summary
        total_lessons = (
            len(PYTHON_LESSONS)
            + len(AI_BUILDER_LESSONS)
            + len(EXCEL_LESSONS)
            + len(CYBERSECURITY_LESSONS)
        )
        total_questions = sum(
            len(l["quiz"]["questions"])
            for lessons in [
                PYTHON_LESSONS,
                AI_BUILDER_LESSONS,
                EXCEL_LESSONS,
                CYBERSECURITY_LESSONS,
            ]
            for l in lessons
            if "quiz" in l and "questions" in l["quiz"]
        )

        print(f"\n✅ {'='*45}")
        print(f"✅  Seed Complete!")
        print(f"✅  • 1 instructor (Houari Ibrahim)")
        print(f"✅  • 1 learning path")
        print(f"✅  • 4 modules (courses)")
        print(f"✅  • {total_lessons} lessons with quizzes")
        print(f"✅  • {total_questions} quiz questions")
        print(f"✅  • 1 demo student with enrollments & reviews")
        print(f"✅ {'='*45}")

    except Exception as e:
        print(f"\n❌ Seed failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
