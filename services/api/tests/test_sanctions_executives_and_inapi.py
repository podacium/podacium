"""
TamWheel Sovereign Ethical Agentic Venture OS — Comprehensive Diligence Test Suite.
Tests:
1. Automated Adverse Media & Regulatory Sanctions Screening Engine (UN, OFAC, EU, Algerian CTRF)
2. Algerian Transliteration Phonetic & Fuzzy Name Matching (Levenshtein, Jaro-Winkler, Maghreb Soundex)
3. Politically Exposed Persons (PEP) detection under Algerian Law 05-01 / Law 23-01
4. Executive Background & Corporate Officer Disqualification Engine (NIN, CNRC Fichier des Fraudeurs, Law 04-08)
5. Commercial Court Bankruptcy Lookback & Mandate Conflicts (Art. 615 & 569 Code de Commerce)
6. INAPI Patent & Trademark Provenance Verifier (Ordinance 03-07, BOPI Gazette, Annuités, IP Moat Index)
7. FastAPI Diligence Endpoints mounted under /api/v1/diligence/*
"""

import pytest
from datetime import datetime
from starlette.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app


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

from app.schemas.diligence_sanctions import (
    SanctionRegime,
    SanctionRiskLevel,
    PEPType,
    PEPRiskTier,
    AdverseMediaSeverity,
    SanctionsScreeningRequest,
    FuzzyMatchRequest,
    PEPScreeningRequest,
    AdverseMediaScanRequest,
)
from app.schemas.executive_vetting import (
    CNRCRegisterStatus,
    DisqualificationType,
    CorporateEntityType,
    ExecutiveVerdict,
    DirectorshipMandate,
    ExecutiveVettingRequest,
    DisqualificationCheckRequest,
    MandatesCheckRequest,
)
from app.schemas.inapi_ip import (
    PatentStatus,
    TrademarkStatus,
    IPMoatTier,
    IPMoatBadge,
    PatentClaimRecord,
    TrademarkClaimRecord,
    PatentVerificationRequest,
    TrademarkVerificationRequest,
    IPOldPortfolioAuditRequest,
)
from app.services.sanctions_screening_engine import (
    sanctions_screening_engine,
    AlgerianPhoneticMatcher,
)
from app.services.executive_vetting_service import executive_vetting_service
from app.services.inapi_ip_verifier import inapi_ip_verifier


# =============================================================================
# 1. UNIT TESTS: ALGERIAN PHONETIC & SANCTIONS SCREENING ENGINE
# =============================================================================

