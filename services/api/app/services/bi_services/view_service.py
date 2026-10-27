"""
View Service
Handles Executive vs Analyst view transformations.
"""

from typing import Any, Dict, Optional
from enum import Enum



# Domain labels for localization
DOMAIN_LABELS = {
    "sales":     {"en": "Sales",     "fr": "Ventes",        "ar": "المبيعات"},
    "finance":   {"en": "Finance",   "fr": "Finance",       "ar": "المالية"},
    "hr":        {"en": "HR",        "fr": "RH",            "ar": "الموارد البشرية"},
    "product":   {"en": "Product",   "fr": "Produit",       "ar": "المنتج"},
    "marketing": {"en": "Marketing", "fr": "Marketing",     "ar": "التسويق"},
    "operations":{"en": "Operations","fr": "Opérations",    "ar": "العمليات"},
    "other":     {"en": "Other",     "fr": "Autre",         "ar": "أخرى"},
}


def localize_domain(domain: Optional[str], locale: str = "en") -> str:
    """Return the human-readable domain label for the given locale."""
    if not domain:
        return ""
    locale = locale if locale in ("en", "fr", "ar") else "en"
    labels = DOMAIN_LABELS.get(domain.lower().strip())
    return labels.get(locale, domain) if labels else domain


class ViewType(str, Enum):
    """Available view types"""
    EXECUTIVE = "executive"
    ANALYST = "analyst"


