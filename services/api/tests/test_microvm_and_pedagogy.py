"""
Unit tests for Layer 6: MicroVM Sandboxing, AST Winnowing Plagiarism, W3C Open Badges v3,
Arrêté 1275, Kahn's DAG Prerequisite Engine, and Progression Velocity Analytics.
"""

import pytest
from datetime import datetime, timezone
from app.services.microvm_evaluator_service import microvm_evaluator_service
from app.services.pedagogy_service import (
    PrerequisiteGraphValidator,
    NodeAccessEvaluator,
    ProgressionVelocityAnalytics,
    VelocityRecord,
)


@pytest.mark.asyncio
async def test_sandboxed_code_execution_async_success():
    source = "def add(a, b): return a + b"
    test_code = "assert add(2, 3) == 5\nprint('TEST_PASSED')"
    res = await microvm_evaluator_service.execute_sandboxed_code_async(
        source_code=source, test_code=test_code, timeout_seconds=3.0
    )
    assert res.passed is True
    assert res.exit_code == 0
    assert "TEST_PASSED" in res.stdout
    assert res.timed_out is False
    assert res.duration_ms > 0


@pytest.mark.asyncio
async def test_sandboxed_code_execution_async_assertion_error():
    source = "def add(a, b): return a - b"
    test_code = "assert add(2, 3) == 5"
    res = await microvm_evaluator_service.execute_sandboxed_code_async(
        source_code=source, test_code=test_code, timeout_seconds=3.0
    )
    assert res.passed is False
    assert res.exit_code != 0
    assert "AssertionError" in res.stderr


@pytest.mark.asyncio
async def test_sandboxed_code_execution_async_timeout():
    source = "import time\nwhile True: time.sleep(0.1)"
    test_code = "pass"
    res = await microvm_evaluator_service.execute_sandboxed_code_async(
        source_code=source, test_code=test_code, timeout_seconds=0.5
    )
    assert res.passed is False
    assert res.timed_out is True
    assert "timed out" in res.stderr.lower()


def test_ast_winnowing_plagiarism_identical_structure():
    code_1 = """
def calculate_vat(subtotal):
    standard_rate = 0.19
    final_amount = subtotal * (1 + standard_rate)
    return round(final_amount, 2)
"""
    code_2 = """
def compute_tva(montant_ht):
    taux_standard = 0.19
    montant_ttc = montant_ht * (1 + taux_standard)
    return round(montant_ttc, 2)
"""
    report = microvm_evaluator_service.calculate_plagiarism_similarity(code_1, code_2)
    assert report["jaccard_similarity"] >= 0.85
    assert report["is_plagiarized"] is True


def test_ast_winnowing_plagiarism_different_algorithms():
    code_1 = """
def sort_items(arr):
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] > arr[j]:
                arr[i], arr[j] = arr[j], arr[i]
    return arr
"""
    code_2 = """
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
"""
    report = microvm_evaluator_service.calculate_plagiarism_similarity(code_1, code_2)
    assert report["jaccard_similarity"] < 0.50
    assert report["is_plagiarized"] is False


