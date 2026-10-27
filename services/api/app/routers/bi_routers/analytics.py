"""
Analytics and evaluation routers.
"""

import logging
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.core.tenant import TenantContext, get_tenant_context
from app.core.config import setting
from app.core.prisma import prisma
from app.schemas.bi_schemas import (
    AnalyticsRequest,
    AnalyticsResult,
    EvaluationRequest,
    EvaluationResult,
    ErrorResponse,
    ViewType,
)
from app.services.bi_services import (
    AnalyticsService,
    AnalyticsCore,
    EvaluationService,
    IngestionService,
    QualityService,
    ViewService,
    HealthScoreService,
    raise_http_exception,
)
from app.services.bi_services.errors import (
    DatasetNotFoundError,
    UnauthorizedAnalystViewError,
)
from app.services.bi_services.query_engine import QueryEngine

router = APIRouter(prefix="/analytics", tags=["BI - Analytics"])


@router.get(
    "/health-score",
    responses={
        200: {"model": Any},
        500: {"model": ErrorResponse},
    },
)
async def get_business_health_score(
    locale: str = Query("en", description="Locale for insights (en, fr, ar)"),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Get the 0-100 business health score for the organization.
    """
    try:
        org_id = ctx.organization_id
        result = await HealthScoreService.calculate_health_score(
            int(org_id), locale=locale
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "Error generating health score",
                "type": "health_score_error",
                "error": str(e),
            },
        )


@router.post(
    "/{dataset_id}/analyze",
    responses={
        200: {"model": AnalyticsResult},
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def analyze_dataset(
    dataset_id: str,
    request: AnalyticsRequest,
    view: ViewType = Query(
        ViewType.EXECUTIVE, description="View type: executive or analyst"
    ),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Perform analytics on dataset.
    """
    try:
        org_id = ctx.organization_id
        current_user = ctx.user

        dataset = await IngestionService.get_dataset(
            dataset_id=dataset_id,
            organization_id=str(org_id),
            user_id=str(ctx.user_id),
        )

        if not dataset.get("records") and not dataset.get("file_path"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "Dataset has no records and no file path available",
                    "type": "empty_dataset",
                },
            )

        preprocessing_result = None
        if dataset.get("preprocessing_log"):
            preprocessing_result = {"transformations_log": dataset["preprocessing_log"]}

        analytics_result = AnalyticsService.perform_analytics(
            records=dataset.get("records") or [],
            columns=dataset.get("columns", []),
            preprocessing_result=preprocessing_result,
            file_path=dataset.get("file_path"),
        )

        if view == ViewType.EXECUTIVE:
            view_result = ViewService.prepare_analytics_view(
                analytics_result, view, current_user
            )
            return view_result
        else:
            if not ViewService.can_view_analyst(current_user):
                raise UnauthorizedAnalystViewError(str(ctx.user_id))

            view_result = ViewService.prepare_analytics_view(
                analytics_result, view, current_user
            )
            return view_result

    except UnauthorizedAnalystViewError as e:
        raise_http_exception(e, status.HTTP_403_FORBIDDEN)
    except DatasetNotFoundError as e:
        raise_http_exception(e, status.HTTP_404_NOT_FOUND)
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "Internal server error during analytics",
                "type": "analytics_error",
                "errors": [str(e)],
            },
        )


@router.get(
    "/{dataset_id}/core",
    responses={
        200: {"model": Any},
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def get_core_analytics(
    dataset_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Get the 10 core BI analytics for a dataset.
    """
    try:
        org_id = ctx.organization_id

        dataset = await IngestionService.get_dataset(
            dataset_id=dataset_id,
            organization_id=str(org_id),
            user_id=str(ctx.user_id),
        )

        file_path = dataset.get("file_path")
        if not file_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.bi.dataset_file_not_found",
            )

        schema = QueryEngine.get_dataset_schema(file_path)
        results = AnalyticsCore.run_all_analytics(file_path, schema)

        return results

    except DatasetNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.bi.dataset_not_found",
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "Error generating core analytics",
                "type": "analytics_error",
                "error": str(e),
            },
        )


@router.post(
    "/{dataset_id}/evaluate",
    response_model=EvaluationResult,
    responses={
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def evaluate_dataset(
    dataset_id: str,
    request: EvaluationRequest,
    view: ViewType = Query(
        ViewType.EXECUTIVE, description="View type: executive or analyst"
    ),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Evaluate trust and risk of analysis.
    """
    try:
        org_id = ctx.organization_id
        current_user = ctx.user

        dataset = await IngestionService.get_dataset(
            dataset_id=dataset_id,
            organization_id=str(org_id),
            user_id=str(ctx.user_id),
        )

        if not dataset.get("records"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "Dataset has no records",
                    "type": "empty_dataset",
                },
            )

        if dataset.get("quality_result"):
            quality_result = dataset["quality_result"]
        else:
            quality_result = QualityService.assess_quality(
                records=dataset["records"],
                columns=dataset["columns"],
            )

        if dataset.get("analytics_result"):
            analytics_result = dataset["analytics_result"]
        else:
            analytics_result = AnalyticsService.perform_analytics(
                records=dataset["records"],
                columns=dataset["columns"],
            )

        preprocessing_log = dataset.get("preprocessing_log")

        evaluation_result = EvaluationService.evaluate_trust_risk(
            quality_result=quality_result,
            analytics_result=analytics_result,
            preprocessing_log=preprocessing_log,
        )

        if view == ViewType.EXECUTIVE:
            view_result = ViewService.prepare_evaluation_view(
                evaluation_result, view, current_user
            )
            return view_result
        else:
            if not ViewService.can_view_analyst(current_user):
                raise UnauthorizedAnalystViewError(str(ctx.user_id))

            view_result = ViewService.prepare_evaluation_view(
                evaluation_result, view, current_user
            )
            return view_result

    except UnauthorizedAnalystViewError as e:
        raise_http_exception(e, status.HTTP_403_FORBIDDEN)
    except DatasetNotFoundError as e:
        raise_http_exception(e, status.HTTP_404_NOT_FOUND)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "Internal server error during evaluation",
                "type": "evaluation_error",
                "errors": [str(e)],
            },
        )


