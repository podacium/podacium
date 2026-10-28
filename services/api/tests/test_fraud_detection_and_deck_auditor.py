"""
TamWheel Sovereign Ethical Agentic Venture OS — Forensic Fraud Detection & Pitch Deck Auditor Test Suite.
Tests:
1. Forensic Accounting G50 Tax Return Discrepancies (Turnover vs Declared Revenue & Zero TVA)
2. CNAS Social Security Slips Headcount & Wage Bill Discrepancies (34.5% Contribution Rule)
3. Directed Graph Circular Transaction Detection (Round-tripping cycles A -> B -> C -> A)
4. Phantom Supplier Identification (High-volume invoicing without valid Algerian NIF)
5. Monthly Bank Statement Mathematical Continuity & Runway Reconciliation
6. TAM/SAM/SOM Inflation Detection calibrated against official Algerian ONS Economic Ceilings
7. Moat Plausibility Rating (Structural INAPI/Decree 20-254 Moat vs Buzzword Illusion)
8. Claim Provenance Index (Verifiable Primary Sources vs Unsubstantiated Hype)
9. FastAPI REST Endpoints (/forensics/fraud/audit, /circular-check, /reconcile-cash, /deck-audit/analyze, /tam-check)
"""

from datetime import datetime, timezone
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.forensic_fraud_detector import (
    ForensicFraudDetector,
    forensic_fraud_detector,
    ALGERIAN_CNAS_STANDARD_RATE,
)
from app.services.deck_audit_service import (
    PitchDeckAuditor,
    deck_auditor,
    ALGERIA_NATIONAL_GDP_USD,
    ONS_SECTOR_TAM_BENCHMARKS_USD,
)
from app.schemas.forensic_fraud import (
    FraudRiskLevel,
    RedFlagSeverity,
    RedFlagCategory,
    G50TaxDeclaration,
    CNASDeclaration,
    TransactionEdge,
    BankStatementMonth,
    ClaimedFinancials,
    ForensicAuditRequest,
    CircularCheckRequest,
    CashReconciliationRequest,
)
from app.schemas.deck_audit import (
    SlideArchetype,
    MarketInflationStatus,
    MoatDefensibilityTier,
    EvidenceStatus,
    DeckClaim,
    DeckSlide,
    DeckAuditRequest,
    TAMCheckRequest,
)


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def client_csrf():
    csrf_token = "test_csrf_token_value_32_chars_123"
    cookies = {"csrf_token": csrf_token}
    headers = {"x-csrf-token": csrf_token}
    return cookies, headers


@pytest.fixture
async def api_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# =============================================================================
# 1. FORENSIC FRAUD DETECTOR UNIT TESTS
# =============================================================================

