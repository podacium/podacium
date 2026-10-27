"""
Unit tests for MicroVM Evaluator, License Scanner, DLG Parser & Reputation Forensics.
"""

from app.services.microvm_evaluator_service import microvm_evaluator_service
from app.services.license_scanner_service import license_scanner_service
from app.services.dlg_parser_service import dlg_parser_service
from app.services.reputation_service import reputation_service, DeviceClusterInfo


def test_microvm_ast_fingerprint_and_evaluation():
    code_a = """
def calculate_tax(amount):
    # Standard IFU tax
    rate = 0.005
    return amount * rate
"""
    code_b = """
def compute_due(x):
    r = 0.005
    return x * r
"""
    # Identical AST structure despite renaming
    fp_a = microvm_evaluator_service.generate_ast_fingerprint(code_a)
    fp_b = microvm_evaluator_service.generate_ast_fingerprint(code_b)
    assert fp_a == fp_b

    eval_res = microvm_evaluator_service.evaluate_capstone_submission(
        student_id=42,
        repo_url="https://github.com/student/algerian-fintech",
        commit_hash="a1b2c3d4e5f67890",
        source_code_sample=code_a,
        tests_passed=10,
        tests_total=10,
        coverage_percent=90.0,
    )
    assert eval_res.passed is True
    assert eval_res.rubric.total_score >= 80.0

    cred = microvm_evaluator_service.issue_verifiable_credential(
        student_id=42,
        student_name="Amina Benali",
        evaluation=eval_res,
    )
    assert cred["id"].startswith("urn:uuid:")
    assert "proof" in cred

    verify_res = microvm_evaluator_service.verify_credential_proof(cred)
    assert verify_res["is_valid"] is True
    assert verify_res["student_name"] == "Amina Benali"


def test_license_scanner_and_onda_manifest():
    deps = {
        "fastapi": "MIT",
        "pydantic": "MIT",
        "some-viral-lib": "GPL-3.0-only",
    }
    report = license_scanner_service.scan_manifest_dependencies(deps)
    assert report.is_clear_for_commercial_handover is False
    assert report.viral_license_count == 1
    assert report.risk_level == "HIGH_RISK_COPYLEFT"

    # Permissive only
    clean_deps = {"fastapi": "MIT", "requests": "Apache-2.0"}
    clean_report = license_scanner_service.scan_manifest_dependencies(clean_deps)
    assert clean_report.is_clear_for_commercial_handover is True
    assert clean_report.risk_level == "CLEAN"

    manifest = license_scanner_service.generate_onda_copyright_manifest(
        contract_id=10,
        milestone_id=2,
        client_name="SARL Digital Oran",
        client_nif="000131012345678",
        freelancer_name="Yacine Meziani",
        freelancer_anae_id="162400998811",
        deliverable_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    assert "manifest_hmac_sha256" in manifest
    assert "PODACIUM-ONDA-CTR10-MS2" in manifest["watermark_tag"]


def test_dlg_pc_compta_parser():
    sample_journal = (
        "Compte;Date;Libellé;Débit;Crédit\n"
        "700000;2026-09-01;Vente Prestation DZD;0;100000\n"
        "411100;2026-09-01;Créance Client SARL;100000;0\n"
        "601000;2026-09-05;Achat fournitures;25000;0\n"
        "512000;2026-09-05;Règlement Banque;0;25000\n"
    ).encode("windows-1256")

    res = dlg_parser_service.parse_dlg_journal(sample_journal)
    assert res.is_valid is True
    assert res.total_entries == 4
    assert res.is_balanced is True
    assert "REVENUE" in res.scf_breakdown


def test_reputation_and_velocity_limits():
    # 1. Collusion detection
    device_a = DeviceClusterInfo(
        canvas_hash="canvas_hash_123",
        webgl_vendor="NVIDIA Corporation",
        ip_subnet_24="197.200.10.0/24",
        user_agent="Mozilla/5.0 Chrome/120",
        cluster_fingerprint="cluster_123",
    )
    device_b = DeviceClusterInfo(
        canvas_hash="canvas_hash_123",
        webgl_vendor="NVIDIA Corporation",
        ip_subnet_24="197.200.10.0/24",
        user_agent="Mozilla/5.0 Chrome/120",
        cluster_fingerprint="cluster_123",
    )
    collusion = reputation_service.detect_collusion_between_parties(device_a, device_b)
    assert collusion.is_collusion_risk is True
    assert collusion.action == "BLOCK"

    # 2. Sybil review down-weighting
    reviews = [
        {"rating": 5.0, "client_completed_orders": 1},  # Sybil/New account (weight 0.1)
        {
            "rating": 1.0,
            "client_completed_orders": 10,
        },  # Established account (weight 1.0)
    ]
    rating_res = reputation_service.calculate_sybil_weighted_rating(reviews)
    # Raw average is (5+1)/2 = 3.0, but weighted is (5*0.1 + 1*1.0) / (0.1 + 1.0) = 1.5 / 1.1 ~= 1.36
    assert rating_res["raw_average"] == 3.0
    assert rating_res["weighted_rating"] < 2.0

    # 3. Transaction velocity limit
    vel_res = reputation_service.check_transaction_velocity_limit(
        user_tier="TIER_0_EMAIL",
        current_month_gmv_dzd=25000,
        proposed_contract_amount_dzd=10000,
    )
    assert vel_res.is_allowed is False
    assert vel_res.upgrade_required_tier == "TIER_1_NIN"
