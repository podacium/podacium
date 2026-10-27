"""Wallet ledger invariants (unit layer, no database).

These replace the previous arithmetic-only placeholder tests, which asserted
things like ``balance - hold == balance - hold`` and could never fail when the
ledger was broken.

The behaviours covered here are the ones that caused real money bugs:

* ``get_available_balance`` ignored ``hold_funds`` reservations (W-06) and
  clamped over-commitment to zero, hiding insolvency;
* ``audit_wallet_ledger`` mis-signed SPEND/EXPIRY rows (W-07/W-08), so an
  honest wallet reported as corrupt and a corrupted one could pass.

Real-PostgreSQL coverage for the transactional half lives in
``tests/integration/test_wallet_invariants.py``.
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.wallet_service import wallet_service


class _Model:
    """Minimal in-memory stand-in for a Prisma model delegate."""

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


class _FakeDb:
    """Fake ``prisma``/transaction exposing only what these code paths touch."""

    def __init__(self, wallet, holds=(), releases=(), payouts=(), escrow=()):
        self.wallet = _Model([wallet])
        self.wallettransaction = _Model([*holds, *releases])
        self.payout = _Model(list(payouts))
        self.escrowhold = _Model(list(escrow))
        self.raw_sql = []

    async def execute_raw(self, sql, *args):
        self.raw_sql.append((sql, args))
        return 1


def _wallet(balance: int, wallet_id: int = 1):
    return SimpleNamespace(
        id=wallet_id, userId=7, podaPoints=balance, isActive=True, currency="PODAPOINT"
    )


# ── get_available_balance (W-06) ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_available_balance_subtracts_generic_hold():
    """hold_funds() reservations must reduce spendable balance."""
    wallet = _wallet(10_000)
    db = _FakeDb(
        wallet,
        holds=[
            SimpleNamespace(
                id=1,
                walletId=wallet.id,
                amount=4_000,
                type="HOLD",
                referenceId="hold-1",
                metadata={"phase": "HELD"},
            )
        ],
    )

    assert await wallet_service.get_available_balance(wallet.id, tx=db) == 6_000


@pytest.mark.asyncio
async def test_available_balance_ignores_released_hold():
    wallet = _wallet(10_000)
    db = _FakeDb(
        wallet,
        holds=[
            SimpleNamespace(
                id=1,
                walletId=wallet.id,
                amount=4_000,
                type="HOLD",
                referenceId="hold-1",
                metadata={"phase": "HELD"},
            )
        ],
        releases=[
            SimpleNamespace(
                id=2,
                walletId=wallet.id,
                amount=4_000,
                type="RELEASE",
                referenceId="hold-1",
                metadata=None,
            )
        ],
    )

    assert await wallet_service.get_available_balance(wallet.id, tx=db) == 10_000


@pytest.mark.asyncio
async def test_available_balance_ignores_posted_hold():
    """A posted two-phase transfer is a real debit already in the balance."""
    wallet = _wallet(6_000)
    db = _FakeDb(
        wallet,
        holds=[
            SimpleNamespace(
                id=1,
                walletId=wallet.id,
                amount=4_000,
                type="HOLD",
                referenceId="tx-1",
                metadata={"phase": "POSTED"},
            )
        ],
    )

    assert await wallet_service.get_available_balance(wallet.id, tx=db) == 6_000


@pytest.mark.asyncio
async def test_available_balance_is_not_clamped_when_over_committed(caplog):
    """Over-commitment must surface as a negative available balance (W-06).

    Clamping to zero made an insolvent wallet look merely empty, so every
    downstream ``available < amount`` check still had to fail for the right
    reason and monitoring never saw the incident.
    """
    wallet = _wallet(1_000)
    db = _FakeDb(
        wallet,
        payouts=[
            SimpleNamespace(id=1, walletId=wallet.id, amount=3_000, status="PENDING")
        ],
    )

    with caplog.at_level("ERROR"):
        available = await wallet_service.get_available_balance(wallet.id, tx=db)

    assert available == -2_000
    assert any("over-committed" in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_available_balance_missing_wallet_raises_404():
    db = _FakeDb(_wallet(0))
    db.wallet.rows = []

    with pytest.raises(HTTPException) as exc:
        await wallet_service.get_available_balance(999, tx=db)

    assert exc.value.status_code == 404


# ── audit_wallet_ledger (W-07 / W-08) ───────────────────────────────────────


def _ledger_row(
    row_id, tx_type, amount, previous, new, reference=None, description=None
):
    return SimpleNamespace(
        id=row_id,
        walletId=1,
        type=tx_type,
        amount=amount,
        previousBalance=previous,
        newBalance=new,
        referenceId=reference,
        description=description,
        createdAt=None,
    )


@pytest.mark.asyncio
async def test_audit_accepts_positive_spend_and_expiry_rows():
    """SPEND/EXPIRY carry a positive amount; direction comes from ``type``."""
    wallet = _wallet(1_300)
    db = _FakeDb(wallet)
    db.wallettransaction.rows = [
        _ledger_row(1, "CREDIT", 2_000, 0, 2_000),
        _ledger_row(2, "SPEND", 200, 2_000, 1_800),
        _ledger_row(3, "EXPIRY", 500, 1_800, 1_300),
    ]

    result = await wallet_service.audit_wallet_ledger(wallet.id, db=db)

    assert result["is_valid"] is True, result["discrepancies"]
    assert result["calculated_balance"] == result["current_balance"] == 1_300


@pytest.mark.asyncio
async def test_audit_tolerates_legacy_negative_spend_rows():
    """Rows written before the sign convention was fixed used -amount."""
    wallet = _wallet(1_800)
    db = _FakeDb(wallet)
    db.wallettransaction.rows = [
        _ledger_row(1, "CREDIT", 2_000, 0, 2_000),
        _ledger_row(2, "SPEND", -200, 2_000, 1_800),  # legacy signed value
    ]

    result = await wallet_service.audit_wallet_ledger(wallet.id, db=db)

    assert result["is_valid"] is True, result["discrepancies"]
    assert result["total_debits"] == 200


@pytest.mark.asyncio
async def test_audit_detects_real_balance_discontinuity():
    """A forged ledger row that does not add up must still be reported."""
    wallet = _wallet(50_000)
    db = _FakeDb(wallet)
    db.wallettransaction.rows = [
        _ledger_row(1, "CREDIT", 1_000, 0, 1_000),
        # claims +49_000 while the amount says 1_000
        _ledger_row(2, "CREDIT", 1_000, 1_000, 50_000),
    ]

    result = await wallet_service.audit_wallet_ledger(wallet.id, db=db)

    assert result["is_valid"] is False
    assert result["chain_broken"] is True
    assert any("discontinuity" in d for d in result["discrepancies"])
