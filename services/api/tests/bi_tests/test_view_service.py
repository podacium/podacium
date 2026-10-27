import pytest
from app.services.bi_services.view_service import ViewService, ViewType
from app.services.bi_services.errors import UnauthorizedAnalystViewError

class DummyUser:
    def __init__(self, role=None, can_view_analyst=False, permissions=None):
        self.role = role
        self.can_view_analyst_flag = can_view_analyst # using a different name to avoid masking property
        if can_view_analyst:
            self.can_view_analyst = True
        self.permissions = permissions or []
        self.id = "user_123"

class TestViewService:
    def test_can_view_analyst_with_role(self):
        user = DummyUser(role="ANALYST")
        assert ViewService.can_view_analyst(user) is True

    def test_can_view_analyst_with_flag(self):
        user = DummyUser(can_view_analyst=True)
        assert ViewService.can_view_analyst(user) is True

    def test_can_view_analyst_with_permission(self):
        user = DummyUser(permissions=["view_analyst"])
        assert ViewService.can_view_analyst(user) is True

    def test_can_view_analyst_denied(self):
        user = DummyUser(role="GUEST")
        assert ViewService.can_view_analyst(user) is False
        
    def test_can_view_analyst_null_user(self):
        assert ViewService.can_view_analyst(None) is False

    def test_prepare_dataset_view_executive(self):
        dataset = {"name": "Sales", "secret_analyst_data": 42, "columns": [{"name": "rev"}]}
        res = ViewService.prepare_dataset_view(dataset, ViewType.EXECUTIVE, DummyUser())
        assert res["name"] == "Sales"
        assert "secret_analyst_data" not in res
        assert "columns" in res

    def test_prepare_dataset_view_analyst_allowed(self):
        dataset = {"name": "Sales", "secret_analyst_data": 42}
        res = ViewService.prepare_dataset_view(dataset, ViewType.ANALYST, DummyUser(role="ANALYST"))
        assert res["secret_analyst_data"] == 42

    def test_prepare_dataset_view_analyst_denied(self):
        dataset = {"name": "Sales", "secret_analyst_data": 42}
        with pytest.raises(UnauthorizedAnalystViewError):
            ViewService.prepare_dataset_view(dataset, ViewType.ANALYST, DummyUser())

    def test_prepare_analytics_view_executive(self):
        analytics = {"executive_summary": "Good", "business_insights": [{"title": "I1"}], "internal_technical": {"trend_analysis": {}}}
        res = ViewService.prepare_analytics_view(analytics, ViewType.EXECUTIVE, DummyUser())
        assert res["executive_summary"] == "Good"
        assert res["has_trends"] is True
        assert "internal_technical" not in res

    def test_prepare_analytics_view_analyst(self):
        analytics = {"executive_summary": "Good", "internal_technical": {"trend_analysis": {}}}
        res = ViewService.prepare_analytics_view(analytics, ViewType.ANALYST, DummyUser(role="ADMIN"))
        assert "internal_technical" in res

    def test_prepare_analytics_view_analyst_unauthorized(self):
        analytics = {"executive_summary": "Good"}
        with pytest.raises(UnauthorizedAnalystViewError):
            ViewService.prepare_analytics_view(analytics, ViewType.ANALYST, DummyUser())

    def test_prepare_analytics_view_default(self):
        analytics = {"executive_summary": "Good"}
        # testing fallback when view_type is something else
        res = ViewService.prepare_analytics_view(analytics, "unknown_view_type", DummyUser())
        assert res["executive_summary"] == "Good"

    def test_prepare_dataset_view_default(self):
        dataset = {"name": "Sales", "secret_analyst_data": 42}
        res = ViewService.prepare_dataset_view(dataset, "unknown_view_type", DummyUser())
        assert res["name"] == "Sales"
        assert "secret_analyst_data" not in res

    def test_prepare_validation_view(self):
        val = {"valid": True, "warnings": ["w1"], "record_count": 10}
        # Executive
        res = ViewService.prepare_validation_view(val, ViewType.EXECUTIVE, DummyUser())
        assert "valid" in res
        assert res["has_warnings"] is True
        
        # Analyst
        res = ViewService.prepare_validation_view(val, ViewType.ANALYST, DummyUser(role="ADMIN"))
        assert res["warnings"] == ["w1"]
        
        # Unauthorized
        with pytest.raises(UnauthorizedAnalystViewError):
            ViewService.prepare_validation_view(val, ViewType.ANALYST, DummyUser())
            
        # Default
        res = ViewService.prepare_validation_view(val, "other", DummyUser())
        assert res["valid"] is True

    def test_prepare_quality_view(self):
        qual = {"quality_score": 95, "detailed_metrics": {}}
        # Executive
        res = ViewService.prepare_quality_view(qual, ViewType.EXECUTIVE, DummyUser())
        assert "quality_score" in res
        assert "detailed_metrics" not in res
        
        # Analyst
        res = ViewService.prepare_quality_view(qual, ViewType.ANALYST, DummyUser(role="ADMIN"))
        assert "detailed_metrics" in res
        
        # Unauthorized
        with pytest.raises(UnauthorizedAnalystViewError):
            ViewService.prepare_quality_view(qual, ViewType.ANALYST, DummyUser())
            
        # Default
        res = ViewService.prepare_quality_view(qual, "other", DummyUser())
        assert "detailed_metrics" not in res

    def test_prepare_evaluation_view(self):
        eval_data = {"confidence_level": "HIGH", "risk_level": "LOW", "raw_scores": {}}
        # Executive
        res = ViewService.prepare_evaluation_view(eval_data, ViewType.EXECUTIVE, DummyUser())
        assert res["confidence_level"] == "HIGH"
        assert res["has_concerns"] is False
        assert "raw_scores" not in res
        
        # Analyst
        res = ViewService.prepare_evaluation_view(eval_data, ViewType.ANALYST, DummyUser(role="ADMIN"))
        assert "raw_scores" in res
        
        # Unauthorized
        with pytest.raises(UnauthorizedAnalystViewError):
            ViewService.prepare_evaluation_view(eval_data, ViewType.ANALYST, DummyUser())
            
        # Default
        res = ViewService.prepare_evaluation_view(eval_data, "other", DummyUser())
        assert "raw_scores" not in res

    def test_prepare_decision_view(self):
        dec = {"recommendations": [{"text": "Do it"}], "explanation": "Why", "context": {"confidence_level": "HIGH"}, "internal_vars": {}}
        # Executive
        res = ViewService.prepare_decision_view(dec, ViewType.EXECUTIVE, DummyUser())
        assert "top_recommendations" in res
        assert "internal_vars" not in res
        
        # Analyst
        res = ViewService.prepare_decision_view(dec, ViewType.ANALYST, DummyUser(role="ADMIN"))
        assert "internal_vars" in res
        
        # Unauthorized
        with pytest.raises(UnauthorizedAnalystViewError):
            ViewService.prepare_decision_view(dec, ViewType.ANALYST, DummyUser())
            
        # Default
        res = ViewService.prepare_decision_view(dec, "other", DummyUser())
        assert "internal_vars" not in res
