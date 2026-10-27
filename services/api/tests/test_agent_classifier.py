"""
Unit tests for the typo-tolerant, dialect-aware, multi-domain IntentClassifier
and AgentSupervisor tool planning.
"""

import pytest
from app.agent.context import AgentSecurityContext
from app.agent.domains import ToolDomain
from app.agent.router.classifier import (
    IntentClassifier,
    damerau_levenshtein,
    normalize_multilingual_text,
    strip_arabic_prefixes,
)
from app.agent.router.supervisor import AgentSupervisor
from app.schemas.auth import UserRole


class TestTextNormalization:
    """Tests for multilingual and Arabic text normalization."""

    def test_arabic_diacritics_and_alef_normalization(self):
        # Tashkeel, Tatweel, and Alef variations
        raw = "دُرُوسٌ بَايْثُون"
        norm = normalize_multilingual_text(raw)
        assert norm == "دروس بايثون"

        raw_alef = "إِكْسِلْ وَ أَرْشِيف"
        norm_alef = normalize_multilingual_text(raw_alef)
        assert norm_alef == "اكسل و ارشيف"

    def test_teh_marbuta_and_alef_maksura(self):
        # ة -> ه, ى -> ي
        raw = "دورة تكوينية في دنيى"
        norm = normalize_multilingual_text(raw)
        assert norm == "دوره تكوينيه في دنيي"

    def test_character_elongation_collapse(self):
        # Repetitions collapsed to at most 2, hamza on yeh normalized to yeh
        raw = "كورسسسسسس راااائع"
        norm = normalize_multilingual_text(raw)
        assert norm == "كورس رايع"

    def test_prefix_stripping(self):
        # Clitics like ال, بال, فال, ول
        assert strip_arabic_prefixes("الدروس") == "دروس"
        assert strip_arabic_prefixes("بالكورس") == "كورس"
        assert strip_arabic_prefixes("فالمشروع") == "مشروع"
        assert strip_arabic_prefixes("وللدورات") == "دورات"


class TestLevenshteinDistance:
    """Tests for bounded Damerau-Levenshtein calculation."""

    def test_distance_bounds(self):
        assert damerau_levenshtein("python", "python", 2) == 0
        assert damerau_levenshtein("دروس", "دروش", 2) == 1
        assert damerau_levenshtein("dashboard", "deshbord", 2) == 2
        # Transposition
        assert damerau_levenshtein("course", "coures", 2) == 1
        # Early exit beyond max_distance
        assert damerau_levenshtein("completely", "different", 2) > 2