class TestSanctionsScreeningEngine:
    """Test suite for name matching, sanctions registers, PEP, and adverse media."""

    def test_algerian_name_normalization_and_prefix_stripping(self):
        """Test normalization of prefixes, honorifics, and diacritics."""
        matcher = AlgerianPhoneticMatcher()

        # Honorifics stripped
        assert matcher.normalize_name("Sidi Cheikh Mohamed") == "mohamed"
        assert matcher.normalize_name("El Hadj Djamel") == "djamel"

        # Accents stripped
        assert matcher.normalize_name("Éric Chérif") == "eric cherif"

        # Prefixes normalized
        assert matcher.normalize_name("Ben-Bouzid") == "ben bouzid"
        assert matcher.normalize_name("Al-Mansour") == "mansour"
        assert matcher.normalize_name("Aït Ahmed") == "ait ahmed"

    def test_maghreb_phonetic_soundex_matching(self):
        """Test phonetic equivalence across Algerian transliterations."""
        matcher = AlgerianPhoneticMatcher()

        # Mohamed vs Mouhamed
        k1 = matcher.maghreb_phonetic_key("Mohamed")
        k2 = matcher.maghreb_phonetic_key("Mouhamed")
        assert k1 == k2

        # Djamel vs Jamel
        assert matcher.maghreb_phonetic_key("Djamel") == matcher.maghreb_phonetic_key("Jamel")

        # Khaled vs Chaled
        assert matcher.maghreb_phonetic_key("Khaled") == matcher.maghreb_phonetic_key("Kaled")

        # Belkacem vs Belkassim
        detail = matcher.match_names("Belkacem", "Belkassim")
        assert detail.compositeScore >= 0.70

    def test_token_permutation_invariance(self):
        """Test name order permutation (First Middle Last vs Last First Middle)."""
        matcher = AlgerianPhoneticMatcher()
        detail = matcher.match_names("Mohamed Amine Benali", "Benali Mohamed Amine")
        assert detail.compositeScore >= 0.85
        assert detail.tokenSimilarity >= 0.90

    def test_negative_name_match_divergence(self):
        """Test that distinct Algerian names score below detection threshold."""
        matcher = AlgerianPhoneticMatcher()
        detail = matcher.match_names("Karim Saidi", "Mokhtar Belmokhtar")
        assert detail.compositeScore < 0.40

    def test_algerian_ctrf_national_freeze_list_detection(self):
        """Test immediate freeze detection against Algerian National Terrorism list."""
        req = SanctionsScreeningRequest(
            entityName="Mokhtar Belmokhtar",
            aliases=["Belaouer", "Khaled Abou El Abass"],
        )
        res = sanctions_screening_engine.screen_entity(req)

        assert res.algerianFreezeListHit is True
        assert res.riskLevel == SanctionRiskLevel.CONFIRMED_SANCTION
        assert res.compositeRiskScore >= 60.0
        assert res.mandatoryReportingRequired is True
        assert res.recommendedAction == "BLOCK_IMMEDIATE_CTRF_FREEZE"
        assert any(h.regime == SanctionRegime.ALGERIA_CTRF_NATIONAL for h in res.sanctionsHits)

    def test_international_sanctions_hit_un_and_ofac(self):
        """Test UN Consolidated and OFAC SDN list matching."""
        req = SanctionsScreeningRequest(
            entityName="Al-Barakaat Financial Consortium",
        )
        res = sanctions_screening_engine.screen_entity(req)

        assert res.riskLevel in [SanctionRiskLevel.CONFIRMED_SANCTION, SanctionRiskLevel.POTENTIAL_MATCH]
        assert len(res.sanctionsHits) >= 1
        assert any(h.regime == SanctionRegime.US_OFAC_SDN for h in res.sanctionsHits)

    def test_clean_founder_screening_verdict(self):
        """Test screening of clean, non-sanctioned startup founder."""
        req = SanctionsScreeningRequest(
            entityName="Amine Yacine Benmansour",
            aliases=["Amine Benmansour"],
            dateOfBirth="1992-06-15",
            nationalId="192160100412340055",
            includeAdverseMedia=True,
            includePepCheck=True,
        )
        res = sanctions_screening_engine.screen_entity(req)

        assert res.riskLevel == SanctionRiskLevel.CLEAN
        assert res.compositeRiskScore < 20.0
        assert res.algerianFreezeListHit is False
        assert res.mandatoryReportingRequired is False
        assert res.recommendedAction == "CLEAR_NO_IMPEDIMENTS"
        assert res.pepAssessment.isPep is False

    def test_algerian_pep_detection_national_cabinet_and_soe_pdg(self):
        """Test PEP status detection under Algerian Law 05-01 / Law 23-01."""
        # Active Minister
        pep_faid = sanctions_screening_engine.check_pep_status("Laaziz Faid")
        assert pep_faid.isPep is True
        assert pep_faid.pepType == PEPType.NATIONAL_PEP
        assert pep_faid.riskTier == PEPRiskTier.CRITICAL
        assert pep_faid.enhancedDueDiligenceMandatory is True

        # State-Owned Enterprise (Sonatrach PDG)
        pep_sonatrach = sanctions_screening_engine.check_pep_status("Rachid Hachichi")
        assert pep_sonatrach.isPep is True
        assert pep_sonatrach.pepType == PEPType.NATIONAL_PEP
        assert "Sonatrach" in (pep_sonatrach.institutionName or "")
        assert pep_sonatrach.riskTier == PEPRiskTier.HIGH

        # Relative or Close Associate (RCA)
        pep_rca = sanctions_screening_engine.check_pep_status("Mohamed Cherif Ould Kaddour")
        assert pep_rca.isPep is True
        assert pep_rca.pepType == PEPType.RCA_PEP

    def test_adverse_media_financial_crimes_scanning(self):
        """Test adverse media detection of white-collar crimes and corruption."""
        req = AdverseMediaScanRequest(
            entityName="Kamel Haddad",
        )
        res = sanctions_screening_engine.scan_adverse_media(req)

        assert res.overallSeverity in [AdverseMediaSeverity.CRITICAL, AdverseMediaSeverity.HIGH]
        assert len(res.articlesFlagged) >= 1
        assert any(
            "corruption" in a.keywordsMatched or "pots-de-vin" in a.keywordsMatched or "abus de biens sociaux" in a.keywordsMatched
            for a in res.articlesFlagged
        )


