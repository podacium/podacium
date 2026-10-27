"""
BI Service Errors
"""

from typing import Dict, List, Optional
from fastapi import HTTPException, status


class BIError(Exception):
    """Base exception for BI service errors"""

    def __init__(
        self,
        message: str,
        error_type: str = "bi_error",
        errors: Optional[List[Dict]] = None,
    ):
        self.message = message
        self.error_type = error_type
        self.code = error_type
        self.errors = errors or []
        super().__init__(self.message)


class DatasetNotFoundError(BIError):
    """Raised when a dataset is not found"""

    def __init__(self, dataset_id: str, message: Optional[str] = None):
        super().__init__(
            message or f"Dataset with ID '{dataset_id}' not found",
            error_type="dataset_not_found",
        )
        self.dataset_id = dataset_id


class UnauthorizedAnalystViewError(BIError):
    """Raised when user tries to access analyst view without permissions"""

    def __init__(self, user_id: str):
        super().__init__(
            f"User '{user_id}' is not authorized to view analyst details",
            error_type="analyst_view_forbidden",
        )
        self.user_id = user_id


class ValidationError(BIError):
    """Raised when dataset validation fails"""

    def __init__(self, errors: List[str], warnings: Optional[List[str]] = None):
        super().__init__(
            "Dataset validation failed",
            error_type="validation_error",
            errors=[{"detail": error} for error in errors],
        )
        self.warnings = warnings or []


class DataQualityError(BIError):
    """Raised when data quality is too poor to proceed"""

    def __init__(self, quality_score: float, message: str):
        super().__init__(message, error_type="data_quality_error")
        self.quality_score = quality_score


def raise_http_exception(
    error: BIError, status_code: int = status.HTTP_400_BAD_REQUEST
) -> None:
    """Convert BIError to HTTPException with consistent response format"""
    raise HTTPException(
        status_code=status_code,
        detail={
            "detail": error.message,
            "type": error.error_type,
            "errors": error.errors,
        },
    )
