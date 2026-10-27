import logging

logger = logging.getLogger(__name__)
"""
Decision intelligence routers.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.prisma import prisma
from app.schemas.bi_schemas import (
    DecisionRequest,
    DecisionResult,
    ErrorResponse,
    ExecutiveView,
    ViewType,
)
from app.services.bi_services import (
    AnalyticsService,
    DecisionService,
    EvaluationService,
    IngestionService,
    PreprocessingService,
    QualityService,
    ValidationService,
    ViewService,
    raise_http_exception,
)
from app.services.bi_services.errors import (
    DatasetNotFoundError,
    UnauthorizedAnalystViewError,
)

router = APIRouter(prefix="/decisions", tags=["BI - Decision Intelligence"])


@router.post(
    "/{dataset_id}/decisions",
    responses={
        200: {"model": DecisionResult},
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def generate_decisions(
    dataset_id: str,
    request: DecisionRequest,
    view: ViewType = Query(ViewType.EXECUTIVE, description="View type: executive or analyst"),
    current_user=Depends(get_current_user),
):
    """
    Generate decision intelligence.
    
    - **dataset_id**: Dataset for decision intelligence
    - **include_warnings**: Include warnings and limitations
    - **max_recommendations**: Maximum number of recommendations
    - **domain_context**: Business domain context
    - **view**: View type (executive or analyst)
    """
    try:
        # Determine organization ID
        org_id = getattr(current_user, "primaryOrganizationId", None)
        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "User has no organization",
                    "type": "missing_organization",
                },
            )
        
        # Get dataset
        dataset = await IngestionService.get_dataset(
            dataset_id=dataset_id,
            organization_id=str(org_id),
            user_id=str(current_user.id),
        )
        
        if not dataset.get("records"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "Dataset has no records",
                    "type": "empty_dataset",
                },
            )
        
        # Get analytics result if available
        analytics_result = None
        if dataset.get("analytics_result"):
            analytics_result = dataset["analytics_result"]
        else:
            # Fallback: perform analytics now
            analytics_result = AnalyticsService.perform_analytics(
                records=dataset["records"],
                columns=dataset["columns"],
            )
        
        # Get evaluation result if available
        evaluation_result = None
        if dataset.get("evaluation_result"):
            evaluation_result = dataset["evaluation_result"]
        else:
            # Fallback: evaluate now
            quality_result = QualityService.assess_quality(
                records=dataset["records"],
                columns=dataset["columns"],
            )
            evaluation_result = EvaluationService.evaluate_trust_risk(
                quality_result=quality_result,
                analytics_result=analytics_result,
            )
        
        # Use dataset domain or request domain
        domain = request.domain_context or dataset.get("domain", "unknown")
        
        # Generate decisions
        decision_result = DecisionService.generate_decisions(
            analytics_result=analytics_result,
            evaluation_result=evaluation_result,
            domain=domain,
        )
        
        # Apply view transformation
        if view == ViewType.EXECUTIVE:
            view_result = ViewService.prepare_decision_view(
                decision_result, view, current_user
            )
            
            # Convert to ExecutiveView format
            executive_view = ExecutiveView(
                executive_summary=decision_result.get("explanation", ""),
                confidence_level=evaluation_result.get("confidence_level", "MEDIUM"),
                risk_level=evaluation_result.get("risk_level", "MEDIUM"),
                top_business_insights=[
                    insight.get("description", "") 
                    for insight in analytics_result.get("business_insights", [])[:5]
                ],
                recommendations=[
                    rec.get("text", "") 
                    for rec in decision_result.get("recommendations", [])[:5]
                ],
                warnings_and_limitations=decision_result.get("warnings", [])[:5],
                has_technical_details=True,
                can_view_analyst=ViewService.can_view_analyst(current_user),
            )
            return executive_view
        else:
            # Analyst view
            if not ViewService.can_view_analyst(current_user):
                raise UnauthorizedAnalystViewError(str(current_user.id))
            
            view_result = ViewService.prepare_decision_view(
                decision_result, view, current_user
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
                "detail": "Internal server error during decision generation",
                "type": "decision_error",
                "errors": [str(e)],
            },
        )


@router.post(
    "/{dataset_id}/full-pipeline",
    responses={
        200: {"model": DecisionResult},
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def run_full_pipeline(
    dataset_id: str,
    view: ViewType = Query(ViewType.EXECUTIVE, description="View type: executive or analyst"),
    current_user=Depends(get_current_user),
):
    """
    Run full BI pipeline on dataset.
    
    - **dataset_id**: Dataset to process
    - **view**: View type (executive or analyst)
    
    Pipeline steps:
    1. Validate dataset
    2. Assess data quality
    3. Preprocess/clean data
    4. Perform analytics
    5. Evaluate trust/risk
    6. Generate decision intelligence
    """
    try:
        # Determine organization ID
        org_id = getattr(current_user, "primaryOrganizationId", None)
        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "User has no organization",
                    "type": "missing_organization",
                },
            )
        
        # Get dataset
        dataset = await IngestionService.get_dataset(
            dataset_id=dataset_id,
            organization_id=str(org_id),
            user_id=str(current_user.id),
        )
        
        if not dataset.get("records"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "Dataset has no records",
                    "type": "empty_dataset",
                },
            )
        
        # Step 1: Validate
        validation_result = ValidationService.validate_dataset(
            records=dataset["records"],
            columns=dataset["columns"],
        )
        
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "detail": "Dataset validation failed",
                    "type": "validation_error",
                    "errors": validation_result["errors"],
                },
            )
        
        # Step 2: Quality assessment
        quality_result = QualityService.assess_quality(
            records=dataset["records"],
            columns=dataset["columns"],
            validation_result=validation_result,
        )
        
        # Step 3: Preprocessing
        processed_records, transformations_log = PreprocessingService.preprocess_dataset(
            records=dataset["records"],
            columns=dataset["columns"],
            validation_result=validation_result,
        )
        
        # Step 4: Analytics
        analytics_result = AnalyticsService.perform_analytics(
            records=processed_records,
            columns=dataset["columns"],
            preprocessing_result={"transformations_log": transformations_log},
        )
        
        # Step 5: Evaluation
        evaluation_result = EvaluationService.evaluate_trust_risk(
            quality_result=quality_result,
            analytics_result=analytics_result,
            preprocessing_log=transformations_log,
        )
        
        # Step 6: Decision intelligence
        domain = dataset.get("domain", "unknown")
        decision_result = DecisionService.generate_decisions(
            analytics_result=analytics_result,
            evaluation_result=evaluation_result,
            domain=domain,
        )
        
        # Store results in dataset
        dataset.update({
            "validation_result": validation_result,
            "quality_result": quality_result,
            "preprocessing_log": transformations_log,
            "analytics_result": analytics_result,
            "evaluation_result": evaluation_result,
            "decision_result": decision_result,
            "records": processed_records,
            "status": "PROCESSED",
        })
        
        # Try to create pipeline run in database
        try:
            await prisma.pipelinerun.create(
                data={
                    "id": f"run_{dataset_id}_{int(datetime.now(timezone.utc).timestamp())}",
                    "datasetId": dataset_id,
                    "validationStatus": "COMPLETED",
                    "validationResult": validation_result,
                    "qualityStatus": "COMPLETED",
                    "qualityResult": quality_result,
                    "preprocessingStatus": "COMPLETED",
                    "preprocessingResult": {"log": transformations_log},
                    "analyticsStatus": "COMPLETED",
                    "analyticsResult": analytics_result,
                    "evaluationStatus": "COMPLETED",
                    "evaluationResult": evaluation_result,
                    "decisionStatus": "COMPLETED",
                    "decisionResult": decision_result,
                    "status": "COMPLETED",
                    "triggeredById": current_user.id,
                    "viewType": view.upper(),
                }
            )
        except Exception as db_error:
            logger.error(f"Operation failed: {db_error}")
        
        # Apply view transformation
        if view == ViewType.EXECUTIVE:
            # Return executive summary
            executive_view = ExecutiveView(
                executive_summary=(
                    f"Completed full BI pipeline on {len(processed_records)} records. "
                    f"Quality: {quality_result['quality_level']}, "
                    f"Confidence: {evaluation_result['confidence_level']}, "
                    f"Generated {len(decision_result.get('recommendations', []))} recommendations."
                ),
                confidence_level=evaluation_result.get("confidence_level", "MEDIUM"),
                risk_level=evaluation_result.get("risk_level", "MEDIUM"),
                top_business_insights=[
                    insight.get("description", "") 
                    for insight in analytics_result.get("business_insights", [])[:5]
                ],
                recommendations=[
                    rec.get("text", "") 
                    for rec in decision_result.get("recommendations", [])[:5]
                ],
                warnings_and_limitations=decision_result.get("warnings", [])[:5],
                has_technical_details=True,
                can_view_analyst=ViewService.can_view_analyst(current_user),
            )
            return executive_view
        else:
            # Analyst view
            if not ViewService.can_view_analyst(current_user):
                raise UnauthorizedAnalystViewError(str(current_user.id))
            
            view_result = ViewService.prepare_decision_view(
                decision_result, view, current_user
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
                "detail": "Internal server error during full pipeline",
                "type": "pipeline_error",
                "errors": [str(e)],
            },
        )