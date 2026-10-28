"""
Unit and integration tests for PlatformModeEngine.
Tests the hard-guarded PLATFORM_MODE toggle requiring all 6 statutory compliance items.
"""

import pytest
from app.services.platform_mode import (
    PlatformModeEngine,
    PlatformMode,
    ChecklistItemKey,
    VerifyChecklistRequest,
    ToggleModeRequest,
)


@pytest.fixture
def engine():
    eng = PlatformModeEngine()
    eng.reset_for_testing()
    return eng


def test_initial_state_is_simulation(engine):
    state = engine.get_state()
    assert state.current_mode == PlatformMode.SIMULATION
    assert not state.all_requirements_met
    assert state.total_requirements == 6
    assert state.verified_count == 0
    assert len(state.checklist) == 6


def test_toggle_to_live_fails_without_requirements(engine):
    req = ToggleModeRequest(
        target_mode=PlatformMode.LIVE,
        admin_id="admin-123",
        admin_otp="999888",
        justification="Attempting premature live launch",
    )
    with pytest.raises(PermissionError) as exc_info:
        engine.toggle_mode(req)
    assert "FATAL REGULATORY LOCK" in str(exc_info.value)
    assert engine.get_state().current_mode == PlatformMode.SIMULATION


def test_verify_checklist_items_one_by_one(engine):
    items_to_verify = [
        ChecklistItemKey.COSOB_CIP_LICENSE,
        ChecklistItemKey.SEGREGATED_ESCROW_CONTRACT,
        ChecklistItemKey.CHARGILY_PAY_PROD_KEYS,
        ChecklistItemKey.NOMINEE_SPAS_CONSTITUTION,
        ChecklistItemKey.SHARIA_BOARD_FATWA,
        ChecklistItemKey.BANK_OF_ALGERIA_NOTIFICATION,
    ]

    for idx, key in enumerate(items_to_verify, 1):
        item = engine.verify_checklist_item(
            VerifyChecklistRequest(
                key=key,
                verified_by="compliance-officer-nadia",
                document_proof_hash=f"sha256-proof-hash-{key.value}",
                notes=f"Statutory validation item #{idx}",
            )
        )
        assert item.is_verified
        assert item.verified_by == "compliance-officer-nadia"
        assert item.document_proof_hash == f"sha256-proof-hash-{key.value}"

    state = engine.get_state()
    assert state.all_requirements_met
    assert state.verified_count == 6


def test_successful_toggle_to_live_when_all_met(engine):
    # Verify all 6
    for key in ChecklistItemKey:
        engine.verify_checklist_item(
            VerifyChecklistRequest(
                key=key,
                verified_by="compliance-officer-nadia",
                document_proof_hash=f"sha256-proof-hash-{key.value}",
                notes="Approved",
            )
        )

    # Toggle to LIVE
    req = ToggleModeRequest(
        target_mode=PlatformMode.LIVE,
        admin_id="admin-nadia",
        admin_otp="123456",
        justification="All 6 COSOB, banking escrow, and Sharia conditions verified",
    )
    new_state = engine.toggle_mode(req)
    assert new_state.current_mode == PlatformMode.LIVE
    assert new_state.transitioned_by == "admin-nadia"
    assert new_state.last_transition_at is not None

    # Toggle back to SIMULATION (always allowed)
    sim_req = ToggleModeRequest(
        target_mode=PlatformMode.SIMULATION,
        admin_id="admin-nadia",
        admin_otp="123456",
        justification="Reverting to simulation sandbox for educational cohort",
    )
    reverted_state = engine.toggle_mode(sim_req)
    assert reverted_state.current_mode == PlatformMode.SIMULATION