@router.get(
    "/insights",
    responses={
        200: {"model": Any},
        500: {"model": ErrorResponse},
    },
)
async def get_insights(
    locale: str = Query("en", description="Locale for insights (en, fr, ar)"),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Get cached auto-generated insights for the organization.
    """
    try:
        org_id = ctx.organization_id

        dashboard = await prisma.dashboard.find_first(
            where={"organizationId": org_id, "title": "System Auto Dashboard"}
        )

        if not dashboard:
            return {"insights": []}

        insights_records = await prisma.insight.find_many(
            where={"dashboardId": dashboard.id},
            order={"createdAt": "desc"},
        )

        import json

        insights = []
        for r in insights_records:
            try:
                data = (
                    json.loads(r.metadata)
                    if isinstance(r.metadata, str)
                    else (r.metadata or {})
                )
                if data.get("locale") == locale or not data.get("locale"):
                    insights.append(data)
            except Exception:
                pass

        return {"insights": insights}

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"detail": "Failed to fetch insights", "error": str(e)},
        )


@router.post(
    "/insights/generate",
    responses={
        200: {"model": Any},
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def generate_insights(
    dataset_id: str,
    locale: str = Query("en", description="Locale for insights (en, fr, ar)"),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Trigger manual generation of insights for a dataset.
    """
    try:
        from app.services.bi_services.insight_engine import InsightEngine

        org_id = ctx.organization_id

        insights = await InsightEngine.generate_and_store(
            organization_id=org_id,
            dataset_id=dataset_id,
            locale=locale,
            user_id=ctx.user_id,
        )
        return {"success": True, "insights": insights}
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"detail": "Failed to generate insights", "error": str(e)},
        )


@router.post(
    "/share/whatsapp",
    responses={
        200: {"model": Any},
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def generate_whatsapp_share(
    type: str = Query(
        "health", description="Type of content to share (health, dataset, dashboard)"
    ),
    locale: str = Query("en", description="Locale for the message (en, fr, ar)"),
    dataset_id: Optional[str] = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Generate a WhatsApp-friendly text digest of BI data.
    """
    try:
        from app.services.bi_services.whatsapp_digest_service import (
            WhatsAppDigestService,
        )

        org_id = ctx.organization_id

        if type == "health":
            text = await WhatsAppDigestService.generate_health_digest(
                organization_id=org_id, locale=locale
            )
        else:
            text = f"Check out my latest Podacium BI insights! ({type})"

        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        shared = await prisma.sharedinsight.create(
            data={
                "organizationId": org_id,
                "type": type,
                "locale": locale,
                "createdBy": ctx.user_id,
                "expiresAt": expires_at,
            }
        )

        base_url = setting.FRONTEND_URL or "http://localhost:3001"
        share_url = f"{base_url}/shared/{shared.token}"

        return {"text": text, "share_url": share_url}

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"detail": "Failed to generate WhatsApp share", "error": str(e)},
        )


class DriverDecompositionPayload(BaseModel):
    metric: str = "net_revenue"
    baseline: float
    current: float
    factor_deltas: List[Dict[str, Any]]
    z_threshold: float = 2.5


@router.post(
    "/driver-decomposition",
    summary="Compute root-cause driver contribution and waterfall attribution",
    description="Calculates percentage contribution of dimensional factors and identifies statistical anomalies",
)
async def get_driver_decomposition(
    payload: DriverDecompositionPayload,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Tier 2 Driver Breakdown: Computes root-cause contribution for horizontal waterfall charts.
    """
    try:
        from app.services.bi_services.driver_engine import DriverEngine

        return DriverEngine.decompose_variance(
            metric=payload.metric
            if isinstance(payload.metric, str)
            else str(payload.metric[0]),
            baseline=payload.baseline,
            current=payload.current,
            factor_deltas=payload.factor_deltas,
            z_threshold=payload.z_threshold,
        )
    except Exception as e:
        logger.error(f"Driver decomposition failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Driver decomposition failed: {str(e)}",
        )