class TestDomainClassification:
    """Tests for multi-lingual, dialectal, and typo-tolerant domain detection."""

    @pytest.mark.parametrize(
        "query,expected_domain",
        [
            # EdTech - standard English & French
            ("I want to enroll in python course", ToolDomain.EDTECH),
            ("Je veux m'inscrire a la formation", ToolDomain.EDTECH),
            # EdTech - Arabic & Algerian Darija
            ("حاب نقرا كورسات بايثون", ToolDomain.EDTECH),
            ("وريني قائمة الدورات", ToolDomain.EDTECH),
            # EdTech - Typo tolerance
            ("دروش بايثون من فضلك", ToolDomain.EDTECH),  # typo: دروش -> دروس
            ("kours python svp", ToolDomain.EDTECH),  # Arabizi: kours
            # Freelance - standard & dialectal
            ("I need to hire a freelancer for my project", ToolDomain.FREELANCE),
            ("Je cherche un freelanceur pour un projet", ToolDomain.FREELANCE),
            ("حاب نلقى بروجي للخدمة", ToolDomain.FREELANCE),
            ("عقد عمل حر و تسليم المشروع", ToolDomain.FREELANCE),
            # Freelance - Typo & Arabizi
            (
                "I want to sign a contrcat",
                ToolDomain.FREELANCE,
            ),  # typo: contrcat -> contract
            ("khdma mostakil", ToolDomain.FREELANCE),  # Arabizi
            # BI - standard & dialectal
            ("Open my sales dashboard and show KPIs", ToolDomain.BI),
            ("Affiche le tableau de bord et les statistiques", ToolDomain.BI),
            ("وريني لوحة التحكم و مؤشرات الاداء", ToolDomain.BI),
            # BI - Typo & Arabizi
            ("Show me my deshbord", ToolDomain.BI),  # typo: deshbord -> dashboard
            ("dachboard des ventes", ToolDomain.BI),  # Arabizi / French phonetic
            # FinTech - standard & Algerian payment rails
            ("Check my BaridiMob wallet balance in DZD", ToolDomain.FINTECH),
            ("Mon solde edahabia et reçu de paiement", ToolDomain.FINTECH),
            ("شحال عندي رصيد في البطاقة الذهبية", ToolDomain.FINTECH),
            ("flous drahem baridimob", ToolDomain.FINTECH),  # Arabizi
            # Core - support & account
            ("I need to reset my password", ToolDomain.CORE),
            ("Ouvrir un ticket pour le support", ToolDomain.CORE),
            ("عندي مشكل و حاب نحكي مع عون الدعم", ToolDomain.CORE),
        ],
    )
    def test_single_domain_classification(
        self, query: str, expected_domain: ToolDomain
    ):
        res = IntentClassifier.classify(query)
        assert res.primary_domain == expected_domain
        assert res.confidence >= 0.60

    def test_exact_contact_does_not_falsely_clash_with_contract(self):
        """Verify that 'contact' in Core is not hijacked by 'contract' in Freelance."""
        res = IntentClassifier.classify("I want to contact support")
        assert res.primary_domain == ToolDomain.CORE
        assert (
            res.secondary_domain is None or res.secondary_domain != ToolDomain.FREELANCE
        )

    def test_multi_domain_co_routing(self):
        """Verify that queries spanning multiple intents detect primary and secondary domains."""
        # Freelance + BI
        query_freelance_bi = (
            "I need to hire a freelancer to build an analytics dashboard"
        )
        res = IntentClassifier.classify(query_freelance_bi)
        domains = {res.primary_domain, res.secondary_domain}
        assert ToolDomain.FREELANCE in domains
        assert ToolDomain.BI in domains

        # EdTech + FinTech
        query_edtech_fintech = (
            "How much does the python course cost in DZD with baridimob"
        )
        res2 = IntentClassifier.classify(query_edtech_fintech)
        domains2 = {res2.primary_domain, res2.secondary_domain}
        assert ToolDomain.EDTECH in domains2
        assert ToolDomain.FINTECH in domains2


class TestSupervisorToolPlanning:
    """Tests for multi-domain supervisor tool generation and RBAC."""

    def test_supervisor_single_domain_plan(self):
        supervisor = AgentSupervisor()
        context = AgentSecurityContext(user_id=1, user_role=UserRole.STUDENT)
        tools = supervisor.plan_tools(
            query="وريني دورات بايثون",
            context=context,
        )
        tool_names = [t.name for t in tools]

        # Should include core discovery tools
        assert "search_knowledge_faq" in tool_names
        assert "get_my_profile" in tool_names
        # Should include edtech tools
        assert any("course" in name or "lesson" in name for name in tool_names)

    def test_supervisor_multi_domain_blended_plan(self):
        supervisor = AgentSupervisor()
        context = AgentSecurityContext(user_id=1, user_role=UserRole.BUSINESS)
        tools = supervisor.plan_tools(
            query="I want to hire a freelancer to build a BI dashboard",
            context=context,
        )
        tool_names = [t.name for t in tools]

        # Should include freelance tools
        assert any(
            "project" in name or "proposal" in name or "milestone" in name
            for name in tool_names
        )
        # Should also include BI tools from secondary domain
        assert any(
            "bi_" in name or "dashboard" in name or "dataset" in name
            for name in tool_names
        )
