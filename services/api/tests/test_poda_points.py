"""PodaPoints spend / purchase / expiry invariants (unit layer, no database).

Replaces the previous file, which was pure arithmetic (``assert 1 == 1``) and
therefore could not detect any of the defects it appeared to cover.
"""

import copy
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.services.feature_service import feature_service
from app.services.poda_points_service import poda_points_service


# ── Fakes ───────────────────────────────────────────────────────────────────


class _Model:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.calls = []

    async def find_unique(self, where):
        self.calls.append(("find_unique", where))
        for row in self.rows:
            if all(getattr(row, k, None) == v for k, v in where.items()):
                return row
        return None

    async def find_first(self, where=None, **kwargs):
        self.calls.append(("find_first", where))
        for row in self.rows:
            if not where or all(getattr(row, k, None) == v for k, v in where.items()):
                return row
        return None

    async def find_many(self, where=None, **kwargs):
        self.calls.append(("find_many", where))
        if not where:
            return list(self.rows)
        out = []
        for row in self.rows:
            ok = True
            for key, value in where.items():
                current = getattr(row, key, None)
                if isinstance(value, dict) and "in" in value:
                    if current not in value["in"]:
                        ok = False
                        break
                elif isinstance(value, dict) and "lt" in value:
                    if not (current is not None and current < value["lt"]):
                        ok = False
                        break
                elif current != value:
                    ok = False
                    break
            if ok:
                out.append(row)
        return out

    async def create(self, data):
        row = SimpleNamespace(id=len(self.rows) + 1, **data)
        self.rows.append(row)
        return row

    async def update(self, where, data):
        row = await self.find_unique(where)
        if row is None:
            raise AssertionError(f"update on missing row {where}")
        for key, value in data.items():
            setattr(row, key, value)
        return row


class _Tx:
    """Fake transaction: records call order so lock-before-read is assertable."""

    def __init__(self, wallet, holds=(), payouts=()):
        self.order = []
        self.wallet = _Model([wallet])
        self.wallettransaction = _Model(list(holds))
        self.payout = _Model(list(payouts))
        self.escrowhold = _Model([])

    async def execute_raw(self, sql, *args):
        self.order.append(("execute_raw", sql))
        return 1


def _wallet(balance: int, wallet_id: int = 1, user_id: int = 7, active: bool = True):
    return SimpleNamespace(
        id=wallet_id,
        userId=user_id,
        podaPoints=balance,
        isActive=active,
        currency="PODAPOINT",
    )


def _record_find_unique(tx):
    """Record wallet reads on the transaction's call-order log."""
    original = tx.wallet.find_unique

    async def wrapped(where):
        tx.order.append(("find_unique", where))
        return await original(where)

    tx.wallet.find_unique = wrapped


# ── spend_points (W-01 / W-05 / W-07) ───────────────────────────────────────


@pytest.mark.asyncio
async def test_spend_locks_wallet_before_reading_balance():
    """Lock-then-read: reading first is the race that allowed double spends."""
    wallet = _wallet(1_000)
    tx = _Tx(wallet)
    _record_find_unique(tx)

    await poda_points_service.spend_points(7, "project_post", quantity=1, tx=tx)

    assert tx.order[0][0] == "execute_raw"
    assert "FOR UPDATE" in tx.order[0][1]
    assert any(kind == "find_unique" for kind, _ in tx.order[1:])


@pytest.mark.asyncio
async def test_spend_writes_positive_amount_and_returns_ledger_id():
    """`amount` is a magnitude; the direction lives in `type` (W-07)."""
    wallet = _wallet(1_000)
    tx = _Tx(wallet)

    result = await poda_points_service.spend_points(
        7, "project_post", reference_id="job-1", quantity=2, tx=tx
    )

    assert result["price"] == 400
    assert result["remaining_balance"] == 600
    assert result["transaction_id"] == 1

    row = tx.wallettransaction.rows[0]
    assert row.amount == 400  # positive, not -400
    assert row.type == "SPEND"
    assert row.previousBalance == 1_000
    assert row.newBalance == 600
    assert row.referenceId == "job-1"
    assert wallet.podaPoints == 600


@pytest.mark.asyncio
async def test_spend_uses_available_balance_not_raw_balance():
    """Held funds cannot be spent (W-06 + W-01 interaction)."""
    wallet = _wallet(1_000)
    held = SimpleNamespace(
        id=99,
        walletId=1,
        amount=900,
        type="HOLD",
        referenceId="hold-1",
        metadata={"phase": "HELD"},
    )
    tx = _Tx(wallet, holds=[held])

    with pytest.raises(HTTPException) as exc:
        await poda_points_service.spend_points(7, "project_post", tx=tx)

    assert exc.value.status_code == 402
    assert wallet.podaPoints == 1_000  # untouched
    assert [r for r in tx.wallettransaction.rows if r.type == "SPEND"] == []


@pytest.mark.asyncio
async def test_spend_rejects_non_positive_quantity():
    with pytest.raises(ValueError):
        await poda_points_service.spend_points(7, "project_post", quantity=0)