# =============================================================================
# 2. UNIT TESTS: EXECUTIVE VETTING & OFFICER DISQUALIFICATION
# =============================================================================

class TestExecutiveVettingService:
    """Test suite for NIN validation, CNRC Disqualification Register, and Mandates."""

    def test_algerian_nin_validation_valid_and_invalid(self):
        """Test 18-digit Algerian National Identification Number (NIN) structure."""
        # Valid: 18 digits, Male (1), year 90, wilaya 16 (Algiers)
        valid, err = executive_vetting_service.validate_algerian_nin("190160100451230012")
        assert valid is True
        assert err is None

        # Valid: 18 digits, Female (2), year 95, wilaya 31 (Oran)
        valid_f, err_f = executive_vetting_service.validate_algerian_nin("295310100789010045")
        assert valid_f is True

        # Invalid length (17 digits)
        invalid_len, err_len = executive_vetting_service.validate_algerian_nin("19016010045123001")
        assert invalid_len is False
        assert "18 numeric digits" in err_len

        # Invalid gender digit (3)
        invalid_g, err_g = executive_vetting_service.validate_algerian_nin("390160100451230012")
        assert invalid_g is False

        # Invalid wilaya code (99 outside 01-58 at index 5:7)
        invalid_w, err_w = executive_vetting_service.validate_algerian_nin("190019900451230012")
        assert invalid_w is False
        assert "wilaya code" in err_w

    def test_cnrc_disqualification_active_managing_ban(self):
        """Test detection in CNRC Fichier des Fraudeurs (Law 04-08)."""
        rec = executive_vetting_service.check_cnrc_disqualification(
            full_name="Tariq Khelil",
            national_id="184160100451230012",
        )
        assert rec.status == CNRCRegisterStatus.INSCRIT_INTERDIT
        assert rec.disqualificationType == DisqualificationType.INTERDICTION_DE_GERER
        assert "Code de Commerce" in rec.legalBasis

    def test_cnrc_disqualification_personal_bankruptcy(self):
        """Test detection of Faillite Personnelle with court comblement de passif."""
        rec = executive_vetting_service.check_cnrc_disqualification(
            full_name="Sofiane Bouchareb",
            national_id="191090100234120098",
        )
        assert rec.status == CNRCRegisterStatus.INSCRIT_INTERDIT
        assert rec.disqualificationType == DisqualificationType.FAILLITE_PERSONNELLE

    def test_cnrc_rehabilitated_officer(self):
        """Test judicially rehabilitated officer record."""
        rec = executive_vetting_service.check_cnrc_disqualification(
            full_name="Farid Ziane",
            national_id="175160100891230033",
        )
        assert rec.status == CNRCRegisterStatus.REHABILITE

    def test_spa_mandate_statutory_limit_exceeded(self):
        """Test Algerian Commercial Code Art. 615: Maximum 5 mandates in SPAs."""
        existing_mandates = [
            DirectorshipMandate(
                companyName=f"Algerian Stock Entity {i} SPA",
                entityType=CorporateEntityType.SPA,
                role="Administrateur",
                isCurrent=True,
            )
            for i in range(1, 6)
        ]

        total, spa_count, conflicts = executive_vetting_service.evaluate_mandates_and_conflicts(
            officer_name="Zoubir Benamara",
            current_mandates=existing_mandates,
            proposed_role="Administrateur",
            target_entity_type=CorporateEntityType.SPA,
        )

        assert spa_count == 5
        assert any(c.conflictType == "SPA_MANDATE_LIMIT_EXCEEDED" for c in conflicts)
        assert any("Article 615" in c.statutoryArticle for c in conflicts)

    def test_sarl_gerant_non_compete_duty(self):
        """Test Algerian Commercial Code Art. 569: Gérant non-compete statutory rule."""
        existing_mandates = [
            DirectorshipMandate(
                companyName="Fintech Maghreb Pay SARL",
                entityType=CorporateEntityType.SARL,
                role="Gérant",
                sector="Fintech",
                isDirectCompetitor=True,
                isCurrent=True,
            )
        ]

        total, spa_count, conflicts = executive_vetting_service.evaluate_mandates_and_conflicts(
            officer_name="Karim Larbi",
            current_mandates=existing_mandates,
            proposed_role="Gérant Associé",
            target_entity_type=CorporateEntityType.SARL,
            target_sector="Fintech",
        )

        assert any(c.conflictType == "SARL_COMPETITOR_GERANT" for c in conflicts)
        assert any("Article 569" in c.statutoryArticle for c in conflicts)

    def test_comprehensive_executive_vetting_clean_vs_disqualified(self):
        """Test full executive vetting response between clean and blacklisted officers."""
        # 1. Disqualified officer
        bad_req = ExecutiveVettingRequest(
            fullName="Tariq Khelil",
            nationalIdNumber="184160100451230012",
            intendedRoleInStartup="Gérant",
        )
        bad_res = executive_vetting_service.vet_executive(bad_req)
        assert bad_res.overallVerdict == ExecutiveVerdict.DISQUALIFIED
        assert bad_res.executiveRiskScore >= 70.0
        assert len(bad_res.covenantsAndMitigations) >= 1

        # 2. Clean founder
        clean_req = ExecutiveVettingRequest(
            fullName="Nadia Belhadj",
            nationalIdNumber="294160100123450078",
            intendedRoleInStartup="Directrice Générale",
            targetStartupEntityType=CorporateEntityType.SARL,
            knownMandates=[],
        )
        clean_res = executive_vetting_service.vet_executive(clean_req)
        assert clean_res.overallVerdict == ExecutiveVerdict.APPROVED
        assert clean_res.executiveRiskScore < 25.0
        assert clean_res.ninValidated is True
        assert clean_res.cnrcDisqualificationRecord.status == CNRCRegisterStatus.AUCUNE_INSCRIPTION


