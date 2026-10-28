"""
TamWheel Sovereign Ethical Agentic Venture OS — Comprehensive Test Suite for Phase 3.
Focus: Merkle-CRDT Offline State Channels & Viral Brag Engine (K=1.48).

Verifies:
1. Merkle-CRDT Offline Engine:
   - Cryptographic Ed25519 keypair generation, local voucher signing, and signature verification.
   - Binary Merkle tree construction (handling odd & even leaves via duplication).
   - O(log N) Merkle inclusion proof generation and verification.
   - Replay attack mitigation: duplicate voucher detection and monotonic nonces.
   - Offline batch reconciliation with Double-Entry Simulation Ledger integration.
   - Asset account overdraft protection against offline over-allocation.
2. Viral Growth & Brag Engine:
   - Visual Brag Cards: 1.91:1 (Landscape) and 9:16 (Vertical) with localized Darija/Arabic/French/English copy.
   - Mathematical K = 1.48 model: K_thesis (0.42) + K_squad (0.58) + K_fantasy (0.36) + K_wilaya (0.12) = 1.48.
   - VIP 48-Hour Early Access Allocation Window unlocks upon 3 verified analyst referrals.
   - Real-time collective Wilaya milestone grant triggers when regional backer threshold is achieved.
3. FastAPI HTTP Endpoints Integration:
   - /api/v1/offline/voucher, /merkle-root, /merkle-proof, /reconcile, /status
   - /api/v1/viral/brag-card, /k-factor, /vip-status, /referral, /milestones, /milestones/contribute
"""

import math
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.services.offline_crdt import (
    MerkleCRDTOfflineEngine,
    MerkleTree,
    OfflineVoucher,
    MerkleProof,
)
from app.services.viral_engine import (
    ViralGrowthEngine,
    K_THESIS,
    K_SQUAD,
    K_FANTASY,
    K_WILAYA,
    K_TOTAL,
    VIP_REFERRALS_THRESHOLD,
    VIP_EARLY_ACCESS_HOURS,
)
from app.services.simulation_engine import DoubleEntrySimulationLedger


# =============================================================================
# 1. UNIT TESTS: MERKLE-CRDT OFFLINE ENGINE
# =============================================================================