@pytest.mark.asyncio
async def test_spend_unknown_feature_is_400():
    with pytest.raises(HTTPException) as exc:
        await poda_points_service.spend_points(7, "not_a_feature")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_spend_inactive_wallet_rejected():
    wallet = _wallet(1_000, active=False)
    tx = _Tx(wallet)

    with pytest.raises(HTTPException) as exc:
        await poda_points_service.spend_points(7, "project_post", tx=tx)

    assert exc.value.status_code == 400


# ── purchase_with_points (W-01 / W-02 / W-12) ──────────────────────────────


@pytest.mark.asyncio
async def test_skill_passport_is_rejected_before_any_debit():
    """THE regression: skill_passport used to be charged 500 points then 400'd."""
    with patch.object(poda_points_service, "spend_points", new=AsyncMock()) as spend:
        with pytest.raises(HTTPException) as exc:
            await feature_service.purchase_with_points(7, "skill_passport")

    assert exc.value.status_code == 400
    spend.assert_not_awaited()


@pytest.mark.asyncio
async def test_price_drift_between_catalog_and_ledger_is_rejected():
    drifted = copy.copy(poda_points_service.FEATURE_PRICES)
    drifted["project_post"] = 999

    with (
        patch.object(poda_points_service, "FEATURE_PRICES", drifted),
        patch.object(poda_points_service, "spend_points", new=AsyncMock()) as spend,
    ):
        with pytest.raises(HTTPException) as exc:
            await feature_service.purchase_with_points(7, "project_post")

    assert exc.value.status_code == 500
    spend.assert_not_awaited()


@pytest.mark.asyncio
async def test_quantity_above_cap_rejected():
    with patch.object(poda_points_service, "spend_points", new=AsyncMock()) as spend:
        with pytest.raises(HTTPException) as exc:
            await feature_service.purchase_with_points(
                7, "project_post", quantity=feature_service.MAX_QUANTITY + 1
            )

    assert exc.value.status_code == 400
    spend.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_feature_rejected():
    with pytest.raises(HTTPException) as exc:
        await feature_service.purchase_with_points(7, "nope")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_featured_project_requires_reference_id():
    with pytest.raises(HTTPException) as exc:
        await feature_service.purchase_with_points(7, "featured_project_7d")

    assert exc.value.status_code == 400


# ── expire_old_points (W-09) ───────────────────────────────────────────────


class _TxCtx:
    def __init__(self, tx):
        self.tx = tx

    async def __aenter__(self):
        return self.tx

    async def __aexit__(self, *args):
        return False


class _FakePrisma:
    def __init__(self, wallet, credits, existing_expiry=None):
        self.wallet = _Model([wallet])
        self.wallettransaction = _Model(list(credits) + list(existing_expiry or []))
        self._tx = _Tx(wallet)
        # Share the delegates so rows created inside the transaction are visible
        # to the next (idempotency) query, exactly like a real commit.
        self._tx.wallet = self.wallet
        self._tx.wallettransaction = self.wallettransaction

    def tx(self):
        return _TxCtx(self._tx)


def _credit(row_id, wallet_id, amount, created):
    return SimpleNamespace(
        id=row_id,
        walletId=wallet_id,
        amount=amount,
        type="CREDIT",
        createdAt=created,
    )


@pytest.mark.asyncio
async def test_expire_old_points_debits_and_is_idempotent():
    from datetime import datetime, timedelta, timezone

    old = datetime.now(timezone.utc) - timedelta(days=400)
    wallet = _wallet(5_000)
    credit = _credit(1, 1, 2_000, old)

    fake = _FakePrisma(wallet, [credit])

    with patch("app.services.poda_points_service.prisma", fake):
        first = await poda_points_service.expire_old_points()

        assert first["expired_points"] == 2_000
        assert wallet.podaPoints == 3_000
        expiry_row = fake._tx.wallettransaction.rows[-1]
        assert expiry_row.amount == 2_000  # positive magnitude
        assert expiry_row.type == "EXPIRY"
        assert expiry_row.referenceId == "expiry:1"

        # Second sweep must be a no-op: the marker row already exists.
        second = await poda_points_service.expire_old_points()

    assert second["expired_points"] == 0
    assert wallet.podaPoints == 3_000


@pytest.mark.asyncio
async def test_expire_old_points_ignores_recent_credits():
    from datetime import datetime, timezone

    wallet = _wallet(5_000)
    credit = _credit(1, 1, 2_000, datetime.now(timezone.utc))

    fake = _FakePrisma(wallet, [credit])

    with patch("app.services.poda_points_service.prisma", fake):
        result = await poda_points_service.expire_old_points()

    assert result["expired_points"] == 0
    assert wallet.podaPoints == 5_000


@pytest.mark.asyncio
async def test_expire_old_points_is_capped_at_current_balance():
    """Points already spent are not expired a second time."""
    from datetime import datetime, timedelta, timezone

    old = datetime.now(timezone.utc) - timedelta(days=400)
    wallet = _wallet(300)  # only 300 of the original 5_000 credit remains
    credit = _credit(1, 1, 5_000, old)

    fake = _FakePrisma(wallet, [credit])

    with patch("app.services.poda_points_service.prisma", fake):
        result = await poda_points_service.expire_old_points()

    assert result["expired_points"] == 300
    assert wallet.podaPoints == 0