class ViewService:
    """Service for transforming results based on view type"""
    
    @classmethod
    def can_view_analyst(cls, user: Any) -> bool:
        """Check if user can view analyst details"""
        # Try to get role from user object
        user_role = getattr(user, "role", None)
        
        # Check for analyst or admin roles
        if user_role and user_role.upper() in ("ANALYST", "ADMIN", "DATA_ANALYST"):
            return True
        
        # Check for permission flag
        if hasattr(user, "can_view_analyst"):
            return bool(user.can_view_analyst)
        
        # Check for permissions list
        if hasattr(user, "permissions"):
            permissions = getattr(user, "permissions", [])
            if isinstance(permissions, list):
                return "view_analyst" in permissions or "analyst_access" in permissions
        
        return False
    
    @classmethod
    def prepare_dataset_view(
        cls,
        dataset: Dict[str, Any],
        view_type: ViewType,
        user: Any
    ) -> Dict[str, Any]:
        """Prepare dataset view based on user role and view type"""
        if view_type == ViewType.EXECUTIVE:
            return cls._create_executive_dataset_view(dataset)
        elif view_type == ViewType.ANALYST:
            if not cls.can_view_analyst(user):
                from .errors import UnauthorizedAnalystViewError
                raise UnauthorizedAnalystViewError(getattr(user, "id", "unknown"))
            return cls._create_analyst_dataset_view(dataset)
        else:
            # Default to executive
            return cls._create_executive_dataset_view(dataset)
    
    @classmethod
    def prepare_validation_view(
        cls,
        validation_result: Dict[str, Any],
        view_type: ViewType,
        user: Any
    ) -> Dict[str, Any]:
        """Prepare validation view based on user role and view type"""
        if view_type == ViewType.EXECUTIVE:
            return cls._create_executive_validation_view(validation_result)
        elif view_type == ViewType.ANALYST:
            if not cls.can_view_analyst(user):
                from .errors import UnauthorizedAnalystViewError
                raise UnauthorizedAnalystViewError(getattr(user, "id", "unknown"))
            return cls._create_analyst_validation_view(validation_result)
        else:
            return cls._create_executive_validation_view(validation_result)
    
    @classmethod
    def prepare_quality_view(
        cls,
        quality_result: Dict[str, Any],
        view_type: ViewType,
        user: Any
    ) -> Dict[str, Any]:
        """Prepare quality view based on user role and view type"""
        if view_type == ViewType.EXECUTIVE:
            return cls._create_executive_quality_view(quality_result)
        elif view_type == ViewType.ANALYST:
            if not cls.can_view_analyst(user):
                from .errors import UnauthorizedAnalystViewError
                raise UnauthorizedAnalystViewError(getattr(user, "id", "unknown"))
            return cls._create_analyst_quality_view(quality_result)
        else:
            return cls._create_executive_quality_view(quality_result)
    
    @classmethod
    def prepare_analytics_view(
        cls,
        analytics_result: Dict[str, Any],
        view_type: ViewType,
        user: Any
    ) -> Dict[str, Any]:
        """Prepare analytics view based on user role and view type"""
        if view_type == ViewType.EXECUTIVE:
            return cls._create_executive_analytics_view(analytics_result)
        elif view_type == ViewType.ANALYST:
            if not cls.can_view_analyst(user):
                from .errors import UnauthorizedAnalystViewError
                raise UnauthorizedAnalystViewError(getattr(user, "id", "unknown"))
            return cls._create_analyst_analytics_view(analytics_result)
        else:
            return cls._create_executive_analytics_view(analytics_result)
    
    @classmethod
    def prepare_evaluation_view(
        cls,
        evaluation_result: Dict[str, Any],
        view_type: ViewType,
        user: Any
    ) -> Dict[str, Any]:
        """Prepare evaluation view based on user role and view type"""
        if view_type == ViewType.EXECUTIVE:
            return cls._create_executive_evaluation_view(evaluation_result)
        elif view_type == ViewType.ANALYST:
            if not cls.can_view_analyst(user):
                from .errors import UnauthorizedAnalystViewError
                raise UnauthorizedAnalystViewError(getattr(user, "id", "unknown"))
            return cls._create_analyst_evaluation_view(evaluation_result)
        else:
            return cls._create_executive_evaluation_view(evaluation_result)
    
    @classmethod
    def prepare_decision_view(
        cls,
        decision_result: Dict[str, Any],
        view_type: ViewType,
        user: Any
    ) -> Dict[str, Any]:
        """Prepare decision view based on user role and view type"""
        if view_type == ViewType.EXECUTIVE:
            return cls._create_executive_decision_view(decision_result)
        elif view_type == ViewType.ANALYST:
            if not cls.can_view_analyst(user):
                from .errors import UnauthorizedAnalystViewError
                raise UnauthorizedAnalystViewError(getattr(user, "id", "unknown"))
            return cls._create_analyst_decision_view(decision_result)
        else:
            return cls._create_executive_decision_view(decision_result)
    
    @staticmethod
    def _create_executive_dataset_view(dataset: Dict[str, Any]) -> Dict[str, Any]:
        """Create executive view for dataset"""
        return {
            "dataset_id": dataset.get("dataset_id"),
            "name": dataset.get("name"),
            "description": dataset.get("description"),
            "domain": dataset.get("domain"),
            "format": dataset.get("format"),
            "original_filename": dataset.get("original_filename"),
            "created_at": dataset.get("created_at"),
            "updated_at": dataset.get("updated_at"),
            "uploaded_by": dataset.get("uploaded_by"),
            "row_count": dataset.get("row_count"),
            "column_count": dataset.get("column_count"),
            "status": dataset.get("status"),
            "columns": dataset.get("columns", []),
            "column_metadata": dataset.get("column_metadata", {}),
            "sample_records": dataset.get("sample_records", [])[:5],
        }
    
    @staticmethod
    def _create_analyst_dataset_view(dataset: Dict[str, Any]) -> Dict[str, Any]:
        """Create analyst view for dataset"""
        return dataset  # Return full dataset for analysts
    
    @staticmethod
    def _create_executive_validation_view(validation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create executive view for validation"""
        return {
            "valid": validation_result.get("valid", False),
            "has_warnings": len(validation_result.get("warnings", [])) > 0,
            "record_count": validation_result.get("record_count", 0),
            "column_count": validation_result.get("column_count", 0),
            "summary": "Dataset is valid and ready for analysis" if validation_result.get("valid") else "Dataset validation failed"
        }
    
    @staticmethod
    def _create_analyst_validation_view(validation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create analyst view for validation"""
        return validation_result  # Return full validation result
    
    @staticmethod
    def _create_executive_quality_view(quality_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create executive view for quality assessment"""
        return {
            "quality_score": quality_result.get("quality_score"),
            "quality_level": quality_result.get("quality_level"),
            "human_summary": quality_result.get("human_summary"),
            "recommendations": quality_result.get("recommendations", [])[:3]  # Top 3 only
        }
    
    @staticmethod
    def _create_analyst_quality_view(quality_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create analyst view for quality assessment"""
        return quality_result  # Return full quality result
    
    @staticmethod
    def _create_executive_analytics_view(analytics_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create executive view for analytics"""
        return {
            "executive_summary": analytics_result.get("executive_summary", ""),
            "business_insights": [
                {
                    "title": insight.get("title"),
                    "description": insight.get("description"),
                    "importance": insight.get("importance")
                }
                for insight in analytics_result.get("business_insights", [])[:5]  # Top 5 only
            ],
            "insight_count": len(analytics_result.get("business_insights", [])),
            "has_trends": "trend_analysis" in analytics_result.get("internal_technical", {})
        }
    
    @staticmethod
    def _create_analyst_analytics_view(analytics_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create analyst view for analytics"""
        return analytics_result  # Return full analytics result
    
    @staticmethod
    def _create_executive_evaluation_view(evaluation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create executive view for evaluation"""
        return {
            "confidence_level": evaluation_result.get("confidence_level"),
            "risk_level": evaluation_result.get("risk_level"),
            "stability_level": evaluation_result.get("stability_level"),
            "trust_summary": evaluation_result.get("trust_summary"),
            "limitations": evaluation_result.get("limitations", [])[:3],  # Top 3 only
            "has_concerns": evaluation_result.get("confidence_level") == "LOW" or 
                          evaluation_result.get("risk_level") == "HIGH"
        }
    
    @staticmethod
    def _create_analyst_evaluation_view(evaluation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create analyst view for evaluation"""
        return evaluation_result  # Return full evaluation result
    
    @staticmethod
    def _create_executive_decision_view(decision_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create executive view for decisions"""
        recommendations = decision_result.get("recommendations", [])
        
        return {
            "top_recommendations": [
                {
                    "text": rec.get("text"),
                    "priority": rec.get("priority"),
                    "expected_benefit": rec.get("expected_benefit")
                }
                for rec in recommendations[:5]  # Top 5 only
            ],
            "total_recommendations": len(recommendations),
            "expected_impact": decision_result.get("expected_impact", {}).get("level"),
            "explanation": decision_result.get("explanation"),
            "warnings": decision_result.get("warnings", [])[:3],  # Top 3 only
            "context": {
                "confidence_level": decision_result.get("context", {}).get("confidence_level"),
                "risk_level": decision_result.get("context", {}).get("risk_level")
            }
        }
    
    @staticmethod
    def _create_analyst_decision_view(decision_result: Dict[str, Any]) -> Dict[str, Any]:
        """Create analyst view for decisions"""
        return decision_result  # Return full decision result