class TestMerkleCRDTOfflineEngine:
    """Verifies Ed25519 signing, Merkle trees, proof verification, and CRDT ledger reconciliation."""

    @pytest.fixture
    def engine(self):
        ledger = DoubleEntrySimulationLedger()
        eng = MerkleCRDTOfflineEngine(ledger=ledger)
        return eng

    def test_ed25519_keypair_generation_and_signature_verification(self, engine):
        """Ed25519 generates valid keypairs and verifies cryptographic signatures."""
        priv_hex, pub_hex = engine.generate_keypair()
        assert len(priv_hex) == 64  # 32 bytes hex
        assert len(pub_hex) == 64   # 32 bytes hex

        payload = b"TamWheel:Adrar:Voucher:10000DZD"
        signature_hex = engine.sign_payload(priv_hex, payload)
        assert len(signature_hex) == 128  # 64 bytes hex Ed25519 signature

        # Valid signature verification
        is_valid = engine.verify_signature(pub_hex, payload, signature_hex)
        assert is_valid is True

        # Tampered payload fails verification
        tampered_payload = b"TamWheel:Adrar:Voucher:99999DZD"
        assert engine.verify_signature(pub_hex, tampered_payload, signature_hex) is False

        # Tampered signature fails verification
        bad_sig = "0" * 128
        assert engine.verify_signature(pub_hex, payload, bad_sig) is False

    def test_offline_voucher_creation_canonical_hashing(self, engine):
        """Creates an offline voucher with valid Ed25519 signature and leaf hash."""
        voucher = engine.create_offline_voucher(
            user_id=10,
            campaign_id="camp-adrar-solar",
            amount_dzd=5000,
            wilaya=1,  # Adrar
        )
        assert voucher.user_id == 10
        assert voucher.amount_dzd == 5000
        assert voucher.nonce == 1
        assert voucher.wilaya == 1
        assert len(voucher.signature) == 128

        # Verify signature on canonical bytes
        assert engine.verify_signature(voucher.public_key, voucher.canonical_bytes(), voucher.signature) is True

        # Verify leaf hash is deterministic SHA-256
        leaf = voucher.leaf_hash()
        assert len(leaf) == 64

    def test_merkle_tree_construction_and_root_integrity(self, engine):
        """Constructs binary Merkle trees for even and odd counts with leaf duplication."""
        # 1. Single leaf
        v1 = engine.create_offline_voucher(user_id=1, campaign_id="c1", amount_dzd=5000)
        tree_1 = MerkleTree([v1.leaf_hash()])
        assert tree_1.root == v1.leaf_hash()

        # 2. Even leaf count (2 leaves)
        v2 = engine.create_offline_voucher(user_id=1, campaign_id="c2", amount_dzd=5000)
        tree_2 = MerkleTree([v1.leaf_hash(), v2.leaf_hash()])
        assert len(tree_2.root) == 64
        assert tree_2.root != v1.leaf_hash()

        # 3. Odd leaf count (3 leaves)
        v3 = engine.create_offline_voucher(user_id=1, campaign_id="c3", amount_dzd=5000)
        tree_3 = MerkleTree([v1.leaf_hash(), v2.leaf_hash(), v3.leaf_hash()])
        assert len(tree_3.root) == 64
        # Tree depth should be 3 levels (3 -> 2 -> 1)
        assert len(tree_3.levels) == 3

    def test_merkle_inclusion_proof_verification(self, engine):
        """Generates and verifies O(log N) Merkle inclusion proofs for all leaves."""
        vouchers = [
            engine.create_offline_voucher(user_id=20, campaign_id=f"camp-{i}", amount_dzd=5000)
            for i in range(1, 6)
        ]
        tree = engine.build_merkle_tree(vouchers)

        for v in vouchers:
            proof = engine.generate_merkle_proof(vouchers, v.voucher_id)
            assert proof.root_hash == tree.root
            assert proof.voucher_id == v.voucher_id

            # Cryptographically verify the inclusion proof
            is_valid = MerkleTree.verify_proof(proof.leaf_hash, proof.proof, proof.root_hash)
            assert is_valid is True

            # Altered leaf hash must fail verification
            tampered_leaf = "f" * 64
            assert MerkleTree.verify_proof(tampered_leaf, proof.proof, proof.root_hash) is False

    def test_replay_attack_prevention_nonce_and_duplicate_voucher(self, engine):
        """Replay attacks via duplicate nonces or settled voucher IDs must be rejected."""
        v1 = engine.create_offline_voucher(user_id=30, campaign_id="camp-1", amount_dzd=5000)
        v2 = engine.create_offline_voucher(user_id=30, campaign_id="camp-2", amount_dzd=5000)

        # First settlement
        res = engine.reconcile_offline_batch(user_id=30, vouchers=[v1, v2])
        assert res.status == "CONVERGED"
        assert res.accepted_count == 2
        assert res.rejected_count == 0

        # Attempt to replay the exact same vouchers
        res_replay = engine.reconcile_offline_batch(user_id=30, vouchers=[v1])
        assert res_replay.status == "REJECTED"
        assert res_replay.accepted_count == 0
        assert res_replay.rejected_count == 1
        assert "Duplicate voucher ID" in res_replay.errors[0]["reason"]

        # Attempt to use a replayed nonce on a new voucher ID
        priv, pub = engine.generate_keypair()
        replay_nonce_voucher = OfflineVoucher(
            voucher_id="vch-fake-replay",
            user_id=30,
            campaign_id="camp-3",
            amount_dzd=5000,
            nonce=1,  # Nonce 1 was already used
            timestamp=datetime.now(timezone.utc).isoformat(),
            wilaya=16,
            public_key=pub,
            signature="",
        )
        replay_nonce_voucher.signature = engine.sign_payload(priv, replay_nonce_voucher.canonical_bytes())

        res_nonce = engine.reconcile_offline_batch(user_id=30, vouchers=[replay_nonce_voucher])
        assert res_nonce.status == "REJECTED"
        assert "Replay attack detected: Nonce 1 already processed" in res_nonce.errors[0]["reason"]

    def test_batch_reconciliation_onto_double_entry_ledger(self, engine):
        """Reconciles valid offline vouchers directly onto double-entry ledger with zero-sum preservation."""
        user_id = 40
        # Issue 50,000 DZD starter grant
        engine.ledger.issue_starter_grant(user_id)
        assert engine.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH") == 50_000

        vouchers = [
            engine.create_offline_voucher(user_id=user_id, campaign_id="camp-oran", amount_dzd=10_000, wilaya=31),
            engine.create_offline_voucher(user_id=user_id, campaign_id="camp-setif", amount_dzd=15_000, wilaya=19),
        ]
        tree = engine.build_merkle_tree(vouchers)

        res = engine.reconcile_offline_batch(
            user_id=user_id,
            vouchers=vouchers,
            claimed_merkle_root=tree.root,
        )
        assert res.status == "CONVERGED"
        assert res.total_vouchers == 2
        assert res.accepted_count == 2
        assert res.reconciled_amount_dzd == 25_000

        # Verify ledger balances
        rem_balance = engine.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")
        assert rem_balance == 25_000  # 50k - 25k

        oran_escrow = engine.ledger.get_account_balance("CAMPAIGN:camp-oran:ESCROW_HOLDING")
        assert oran_escrow == 10_000

        setif_escrow = engine.ledger.get_account_balance("CAMPAIGN:camp-setif:ESCROW_HOLDING")
        assert setif_escrow == 15_000

        # Verify SHA-256 state chain integrity
        audit = engine.ledger.verify_state_chain()
        assert audit["isValid"] is True

    def test_insufficient_balance_overdraft_prevention_offline(self, engine):
        """Offline vouchers exceeding user virtual cash balance must be rejected."""
        user_id = 50
        engine.ledger.issue_starter_grant(user_id)  # 50,000 DZD

        # Create vouchers totaling 60,000 DZD (overdraft by 10k)
        v1 = engine.create_offline_voucher(user_id=user_id, campaign_id="camp-1", amount_dzd=30_000)
        v2 = engine.create_offline_voucher(user_id=user_id, campaign_id="camp-2", amount_dzd=30_000)

        res = engine.reconcile_offline_batch(user_id=user_id, vouchers=[v1, v2])
        # v1 accepted (30k <= 50k), v2 rejected (30k > remaining 20k)
        assert res.status == "PARTIALLY_CONVERGED"
        assert res.accepted_count == 1
        assert res.rejected_count == 1
        assert "Insufficient virtual cash balance" in res.errors[0]["reason"]
        assert engine.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH") == 20_000


