from fastapi import APIRouter, Depends, HTTPException, Response, status
from typing import Dict, Any, List
from app.schemas.onboarding import OnboardingSubmit
from app.services.onboarding_service import onboarding_service
from app.core.auth import get_current_active_user
from app.core.security import set_session_cookie
import logging

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
logger = logging.getLogger(__name__)

CATEGORY_SKILLS: Dict[str, List[str]] = {
    "software": [
        "python",
        "javascript",
        "typescript",
        "react",
        "node.js",
        "next.js",
        "html",
        "css",
        "tailwind",
        "vue",
        "angular",
        "django",
        "flask",
        "fastapi",
        "sql",
        "postgresql",
        "mongodb",
        "git",
        "docker",
        "aws",
        "linux",
        "rest api",
        "graphql",
    ],
    "data": [
        "python",
        "sql",
        "pandas",
        "numpy",
        "machine learning",
        "deep learning",
        "tensorflow",
        "pytorch",
        "data analysis",
        "data visualization",
        "statistics",
        "power bi",
        "tableau",
        "excel",
        "big data",
        "etl",
        "airflow",
        "scikit-learn",
        "nlp",
        "computer vision",
    ],
    "design": [
        "figma",
        "adobe xd",
        "photoshop",
        "illustrator",
        "ui design",
        "ux design",
        "graphic design",
        "logo design",
        "branding",
        "prototyping",
        "wireframing",
        "motion design",
        "canva",
        "typography",
        "color theory",
    ],
    "business": [
        "marketing",
        "sales",
        "project management",
        "leadership",
        "communication",
        "negotiation",
        "finance",
        "accounting",
        "strategy",
        "operations",
        "hr",
        "customer service",
        "business development",
        "analytics",
        "excel",
    ],
    "finance": [
        "accounting",
        "bookkeeping",
        "financial analysis",
        "tax",
        "audit",
        "budgeting",
        "forecasting",
        "excel",
        "quickbooks",
        "risk management",
        "investment",
        "banking",
        "insurance",
        "compliance",
    ],
}

ROLE_CONFIG: Dict[str, Dict[str, Any]] = {
    "student": {
        "label": "Student",
        "steps": [
            {
                "key": "primaryGoal",
                "type": "mcq",
                "optionKeys": ["learn", "explore", "teach"],
            },
            {
                "key": "fieldOfInterest",
                "type": "mcq",
                "optionKeys": [
                    "software",
                    "data",
                    "design",
                    "business",
                    "finance",
                    "other",
                ],
            },
            {
                "key": "experienceLevel",
                "type": "mcq",
                "optionKeys": ["beginner", "intermediate", "advanced", "expert"],
            },
            {
                "key": "weeklyTime",
                "type": "mcq",
                "optionKeys": ["lessThan2", "2to5", "5to10", "moreThan10"],
            },
        ],
    },
    "professional": {
        "label": "Professional",
        "steps": [
            {
                "key": "primaryGoal",
                "type": "mcq",
                "optionKeys": ["hire", "analyze", "explore"],
            },
            {
                "key": "fieldOfInterest",
                "type": "mcq",
                "optionKeys": [
                    "software",
                    "data",
                    "design",
                    "business",
                    "finance",
                    "other",
                ],
            },
            {
                "key": "experienceLevel",
                "type": "mcq",
                "optionKeys": ["intermediate", "advanced", "expert"],
            },
        ],
    },
    "freelancer": {
        "label": "Freelancer",
        "steps": [
            {
                "key": "primaryGoal",
                "type": "mcq",
                "optionKeys": ["freelance", "learn", "explore"],
            },
            {"key": "skills", "type": "multi-select"},
            {
                "key": "experienceLevel",
                "type": "mcq",
                "optionKeys": ["beginner", "intermediate", "advanced", "expert"],
            },
            {
                "key": "weeklyTime",
                "type": "mcq",
                "optionKeys": ["lessThan2", "2to5", "5to10", "moreThan10"],
            },
        ],
    },
    "entrepreneur": {
        "label": "Entrepreneur",
        "steps": [
            {
                "key": "primaryGoal",
                "type": "mcq",
                "optionKeys": ["hire", "analyze", "explore"],
            },
            {
                "key": "fieldOfInterest",
                "type": "mcq",
                "optionKeys": [
                    "software",
                    "data",
                    "design",
                    "business",
                    "finance",
                    "other",
                ],
            },
            {
                "key": "experienceLevel",
                "type": "mcq",
                "optionKeys": ["intermediate", "advanced", "expert"],
            },
        ],
    },
    "researcher": {
        "label": "Researcher",
        "steps": [
            {
                "key": "primaryGoal",
                "type": "mcq",
                "optionKeys": ["analyze", "teach", "explore"],
            },
            {
                "key": "fieldOfInterest",
                "type": "mcq",
                "optionKeys": [
                    "software",
                    "data",
                    "design",
                    "business",
                    "finance",
                    "other",
                ],
            },
            {
                "key": "experienceLevel",
                "type": "mcq",
                "optionKeys": ["advanced", "expert"],
            },
        ],
    },
    "instructor": {
        "label": "Instructor",
        "steps": [
            {
                "key": "primaryGoal",
                "type": "mcq",
                "optionKeys": ["teach", "analyze", "explore"],
            },
            {
                "key": "fieldOfInterest",
                "type": "mcq",
                "optionKeys": [
                    "software",
                    "data",
                    "design",
                    "business",
                    "finance",
                    "other",
                ],
            },
            {
                "key": "experienceLevel",
                "type": "mcq",
                "optionKeys": ["advanced", "expert"],
            },
        ],
    },
    "other": {
        "label": "Other",
        "steps": [
            {"key": "primaryGoal", "type": "mcq", "optionKeys": ["explore", "learn"]},
        ],
    },
}


@router.get("/config", status_code=status.HTTP_200_OK)
async def get_onboarding_config():
    """Return role definitions, branching config, and skill suggestions."""
    return {
        "roles": {
            k: {"label": v["label"], "steps": v["steps"]}
            for k, v in ROLE_CONFIG.items()
        },
        "category_skills": CATEGORY_SKILLS,
    }


@router.post("", status_code=status.HTTP_200_OK)
async def submit_onboarding(
    data: OnboardingSubmit,
    response: Response,
    current_user=Depends(get_current_active_user),
):
    """Submit onboarding questionnaire answers."""
    try:
        result = await onboarding_service.submit(
            user_id=current_user.id,
            data=data.model_dump(),
        )
        # Sync Edge session cookie to prevent redirect loop
        set_session_cookie(
            response, current_user.id, result.get("role", current_user.role)
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Onboarding submit failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit onboarding answers",
        )


@router.post("/skip", status_code=status.HTTP_200_OK)
async def skip_onboarding(
    response: Response,
    current_user=Depends(get_current_active_user),
):
    """Skip onboarding — marks it as completed with all-null answers."""
    try:
        result = await onboarding_service.skip(user_id=current_user.id)
        # Sync Edge session cookie to prevent redirect loop
        set_session_cookie(response, current_user.id, current_user.role)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Onboarding skip failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to skip onboarding",
        )
