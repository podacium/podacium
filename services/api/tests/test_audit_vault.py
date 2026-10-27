"""
Unit tests for Cryptographic Audit Vault Service (HMAC-SHA256 Chaining).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.audit_trail_service import (
    audit_trail_service,
    _compute_hash,
    GENESIS_PREVIOUS_HASH,
)


def test_compute_hash_deterministic():
    """Verify HMAC-SHA256 digest computation is deterministic and changes on payload tampering."""
    secret = "test_secret_123"
    hash1 = _compute_hash(
        secret=secret,
        sequence=1,
        timestamp="2026-09-20T12:00:00+00:00",
        action="users:ban",
        domain="USERS",
        resource_type="User",
        resource_id="10",
        status="SUCCESS",
        previous_hash=GENESIS_PREVIOUS_HASH,
        metadata_str="{}",
    )
    hash2 = _compute_hash(
        secret=secret,
        sequence=1,
        timestamp="2026-09-20T12:00:00+00:00",
        action="users:ban",
        domain="USERS",
        resource_type="User",
        resource_id="10",
        status="SUCCESS",
        previous_hash=GENESIS_PREVIOUS_HASH,
        metadata_str="{}",
    )
    assert hash1 == hash2

    # Tampered action
    hash_tampered = _compute_hash(
        secret=secret,
        sequence=1,
        timestamp="2026-09-20T12:00:00+00:00",
        action="users:unban",
        domain="USERS",
        resource_type="User",
        resource_id="10",
        status="SUCCESS",
        previous_hash=GENESIS_PREVIOUS_HASH,
        metadata_str="{}",
    )
    assert hash1 != hash_tampered


@pytest.mark.asyncio
async def test_audit_log_chains_from_previous_record():
    """Verify new audit records chain from the previous record's sha256Hash."""
    mock_latest = MagicMock()
    mock_latest.sequenceNumber = 42
    mock_latest.sha256Hash = "prev_sha256_abcdef123456"

    with (
        patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.find_first",
            new_callable=AsyncMock,
        ) as mock_find_first,
        patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.create",
            new_callable=AsyncMock,
        ) as mock_create,
    ):
        mock_find_first.return_value = mock_latest
        mock_create.return_value = MagicMock(sequenceNumber=43)

        await audit_trail_service.log_action(
            action="finance:gateways:write",
            domain="BILLING",
            resource_type="PaymentGatewayConfig",
            resource_id="1",
        )

        mock_create.assert_called_once()
        create_kwargs = mock_create.call_args[1]["data"]
        assert create_kwargs["sequenceNumber"] == 43
        assert create_kwargs["previousHash"] == "prev_sha256_abcdef123456"
        assert len(create_kwargs["sha256Hash"]) == 64


@pytest.mark.asyncio
async def test_genesis_audit_record_creation():
    """Verify first audit record uses GENESIS_PREVIOUS_HASH and sequence=1."""
    with (
        patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.find_first",
            new_callable=AsyncMock,
        ) as mock_find_first,
        patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.create",
            new_callable=AsyncMock,
        ) as mock_create,
    ):
        mock_find_first.return_value = None
        mock_create.return_value = MagicMock(sequenceNumber=1)

        await audit_trail_service.log_action(
            action="system:startup",
            domain="SYSTEM",
            resource_type="Server",
        )

        mock_create.assert_called_once()
        data = mock_create.call_args[1]["data"]
        assert data["sequenceNumber"] == 1
        assert data["previousHash"] == GENESIS_PREVIOUS_HASH


