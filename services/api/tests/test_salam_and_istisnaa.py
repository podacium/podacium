"""
TamWheel Sovereign Ethical Agentic Venture OS — AAOIFI Standard No. 9 Salam & Standard No. 10 Istisna'a Test Suite.
Verifies:
1. Salam Engine (AAOIFI Shariah Standard No. 9):
   - Stage 1: Full immediate advance capital disbursement (Ra's Mal al-Salam).
   - Stage 2: Fungible commodity specifications in Dhimmah (Biskra dates, Mitidja citrus, Sétif grain).
   - Stage 3: Warehouse delivery receipt, laboratory grading, superior quality acceptance without surcharge,
             inferior quality discount (Muqassah), and rejection.
   - Stage 4: Independent Parallel Salam (Salam Muwazi) and Wikalah agency sale without cross-tying.
   - Non-interest Sharia delay remedies: insolvency respite vs. charity penalty for procrastination (Tathir).
2. Istisna'a Engine (AAOIFI Shariah Standard No. 10):
   - Manufacturing contract creation for clean-tech/hardware assets (Solar PV arrays, EV chargers).
   - Work-in-Progress (WIP) certification by accredited engineer before disbursement.
   - Provisional acceptance & warranty retention fund (Kafalat al-Siyanah).
   - Defect claim handling (repaired by manufacturer vs. deducted from retention).
   - Permissible liquidated damages (Shart Jaza'i) limited to verified direct loss.
   - Final Acceptance Certificate and retention fund release.
3. FastAPI Endpoints integration under `/api/v1/sharia/salam` and `/api/v1/sharia/istisnaa`.
"""