class TestForensicFraudDetector:
    """Unit tests for corporate accounting forensic anomaly engine."""

    def test_g50_tax_discrepancy_massive_gap(self):
        """Test detection of severe discrepancy between pitch deck revenue and G50 tax returns."""
        claimed = ClaimedFinancials(
            annualDeclaredRevenueDzd=50_000_000.0,
            claimedMonthlyPayrollDzd=1_500_000.0,
            claimedHeadcount=10,
            claimedMonthlyBurnDzd=1_800_000.0,
            claimedRunwayMonths=12.0,
        )
        # G50 shows only 6M DZD annualized turnover
        g50s = [
            G50TaxDeclaration(period=f"2026-{m:02d}", turnoverReportedDzd=500_000.0, tvaCollectedDzd=95_000.0)
            for m in range(1, 13)
        ]

        score, flags, discrepancy = forensic_fraud_detector.check_tax_discrepancies(claimed, g50s)

        assert score >= 80.0
        assert discrepancy == 44_000_000.0
        critical_flags = [f for f in flags if f.code == "FLG_TAX_MASSIVE_GAP"]
        assert len(critical_flags) == 1
        assert critical_flags[0].severity == RedFlagSeverity.CRITICAL

    def test_g50_missing_filings_when_high_revenue_claimed(self):
        """Test severe red flag when founder claims large revenue but has 0 G50 tax filings."""
        claimed = ClaimedFinancials(
            annualDeclaredRevenueDzd=25_000_000.0,
            claimedMonthlyPayrollDzd=800_000.0,
            claimedHeadcount=6,
            claimedMonthlyBurnDzd=1_000_000.0,
            claimedRunwayMonths=8.0,
        )
        score, flags, discrepancy = forensic_fraud_detector.check_tax_discrepancies(claimed, [])

        assert score == 85.0
        assert any(f.code == "FLG_TAX_NO_G50_FILINGS" for f in flags)

    def test_g50_zero_tva_irregularity(self):
        """Test positive turnover with zero TVA remitted without verified startup label exemption."""
        claimed = ClaimedFinancials(
            annualDeclaredRevenueDzd=12_000_000.0,
            claimedMonthlyPayrollDzd=600_000.0,
            claimedHeadcount=5,
            claimedMonthlyBurnDzd=700_000.0,
            claimedRunwayMonths=10.0,
        )
        g50s = [
            G50TaxDeclaration(period="2026-01", turnoverReportedDzd=1_000_000.0, tvaCollectedDzd=0.0)
        ]
        score, flags, _ = forensic_fraud_detector.check_tax_discrepancies(claimed, g50s)
        assert any(f.code == "FLG_TAX_ZERO_TVA_IRREGULARITY" for f in flags)

    def test_cnas_headcount_undeclared_labor(self):
        """Test undeclared labor detection where claimed team is >2x larger than CNAS declared workers."""
        claimed = ClaimedFinancials(
            annualDeclaredRevenueDzd=10_000_000.0,
            claimedMonthlyPayrollDzd=2_000_000.0,
            claimedHeadcount=25,
            claimedMonthlyBurnDzd=2_500_000.0,
            claimedRunwayMonths=6.0,
        )
        cnas_slips = [
            CNASDeclaration(
                period="2026-Q1",
                activeEmployeesCount=4,
                declaredGrossSalaryDzd=400_000.0,
                contributionsPaidDzd=138_000.0,
            )
        ]

        score, flags, discrepancy = forensic_fraud_detector.check_payroll_cnas_discrepancies(claimed, cnas_slips)

        assert score >= 70.0
        assert any(f.code == "FLG_PAYROLL_UNDECLARED_LABOR" for f in flags)
        assert any(f.code == "FLG_PAYROLL_WAGE_DIVERGENCE" for f in flags)

    def test_cnas_phantom_team_zero_declared(self):
        """Test critical flag when founder claims employees but CNAS records show 0 insured workers."""
        claimed = ClaimedFinancials(
            annualDeclaredRevenueDzd=5_000_000.0,
            claimedMonthlyPayrollDzd=500_000.0,
            claimedHeadcount=8,
            claimedMonthlyBurnDzd=600_000.0,
            claimedRunwayMonths=9.0,
        )
        cnas_slips = [
            CNASDeclaration(
                period="2026-Q1",
                activeEmployeesCount=0,
                declaredGrossSalaryDzd=0.0,
                contributionsPaidDzd=0.0,
            )
        ]
        score, flags, _ = forensic_fraud_detector.check_payroll_cnas_discrepancies(claimed, cnas_slips)
        assert any(f.code == "FLG_PAYROLL_GHOST_TEAM" for f in flags)

    def test_circular_transactions_round_tripping_detection(self):
        """Test directed cycle detection (A -> B -> C -> A) and round-tripping volume accumulation."""
        transactions = [
            TransactionEdge(
                transactionId="tx-1",
                sourceEntity="StartupAlpha",
                targetEntity="VendorBeta",
                amountDzd=5_000_000.0,
                invoiceDate="2026-02-01",
                isRelatedParty=True,
            ),
            TransactionEdge(
                transactionId="tx-2",
                sourceEntity="VendorBeta",
                targetEntity="ConsultingGamma",
                amountDzd=4_800_000.0,
                invoiceDate="2026-02-05",
                isRelatedParty=True,
            ),
            TransactionEdge(
                transactionId="tx-3",
                sourceEntity="ConsultingGamma",
                targetEntity="StartupAlpha",
                amountDzd=4_700_000.0,
                invoiceDate="2026-02-10",
                isRelatedParty=True,
            ),
        ]

        score, loops, phantoms, flags = forensic_fraud_detector.detect_circular_transactions(
            transactions=transactions,
            target_entity="StartupAlpha",
        )

        assert len(loops) >= 1
        assert loops[0].cycleLength == 3
        assert loops[0].totalCycleVolumeDzd == 14_500_000.0
        assert score >= 70.0
        assert any(f.code == "FLG_CIRCULAR_ROUND_TRIPPING" for f in flags)

    def test_phantom_supplier_missing_nif(self):
        """Test identification of high-volume supplier without valid Algerian NIF."""
        transactions = [
            TransactionEdge(
                transactionId="tx-10",
                sourceEntity="StartupAlpha",
                targetEntity="GhostVendorSARL",
                amountDzd=2_500_000.0,
                invoiceDate="2026-01-15",
                sourceNif="002116001234567",
                targetNif="",  # Missing NIF
            )
        ]

        score, loops, phantoms, flags = forensic_fraud_detector.detect_circular_transactions(
            transactions=transactions,
            target_entity="StartupAlpha",
        )

        assert len(phantoms) == 1
        assert phantoms[0]["entity"] == "GhostVendorSARL"
        assert any(f.code == "FLG_PHANTOM_SUPPLIER_SUSPECT" for f in flags)

    def test_cash_burn_ledger_math_tampering_and_runway_gap(self):
        """Test bank statement reconciliation detecting math tampering and severe runway exaggeration."""
        # Statement 1 has math discrepancy: opening 10M + deposits 1M - withdrawals 3M = 8M, but closing is 15M!
        statements = [
            BankStatementMonth(
                period="2026-01",
                openingBalanceDzd=10_000_000.0,
                totalDepositsDzd=1_000_000.0,
                totalWithdrawalsDzd=3_000_000.0,
                closingBalanceDzd=15_000_000.0,  # +7M fabricated
            ),
            BankStatementMonth(
                period="2026-02",
                openingBalanceDzd=15_000_000.0,
                totalDepositsDzd=500_000.0,
                totalWithdrawalsDzd=4_500_000.0,
                closingBalanceDzd=11_000_000.0,
            ),
        ]

        score, flags, actual_burn, actual_runway, runway_delta = forensic_fraud_detector.reconcile_cash_burn(
            statements=statements,
            claimed_burn=500_000.0,
            claimed_runway=24.0,  # Claims 24 months runway
        )

        assert score >= 70.0
        assert any(f.code.startswith("FLG_BANK_MATH_DISCREPANCY") for f in flags)
        assert any(f.code == "FLG_RUNWAY_EXAGGERATION_CRITICAL" for f in flags)
        assert runway_delta > 10.0

    def test_composite_forensic_audit_clean_vs_fraudulent(self):
        """Test full audit flow differentiating clean compliant startup vs fraudulent entity."""
        # 1. Clean Startup
        clean_req = ForensicAuditRequest(
            startupId="st-clean",
            companyName="CleanTech SPA",
            claimedFinancials=ClaimedFinancials(
                annualDeclaredRevenueDzd=12_000_000.0,
                claimedMonthlyPayrollDzd=600_000.0,
                claimedHeadcount=5,
                claimedMonthlyBurnDzd=700_000.0,
                claimedRunwayMonths=10.0,
            ),
            g50Declarations=[
                G50TaxDeclaration(period=f"2026-{m:02d}", turnoverReportedDzd=1_000_000.0, tvaCollectedDzd=190_000.0)
                for m in range(1, 13)
            ],
            cnasDeclarations=[
                CNASDeclaration(
                    period="2026-Q1",
                    activeEmployeesCount=5,
                    declaredGrossSalaryDzd=600_000.0,
                    contributionsPaidDzd=207_000.0,
                )
            ],
            transactions=[],
            bankStatements=[
                BankStatementMonth(
                    period="2026-01",
                    openingBalanceDzd=7_700_000.0,
                    totalDepositsDzd=1_000_000.0,
                    totalWithdrawalsDzd=1_700_000.0,
                    closingBalanceDzd=7_000_000.0,
                )
            ],
        )

        clean_resp = forensic_fraud_detector.audit_startup(clean_req)
        assert clean_resp.scoreBreakdown.riskLevel == FraudRiskLevel.LOW_RISK
        assert clean_resp.scoreBreakdown.overallFraudScore < 25.0

        # 2. Fraudulent Startup (fabricated revenue, ghost workers, circular round-tripping)
        fraud_req = ForensicAuditRequest(
            startupId="st-fraud",
            companyName="ScamVenture SARL",
            claimedFinancials=ClaimedFinancials(
                annualDeclaredRevenueDzd=80_000_000.0,
                claimedMonthlyPayrollDzd=3_000_000.0,
                claimedHeadcount=30,
                claimedMonthlyBurnDzd=3_500_000.0,
                claimedRunwayMonths=18.0,
            ),
            g50Declarations=[],  # No G50s
            cnasDeclarations=[
                CNASDeclaration(
                    period="2026-Q1",
                    activeEmployeesCount=0,
                    declaredGrossSalaryDzd=0.0,
                    contributionsPaidDzd=0.0,
                )
            ],
            transactions=[
                TransactionEdge(transactionId="t1", sourceEntity="ScamVenture SARL", targetEntity="B", amountDzd=10_000_000.0, invoiceDate="2026-01-01"),
                TransactionEdge(transactionId="t2", sourceEntity="B", targetEntity="ScamVenture SARL", amountDzd=10_000_000.0, invoiceDate="2026-01-02"),
            ],
            bankStatements=[],
        )

        fraud_resp = forensic_fraud_detector.audit_startup(fraud_req)
        assert fraud_resp.scoreBreakdown.riskLevel == FraudRiskLevel.CRITICAL_FRAUD_ALERT
        assert fraud_resp.scoreBreakdown.overallFraudScore >= 75.0