# =============================================================================
# 2. UNIT TESTS: VIRAL GROWTH & BRAG ENGINE
# =============================================================================

class TestViralGrowthEngine:
    """Verifies visual brag cards, K=1.48 growth model, VIP 48h access, and Wilaya milestones."""

    @pytest.fixture
    def engine(self):
        eng = ViralGrowthEngine()
        return eng

    def test_brag_card_generation_aspect_ratios_and_localization(self, engine):
        """Generates 1.91:1 and 9:16 cards with Darija, Arabic, French, and English share copy."""
        # 1. Landscape 1.91:1 for LinkedIn/Twitter
        card_191 = engine.generate_brag_card(
            user_id=101,
            user_name="Karim Benali",
            card_type="FOUNDING_BACKER",
            aspect_ratio="1.91:1",
            startup_name="SolarTech Oran",
            wilaya_code=31,
            amount_dzd=15_000,
        )
        assert card_191.dimensions["width"] == 1200
        assert card_191.dimensions["height"] == 628
        assert "SolarTech Oran" in card_191.headline
        assert "31" in str(card_191.wilaya_code) or card_191.wilaya_name == "Oran"

        # Check multilingual vernacular copy
        texts = card_191.share_texts
        assert "🇩🇿" in texts["darija"]
        assert "فكرة واعرة" in texts["darija"]
        assert "مساهم" in texts["arabic"]
        assert "investisseur" in texts["french"]
        assert "TamWheel" in texts["english"]
        assert "https://tamwheel.dz/ref/TAM-101-" in card_191.deep_link_url

        # 2. Vertical 9:16 for Instagram/WhatsApp Status
        card_916 = engine.generate_brag_card(
            user_id=101,
            user_name="Karim Benali",
            card_type="INVESTMENT_THESIS",
            aspect_ratio="9:16",
            startup_name="GreenFarm AI",
            user_tier="ANALYST",
        )
        assert card_916.dimensions["width"] == 1080
        assert card_916.dimensions["height"] == 1920
        assert "GreenFarm AI" in card_916.headline
        assert "ANALYST" in card_916.subheadline

    def test_k_factor_148_mathematical_model(self, engine):
        """Validates K = 1.48 components: 0.42 + 0.58 + 0.36 + 0.12 = 1.48."""
        assert K_THESIS == 0.42
        assert K_SQUAD == 0.58
        assert K_FANTASY == 0.36
        assert K_WILAYA == 0.12
        assert K_TOTAL == 1.48

        model = engine.calculate_k_factor_model(initial_users=1000, cycles=3)
        assert model.k_total == 1.48
        assert model.is_exponential_growth is True
        assert len(model.projections) == 4  # Cycle 0, 1, 2, 3

        # Cycle 0: 1000 users
        assert model.projections[0]["cumulativeUsers"] == 1000
        # Cycle 1: 1000 + (1000 * 1.48) = 1000 + 1480 = 2480 users
        assert model.projections[1]["newUsers"] == 1480
        assert model.projections[1]["cumulativeUsers"] == 2480
        # Compounding expands monotonically
        assert model.projections[3]["cumulativeUsers"] > model.projections[2]["cumulativeUsers"]

    def test_vip_48_hour_early_access_allocation_window(self, engine):
        """Referring 3 verified analysts unlocks priority 48-hour allocation window."""
        user_id = 202

        # 0 referrals: Locked
        st0 = engine.get_vip_status(user_id)
        assert st0.is_vip_unlocked is False
        assert st0.total_referrals == 0

        # Self-referral rejected
        with pytest.raises(HTTPException) as exc:
            engine.record_referral(referrer_id=user_id, referee_id=user_id)
        assert exc.value.status_code == 400

        # Refer 1 and 2: Still locked
        engine.record_referral(referrer_id=user_id, referee_id=301, is_verified=True)
        engine.record_referral(referrer_id=user_id, referee_id=302, is_verified=True)
        st2 = engine.get_vip_status(user_id)
        assert st2.is_vip_unlocked is False
        assert st2.verified_analysts_count == 2

        # Refer 3rd analyst: UNLOCKED!
        res3 = engine.record_referral(referrer_id=user_id, referee_id=303, is_verified=True)
        assert res3["isVipUnlocked"] is True
        st3 = engine.get_vip_status(user_id)
        assert st3.is_vip_unlocked is True
        assert st3.early_access_hours == VIP_EARLY_ACCESS_HOURS

        # Test early access window timing
        launch_time = datetime.now(timezone.utc) + timedelta(hours=36)  # 36 hours before launch
        launch_iso = launch_time.isoformat()

        # VIP user can access 36h before launch
        assert engine.can_access_campaign_early(user_id=user_id, campaign_launch_at_iso=launch_iso) is True

        # Non-VIP user cannot access 36h before launch
        non_vip_id = 999
        assert engine.can_access_campaign_early(user_id=non_vip_id, campaign_launch_at_iso=launch_iso) is False

    def test_wilaya_collective_milestone_grant_triggers(self, engine):
        """When backer threshold is achieved in a Wilaya, grant is automatically unlocked."""
        # Create milestone: 5 backers from Batna (Wilaya 5) unlocks 250k DZD grant
        milestone = engine.create_wilaya_milestone(
            startup_id="startup-batna-iot",
            startup_name="Batna Agro IoT",
            wilaya_code=5,
            target_backers_count=5,
            grant_amount_dzd=250_000,
            sponsor_name="Aures Capital Angels",
        )
        assert milestone.status == "ACTIVE"
        assert milestone.progress_pct == 0.0

        # Backers 1 to 4 contribute
        for uid in [501, 502, 503, 504]:
            res = engine.record_wilaya_backing(milestone.milestone_id, user_id=uid)
            assert res["status"] == "ACTIVE"
            assert res["justUnlocked"] is False

        # 5th backer reaches threshold: GRANT UNLOCK TRIGGERED!
        res_5 = engine.record_wilaya_backing(milestone.milestone_id, user_id=505)
        assert res_5["status"] == "UNLOCKED"
        assert res_5["justUnlocked"] is True
        assert res_5["progressPct"] == 100.0
        assert res_5["unlockedAt"] is not None

        # Verify listing reflects unlocked state
        milestones = engine.list_wilaya_milestones(wilaya_code=5)
        unlocked_m = next(m for m in milestones if m.milestone_id == milestone.milestone_id)
        assert unlocked_m.status == "UNLOCKED"
        assert unlocked_m.current_backers_count == 5