def test_w3c_verifiable_credential_arrete_1275():
    eval_res = microvm_evaluator_service.evaluate_capstone_submission(
        student_id=101,
        repo_url="https://github.com/student/fintech-algerie",
        commit_hash="c0ffee123456",
        tests_passed=10,
        tests_total=10,
        coverage_percent=95.0,
    )
    arrete_meta = {
        "track_type": "STARTUP",
        "university_affiliation": {
            "institutionCode": "DZ-MESRS-ESE-ORAN",
            "institutionName": "École Supérieure en Économie d'Oran (ESE Oran)",
            "incubatorId": "INC-ESE-ORAN-2026-04",
        },
        "startup_project": {
            "projectName": "Algérie Cashless Rails",
            "labelStatus": "PROJET_INNOVANT_OBTENU",
            "nationalCommitteeRef": "CNL-2026-DZ-8942",
            "asfEligible": True,
        },
    }
    cred = microvm_evaluator_service.issue_verifiable_credential(
        student_id=101,
        student_name="Karim Belkacem",
        evaluation=eval_res,
        course_title="Distributed Algorithmic Systems Masterclass",
        arrete_1275_metadata=arrete_meta,
    )
    assert cred["type"] == [
        "VerifiableCredential",
        "OpenBadgeCredential",
        "PodaciumCapstoneProof",
    ]
    assert "algerianRegulatoryExtension" in cred["credentialSubject"]
    reg = cred["credentialSubject"]["algerianRegulatoryExtension"]
    assert "Arrêté 1275" in reg["framework"]
    assert reg["universityAffiliation"]["institutionCode"] == "DZ-MESRS-ESE-ORAN"

    # Verify cryptographic signature
    verify_res = microvm_evaluator_service.verify_credential_proof(cred)
    assert verify_res["is_valid"] is True
    assert verify_res["student_name"] == "Karim Belkacem"
    assert verify_res["algerian_regulatory_extension"] is not None


def test_linkedin_add_to_profile_url():
    url = microvm_evaluator_service.build_linkedin_certification_url(
        course_title="FastAPI & Next.js Architecture",
        certificate_id="PDC-TEST-12345",
        issued_at=datetime(2026, 10, 16, tzinfo=timezone.utc),
    )
    assert "https://www.linkedin.com/profile/add" in url
    assert "startTask=CERTIFICATION_NAME" in url
    assert "PDC-TEST-12345" in url
    assert "104859302" in url
    assert "issueYear=2026" in url
    assert "issueMonth=10" in url


def test_kahn_dag_prerequisite_validation_valid():
    nodes = ["lesson_1", "lesson_2", "lesson_3", "lesson_4"]
    edges = [
        ("lesson_1", "lesson_2"),
        ("lesson_2", "lesson_3"),
        ("lesson_1", "lesson_4"),
        ("lesson_3", "lesson_4"),
    ]
    validator = PrerequisiteGraphValidator(nodes, edges)
    is_valid, topo_order, cycles = validator.validate_dag()
    assert is_valid is True
    assert len(cycles) == 0
    assert len(topo_order) == 4
    assert topo_order.index("lesson_1") < topo_order.index("lesson_2")
    assert topo_order.index("lesson_2") < topo_order.index("lesson_3")
    assert topo_order.index("lesson_3") < topo_order.index("lesson_4")


def test_kahn_dag_prerequisite_validation_cycle_detection():
    nodes = ["node_a", "node_b", "node_c"]
    edges = [
        ("node_a", "node_b"),
        ("node_b", "node_c"),
        ("node_c", "node_a"),  # Cycle!
    ]
    validator = PrerequisiteGraphValidator(nodes, edges)
    is_valid, topo_order, cycles = validator.validate_dag()
    assert is_valid is False
    assert len(cycles) == 3


def test_node_access_evaluator():
    prereq_graph = {
        "lesson_3": ["lesson_1", "lesson_2"],
        "lesson_2": ["lesson_1"],
        "lesson_1": [],
    }
    # User completed only lesson_1
    allowed, missing = NodeAccessEvaluator.can_student_access_node(
        "lesson_3", prereq_graph, {"lesson_1"}
    )
    assert allowed is False
    assert missing == ["lesson_2"]

    # User completed both
    allowed, missing = NodeAccessEvaluator.can_student_access_node(
        "lesson_3", prereq_graph, {"lesson_1", "lesson_2"}
    )
    assert allowed is True
    assert missing == []


