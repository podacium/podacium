"""
BI Routers Package
Contains all routers for the BI module.
"""

from .datasets import router as datasets_router
from .analytics import router as analytics_router
from .decision import router as decision_router
from .dashboards import router as dashboards_router
from .widgets import router as widgets_router
from .decisions import router as decisions_router
from .reports import router as reports_router
from .quality import router as quality_router
from .flywheel import router as flywheel_router
from .connectors import router as connectors_router
from .embed import router as embed_router
from .collaboration import router as collaboration_router

__all__ = [
    "datasets_router", 
    "analytics_router", 
    "decision_router", 
    "dashboards_router", 
    "widgets_router",
    "decisions_router",
    "reports_router",
    "quality_router",
    "flywheel_router",
    "connectors_router",
    "embed_router",
    "collaboration_router"
]