# =============================================================================
# 3. FASTAPI HTTP ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestOfflineAndViralFastApiEndpoints:
    """Verifies all new FastAPI endpoints under /api/v1/offline and /api/v1/viral."""

    @pytest.fixture
    def client(self):
        transport = ASGITransport(app=app)
        c = AsyncClient(transport=transport, base_url="http://test")
        csrf_val = "test_csrf_token_value_32_chars_123"
        c.cookies.set("csrf_token", csrf_val)
        c.headers.update({"x-csrf-token": csrf_val})
        return c

    @pytest.fixture
    def mock_user(self):
        return MagicMock(
            id=88,
            fullName="Lina Haddad",
            email="lina@tamwheel.dz",
            role="STUDENT",
            analystTier="SCOUT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_offline_endpoints_flow(self, client, mock_user):
        """Tests /voucher, /merkle-root, /merkle-proof, /reconcile, and /status."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. POST /api/v1/offline/voucher
            v_resp1 = await client.post(
                "/api/v1/offline/voucher",
                json={"campaignId": "camp-tindouf", "amountDzd": 5000, "wilaya": 37},
            )
            assert v_resp1.status_code == 200
            v1_data = v_resp1.json()
            assert v1_data["userId"] == 88
            assert v1_data["amountDzd"] == 5000
            assert v1_data["wilaya"] == 37

            v_resp2 = await client.post(
                "/api/v1/offline/voucher",
                json={"campaignId": "camp-adrar", "amountDzd": 5000, "wilaya": 1},
            )
            assert v_resp2.status_code == 200
            v2_data = v_resp2.json()

            # 2. POST /api/v1/offline/merkle-root
            root_resp = await client.post(
                "/api/v1/offline/merkle-root",
                json={"vouchers": [v1_data, v2_data]},
            )
            assert root_resp.status_code == 200
            root_data = root_resp.json()
            assert "merkleRoot" in root_data
            assert root_data["leafCount"] == 2

            # 3. POST /api/v1/offline/merkle-proof
            proof_resp = await client.post(
                "/api/v1/offline/merkle-proof",
                json={"vouchers": [v1_data, v2_data], "targetVoucherId": v1_data["voucherId"]},
            )
            assert proof_resp.status_code == 200
            proof_data = proof_resp.json()
            assert proof_data["voucherId"] == v1_data["voucherId"]
            assert len(proof_data["proof"]) >= 1

            # 4. POST /api/v1/offline/reconcile
            rec_resp = await client.post(
                "/api/v1/offline/reconcile",
                json={"vouchers": [v1_data, v2_data], "claimedMerkleRoot": root_data["merkleRoot"]},
            )
            assert rec_resp.status_code == 200
            rec_data = rec_resp.json()
            assert rec_data["status"] == "CONVERGED"
            assert rec_data["acceptedCount"] == 2
            assert rec_data["reconciledAmountDzd"] == 10000

            # 5. GET /api/v1/offline/status
            st_resp = await client.get("/api/v1/offline/status")
            assert st_resp.status_code == 200
            st_data = st_resp.json()
            assert st_data["userId"] == 88
            assert st_data["settledVouchersCount"] >= 2
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_viral_endpoints_flow(self, client, mock_user):
        """Tests /brag-card, /k-factor, /vip-status, /referral, /milestones, /milestones/contribute."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. GET /api/v1/viral/brag-card (Landscape 1.91:1)
            card_resp = await client.get(
                "/api/v1/viral/brag-card?cardType=FOUNDING_BACKER&aspectRatio=1.91:1&startupName=GreenFarm"
            )
            assert card_resp.status_code == 200
            card_data = card_resp.json()
            assert card_data["cardType"] == "FOUNDING_BACKER"
            assert card_data["dimensions"]["width"] == 1200
            assert "darija" in card_data["shareTexts"]
            assert "TAM-88-" in card_data["deepLinkUrl"]

            # 2. GET /api/v1/viral/k-factor
            k_resp = await client.get("/api/v1/viral/k-factor?initialUsers=500&cycles=4")
            assert k_resp.status_code == 200
            k_data = k_resp.json()
            assert k_data["kTotal"] == 1.48
            assert k_data["isExponentialGrowth"] is True
            assert len(k_data["projections"]) == 5

            # 3. GET /api/v1/viral/vip-status
            vip_resp = await client.get("/api/v1/viral/vip-status")
            assert vip_resp.status_code == 200
            vip_data = vip_resp.json()
            assert vip_data["userId"] == 88
            assert vip_data["earlyAccessHours"] == 48

            # 4. POST /api/v1/viral/referral
            ref_resp = await client.post(
                "/api/v1/viral/referral",
                json={"refereeId": 991, "isVerified": True},
            )
            assert ref_resp.status_code == 200
            ref_data = ref_resp.json()
            assert ref_data["success"] is True

            # 5. GET /api/v1/viral/milestones
            m_resp = await client.get("/api/v1/viral/milestones")
            assert m_resp.status_code == 200
            m_list = m_resp.json()
            assert len(m_list) >= 1
            sample_m_id = m_list[0]["milestoneId"]

            # 6. POST /api/v1/viral/milestones/contribute
            contrib_resp = await client.post(
                "/api/v1/viral/milestones/contribute",
                json={"milestoneId": sample_m_id},
            )
            assert contrib_resp.status_code == 200
            contrib_data = contrib_resp.json()
            assert contrib_data["success"] is True
            assert contrib_data["milestoneId"] == sample_m_id

            # 7. POST /api/v1/viral/milestones (Create new challenge)
            create_m_resp = await client.post(
                "/api/v1/viral/milestones",
                json={
                    "startupId": "startup-new-biskra",
                    "startupName": "Biskra Date Palms Tech",
                    "wilayaCode": 7,
                    "targetBackersCount": 30,
                    "grantAmountDzd": 400000,
                    "sponsorName": "Ziban Innovation Syndicate",
                },
            )
            assert create_m_resp.status_code == 200
            create_m_data = create_m_resp.json()
            assert create_m_data["wilayaCode"] == 7
            assert create_m_data["targetBackersCount"] == 30
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)