from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.salam_engine import (
    salam_engine,
    SalamContractRequest,
    SalamInspectionRequest,
    ParallelSalamRequest,
    WikalahLiquidationRequest,
    SalamDelayRemedyRequest,
    SalamCommodityType,
    QualityGrade,
    SalamStage,
    InspectionOutcome,
    LiquidationMethod,
)
from app.services.istisnaa_engine import (
    istisnaa_engine,
    IstisnaaContractRequest,
    IstisnaaMilestoneSpec,
    WIPCertificationRequest,
    DisburseMilestoneRequest,
    ProvisionalAcceptanceRequest,
    DefectReportRequest,
    ResolveDefectRequest,
    FinalAcceptanceRequest,
    LiquidatedDamagesRequest,
    IstisnaaAssetCategory,
    IstisnaaStage,
    MilestoneStatus,
    DefectSeverity,
    DefectStatus,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. UNIT TESTS: AAOIFI STANDARD NO. 9 SALAM ENGINE
# =============================================================================

class TestSalamEngine:
    def test_salam_contract_creation_and_advance_capital(self):
        """Validates Stage 1 & 2: Full advance disbursement (Ra's Mal al-Salam) and goods specifications."""
        engine = salam_engine
        delivery_dt = datetime.now(timezone.utc) + timedelta(days=90)

        req = SalamContractRequest(
            producer_id="coop-biskra-tolga",
            producer_name="Coopérative Phoenicicole de Tolga",
            commodity_type=SalamCommodityType.BISKRA_DEGLET_NOUR_DATES,
            commodity_description="Deglet Nour Dates, branched, moisture <18%, caliber >40mm",
            quantity_metric_tons=25.0,
            unit_price_per_ton_dzd=320_000.0,
            expected_quality_grade=QualityGrade.GRADE_1,
            max_moisture_pct=18.0,
            delivery_date=delivery_dt,
            warehouse_depot_name="Entrepôt Frigorifique Régional Biskra - Depot #3",
            warehouse_depot_wilaya="Biskra",
            advance_payment_reference="BEA-TRANSFER-ADV-2026-9901",
        )

        facility = engine.create_salam_contract(req)
        assert facility.stage == SalamStage.COMMODITY_SPECIFIED
        # Advance capital = 25 tons * 320,000 DZD = 8,000,000 DZD
        assert facility.advance_capital_dzd == 8_000_000.0
        assert facility.quantity_metric_tons == 25.0
        assert len(facility.cryptographic_seal) == 64

    def test_salam_delivery_inspection_conformant_and_superior(self):
        """Validates Stage 3: Laboratory inspection. Superior quality accepted with no surcharge."""
        engine = salam_engine
        delivery_dt = datetime.now(timezone.utc) + timedelta(days=60)

        req = SalamContractRequest(
            producer_id="coop-mitidja-citrus",
            producer_name="Coopérative Agrumes Mitidja - Boufarik",
            commodity_type=SalamCommodityType.MITIDJA_CITRUS_ORANGES,
            commodity_description="Thomson Navel Oranges, caliber 70-80mm",
            quantity_metric_tons=40.0,
            unit_price_per_ton_dzd=150_000.0,
            expected_quality_grade=QualityGrade.GRADE_1,
            max_moisture_pct=15.0,
            delivery_date=delivery_dt,
            warehouse_depot_name="Silo et Conditionnement Boufarik",
            warehouse_depot_wilaya="Blida",
            advance_payment_reference="BDL-TRANSFER-ADV-8831",
        )
        facility = engine.create_salam_contract(req)

        # 1. Deliver superior quality (EXTRA_PREMIUM) -> Must be accepted with 0% surcharge
        insp_req = SalamInspectionRequest(
            delivery_note_ref="BL-MITIDJA-2026-044",
            actual_delivered_metric_tons=40.0,
            inspected_grade=QualityGrade.EXTRA_PREMIUM,
            inspected_moisture_pct=12.5,
            inspector_credentials="CACQE - Centre Algérien du Contrôle de la Qualité #9921",
            inspection_notes="Superior sugar content and blemish-free skin.",
        )
        facility = engine.inspect_delivery(facility.contract_id, insp_req)
        assert facility.stage == SalamStage.DELIVERED_ACCEPTED
        assert facility.inspection.outcome == InspectionOutcome.SUPERIOR
        assert facility.inspection.price_adjustment_pct == 0.0

    def test_salam_delivery_inspection_inferior_with_sharia_discount(self):
        """Validates Stage 3: Inferior quality accepted with Sharia price adjustment (Muqassah)."""
        engine = salam_engine
        delivery_dt = datetime.now(timezone.utc) + timedelta(days=120)

        req = SalamContractRequest(
            producer_id="coop-setif-cereal",
            producer_name="Coopérative Céréalière des Hauts-Plateaux Sétif",
            commodity_type=SalamCommodityType.SETIF_DURUM_WHEAT,
            commodity_description="High-Protein Durum Wheat, protein >13.5%",
            quantity_metric_tons=100.0,
            unit_price_per_ton_dzd=45_000.0,
            expected_quality_grade=QualityGrade.EXTRA_PREMIUM,
            max_moisture_pct=13.0,
            delivery_date=delivery_dt,
            warehouse_depot_name="Silo Céréalier OAIC Sétif - Silo #1",
            warehouse_depot_wilaya="Sétif",
            advance_payment_reference="CPA-TRANSFER-ADV-4412",
        )
        facility = engine.create_salam_contract(req)

        # Delivered Grade 2 (inferior) -> Accepted with 10% discount
        insp_req = SalamInspectionRequest(
            delivery_note_ref="BL-SETIF-2026-881",
            actual_delivered_metric_tons=100.0,
            inspected_grade=QualityGrade.GRADE_2,
            inspected_moisture_pct=12.8,
            inspector_credentials="OAIC Regional Laboratory Inspector #441",
            accept_inferior_with_discount=True,
            negotiated_discount_pct=10.0,
        )
        facility = engine.inspect_delivery(facility.contract_id, insp_req)
        assert facility.stage == SalamStage.DELIVERED_ADJUSTED
        assert facility.inspection.outcome == InspectionOutcome.INFERIOR_ACCEPTABLE
        assert facility.inspection.price_adjustment_pct == 10.0
        # Base = 100 * 45,000 = 4,500,000 DZD -> Adjusted by -10% = 4,050,000 DZD
        assert facility.inspection.adjusted_total_value_dzd == 4_050_000.0

    def test_salam_parallel_salam_and_wikalah_liquidation(self):
        """Validates Stage 4: Parallel Salam (Salam Muwazi) and Wikalah agency sale."""
        engine = salam_engine
        delivery_dt = datetime.now(timezone.utc) + timedelta(days=45)

        req = SalamContractRequest(
            producer_id="coop-biskra-02",
            producer_name="Biskra Oasis Agro Coop",
            commodity_type=SalamCommodityType.BISKRA_DEGLET_NOUR_DATES,
            commodity_description="Export Grade Dates",
            quantity_metric_tons=10.0,
            unit_price_per_ton_dzd=300_000.0,
            expected_quality_grade=QualityGrade.GRADE_1,
            max_moisture_pct=17.0,
            delivery_date=delivery_dt,
            warehouse_depot_name="Biskra Cold Depot #1",
            warehouse_depot_wilaya="Biskra",
            advance_payment_reference="BNA-ADV-90021",
        )
        facility = engine.create_salam_contract(req)

        # Parallel Salam execution: Sell 10 tons to Agrodiv at 340,000 DZD/ton
        parallel_req = ParallelSalamRequest(
            secondary_buyer_id="buyer-agrodiv-algeria",
            secondary_buyer_name="Groupe Agrodiv SPA",
            selling_price_per_ton_dzd=340_000.0,
            parallel_delivery_date=delivery_dt + timedelta(days=5),
            parallel_depot_name="Entrepôt Central Agrodiv Alger",
        )
        facility = engine.execute_parallel_salam(facility.contract_id, parallel_req)
        assert facility.stage == SalamStage.LIQUIDATED
        assert facility.liquidation.method == LiquidationMethod.PARALLEL_SALAM
        # Gross = 10 * 340,000 = 3,400,000 DZD. Advance was 3,000,000 DZD -> Profit = 400,000 DZD
        assert facility.liquidation.gross_proceeds_dzd == 3_400_000.0
        assert facility.liquidation.profit_or_gain_dzd == 400_000.0

    def test_salam_delay_remedies_respite_and_charity_penalty(self):
        """Validates non-interest Sharia delay remedies: insolvency extension vs. charity penalty."""
        engine = salam_engine
        delivery_dt = datetime.now(timezone.utc) + timedelta(days=30)

        req = SalamContractRequest(
            producer_id="coop-kabylie-olive",
            producer_name="Huilerie Traditionnelle Tizi Ouzou",
            commodity_type=SalamCommodityType.KABYLIE_EXTRA_VIRGIN_OLIVE_OIL,
            commodity_description="Extra virgin cold-pressed olive oil, acidity <0.8%",
            quantity_metric_tons=5.0,
            unit_price_per_ton_dzd=900_000.0,
            delivery_date=delivery_dt,
            warehouse_depot_name="Depot Huile Tizi Ouzou",
            warehouse_depot_wilaya="Tizi Ouzou",
            advance_payment_reference="AGB-ADV-88301",
        )
        facility = engine.create_salam_contract(req)

        # 1. Hardship (Mu'sir) -> Mandatory extension without penalty
        respite_req = SalamDelayRemedyRequest(
            is_genuine_insolvency=True,
            days_extension=45,
        )
        facility = engine.apply_delay_remedy(facility.contract_id, respite_req)
        assert facility.delivery_date > delivery_dt
        assert facility.charity_penalty_receipt is None

        # 2. Procrastination (Mumathil) -> 100% penalty to charity via Tathir
        penalty_req = SalamDelayRemedyRequest(
            is_genuine_insolvency=False,
            late_penalty_dzd=30_000.0,
            charity_id="CHARITY-WATER-SOLAR-005",
        )
        facility = engine.apply_delay_remedy(facility.contract_id, penalty_req)
        assert facility.charity_penalty_receipt is not None
        assert facility.charity_penalty_receipt.amount_dzd == 30_000.0
        assert facility.charity_penalty_receipt.status.value == "DISBURSED"


# =============================================================================
# 2. UNIT TESTS: AAOIFI STANDARD NO. 10 ISTISNA'A PROGRESS FINANCING ENGINE
# =============================================================================

class TestIstisnaaEngine:
    def test_istisnaa_lifecycle_wip_certification_and_retention(self):
        """Validates full Istisna'a lifecycle: WIP certification, provisional acceptance, defects, and final release."""
        engine = istisnaa_engine
        target_delivery = datetime.now(timezone.utc) + timedelta(days=180)

        # CONTRACT CREATION (Stage 1)
        req = IstisnaaContractRequest(
            startup_id="startup-adrar-cleantech",
            startup_name="Adrar Solar Innovations SPA",
            manufacturer_id="mfg-sonelgaz-equip",
            manufacturer_name="Entreprise Nationale des Équipements Solaires",
            asset_category=IstisnaaAssetCategory.SOLAR_PHOTOVOLTAIC_ARRAY,
            asset_description="100 kW Off-Grid Photovoltaic Pumping & Battery Storage System",
            total_contract_price_dzd=10_000_000.0,
            retention_rate_pct=10.0,  # 10% warranty retention (Kafalat al-Siyanah) = 1,000,000 DZD
            defect_liability_months=12,
            target_delivery_date=target_delivery,
            milestones=[
                IstisnaaMilestoneSpec(
                    milestone_index=1,
                    milestone_name="Procurement of Inverters & Monocrystalline PV Cells",
                    completion_target_pct=30.0,
                    tranche_amount_dzd=3_000_000.0,
                ),
                IstisnaaMilestoneSpec(
                    milestone_index=2,
                    milestone_name="Frame Fabrication, Wiring & Transformer Assembly",
                    completion_target_pct=70.0,
                    tranche_amount_dzd=4_000_000.0,
                ),
                IstisnaaMilestoneSpec(
                    milestone_index=3,
                    milestone_name="Site Commissioning, Inverter Testing & Grid Sync",
                    completion_target_pct=100.0,
                    tranche_amount_dzd=3_000_000.0,
                ),
            ],
        )
        facility = engine.create_istisnaa_contract(req)
        assert facility.stage == IstisnaaStage.CONTRACT_SIGNED
        assert facility.retention_amount_dzd == 1_000_000.0
        assert facility.retention_fund.remaining_retention_balance_dzd == 1_000_000.0
        assert len(facility.milestones) == 3

        # STAGE 2: WIP CERTIFICATION & DISBURSEMENT FOR MILESTONE 1
        # Cannot disburse before certification
        with pytest.raises(ValueError, match="must be CERTIFIED"):
            engine.disburse_milestone(
                facility.facility_id,
                DisburseMilestoneRequest(milestone_index=1, payment_reference="PAY-TR1-FAIL"),
            )

        cert_req1 = WIPCertificationRequest(
            milestone_index=1,
            engineer_name="Dr. Sofiane Meziani",
            engineer_license="OIA-ING-2018-994",
            measured_progress_pct=35.0,  # Above 30% target
            quality_standards_verified=True,
            lab_inspection_report_ref="LAB-INSPECTION-SOLAR-001",
        )
        facility = engine.certify_wip_milestone(facility.facility_id, cert_req1)
        assert facility.milestones[0].status == MilestoneStatus.CERTIFIED

        facility = engine.disburse_milestone(
            facility.facility_id,
            DisburseMilestoneRequest(milestone_index=1, payment_reference="BEA-DISBURSE-TR1-099"),
        )
        assert facility.milestones[0].status == MilestoneStatus.DISBURSED
        assert facility.total_disbursed_dzd == 3_000_000.0

        # Complete Milestones 2 and 3
        engine.certify_wip_milestone(
            facility.facility_id,
            WIPCertificationRequest(
                milestone_index=2,
                engineer_name="Dr. Sofiane Meziani",
                engineer_license="OIA-ING-2018-994",
                measured_progress_pct=75.0,
                quality_standards_verified=True,
                lab_inspection_report_ref="LAB-INSPECTION-SOLAR-002",
            ),
        )
        engine.disburse_milestone(
            facility.facility_id,
            DisburseMilestoneRequest(milestone_index=2, payment_reference="BEA-DISBURSE-TR2-100"),
        )

        engine.certify_wip_milestone(
            facility.facility_id,
            WIPCertificationRequest(
                milestone_index=3,
                engineer_name="Dr. Sofiane Meziani",
                engineer_license="OIA-ING-2018-994",
                measured_progress_pct=100.0,
                quality_standards_verified=True,
                lab_inspection_report_ref="LAB-INSPECTION-SOLAR-003",
            ),
        )
        engine.disburse_milestone(
            facility.facility_id,
            DisburseMilestoneRequest(milestone_index=3, payment_reference="BEA-DISBURSE-TR3-101"),
        )
        assert facility.total_disbursed_dzd == 10_000_000.0

        # STAGE 3: PROVISIONAL ACCEPTANCE
        prov_req = ProvisionalAcceptanceRequest(
            handover_protocol_ref="PV-COMMISSIONING-ADRAR-2026",
            acceptance_notes="System successfully powered on. Battery bank fully charged.",
        )
        facility = engine.grant_provisional_acceptance(facility.facility_id, prov_req)
        assert facility.stage == IstisnaaStage.DEFECT_LIABILITY_ACTIVE

        # DEFECT REPORTING & RESOLUTION (Deduction from retention)
        defect = engine.report_defect_claim(
            facility.facility_id,
            DefectReportRequest(
                defect_description="Inverter cooling fan bearing vibration anomaly",
                severity=DefectSeverity.MINOR,
                estimated_repair_cost_dzd=50_000.0,
            ),
        )
        assert defect.status == DefectStatus.REPORTED

        # Resolve via deduction from Kafalat al-Siyanah
        facility = engine.resolve_defect_claim(
            facility.facility_id,
            ResolveDefectRequest(
                defect_id=defect.defect_id,
                resolved_by_manufacturer=False,
                actual_deduction_dzd=50_000.0,
            ),
        )
        assert facility.retention_fund.total_deductions_applied_dzd == 50_000.0
        assert facility.retention_fund.remaining_retention_balance_dzd == 950_000.0

        # STAGE 4: FINAL ACCEPTANCE CERTIFICATE (Shahadat al-Qabul al-Niha'i)
        final_req = FinalAcceptanceRequest(
            client_signoff_confirmed=True,
            supervising_engineer_signoff="Dr. Sofiane Meziani, Senior Solar Auditor",
        )
        facility = engine.grant_final_acceptance(facility.facility_id, final_req)
        assert facility.stage == IstisnaaStage.FINAL_ACCEPTANCE
        assert facility.retention_fund.is_released is True
        assert facility.retention_fund.released_at is not None

    def test_istisnaa_liquidated_damages_permissible_sharia_loss(self):
        """Validates AAOIFI Standard 10 Clause 3/6 Shart Jaza'i: damages strictly tied to verified actual loss."""
        engine = istisnaa_engine
        target_delivery = datetime.now(timezone.utc) + timedelta(days=90)

        req = IstisnaaContractRequest(
            startup_id="startup-ev-charge",
            startup_name="VoltDZ Fast EV Infrastructure",
            manufacturer_id="mfg-algeria-hardware",
            manufacturer_name="Société Algérienne des Chargeurs Électriques",
            asset_category=IstisnaaAssetCategory.EV_CHARGING_INFRASTRUCTURE,
            asset_description="10x 150 kW DC Fast Charging Stations with CCS2 Dispensers",
            total_contract_price_dzd=15_000_000.0,
            target_delivery_date=target_delivery,
            milestones=[
                IstisnaaMilestoneSpec(
                    milestone_index=1,
                    milestone_name="Full Manufacturing & Factory Testing",
                    completion_target_pct=100.0,
                    tranche_amount_dzd=15_000_000.0,
                )
            ],
        )
        facility = engine.create_istisnaa_contract(req)

        # Unexcused delay: 20 days overdue, actual direct crane demurrage & storage losses = 150,000 DZD
        damages_req = LiquidatedDamagesRequest(
            days_overdue=20,
            verified_actual_direct_loss_dzd=150_000.0,
            delay_justification_evaluated=True,
        )
        facility = engine.apply_liquidated_damages(facility.facility_id, damages_req)
        assert facility.liquidated_damages_dzd == 150_000.0


# =============================================================================
# 3. HTTP ENDPOINT TESTS
# =============================================================================

class TestSalamAndIstisnaaEndpoints:
    def test_api_salam_lifecycle_endpoints(self, client):
        delivery_dt = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()

        # 1. Create Salam Contract (Stage 1 & 2)
        res = client.post(
            "/api/v1/sharia/salam/contracts",
            json={
                "producer_id": "coop-biskra-api-01",
                "producer_name": "Coopérative Phoenicicole Tolga",
                "commodity_type": "BISKRA_DEGLET_NOUR_DATES",
                "commodity_description": "Export Grade Deglet Nour Dates",
                "quantity_metric_tons": 20.0,
                "unit_price_per_ton_dzd": 300000.0,
                "expected_quality_grade": "GRADE_1",
                "max_moisture_pct": 18.0,
                "delivery_date": delivery_dt,
                "warehouse_depot_name": "Tolga Regional Cold Depot",
                "warehouse_depot_wilaya": "Biskra",
                "advance_payment_reference": "BEA-ADV-API-0012",
            },
        )
        assert res.status_code == 201, res.text
        contract_data = res.json()
        contract_id = contract_data["contract_id"]
        assert contract_data["advance_capital_dzd"] == 6_000_000.0
        assert contract_data["stage"] == "COMMODITY_SPECIFIED"

        # 2. Get Salam Contract Details
        res = client.get(f"/api/v1/sharia/salam/contracts/{contract_id}")
        assert res.status_code == 200
        assert res.json()["contract_id"] == contract_id

        # 3. Inspect Delivery (Stage 3)
        res = client.post(
            f"/api/v1/sharia/salam/contracts/{contract_id}/inspect",
            json={
                "delivery_note_ref": "BL-BISKRA-API-9901",
                "actual_delivered_metric_tons": 20.0,
                "inspected_grade": "GRADE_1",
                "inspected_moisture_pct": 16.5,
                "inspector_credentials": "CACQE-BISKRA-INSPECTOR-88",
            },
        )
        assert res.status_code == 200, res.text
        assert res.json()["stage"] == "DELIVERED_ACCEPTED"

        # 4. Liquidate via Parallel Salam (Stage 4)
        parallel_dt = (datetime.now(timezone.utc) + timedelta(days=95)).isoformat()
        res = client.post(
            f"/api/v1/sharia/salam/contracts/{contract_id}/parallel",
            json={
                "secondary_buyer_id": "buyer-agrodiv-api",
                "secondary_buyer_name": "Agrodiv Céréales & Dattes SPA",
                "selling_price_per_ton_dzd": 330000.0,
                "parallel_delivery_date": parallel_dt,
                "parallel_depot_name": "Agrodiv Alger Central Silo",
            },
        )
        assert res.status_code == 200, res.text
        assert res.json()["stage"] == "LIQUIDATED"
        assert res.json()["liquidation"]["profit_or_gain_dzd"] == 600_000.0

    def test_api_istisnaa_lifecycle_endpoints(self, client):
        target_delivery = (datetime.now(timezone.utc) + timedelta(days=120)).isoformat()

        # 1. Create Istisna'a Contract
        res = client.post(
            "/api/v1/sharia/istisnaa/contracts",
            json={
                "startup_id": "startup-solar-api",
                "startup_name": "Ouargla Solar Pumping SARL",
                "manufacturer_id": "mfg-ouargla-eng",
                "manufacturer_name": "Ouargla Precision Metal Fabrication",
                "asset_category": "SOLAR_PHOTOVOLTAIC_ARRAY",
                "asset_description": "Custom Dual-Axis Solar Tracking Framework for Irrigation",
                "total_contract_price_dzd": 5000000.0,
                "retention_rate_pct": 5.0,
                "defect_liability_months": 12,
                "target_delivery_date": target_delivery,
                "milestones": [
                    {
                        "milestone_index": 1,
                        "milestone_name": "Steel Framework Fabrication & Galvanization",
                        "completion_target_pct": 50.0,
                        "tranche_amount_dzd": 2500000.0,
                    },
                    {
                        "milestone_index": 2,
                        "milestone_name": "Linear Actuator Assembly & Controller Testing",
                        "completion_target_pct": 100.0,
                        "tranche_amount_dzd": 2500000.0,
                    },
                ],
            },
        )
        assert res.status_code == 201, res.text
        facility_data = res.json()
        facility_id = facility_data["facility_id"]
        assert facility_data["retention_amount_dzd"] == 250_000.0

        # 2. Certify WIP Milestone 1
        res = client.post(
            f"/api/v1/sharia/istisnaa/contracts/{facility_id}/wip/certify",
            json={
                "milestone_index": 1,
                "engineer_name": "Ing. Farid Benali",
                "engineer_license": "OIA-ALGERIA-7712",
                "measured_progress_pct": 55.0,
                "quality_standards_verified": True,
                "lab_inspection_report_ref": "LAB-GALVA-OUARGLA-01",
            },
        )
        assert res.status_code == 200, res.text
        assert res.json()["milestones"][0]["status"] == "CERTIFIED"

        # 3. Disburse Milestone 1
        res = client.post(
            f"/api/v1/sharia/istisnaa/contracts/{facility_id}/milestones/disburse",
            json={
                "milestone_index": 1,
                "payment_reference": "BNA-TR1-PAY-99120",
            },
        )
        assert res.status_code == 200, res.text
        assert res.json()["total_disbursed_dzd"] == 2_500_000.0