# =============================================================================
# 2. PITCH DECK AUDITOR UNIT TESTS
# =============================================================================

class TestPitchDeckAuditor:
    """Unit tests for pitch deck slide diligence and exaggeration detection."""

    def test_tam_impossible_exceeds_national_gdp(self):
        """Test detection of claimed TAM exceeding Algeria's entire National GDP ($250B)."""
        analysis = deck_auditor.evaluate_tam(
            sector="Agritech",
            claimed_tam=350_000_000_000.0,  # $350B > $250B GDP
            claimed_sam=100_000_000_000.0,
            claimed_som=10_000_000_000.0,
            target_geo="ALGERIA",
        )
        assert analysis.inflationStatus == MarketInflationStatus.IMPOSSIBLE_METRIC
        assert "exceeds the entire GDP of Algeria" in analysis.critique

    def test_tam_inflated_vs_ons_sector_benchmark(self):
        """Test market sizing that severely inflates official ONS sector boundaries."""
        # B2B SaaS ceiling in Algeria is ~500M USD. Claiming 5B USD is 10x inflated!
        analysis = deck_auditor.evaluate_tam(
            sector="SAAS",
            claimed_tam=5_000_000_000.0,
            claimed_sam=1_500_000_000.0,
            claimed_som=200_000_000.0,
            target_geo="ALGERIA",
        )
        assert analysis.inflationStatus == MarketInflationStatus.IMPOSSIBLE_METRIC
        assert analysis.inflationFactor >= 5.0

    def test_tam_plausible_conservative_sizing(self):
        """Test realistic market sizing within empirical ONS bounds."""
        analysis = deck_auditor.evaluate_tam(
            sector="Agritech",
            claimed_tam=15_000_000_000.0,  # Agritech benchmark is 28B
            claimed_sam=3_000_000_000.0,
            claimed_som=150_000_000.0,
            target_geo="ALGERIA",
        )
        assert analysis.inflationStatus == MarketInflationStatus.PLAUSIBLE
        assert analysis.inflationFactor <= 1.25

    def test_moat_buzzword_illusion_penalty(self):
        """Test that hype phrases without IP or regulatory defensibility are flagged as BUZZWORD_ILLUSION."""
        content = "We have a massive first-mover advantage, superior UI and UX, revolutionary AI, and no direct competitors."
        claims = [
            DeckClaim(
                claimId="c-1",
                statement="We have no competition and unbeatable first-mover advantage",
                status=EvidenceStatus.EVIDENCE_UNSUBSTANTIATED,
            )
        ]

        analysis = deck_auditor.evaluate_moat(slide_content=content, claims=claims)

        assert analysis.moatTier == MoatDefensibilityTier.BUZZWORD_ILLUSION
        assert analysis.score < 25.0
        assert len(analysis.buzzwordsDetected) >= 3

    def test_moat_genuine_defensibility_with_inapi_and_decree_label(self):
        """Test high defensibility score for startups with registered INAPI patents and Decree 20-254 label."""
        content = "Protected by INAPI patent brevet d'invention n° 23091 and official Label Startup under Décret 20-254."
        claims = [
            DeckClaim(
                claimId="c-2",
                statement="Patent registered at INAPI for autonomous micro-irrigation nozzle",
                evidenceType="INAPI_PATENT",
                status=EvidenceStatus.EVIDENCE_VERIFIED,
            )
        ]

        analysis = deck_auditor.evaluate_moat(slide_content=content, claims=claims)

        assert analysis.moatTier == MoatDefensibilityTier.GENUINE_DEFENSIBLE_MOAT
        assert analysis.score >= 80.0
        assert analysis.dimensions["techAndIp"] >= 80.0
        assert analysis.dimensions["regulatoryMoat"] >= 80.0

    def test_claim_provenance_index_calculation(self):
        """Test calculation of Claim Provenance Index from verifiable primary evidence."""
        # 1. Fully verified claims
        verified_claims = [
            DeckClaim(claimId="1", statement="Annual revenue is 15M DZD", status=EvidenceStatus.EVIDENCE_VERIFIED),
            DeckClaim(claimId="2", statement="Patent filed at INAPI", status=EvidenceStatus.EVIDENCE_VERIFIED),
        ]
        score, ratio = deck_auditor.calculate_provenance_index(verified_claims)
        assert score == 100.0
        assert ratio == 1.0

        # 2. Mixed claims
        mixed_claims = [
            DeckClaim(claimId="1", statement="Contract signed with Sonatrach", status=EvidenceStatus.EVIDENCE_VERIFIED),
            DeckClaim(claimId="2", statement="MoU with university", status=EvidenceStatus.EVIDENCE_PARTIAL),
            DeckClaim(claimId="3", statement="10,000 active users", status=EvidenceStatus.EVIDENCE_UNSUBSTANTIATED),
        ]
        score_mixed, ratio_mixed = deck_auditor.calculate_provenance_index(mixed_claims)
        # (1.0 + 0.5 + 0.0) / 3 * 100 = 50.0
        assert score_mixed == 50.0
        assert round(ratio_mixed, 2) == 0.33

    def test_full_deck_slide_by_slide_audit(self):
        """Test complete slide-by-slide pitch deck analysis."""
        req = DeckAuditRequest(
            startupId="st-deck-1",
            deckTitle="Algeria Solar IoT Deck",
            sector="Energy Cleantech",
            targetMarketGeo="ALGERIA",
            slides=[
                DeckSlide(
                    slideNumber=1,
                    title="Problem",
                    archetype=SlideArchetype.PROBLEM,
                    content="High diesel pumping costs for Saharan farmers.",
                ),
                DeckSlide(
                    slideNumber=2,
                    title="Market Size",
                    archetype=SlideArchetype.TAM_SAM_SOM,
                    content="TAM SAM SOM Breakdown",
                    metrics={"tam": 12_000_000_000.0, "sam": 2_500_000_000.0, "som": 150_000_000.0},
                ),
                DeckSlide(
                    slideNumber=3,
                    title="Moat & IP",
                    archetype=SlideArchetype.MOAT,
                    content="Patent registered at INAPI and Label Startup under Décret 20-254.",
                    claims=[
                        DeckClaim(
                            claimId="c-ip",
                            statement="INAPI Patent #9921",
                            evidenceType="INAPI_PATENT",
                            status=EvidenceStatus.EVIDENCE_VERIFIED,
                        )
                    ],
                ),
                DeckSlide(
                    slideNumber=4,
                    title="Traction",
                    archetype=SlideArchetype.TRACTION,
                    content="40 farm deployments across Biskra and El Oued.",
                    claims=[
                        DeckClaim(
                            claimId="c-trac",
                            statement="40 commercial deployments",
                            evidenceType="CONTRACT",
                            status=EvidenceStatus.EVIDENCE_VERIFIED,
                        )
                    ],
                ),
            ],
        )

        resp = deck_auditor.audit_deck(req)

        assert resp.overallIntegrityScore >= 80.0
        assert len(resp.slideResults) == 4
        assert resp.tamAnalysis is not None
        assert resp.tamAnalysis.inflationStatus == MarketInflationStatus.PLAUSIBLE
        assert resp.moatAnalysis is not None
        assert resp.moatAnalysis.moatTier == MoatDefensibilityTier.GENUINE_DEFENSIBLE_MOAT