@pytest.mark.asyncio
async def test_chain_integrity_verification_success():
    from app.core.config import setting

    secret = setting.JWT_SECRET_KEY or "audit_secret_fallback_2026"
    from datetime import datetime, timezone

    ts = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    hash_1 = _compute_hash(
        secret=secret,
        sequence=1,
        timestamp=ts.isoformat(),
        action="users:create",
        domain="IAM",
        resource_type="User",
        resource_id="1",
        status="SUCCESS",
        previous_hash=GENESIS_PREVIOUS_HASH,
        metadata_str="{}",
    )
    rec1 = MagicMock(
        sequenceNumber=1,
        timestamp=ts,
        action="users:create",
        domain=MagicMock(name="IAM"),
        resourceType="User",
        resourceId="1",
        status=MagicMock(name="SUCCESS"),
        previousHash=GENESIS_PREVIOUS_HASH,
        sha256Hash=hash_1,
        metadata={},
    )
    hash_2 = _compute_hash(
        secret=secret,
        sequence=2,
        timestamp=ts.isoformat(),
        action="users:ban",
        domain="IAM",
        resource_type="User",
        resource_id="1",
        status="SUCCESS",
        previous_hash=hash_1,
        metadata_str="{}",
    )
    rec2 = MagicMock(
        sequenceNumber=2,
        timestamp=ts,
        action="users:ban",
        domain=MagicMock(name="IAM"),
        resourceType="User",
        resourceId="1",
        status=MagicMock(name="SUCCESS"),
        previousHash=hash_1,
        sha256Hash=hash_2,
        metadata={},
    )

    with patch(
        "app.services.audit_trail_service.prisma.adminaudittrail.find_many",
        new_callable=AsyncMock,
    ) as mock_find_many:
        mock_find_many.return_value = [rec1, rec2]
        res = await audit_trail_service.verify_chain_integrity()
        assert res["is_valid"] is True
        assert res["verified_count"] == 2
        assert len(res["corruptions"]) == 0


@pytest.mark.asyncio
async def test_chain_tamper_detection_on_hash_modification():
    """Verify tampering with a historical hash breaks chain integrity."""
    rec1 = MagicMock(
        sequenceNumber=1,
        timestamp=MagicMock(isoformat=lambda: "2026-09-20T12:00:00+00:00"),
        action="users:create",
        domain=MagicMock(name="IAM"),
        resourceType="User",
        resourceId="1",
        status=MagicMock(name="SUCCESS"),
        previousHash=GENESIS_PREVIOUS_HASH,
        sha256Hash="tampered_hash_123456",
        metadata={},
    )
    with patch(
        "app.services.audit_trail_service.prisma.adminaudittrail.find_many",
        new_callable=AsyncMock,
    ) as mock_find_many:
        mock_find_many.return_value = [rec1]
        res = await audit_trail_service.verify_chain_integrity()
        assert res["is_valid"] is False
        assert len(res["corruptions"]) > 0
        assert res["corruptions"][0]["sequence"] == 1


@pytest.mark.asyncio
async def test_audit_log_serialization_under_lock():
    """Verify concurrent log_action calls are strictly serialized and chained under asyncio.Lock()."""
    import asyncio

    created_records = []
    current_seq = [0]
    last_hash = [GENESIS_PREVIOUS_HASH]

    async def fake_find_first(order=None):
        if not created_records:
            return None
        return created_records[-1]

    async def fake_create(data):
        # Simulate slight async delay to verify lock prevents race conditions
        await asyncio.sleep(0.005)
        seq = data["sequenceNumber"]
        prev = data["previousHash"]
        sha = data["sha256Hash"]
        assert (
            prev == last_hash[0]
        ), f"Sequence broken: expected prev {last_hash[0]}, got {prev}"
        assert seq == current_seq[0] + 1
        current_seq[0] = seq
        last_hash[0] = sha
        rec = MagicMock(
            sequenceNumber=seq,
            sha256Hash=sha,
            previousHash=prev,
        )
        created_records.append(rec)
        return rec

    with (
        patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.find_first",
            side_effect=fake_find_first,
        ),
        patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.create",
            side_effect=fake_create,
        ),
    ):
        tasks = [
            audit_trail_service.log_action(
                action=f"action:{i}",
                domain="SYSTEM",
                resource_type="Job",
                resource_id=str(i),
            )
            for i in range(5)
        ]
        results = await asyncio.gather(*tasks)
        assert len(results) == 5
        assert len(created_records) == 5
        assert [r.sequenceNumber for r in created_records] == [1, 2, 3, 4, 5]
