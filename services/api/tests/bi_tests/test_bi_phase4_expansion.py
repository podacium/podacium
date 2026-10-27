"""
Unit tests for BI Phase 4 Expansion Services:
- CLSMaskingService
- ReportExporter
- verify_organization_access
"""

import pytest
from app.services.bi_services.cls_masking_service import CLSMaskingService
from app.services.bi_services.report_exporter import ReportExporter
from app.core.auth import verify_organization_access
from fastapi import HTTPException

class DummyUser:
    def __init__(self, user_id=1, is_admin=False, organization_id=10):
        self.id = user_id
        self.is_admin = is_admin
        self.organization_id = organization_id

def test_cls_masking_service_sensitive_columns():
    assert CLSMaskingService.is_sensitive_column("user_ssn") is True
    assert CLSMaskingService.is_sensitive_column("phone_number") is True
    assert CLSMaskingService.is_sensitive_column("annual_salary") is True
    assert CLSMaskingService.is_sensitive_column("dataset_name") is False

def test_cls_masking_service_apply_masking():
    records = [
        {"id": 1, "name": "Alice", "phone": "1234567890", "salary": 50000},
        {"id": 2, "name": "Bob", "phone": "0987654321", "salary": 60000},
    ]

    # ADMIN sees unmasked
    unmasked = CLSMaskingService.apply_cls_masking(records, user_role="ADMIN")
    assert unmasked[0]["phone"] == "1234567890"

    # VIEWER gets masked phone and salary
    masked = CLSMaskingService.apply_cls_masking(records, user_role="VIEWER")
    assert masked[0]["phone"] != "1234567890"
    assert "*" in masked[0]["phone"]


def test_report_exporter_csv_generation():
    records = [
        {"metric": "Revenue", "value": 1000},
        {"metric": "Costs", "value": 400},
    ]
    csv_bytes = ReportExporter.export_to_csv(records)
    csv_str = csv_bytes.decode("utf-8")
    assert "metric,value" in csv_str
    assert "Revenue,1000" in csv_str

@pytest.mark.asyncio
async def test_verify_organization_access_success():
    user = DummyUser(organization_id=10)
    org_id = await verify_organization_access(10, user)
    assert org_id == 10

@pytest.mark.asyncio
async def test_verify_organization_access_mismatch():
    user = DummyUser(organization_id=10)
    with pytest.raises(HTTPException) as exc:
        await verify_organization_access(99, user)
    assert exc.value.status_code == 403
