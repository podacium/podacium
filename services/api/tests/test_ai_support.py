"""
Tests for Podacium Native AI Support Assistant.

Covers:
- PII scrubbing (ANPDP Law 18-07 / 25-11 compliance)
- Offline knowledge base FAQ matching across French, Arabic, and English
- Dynamic category inference (BILLING, LEARNING, HUB, ACCOUNT, GENERAL)
- Fast-path fallback when Gemini API key is absent
- Integration tests for POST /api/v1/support/chat
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.services.ai_support_service import (
    sanitize_pii,
    ask_podacium_ai,
    _infer_category,
    execute_tool,
    GEMINI_TOOLS,
)
from app.services.support_knowledge import match_offline_faq


class TestPIIScrubber:
    """Tests for regex-based PII sanitization."""

    def test_masks_card_numbers(self):
        text = "Ma carte est 5040 1234 5678 9012 pour mon paiement EDAHABIA"
        sanitized = sanitize_pii(text)
        assert "5040 1234 5678 9012" not in sanitized
        assert "[CARTE_MASQUÉE]" in sanitized

    def test_masks_cvv(self):
        text = "Mon code est cvv: 123 et cvv=456"
        sanitized = sanitize_pii(text)
        assert "123" not in sanitized
        assert "CVV:[MASQUÉ]" in sanitized

    def test_masks_algerian_phone_numbers(self):
        text = "Appelez-moi au 0550123456 ou +213661234567"
        sanitized = sanitize_pii(text)
        assert "0550123456" not in sanitized
        assert "+213661234567" not in sanitized
        assert "[TÉLÉPHONE_MASQUÉ]" in sanitized

    def test_masks_ccp_numbers(self):
        text = "Mon CCP: 12345678 clé 20"
        sanitized = sanitize_pii(text)
        assert "12345678" not in sanitized
        assert "[CCP_MASQUÉ]" in sanitized


class TestOfflineKnowledgeMatcher:
    """Tests for rule-based offline FAQ matching."""

    def test_matches_edahabia_billing(self):
        result_fr = match_offline_faq("Comment payer avec la carte edahabia ?", "fr")
        assert result_fr is not None
        assert result_fr["category"] == "BILLING"
        assert "EDAHABIA" in result_fr["reply"]
        assert "Chargily" in result_fr["reply"]

        result_ar = match_offline_faq("كيف يمكنني الدفع بالبطاقة الذهبية؟", "ar")
        assert result_ar is not None
        assert result_ar["category"] == "BILLING"
        assert "الذهبية" in result_ar["reply"]

    def test_matches_certificate(self):
        result = match_offline_faq("Comment obtenir mon certificat LinkedIn ?", "fr")
        assert result is not None
        assert result["category"] == "LEARNING"
        assert "Open Badges v3" in result["reply"]

    def test_matches_freelance_escrow(self):
        result = match_offline_faq(
            "Comment fonctionne l'escrow pour un freelance ?", "fr"
        )
        assert result is not None
        assert result["category"] == "HUB"
        assert "séquestre" in result["reply"]

    def test_matches_founders_and_origin(self):
        result_fr = match_offline_faq("Qui a fondé Podacium ?", "fr")
        assert result_fr is not None
        assert "Zakarya ROUBHI" in result_fr["reply"]
        assert "Mohamed Redha HABIB" in result_fr["reply"]
        assert "Ahmed MERHAB" in result_fr["reply"]
        assert "ESE Oran" in result_fr["reply"]
        assert "1275" in result_fr["reply"]

        result_ar = match_offline_faq("من هم مؤسسو منصة بوداسيوم؟", "ar")
        assert result_ar is not None
        assert "زكريا روبحي" in result_ar["reply"]
        assert "حبيب" in result_ar["reply"]

    def test_matches_social_media_links(self):
        result = match_offline_faq("Quels sont vos réseaux sociaux ?", "fr")
        assert result is not None
        assert "linkedin.com/company/podacium" in result["reply"]
        assert "youtube.com/@PodaciumDZ" in result["reply"]
        assert "instagram.com/podacium" in result["reply"]

    def test_unmatched_query_returns_none(self):
        result = match_offline_faq("Quelle est la météo à Oran ?", "fr")
        assert result is None


class TestCategoryInference:
    """Tests for conversation topic inference."""

    def test_category_detection(self):
        assert _infer_category("erreur paiement chargily") == "BILLING"
        assert _infer_category("quiz du cours de python") == "LEARNING"
        assert _infer_category("contrat freelance client") == "HUB"
        assert _infer_category("changer mon mot de passe") == "ACCOUNT"
        assert _infer_category("bonjour j'ai une question") == "GENERAL"


@pytest.mark.asyncio
class TestAIAssistantService:
    """Tests for ask_podacium_ai service."""

    async def test_fallback_when_no_api_key(self):
        with patch("app.services.ai_support_service.setting") as mock_setting:
            mock_setting.GEMINI_API_KEY = None
            response = await ask_podacium_ai(
                message="Comment payer avec EDAHABIA ?", locale="fr"
            )
            assert response["engine"] == "offline_knowledge"
            assert response["category"] == "BILLING"
            assert "Chargily" in response["reply"]

    async def test_empty_message_handling(self):
        response = await ask_podacium_ai(message="   ", locale="fr")
        assert response["category"] == "GENERAL"
        assert "Veuillez poser une question" in response["reply"]


class TestSupportChatEndpoint:
    """Integration tests for POST /api/v1/support/chat."""

    @pytest.fixture(autouse=True)
    def disable_gemini_in_tests(self, monkeypatch):
        from app.core.config import setting

        monkeypatch.setattr(setting, "GEMINI_API_KEY", "")

    def _make_client(self):
        from app.main import app

        return TestClient(app, raise_server_exceptions=False)

    def test_successful_chat_query(self):
        client = self._make_client()
        resp = client.post(
            "/api/v1/support/chat",
            json={"message": "Puis-je payer par EDAHABIA ?", "locale": "fr"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert "category" in data
        assert data["category"] == "BILLING"
        assert data["engine"] in ("gemini", "offline_knowledge")

    def test_chat_query_empty_fails_validation(self):
        client = self._make_client()
        resp = client.post(
            "/api/v1/support/chat",
            json={"message": "", "locale": "fr"},
        )
        assert resp.status_code == 422  # Pydantic validation error (min_length=1)

    def test_streaming_chat_endpoint(self):
        client = self._make_client()
        resp = client.post(
            "/api/v1/support/chat/stream",
            json={"message": "Comment obtenir mon certificat ?", "locale": "fr"},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        # Validate that stream contains SSE data lines
        content = resp.text
        assert "data: " in content
        assert "done" in content

    def test_escalation_dossier_endpoint(self):
        client = self._make_client()
        resp = client.post(
            "/api/v1/support/dossier",
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "Mon compte CCP a été débité mais le cours est bloqué",
                    },
                    {
                        "role": "assistant",
                        "content": "Veuillez patienter 24h pour la télécollecte",
                    },
                ],
                "locale": "fr",
                "client_context": {
                    "page": "/billing",
                    "browser": "Mozilla/5.0",
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["category"] == "BILLING"
        assert data["detected_sentiment"] == "high_frustration"
        assert "DOSSIER D'ESCALADE" in data["formatted_markdown"]
        assert "Vérifier la transaction" in data["recommended_action"]


class TestAIToolExecution:
    """Tests for safe AI function calling and data boundaries."""

    def test_gemini_tools_declarations(self):
        tool_names = [tool["name"] for tool in GEMINI_TOOLS]
        expected_tools = [
            "search_courses",
            "search_learning_paths",
            "search_freelance_projects",
            "get_my_learning_progress",
            "get_my_freelance_contracts",
            "get_my_tickets",
            "create_support_ticket",
        ]
        for name in expected_tools:
            assert name in tool_names

        # Verify no tool declaration exposes dangerous actions
        for tool in GEMINI_TOOLS:
            assert "password" not in str(tool).lower()
            assert "secret" not in str(tool).lower()
            assert "token" not in str(tool).lower() or "share" in str(tool).lower()

    def test_support_tool_definitions_typed_conversion(self):
        from app.services.ai_support_service import SUPPORT_TOOL_DEFINITIONS

        assert len(SUPPORT_TOOL_DEFINITIONS) == 7
        for tool_def in SUPPORT_TOOL_DEFINITIONS:
            assert tool_def.name
            assert tool_def.description
            assert tool_def.parameters["type"] == "object"

    @pytest.mark.asyncio
    async def test_private_tools_block_unauthenticated_callers(self):
        # 1. Learning progress
        res_learn = await execute_tool(
            "get_my_learning_progress", {}, current_user=None
        )
        assert res_learn.get("authenticated") is False
        assert "/auth/login" in res_learn.get("message", "")

        # 2. Freelance contracts
        res_freelance = await execute_tool(
            "get_my_freelance_contracts", {}, current_user=None
        )
        assert res_freelance.get("authenticated") is False
        assert "/auth/login" in res_freelance.get("message", "")

        # 3. Support tickets
        res_tickets = await execute_tool("get_my_tickets", {}, current_user=None)
        assert res_tickets.get("authenticated") is False
        assert "/auth/login" in res_tickets.get("message", "")

        # 4. Create ticket
        res_create = await execute_tool(
            "create_support_ticket",
            {"subject": "Test", "category": "GENERAL", "description": "Help"},
            current_user=None,
        )
        assert res_create.get("authenticated") is False
        assert "/auth/login" in res_create.get("message", "")

    @pytest.mark.asyncio
    async def test_search_learning_paths_public_execution(self):
        res = await execute_tool(
            "search_learning_paths", {"query": "web"}, current_user=None
        )
        assert "paths" in res
        assert "count" in res
        assert isinstance(res["paths"], list)

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error(self):
        res = await execute_tool(
            "hack_database", {"sql": "DROP TABLE users"}, current_user=None
        )
        assert "error" in res
        assert "Unknown tool" in res["error"]


class TestTokenAwareContextRetention:
    """Tests for dynamic token-aware sliding window context retention."""

    def test_retains_more_than_six_turns_within_budget(self):
        from app.services.ai_support_service import build_token_aware_contents

        history = [
            {"role": "user", "content": f"Message turn {i}"}
            if i % 2 == 0
            else {"role": "assistant", "content": f"Response turn {i}"}
            for i in range(12)
        ]
        # 12 turns, all short strings (~3 tokens each)
        contents = build_token_aware_contents(
            history, "Current message", max_tokens=1000
        )
        # All 12 turns + 1 current message = 13 items
        assert len(contents) == 13
        assert contents[0]["parts"][0]["text"] == "Message turn 0"
        assert contents[-1]["parts"][0]["text"] == "Current message"

    def test_truncates_oldest_turns_when_budget_exceeded(self):
        from app.services.ai_support_service import build_token_aware_contents

        # Create turns with ~50 tokens each
        history = [
            {"role": "user", "content": f"Turn {i} " + "word " * 30} for i in range(10)
        ]
        # Low token budget that can only fit 2-3 turns plus current message
        contents = build_token_aware_contents(
            history, "Latest user prompt", max_tokens=100
        )
        # Oldest turns should be omitted, latest preserved
        assert len(contents) < len(history) + 1
        assert contents[-1]["parts"][0]["text"] == "Latest user prompt"
        # The first retained turn in contents should be a more recent turn (not Turn 0)
        assert "Turn 0" not in contents[0]["parts"][0]["text"]
