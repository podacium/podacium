"""Admin wallet adjustment guard rails (unit layer, no database).

``POST /wallets/admin/{id}/adjust`` mints or destroys PodaPoints directly, so it
is the single most dangerous admin surface in the platform. These tests pin the
guard rails that were added after the wallet audit:

* granular RBAC instead of the legacy ``role == "ADMIN"`` flag (the permission
  dependency itself is exercised in ``tests/test_admin_rbac_comprehensive.py``);
* a per-operator cap below the maker-checker threshold;
* a mandatory, meaningful reason;
* replay protection keyed on the caller's ``idempotency_key``;
* the audit row is written inside the same transaction as the balance change.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routers import wallet as wallet_router

MIN_REASON = "ledger correction per ticket #4471"


class _Model:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.created = []

    async def find_unique(self, where):
        for row in self.rows:
            if all(getattr(row, k, None) == v for k, v in where.items()):
                return row
        return None

    async def find_first(self, where=None, **kwargs):
        for row in self.rows:
            if not where or all(getattr(row, k, None) == v for k, v in where.items()):
                return row
        return None

    async def find_many(self, where=None, **kwargs):
        if not where:
            return list(self.rows)
        return [
            row
            for row in self.rows
            if all(getattr(row, k, None) == v for k, v in where.items())
        ]

    async def create(self, data):
        row = SimpleNamespace(id=len(self.rows) + 1, **data)
        self.rows.append(row)
        self.created.append(data)
        return row


class _Tx:
    def __init__(self, wallet, ledger=()):
        self.raw_sql = []
        self.wallet = _Model([wallet] if wallet else [])
        self.wallettransaction = _Model(ledger)
        self.auditlog = _Model([])

    async def execute_raw(self, sql, *args):
        self.raw_sql.append(sql)
        return 1


class _TxCtx:
    def __init__(self, tx):
        self.tx = tx

    async def __aenter__(self):
        return self.tx

    async def __aexit__(self, *args):
        return False


def _wallet(balance: int = 1_000, wallet_id: int = 1):
    return SimpleNamespace(id=wallet_id, podaPoints=balance, isActive=True)


async def _call(**overrides):
    kwargs = {
        "wallet_id": 1,
        "adjustment": 500,
        "reason": MIN_REASON,
        "idempotency_key": None,
        "admin": MagicMock(id=42),
    }
    kwargs.update(overrides)
    return await wallet_router.admin_adjust_wallet_balance(**kwargs)


@pytest.mark.asyncio
async def test_zero_adjustment_is_rejected():
    with pytest.raises(HTTPException) as exc:
        await _call(adjustment=0)

    assert exc.value.status_code == 400
    assert "non-zero" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_adjustment_above_cap_is_rejected():
    """A single operator must never be able to move a maker-checker amount."""
    cap = wallet_router.MAX_ADMIN_ADJUSTMENT

    with pytest.raises(HTTPException) as exc:
        await _call(adjustment=cap + 1)

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "ADJUSTMENT_EXCEEDS_CAP"
    assert exc.value.detail["cap"] == cap
    assert cap < 100_000  # below WalletService.MAKER_CHECKER_THRESHOLD


@pytest.mark.asyncio
async def test_reason_shorter_than_minimum_is_rejected():
    with pytest.raises(HTTPException) as exc:
        await _call(reason="fix")

    assert exc.value.status_code == 400
    assert "reason" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_credit_applies_and_audits_in_one_transaction():
    wallet = _wallet(1_000)
    tx = _Tx(wallet)

    with (
        patch.object(wallet_router.prisma, "tx", return_value=_TxCtx(tx)),
        patch.object(
            wallet_router.wallet_service,
            "credit_wallet",
            new=AsyncMock(
                return_value=SimpleNamespace(id=wallet.id, poda_points=1_500)
            ),
        ) as credit,
    ):
        result = await _call(adjustment=500, idempotency_key="ticket-4471")

    assert result["success"] is True
    assert result["previous_balance"] == 1_000
    assert result["new_balance"] == 1_500

    # The wallet row is locked before anything is read or written.
    assert any("FOR UPDATE" in sql for sql in tx.raw_sql)

    # The credit participates in the same transaction and is not booked as a sale.
    _, kwargs = credit.call_args
    assert kwargs["tx"] is tx
    assert kwargs["amount"] == 500
    assert kwargs["skip_transaction"] is True
    assert kwargs["reference_id"] == "ADMIN_ADJUST_42_ticket-4471"

    # Audit row committed with the balance change.
    assert len(tx.auditlog.created) == 1
    audit = tx.auditlog.created[0]
    assert audit["actorId"] == 42
    assert audit["eventType"] == "WALLET_BALANCE_ADJUSTMENT"
    assert audit["metadata"].data["new_balance"] == 1_500


@pytest.mark.asyncio
async def test_replayed_idempotency_key_does_not_apply_twice():
    wallet = _wallet(1_000)
    existing = SimpleNamespace(
        id=99,
        referenceId="ADMIN_ADJUST_42_ticket-4471",
        previousBalance=1_000,
        newBalance=1_500,
    )
    tx = _Tx(wallet, ledger=[existing])

    with (
        patch.object(wallet_router.prisma, "tx", return_value=_TxCtx(tx)),
        patch.object(
            wallet_router.wallet_service, "credit_wallet", new=AsyncMock()
        ) as credit,
    ):
        result = await _call(adjustment=500, idempotency_key="ticket-4471")

    assert result["idempotent_replay"] is True
    assert result["new_balance"] == 1_500
    credit.assert_not_awaited()
    assert tx.auditlog.created == []


@pytest.mark.asyncio
async def test_missing_wallet_is_404_and_audits_nothing():
    tx = _Tx(wallet=None)

    with patch.object(wallet_router.prisma, "tx", return_value=_TxCtx(tx)):
        with pytest.raises(HTTPException) as exc:
            await _call()

    assert exc.value.status_code == 404
    assert tx.auditlog.created == []