# =============================================================================
# 3. UNIT TESTS: INAPI IP PROVENANCE & MOAT VERIFIER
# =============================================================================

class TestInapiIpVerifier:
    """Test suite for patent formatting, BOPI gazette, annuities, and IP moat."""

    def test_inapi_patent_number_formatting(self):
        """Test Algerian INAPI patent number syntax validation."""
        # Modern standard
        assert inapi_ip_verifier.validate_patent_number_format("DZ/P/2023/000142") is True
        assert inapi_ip_verifier.validate_patent_number_format("DZ/P/2024/1042") is True

        # Legacy format
        assert inapi_ip_verifier.validate_patent_number_format("DZ/2018/1234") is True

        # Invalid format
        assert inapi_ip_verifier.validate_patent_number_format("US9821412B2") is False
        assert inapi_ip_verifier.validate_patent_number_format("FAKE_PATENT_123") is False

    def test_ipc_classification_validation(self):
        """Test International Patent Classification (IPC) syntax."""
        assert inapi_ip_verifier.validate_ipc_classification("G06F 17/00") is True
        assert inapi_ip_verifier.validate_ipc_classification("H04L 9/32") is True
        assert inapi_ip_verifier.validate_ipc_classification("A61K 31/00") is True
        assert inapi_ip_verifier.validate_ipc_classification("INVALID_CODE") is False

    def test_paris_convention_priority_claim_evaluation(self):
        """Test Paris Convention 12-month priority period calculation."""
        # Within 12 months (~6 months) -> Valid
        valid, err = inapi_ip_verifier.evaluate_priority_claim(
            filing_date_str="2023-06-01",
            priority_date_str="2023-01-15",
            priority_country="FR",
        )
        assert valid is True
        assert err is None

        # Exceeds 12 months (18 months) -> Invalid
        invalid, err_msg = inapi_ip_verifier.evaluate_priority_claim(
            filing_date_str="2023-09-01",
            priority_date_str="2022-01-15",
            priority_country="US",
        )
        assert invalid is False
        assert "priority term exceeded" in err_msg

    def test_patent_annuity_validity_active_vs_grace_vs_lapsed(self):
        """Test 20-year term and maintenance fee grace period under Ordinance 03-07."""
        # 1. Active granted patent with fees paid
        p_active = PatentClaimRecord(
            patentNumber="DZ/P/2022/000115",
            title="Distributed Algerian Sharia Ledger",
            filingDate="2022-03-01",
            ipcClassification="G06F 17/00",
            bopiNumber="BOPI N° 320/2023",
            currentAnnuityYear=2,
            lastPaidAnnuityYear=2,
            assignedToStartup=True,
        )
        res_active = inapi_ip_verifier.verify_patent(PatentVerificationRequest(patent=p_active, asOfDate="2024-01-15"))
        assert res_active.status == PatentStatus.GRANTED_ACTIVE
        assert res_active.isAnnuityCurrent is True
        assert IPMoatBadge.INAPI_VERIFIED_PATENT in res_active.badgesIssued

        # 2. In 6-month surcharge grace window
        p_grace = PatentClaimRecord(
            patentNumber="DZ/P/2023/000210",
            title="Bio-Insecticide Formulation",
            filingDate="2023-01-10",
            ipcClassification="A01N 25/00",
            bopiNumber="BOPI N° 335/2024",
            currentAnnuityYear=2,
            lastPaidAnnuityYear=1,  # Missed year 2
            assignedToStartup=True,
        )
        # Evaluated 3 months after anniversary
        res_grace = inapi_ip_verifier.verify_patent(PatentVerificationRequest(patent=p_grace, asOfDate="2024-04-10"))
        assert res_grace.status == PatentStatus.IN_GRACE_PERIOD
        assert res_grace.isInGracePeriod is True
        assert IPMoatBadge.INAPI_LAPSED_FEE_WARNING in res_grace.badgesIssued

        # 3. Lapsed unpaid patent (past 6-month grace)
        p_lapsed = PatentClaimRecord(
            patentNumber="DZ/P/2020/000888",
            title="Solar Cell Inverter",
            filingDate="2020-01-10",
            ipcClassification="H02S 40/32",
            bopiNumber="BOPI N° 300/2021",
            currentAnnuityYear=4,
            lastPaidAnnuityYear=1,
            assignedToStartup=True,
        )
        res_lapsed = inapi_ip_verifier.verify_patent(PatentVerificationRequest(patent=p_lapsed, asOfDate="2024-01-10"))
        assert res_lapsed.status == PatentStatus.LAPSED_UNPAID_ANNUITY
        assert res_lapsed.isAnnuityCurrent is False

    def test_trademark_nice_classification_and_term(self):
        """Test industrial trademark validation across tech-relevant Nice classes."""
        tm = TrademarkClaimRecord(
            registrationNumber="DZ/M/2023/000845",
            markName="TamWheel Venture OS",
            filingDate="2023-05-15",
            niceClasses=[9, 36, 42],
            assignedToStartup=True,
        )
        res = inapi_ip_verifier.verify_trademark(TrademarkVerificationRequest(trademark=tm, asOfDate="2024-01-01"))
        assert res.isFormatValid is True
        assert res.status == TrademarkStatus.REGISTERED_ACTIVE
        assert res.techRelevantClassesPresent is True
        assert IPMoatBadge.INAPI_REGISTERED_TRADEMARK in res.badgesIssued

    def test_portfolio_ip_moat_tier_1_deep_tech_vs_unprotected(self):
        """Test overall IP Moat Index computation and badge issuance."""
        # Strong portfolio
        deep_tech_audit = inapi_ip_verifier.audit_portfolio(
            IPOldPortfolioAuditRequest(
                startupId="st-deep-1",
                companyName="Quantum Solar Algiers SPA",
                asOfDate="2023-08-01",
                patents=[
                    PatentClaimRecord(
                        patentNumber="DZ/P/2023/000101",
                        title="Perovskite Tandem Photovoltaic",
                        filingDate="2023-02-10",
                        ipcClassification="H01L 31/00",
                        bopiNumber="BOPI N° 330/2023",
                        currentAnnuityYear=1,
                        lastPaidAnnuityYear=1,
                        pctApplicationNumber="PCT/DZ2023/000004",
                        assignedToStartup=True,
                    )
                ],
                trademarks=[
                    TrademarkClaimRecord(
                        registrationNumber="DZ/M/2023/000101",
                        markName="QuantumSolar",
                        filingDate="2023-02-10",
                        niceClasses=[9, 42],
                        assignedToStartup=True,
                    )
                ],
            )
        )
        assert deep_tech_audit.ipMoatIndex >= 70.0
        assert deep_tech_audit.ipMoatTier in [IPMoatTier.IP_MOAT_DEEP_TECH_TIER_1, IPMoatTier.IP_MOAT_DEFENSIBLE]
        assert IPMoatBadge.INAPI_VERIFIED_PATENT in deep_tech_audit.portfolioBadges
        assert IPMoatBadge.INAPI_PCT_INTERNATIONAL_PHASE in deep_tech_audit.portfolioBadges

        # Unprotected startup (zero patents, no tech trademark)
        bare_audit = inapi_ip_verifier.audit_portfolio(
            IPOldPortfolioAuditRequest(
                startupId="st-bare-2",
                companyName="Fast Food Drop SARL",
                patents=[],
                trademarks=[],
            )
        )
        assert bare_audit.ipMoatIndex == 0.0
        assert bare_audit.ipMoatTier == IPMoatTier.IP_MOAT_UNPROTECTED