# =============================================================================
# 3. FASTAPI REST ENDPOINTS INTEGRATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_endpoint_forensic_fraud_audit(api_client, client_csrf):
    """Test POST /api/v1/forensics/fraud/audit."""
    cookies, headers = client_csrf
    for k, v in cookies.items():
        api_client.cookies.set(k, v)

    resp = await api_client.post(
        "/api/v1/forensics/fraud/audit",
        json={
            "startupId": "st-api-test",
            "companyName": "AgriTech SPAS",
            "claimedFinancials": {
                "annualDeclaredRevenueDzd": 15_000_000.0,
                "claimedMonthlyPayrollDzd": 800_000.0,
                "claimedHeadcount": 8,
                "claimedMonthlyBurnDzd": 900_000.0,
                "claimedRunwayMonths": 10.0,
            },
            "g50Declarations": [
                {"period": "2026-01", "turnoverReportedDzd": 1_250_000.0, "tvaCollectedDzd": 237_500.0}
            ],
            "cnasDeclarations": [
                {
                    "period": "2026-Q1",
                    "activeEmployeesCount": 7,
                    "declaredGrossSalaryDzd": 750_000.0,
                    "contributionsPaidDzd": 258_750.0,
                }
            ],
            "transactions": [],
            "bankStatements": [
                {
                    "period": "2026-01",
                    "openingBalanceDzd": 9_000_000.0,
                    "totalDepositsDzd": 1_250_000.0,
                    "totalWithdrawalsDzd": 2_150_000.0,
                    "closingBalanceDzd": 8_100_000.0,
                }
            ],
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["startupId"] == "st-api-test"
    assert "scoreBreakdown" in data
    assert data["scoreBreakdown"]["riskLevel"] in ("LOW_RISK", "MODERATE_RISK")
    assert "redFlags" in data


@pytest.mark.asyncio
async def test_endpoint_circular_transaction_check(api_client, client_csrf):
    """Test POST /api/v1/forensics/fraud/circular-check."""
    cookies, headers = client_csrf
    for k, v in cookies.items():
        api_client.cookies.set(k, v)

    resp = await api_client.post(
        "/api/v1/forensics/fraud/circular-check",
        json={
            "targetEntity": "Alpha",
            "transactions": [
                {"transactionId": "t1", "sourceEntity": "Alpha", "targetEntity": "Beta", "amountDzd": 1_000_000.0, "invoiceDate": "2026-01-01"},
                {"transactionId": "t2", "sourceEntity": "Beta", "targetEntity": "Gamma", "amountDzd": 900_000.0, "invoiceDate": "2026-01-02"},
                {"transactionId": "t3", "sourceEntity": "Gamma", "targetEntity": "Alpha", "amountDzd": 850_000.0, "invoiceDate": "2026-01-03"},
            ],
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["cyclesFound"] == 1
    assert data["circularRiskScore"] >= 50.0


@pytest.mark.asyncio
async def test_endpoint_cash_reconciliation(api_client, client_csrf):
    """Test POST /api/v1/forensics/fraud/reconcile-cash."""
    cookies, headers = client_csrf
    for k, v in cookies.items():
        api_client.cookies.set(k, v)

    resp = await api_client.post(
        "/api/v1/forensics/fraud/reconcile-cash",
        json={
            "claimedMonthlyBurnDzd": 500_000.0,
            "claimedRunwayMonths": 10.0,
            "bankStatements": [
                {
                    "period": "2026-01",
                    "openingBalanceDzd": 5_500_000.0,
                    "totalDepositsDzd": 0.0,
                    "totalWithdrawalsDzd": 500_000.0,
                    "closingBalanceDzd": 5_000_000.0,
                }
            ],
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["isReconciled"] is True
    assert data["calculatedRunwayMonths"] == 10.0
    assert data["ledgerDiscrepancyTotalDzd"] == 0.0


@pytest.mark.asyncio
async def test_endpoint_pitch_deck_analysis(api_client, client_csrf):
    """Test POST /api/v1/diligence/deck-audit/analyze."""
    cookies, headers = client_csrf
    for k, v in cookies.items():
        api_client.cookies.set(k, v)

    resp = await api_client.post(
        "/api/v1/diligence/deck-audit/analyze",
        json={
            "startupId": "st-pitch-api",
            "deckTitle": "Fintech Pay DZ Deck",
            "sector": "Fintech",
            "targetMarketGeo": "ALGERIA",
            "slides": [
                {
                    "slideNumber": 1,
                    "title": "Market Size",
                    "archetype": "TAM_SAM_SOM",
                    "content": "Digital payments market",
                    "metrics": {"tam": 8_000_000_000.0, "sam": 2_000_000_000.0, "som": 100_000_000.0},
                },
                {
                    "slideNumber": 2,
                    "title": "Defensibility",
                    "archetype": "MOAT",
                    "content": "Regulatory license under Banque d'Algérie and Decree 20-254 Startup Label.",
                },
            ],
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["startupId"] == "st-pitch-api"
    assert data["overallIntegrityScore"] > 70.0
    assert len(data["slideResults"]) == 2


@pytest.mark.asyncio
async def test_endpoint_tam_benchmark_check(api_client, client_csrf):
    """Test POST /api/v1/diligence/deck-audit/tam-check."""
    cookies, headers = client_csrf
    for k, v in cookies.items():
        api_client.cookies.set(k, v)

    resp = await api_client.post(
        "/api/v1/diligence/deck-audit/tam-check",
        json={
            "sector": "E-COMMERCE",
            "targetMarketGeo": "ALGERIA",
            "claimedTamUsd": 3_000_000_000.0,
            "claimedSamUsd": 800_000_000.0,
            "claimedSomUsd": 50_000_000.0,
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["sector"] == "E-COMMERCE"
    assert data["inflationStatus"] == "PLAUSIBLE"
    assert data["inflationFactor"] <= 1.25
