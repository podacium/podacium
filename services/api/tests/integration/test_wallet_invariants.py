"""
P0 FINANCIAL INVARIANTS — wallet transfers (real PostgreSQL).

Proves the critical money-minting exploit is closed:

  from_wallet_id == to_wallet_id  ⇒  balance unchanged, no ledger entries.

Also verifies normal transfer, insufficient funds, and the schema validator.
"""

import pytest

from app.core.prisma import prisma
from app.services.wallet_service import wallet_service
from app.schemas.payment import WalletTransferRequest, PaymentPurpose


async def _create_wallet(user_id: int, poda_points: int = 0):
    return await prisma.wallet.create(
        data={
            "userId": user_id,
            "podaPoints": poda_points,
            "currency": "PODAPOINT",
            "isActive": True,
        }
    )


async def _ledger(wallet_id: int):
    return await prisma.wallettransaction.find_many(
        where={"walletId": wallet_id}, order={"createdAt": "asc"}
    )


async def _balance(wallet_id: int) -> int:
    row = await prisma.wallet.find_unique(where={"id": wallet_id})
    return row.podaPoints if row else -1


@pytest.mark.integration
async def test_self_transfer_leaves_balance_unchanged(prisma, _clean_db, make_user):
    """THE exploit regression: self-transfer must NOT mint money."""
    uid = await make_user("self@podacium.com")
    wallet = await _create_wallet(user_id=uid, poda_points=10_000)

    # Layer 1: the Pydantic schema rejects from==to up-front.
    with pytest.raises(ValueError, match="same wallet"):
        WalletTransferRequest(
            from_wallet_id=wallet.id,
            to_wallet_id=wallet.id,
            amount=5_000,
            purpose=PaymentPurpose.TRANSFER,
        )

    # Layer 2: even a raw (unvalidated) service call must not mint money.
    # Use model_construct to bypass the Pydantic guard and prove the SERVICE
    # independently rejects a self-transfer.
    from fastapi import HTTPException

    raw_request = WalletTransferRequest.model_construct(
        from_wallet_id=wallet.id,
        to_wallet_id=wallet.id,  # identical — must be rejected at the service layer
        amount=5_000,
        purpose=PaymentPurpose.TRANSFER,
    )
    with pytest.raises(HTTPException) as exc:
        await wallet_service.transfer_funds(raw_request)
    assert exc.value.status_code == 400

    # FINANCIAL INVARIANT: balance is unchanged after both rejected attempts.
    assert await _balance(wallet.id) == 10_000
    # No stale/debit/credit ledger rows were created for the non-transfer.
    assert await _ledger(wallet.id) == []


@pytest.mark.integration
async def test_schema_rejects_self_transfer(prisma):
    with pytest.raises(ValueError, match="same wallet"):
        WalletTransferRequest(
            from_wallet_id=1,
            to_wallet_id=1,
            amount=1,
            purpose=PaymentPurpose.TRANSFER,
        )


@pytest.mark.integration
async def test_schema_rejects_zero_and_negative_amount(prisma):
    with pytest.raises(ValueError):
        WalletTransferRequest(
            from_wallet_id=1, to_wallet_id=2, amount=0, purpose=PaymentPurpose.TRANSFER
        )
    with pytest.raises(ValueError):
        WalletTransferRequest(
            from_wallet_id=1, to_wallet_id=2, amount=-5, purpose=PaymentPurpose.TRANSFER
        )


@pytest.mark.integration
async def test_normal_transfer_moves_exact_amount(prisma, _clean_db, make_user):
    """A legitimate A->B transfer debits one wallet and credits the other by
    exactly `amount`, with matching ledger rows on both sides."""
    a = await _create_wallet(
        user_id=await make_user("a@podacium.com"), poda_points=10_000
    )
    b = await _create_wallet(user_id=await make_user("b@podacium.com"), poda_points=500)

    await wallet_service.transfer_funds(
        WalletTransferRequest(
            from_wallet_id=a.id,
            to_wallet_id=b.id,
            amount=4_000,
            purpose=PaymentPurpose.TRANSFER,
            description="test transfer",
        )
    )

    assert await _balance(a.id) == 6_000
    assert await _balance(b.id) == 4_500

    # Ledger: one TRANSFER_OUT on A, one TRANSFER_IN on B, one main Transaction.
    a_rows = await _ledger(a.id)
    b_rows = await _ledger(b.id)
    assert len(a_rows) == 1 and a_rows[0].type == "TRANSFER_OUT"
    assert len(b_rows) == 1 and b_rows[0].type == "TRANSFER_IN"
    main_tx = await prisma.transaction.count(
        where={"walletId": a.id, "amount": 4_000, "status": "COMPLETED"}
    )
    assert main_tx == 1


@pytest.mark.integration
async def test_transfer_insufficient_balance_rejected(prisma, _clean_db, make_user):
    a = await _create_wallet(
        user_id=await make_user("low@podacium.com"), poda_points=100
    )
    b = await _create_wallet(
        user_id=await make_user("zero@podacium.com"), poda_points=0
    )

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await wallet_service.transfer_funds(
            WalletTransferRequest(
                from_wallet_id=a.id,
                to_wallet_id=b.id,
                amount=500,
                purpose=PaymentPurpose.TRANSFER,
            )
        )
    assert exc.value.status_code == 400

    # Neither side changed.
    assert await _balance(a.id) == 100
    assert await _balance(b.id) == 0


