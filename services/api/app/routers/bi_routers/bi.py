"""
Main BI router that includes all BI sub-routers.
This file is imported in main.py and mounted under /api prefix.
"""

from fastapi import APIRouter

from app.routers.bi_routers import (
    datasets_router,
    analytics_router,
    decision_router,
    dashboards_router,
    widgets_router,
    decisions_router,
    reports_router,
    quality_router,
    flywheel_router,
    connectors_router,
    embed_router,
    collaboration_router,
)
from app.routers.bi_routers.arrow_stream import router as arrow_router
from app.routers.bi_routers.simulations import router as simulations_router

# Create main router with prefix "/bi"
router = APIRouter(prefix="/bi", tags=["Business Intelligence"])

# Include all BI sub-routers
router.include_router(datasets_router)
router.include_router(analytics_router)
router.include_router(decision_router)
router.include_router(dashboards_router)
router.include_router(widgets_router)
router.include_router(decisions_router)
router.include_router(reports_router)
router.include_router(quality_router)
router.include_router(flywheel_router)
router.include_router(connectors_router)
router.include_router(embed_router)
router.include_router(collaboration_router)
router.include_router(arrow_router)
router.include_router(simulations_router)


# Optional: Add health check endpoint for BI module
@router.get("/health")
async def bi_health_check():
    """Health check for BI module"""
    return {
        "status": "healthy",
        "module": "business_intelligence",
        "version": "1.0.0",
        "services": [
            "datasets",
            "analytics",
            "decision_intelligence",
            "dashboards",
            "decisions",
            "reports",
            "quality",
            "flywheel",
        ],
    }
