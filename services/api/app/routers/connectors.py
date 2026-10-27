"""
FastAPI Router for 10 Production Connectors (Google, GitHub, Slack, Zoom, Notion, Kaggle, HuggingFace, Teams, Calendar, Chargily).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from app.core.auth import get_current_user
from app.services.connectors.google_connector import google_connector
from app.services.connectors.github_connector import github_connector
from app.services.connectors.slack_connector import slack_connector
from app.services.connectors.zoom_connector import zoom_connector
from app.services.connectors.notion_connector import notion_connector
from app.services.connectors.kaggle_connector import kaggle_connector
from app.services.connectors.huggingface_connector import huggingface_connector
from app.services.connectors.teams_connector import teams_connector
from app.services.connectors.calendar_connector import calendar_connector
from app.services.connectors.chargily_connector import chargily_connector

router = APIRouter(prefix="/connectors", tags=["Pillar Connectors"])


# Request Schemas
class GoogleDriveImportRequest(BaseModel):
    file_id: str
    course_id: int
    assignment_id: int


class GitHubSyncRequest(BaseModel):
    repo_owner: str
    repo_name: str
    pull_number: int


class SlackSnapshotRequest(BaseModel):
    channel: str
    dashboard_name: str
    kpi_summary: str


class ZoomWebinarRequest(BaseModel):
    topic: str
    start_time_iso: str
    duration_minutes: int = 60


class NotionExportRequest(BaseModel):
    page_title: str
    content_markdown: str


class KaggleIngestRequest(BaseModel):
    dataset_handle: str
    target_dataset_id: int


class HuggingFaceSyncRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_id: str


class TeamsCardRequest(BaseModel):
    webhook_url: str
    title: str
    message: str


class CalendarEventRequest(BaseModel):
    summary: str
    description: str
    start_time_iso: str
    end_time_iso: str


class ChargilyEscrowRequest(BaseModel):
    contract_id: int
    milestone_id: int
    amount_dzd: float
    payment_method: str = "edahabia"


# Connector Endpoints
@router.post("/google/import-drive")
async def import_google_drive(req: GoogleDriveImportRequest, current_user=Depends(get_current_user)):
    """Import homework assignment file from Google Drive."""
    try:
        return await google_connector.import_assignment_from_drive(
            current_user.id, req.file_id, req.course_id, req.assignment_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/github/sync-pr")
async def sync_github_pr(req: GitHubSyncRequest, current_user=Depends(get_current_user)):
    """Sync GitHub Pull Request to Freelance Contract milestone."""
    try:
        return await github_connector.sync_milestone_pr(
            current_user.id, req.repo_owner, req.repo_name, req.pull_number
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slack/post-snapshot")
async def post_slack_snapshot(req: SlackSnapshotRequest, current_user=Depends(get_current_user)):
    """Post BI Dashboard summary snapshot to Slack Channel."""
    try:
        return await slack_connector.post_bi_dashboard_snapshot(
            current_user.id, req.channel, req.dashboard_name, req.kpi_summary
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/zoom/provision-webinar")
async def provision_zoom_webinar(req: ZoomWebinarRequest, current_user=Depends(get_current_user)):
    """Schedule virtual classroom webinar on Zoom."""
    try:
        return await zoom_connector.provision_live_webinar(
            current_user.id, req.topic, req.start_time_iso, req.duration_minutes
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/notion/export-notes")
async def export_notion_notes(req: NotionExportRequest, current_user=Depends(get_current_user)):
    """Export study notes to Notion workspace page."""
    try:
        return await notion_connector.export_study_guide_to_notion(
            current_user.id, req.page_title, req.content_markdown
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/kaggle/ingest-dataset")
async def ingest_kaggle(req: KaggleIngestRequest, current_user=Depends(get_current_user)):
    """Ingest ML dataset from Kaggle into Podacium BI Hub."""
    try:
        return await kaggle_connector.ingest_kaggle_dataset(
            current_user.id, req.dataset_handle, req.target_dataset_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/huggingface/sync-model")
async def sync_huggingface(req: HuggingFaceSyncRequest, current_user=Depends(get_current_user)):
    """Sync HuggingFace model metadata card."""
    try:
        return await huggingface_connector.sync_hf_model_card(current_user.id, req.model_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/teams/post-card")
async def post_teams_card(req: TeamsCardRequest, current_user=Depends(get_current_user)):
    """Post Adaptive Card to Microsoft Teams Channel."""
    try:
        return await teams_connector.post_teams_card(
            current_user.id, req.webhook_url, req.title, req.message
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calendar/create-event")
async def create_calendar_event(req: CalendarEventRequest, current_user=Depends(get_current_user)):
    """Create Google Calendar Event for Course Lectures or Milestones."""
    try:
        return await calendar_connector.create_calendar_event(
            current_user.id, req.summary, req.description, req.start_time_iso, req.end_time_iso
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/chargily/create-escrow")
async def create_chargily_escrow(req: ChargilyEscrowRequest, current_user=Depends(get_current_user)):
    """Create CIB / Edahabia card escrow checkout session."""
    try:
        return await chargily_connector.create_escrow_deposit(
            req.contract_id, req.milestone_id, req.amount_dzd, req.payment_method
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{provider}/sync-now")
async def run_connector_sync(provider: str, current_user=Depends(get_current_user)):
    """Trigger automated background synchronization for a connector."""
    from app.services.connectors.connector_pipeline import connector_pipeline
    try:
        return await connector_pipeline.run_sync(current_user.id, provider)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{provider}/logs")
async def get_connector_audit_logs(provider: str, limit: int = 20, current_user=Depends(get_current_user)):
    """Retrieve audit trace log history for a connector."""
    from app.services.connectors.connector_pipeline import connector_pipeline
    try:
        logs = await connector_pipeline.get_connector_logs(current_user.id, provider, limit)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