@pytest.mark.integration
async def test_transfer_unknown_target_rejected(prisma, _clean_db, make_user):
    a = await _create_wallet(user_id=await make_user("x@podacium.com"), poda_points=100)

    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await wallet_service.transfer_funds(
            WalletTransferRequest(
                from_wallet_id=a.id,
                to_wallet_id=999_999,
                amount=50,
                purpose=PaymentPurpose.TRANSFER,
            )
        )


# ─────────────────────────────────────────────────────────────────────────────
# PodaPoints spend / purchase / hold invariants (W-01, W-06, W-07, W-09, W-12)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_spend_points_writes_positive_amount_and_links_ledger_row(
    prisma, _clean_db, make_user
):
    """A SPEND row must be a positive magnitude and be the row the caller got.

    Previously the ledger row carried -amount (opposite sign to every other
    type), and the router had to guess the row id from "latest transaction",
    which could pick up a concurrent credit.
    """
    from app.services.poda_points_service import poda_points_service

    uid = await make_user("spender@podacium.com")
    wallet = await _create_wallet(user_id=uid, poda_points=1_000)

    result = await poda_points_service.spend_points(uid, "project_post")

    assert result["remaining_balance"] == 800
    assert await _balance(wallet.id) == 800

    rows = await _ledger(wallet.id)
    assert len(rows) == 1
    assert rows[0].type == "SPEND"
    assert rows[0].amount == 200  # positive
    assert rows[0].id == result["transaction_id"]
    assert rows[0].previousBalance == 1_000
    assert rows[0].newBalance == 800


@pytest.mark.integration
async def test_feature_purchase_is_atomic_with_the_grant(prisma, _clean_db, make_user):
    """If the grant fails, the debit must roll back (W-01).

    `featured_project_7d` charges 500 points and then verifies project
    ownership. Before the fix the debit had already committed, so a user who
    passed a bogus/foreign project id paid 500 points and received nothing.
    """
    from fastapi import HTTPException

    from app.services.feature_service import feature_service

    uid = await make_user("atomic@podacium.com")
    wallet = await _create_wallet(user_id=uid, poda_points=1_000)

    with pytest.raises(HTTPException):
        await feature_service.purchase_with_points(
            uid, "featured_project_7d", reference_id="999999"
        )

    assert await _balance(wallet.id) == 1_000
    assert await _ledger(wallet.id) == []
    assert await prisma.featurepurchase.count(where={"userId": uid}) == 0


@pytest.mark.integration
async def test_skill_passport_cannot_be_bought(prisma, _clean_db, make_user):
    """Regression: skill_passport used to cost 500 points and then 400."""
    from fastapi import HTTPException

    from app.services.feature_service import feature_service

    uid = await make_user("passport@podacium.com")
    wallet = await _create_wallet(user_id=uid, poda_points=1_000)

    with pytest.raises(HTTPException) as exc:
        await feature_service.purchase_with_points(uid, "skill_passport")

    assert exc.value.status_code == 400
    assert await _balance(wallet.id) == 1_000
    assert await _ledger(wallet.id) == []


@pytest.mark.integration
async def test_hold_funds_reduces_available_balance_only(prisma, _clean_db, make_user):
    """hold_funds used to write a HOLD row with no phase marker, so
    get_available_balance ignored it and the "held" funds stayed spendable."""
    uid = await make_user("holder@podacium.com")
    wallet = await _create_wallet(user_id=uid, poda_points=1_000)

    await wallet_service.hold_funds(
        wallet_id=wallet.id,
        amount=400,
        purpose=PaymentPurpose.TRANSFER,
        reference_id="hold-it",
    )

    assert await _balance(wallet.id) == 1_000  # total untouched
    assert await wallet_service.get_available_balance(wallet.id) == 600

    from app.services.poda_points_service import poda_points_service

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        # 1000 > 600 available, even though the raw balance is 1_000.
        await poda_points_service.spend_points(uid, "featured_project_7d", quantity=2)

    assert exc.value.status_code == 402
    assert await _balance(wallet.id) == 1_000


@pytest.mark.integration
async def test_expire_old_points_is_idempotent(prisma, _clean_db, make_user):
    """Expiry must run once per source credit, and never go below zero (W-09).

    Nothing scheduled expiry before this fix, and the query it ran filtered on
    type=TOP_UP, which the live purchase path never writes.
    """
    from datetime import datetime, timedelta, timezone

    from app.services.poda_points_service import poda_points_service

    uid = await make_user("expiring@podacium.com")
    wallet = await _create_wallet(user_id=uid, poda_points=1_000)

    old = datetime.now(timezone.utc) - timedelta(days=400)
    await prisma.wallettransaction.create(
        data={
            "walletId": wallet.id,
            "amount": 1_000,
            "previousBalance": 0,
            "newBalance": 1_000,
            "type": "CREDIT",
            "purpose": PaymentPurpose.PODAPOINT_PURCHASE,
            "createdAt": old,
        }
    )

    first = await poda_points_service.expire_old_points()
    assert first["expired_points"] == 1_000
    assert await _balance(wallet.id) == 0

    second = await poda_points_service.expire_old_points()
    assert second["expired_points"] == 0
    assert await _balance(wallet.id) == 0

    expiry_rows = [row for row in await _ledger(wallet.id) if row.type == "EXPIRY"]
    assert len(expiry_rows) == 1
    assert expiry_rows[0].amount == 1_000
    assert (expiry_rows[0].referenceId or "").startswith("expiry:")