# =============================================================================
# 4. FASTAPI ENDPOINT INTEGRATION TESTS
# =============================================================================

@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


def test_endpoint_sanctions_screen(client):
    """Integration test for POST /api/v1/diligence/sanctions/screen."""
    payload = {
        "entityName": "Mokhtar Belmokhtar",
        "aliases": ["Khaled Abou El Abass"],
        "countryCode": "DZ",
        "includeAdverseMedia": True,
        "includePepCheck": True,
    }
    response = client.post("/api/v1/diligence/sanctions/screen", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["algerianFreezeListHit"] is True
    assert data["riskLevel"] == "CONFIRMED_SANCTION"
    assert data["mandatoryReportingRequired"] is True
    assert "BLOCK" in data["recommendedAction"]


def test_endpoint_sanctions_fuzzy_match(client):
    """Integration test for POST /api/v1/diligence/sanctions/fuzzy-match."""
    payload = {
        "queryName": "Mohamed Cherif Benali",
        "targetName": "Mouhamed Cherif Benali",
    }
    response = client.post("/api/v1/diligence/sanctions/fuzzy-match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isMatch"] is True
    assert data["matchDetails"]["compositeScore"] >= 0.80


def test_endpoint_sanctions_pep_check(client):
    """Integration test for POST /api/v1/diligence/sanctions/pep-check."""
    payload = {
        "fullName": "Laaziz Faid",
        "knownRoles": ["Ministre des Finances"],
    }
    response = client.post("/api/v1/diligence/sanctions/pep-check", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["pepHit"]["isPep"] is True
    assert data["pepHit"]["pepType"] == "NATIONAL_PEP"
    assert len(data["recommendedMitigations"]) >= 1


def test_endpoint_sanctions_adverse_media(client):
    """Integration test for POST /api/v1/diligence/sanctions/adverse-media."""
    payload = {
        "entityName": "Kamel Haddad",
    }
    response = client.post("/api/v1/diligence/sanctions/adverse-media", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overallSeverity"] in ["CRITICAL", "HIGH"]
    assert len(data["articlesFlagged"]) >= 1


def test_endpoint_executives_vet(client):
    """Integration test for POST /api/v1/diligence/executives/vet."""
    payload = {
        "fullName": "Tariq Khelil",
        "nationalIdNumber": "184160100451230012",
        "intendedRoleInStartup": "Gérant",
        "targetStartupEntityType": "SARL",
    }
    response = client.post("/api/v1/diligence/executives/vet", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overallVerdict"] == "DISQUALIFIED"
    assert data["cnrcDisqualificationRecord"]["status"] == "INSCRIT_INTERDIT"


def test_endpoint_executives_disqualification_check(client):
    """Integration test for POST /api/v1/diligence/executives/disqualification-check."""
    payload = {
        "fullName": "Sofiane Bouchareb",
        "nationalId": "191090100234120098",
    }
    response = client.post("/api/v1/diligence/executives/disqualification-check", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isDisqualified"] is True
    assert data["record"]["disqualificationType"] == "FAILLITE_PERSONNELLE"


def test_endpoint_executives_mandates_check(client):
    """Integration test for POST /api/v1/diligence/executives/mandates-check."""
    payload = {
        "officerName": "Adel Boudiaf",
        "currentMandates": [
            {
                "companyName": f"Corporate Entity {i} SPA",
                "entityType": "SPA",
                "role": "Administrateur",
                "isCurrent": True,
            }
            for i in range(1, 6)
        ],
        "proposedNewRole": "Administrateur",
        "targetEntityType": "SPA",
    }
    response = client.post("/api/v1/diligence/executives/mandates-check", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isSpaLimitExceeded"] is True
    assert data["status"] == "CONFLICT_DETECTED"


def test_endpoint_inapi_verify_patent(client):
    """Integration test for POST /api/v1/diligence/inapi/verify-patent."""
    payload = {
        "patent": {
            "patentNumber": "DZ/P/2023/000142",
            "title": "Autonomous Agricultural Drone Navigation",
            "filingDate": "2023-04-10",
            "ipcClassification": "B64C 39/00",
            "bopiNumber": "BOPI N° 338/2024",
            "currentAnnuityYear": 1,
            "lastPaidAnnuityYear": 1,
            "assignedToStartup": True,
        },
        "asOfDate": "2023-10-10",
    }
    response = client.post("/api/v1/diligence/inapi/verify-patent", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isFormatValid"] is True
    assert data["status"] == "GRANTED_ACTIVE"
    assert "INAPI_VERIFIED_PATENT" in data["badgesIssued"]


def test_endpoint_inapi_verify_trademark(client):
    """Integration test for POST /api/v1/diligence/inapi/verify-trademark."""
    payload = {
        "trademark": {
            "registrationNumber": "DZ/M/2022/000512",
            "markName": "SovereignCloud DZ",
            "filingDate": "2022-01-20",
            "niceClasses": [9, 38, 42],
            "assignedToStartup": True,
        }
    }
    response = client.post("/api/v1/diligence/inapi/verify-trademark", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isFormatValid"] is True
    assert data["status"] == "REGISTERED_ACTIVE"
    assert data["techRelevantClassesPresent"] is True


def test_endpoint_inapi_audit_portfolio(client):
    """Integration test for POST /api/v1/diligence/inapi/audit-portfolio."""
    payload = {
        "startupId": "st-algeria-ai-01",
        "companyName": "Algiers Synthetic Intelligence SPA",
        "asOfDate": "2023-08-01",
        "patents": [
            {
                "patentNumber": "DZ/P/2023/000999",
                "title": "Arabic-Dialectal LLM Optimization Engine",
                "filingDate": "2023-03-01",
                "ipcClassification": "G06F 17/00",
                "bopiNumber": "BOPI N° 332/2023",
                "currentAnnuityYear": 1,
                "lastPaidAnnuityYear": 1,
                "assignedToStartup": True,
            }
        ],
        "trademarks": [
            {
                "registrationNumber": "DZ/M/2023/000450",
                "markName": "DarijaLLM",
                "filingDate": "2023-03-01",
                "niceClasses": [9, 42],
                "assignedToStartup": True,
            }
        ],
    }
    response = client.post("/api/v1/diligence/inapi/audit-portfolio", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ipMoatIndex"] >= 50.0
    assert len(data["portfolioBadges"]) >= 1
    assert "Tier-1" in data["investorMoatSummary"] or "Defensible" in data["investorMoatSummary"]