def test_progression_velocity_analytics():
    records = [
        VelocityRecord(user_id=1, completed_effort_minutes=300, active_days=14),
        VelocityRecord(user_id=2, completed_effort_minutes=320, active_days=14),
        VelocityRecord(user_id=3, completed_effort_minutes=290, active_days=14),
        VelocityRecord(user_id=4, completed_effort_minutes=310, active_days=14),
        VelocityRecord(user_id=5, completed_effort_minutes=305, active_days=14),
        VelocityRecord(
            user_id=6, completed_effort_minutes=15, active_days=14
        ),  # Extreme drop!
    ]
    report = ProgressionVelocityAnalytics.calculate_cohort_velocity(
        records, window_days=14, z_threshold=-2.0
    )
    assert report["cohort_size"] == 6
    assert report["at_risk_count"] == 1
    flagged = report["at_risk_students"][0]
    assert flagged["user_id"] == 6
    assert flagged["z_score"] < -2.0
    assert flagged["requires_retention_nudge"] is True


@pytest.mark.asyncio
async def test_evaluate_student_code_endpoint():
    from app.routers.education import evaluate_student_code
    from app.schemas.education import CodeExecutionRequest
    from unittest.mock import MagicMock

    user = MagicMock()
    user.id = 1
    user.role = "STUDENT"

    req = CodeExecutionRequest(
        code="def solve(x): return x * 2",
        test_code="assert solve(4) == 8\nprint('PASSED')",
    )
    res = await evaluate_student_code(payload=req, current_user=user)
    assert res.passed is True
    assert "PASSED" in res.output
    assert res.error is None
    assert res.duration_ms > 0


@pytest.mark.asyncio
async def test_sandboxed_code_execution_blocks_network_egress():
    """Verify student Python sandbox execution blocks network egress to internal VPC and external hosts."""
    source = """
import socket
s = socket.socket()
s.connect(("127.0.0.1", 5432))
"""
    test_code = "pass"
    res = await microvm_evaluator_service.execute_sandboxed_code_async(
        source_code=source, test_code=test_code, timeout_seconds=2.0
    )
    assert res.passed is False
    assert (
        "network" in res.stderr.lower()
        or "permissionerror" in res.stderr.lower()
        or "oserror" in res.stderr.lower()
        or "unreachable" in res.stderr.lower()
    )


@pytest.mark.asyncio
async def test_sandboxed_code_execution_enforces_memory_quota():
    """Verify student Python sandbox enforces strict memory quotas (RLIMIT_AS)."""
    source = """
# Attempt to allocate 500MB with 64MB quota
big_chunk = 'a' * (500 * 1024 * 1024)
"""
    test_code = "pass"
    res = await microvm_evaluator_service.execute_sandboxed_code_async(
        source_code=source, test_code=test_code, timeout_seconds=2.0, memory_limit_mb=64
    )
    assert res.passed is False
    assert "memoryerror" in res.stderr.lower()


def test_sweep_line_jitter_buffer_tolerance_0_25():
    """Verify sweep-line O(N log N) interval merging respects 0.25s jitter buffer."""
    from app.services.video.interval_tracker import interval_tracker

    # 1. Gap of 0.20s (< 0.25s) is merged: 0-10 and 10.20-20 -> (0, 20)
    intervals_close = [(0.0, 10.0), (10.20, 20.0)]
    merged_close = interval_tracker.merge_intervals(
        intervals_close, jitter_tolerance=0.25
    )
    assert merged_close == [(0.0, 20.0)]

    # 2. Gap of 0.35s (> 0.25s) is kept separate: 0-10 and 10.35-20 -> (0, 10), (10.35, 20)
    intervals_far = [(0.0, 10.0), (10.35, 20.0)]
    merged_far = interval_tracker.merge_intervals(intervals_far, jitter_tolerance=0.25)
    assert merged_far == [(0.0, 10.0), (10.35, 20.0)]


def test_heartbeat_rejects_server_wall_clock_spoofing():
    """Verify server wall-clock delta anti-cheat rejects spoofed progress faster than physical playback."""
    from app.services.video.interval_tracker import interval_tracker

    # Client claims 25 seconds watched while server wall-clock recorded only 2 seconds elapsed
    res = interval_tracker.verify_progress_heartbeat(
        existing_intervals=[(0.0, 10.0)],
        new_start=10.0,
        new_end=35.0,
        duration_seconds=100.0,
        time_elapsed_since_last_beacon=2.0,
        server_elapsed_seconds=2.0,
        max_speed_multiplier=2.5,
    )
    assert res["is_valid"] is False
    assert "Server anti-cheat violation" in res["reason"]


def test_heartbeat_rejects_rapid_spam_flood():
    """Verify server rejects high-frequency spamming heartbeats that try to exploit drift allowances."""
    from app.services.video.interval_tracker import interval_tracker

    # Client fires heartbeat after only 0.05s server wall-clock with a 5s chunk
    res = interval_tracker.verify_progress_heartbeat(
        existing_intervals=[(0.0, 10.0)],
        new_start=10.0,
        new_end=15.0,
        duration_seconds=100.0,
        time_elapsed_since_last_beacon=0.05,
        server_elapsed_seconds=0.05,
    )
    assert res["is_valid"] is False
    assert "too rapidly" in res["reason"]


def test_w3c_verifiable_credential_tamper_detected_on_envelope_change():
    """VULN-W2-09: Tampering with outer envelope (issuer, issuanceDate, id) must be detected."""
    eval_res = microvm_evaluator_service.evaluate_capstone_submission(
        student_id=202,
        repo_url="https://github.com/student/fintech-algerie",
        commit_hash="deadbeef1234",
        tests_passed=10,
        tests_total=10,
        coverage_percent=90.0,
    )
    cred = microvm_evaluator_service.issue_verifiable_credential(
        student_id=202,
        student_name="Amine Zerrouki",
        evaluation=eval_res,
        course_title="FinTech MicroVM Security",
    )
    # Valid initially
    assert microvm_evaluator_service.verify_credential_proof(cred)["is_valid"] is True

    # 1. Tamper with issuer name
    tampered_issuer = dict(cred)
    tampered_issuer["issuer"] = dict(cred["issuer"])
    tampered_issuer["issuer"]["name"] = "Malicious Rogue Authority"
    res1 = microvm_evaluator_service.verify_credential_proof(tampered_issuer)
    assert res1["is_valid"] is False

    # 2. Tamper with issuance date
    tampered_date = dict(cred)
    tampered_date["issuanceDate"] = "2020-01-01T00:00:00+00:00"
    res2 = microvm_evaluator_service.verify_credential_proof(tampered_date)
    assert res2["is_valid"] is False

    # 3. Tamper with credential ID
    tampered_id = dict(cred)
    tampered_id["id"] = "urn:uuid:00000000-0000-0000-0000-000000000000"
    res3 = microvm_evaluator_service.verify_credential_proof(tampered_id)
    assert res3["is_valid"] is False


def test_w3c_verifiable_credential_third_party_public_key_verification():
    """Verify third parties can verify credentials off-platform using only the public key."""
    eval_res = microvm_evaluator_service.evaluate_capstone_submission(
        student_id=303,
        repo_url="https://github.com/student/fintech-algerie",
        commit_hash="beefcafe5678",
        tests_passed=10,
        tests_total=10,
        coverage_percent=88.0,
    )
    cred = microvm_evaluator_service.issue_verifiable_credential(
        student_id=303,
        student_name="Fatima Zohra",
        evaluation=eval_res,
        course_title="Distributed Systems",
    )
    pub_key_hex = microvm_evaluator_service.public_key_hex
    res = microvm_evaluator_service.verify_credential_proof(
        cred, public_key_hex=pub_key_hex
    )
    assert res["is_valid"] is True
    assert res["student_name"] == "Fatima Zohra"
    assert res["scope"] == "FULL_DOCUMENT_RFC8785"
