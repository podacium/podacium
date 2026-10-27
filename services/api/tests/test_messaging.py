"""
Unit and Integration Test Suite for Podacium Messaging & Algerian Shield
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from app.services.algerian_shield_service import (
    verify_algerian_rip_checksum,
    verify_ccp_cle,
    normalize_algerian_text,
    inspect_and_mask_disintermediation,
)
from app.services.messaging_service import (
    MessagingService,
)
from app.schemas.messaging import MessageCreate, MessageType, MessageAttachmentCreate


class TestAlgerianShieldService:
    """Test suite for Algerian financial & telecom anti-disintermediation engine."""

    def test_verify_algerian_rip_checksum_valid(self):
        # 00799999 + 10-digit account (e.g., 0012345678) -> computes key
        # Let's test a valid formula: account_part = "007999990012345678"
        account_int = int("007999990012345678")
        remainder = (account_int * 100) % 97
        expected_key = 97 - remainder if remainder != 0 else 97
        rip_str = f"007999990012345678{expected_key:02d}"
        assert verify_algerian_rip_checksum(rip_str) is True

    def test_verify_algerian_rip_checksum_invalid(self):
        assert verify_algerian_rip_checksum("00799999001234567800") is False
        assert verify_algerian_rip_checksum("12345") is False

    def test_verify_ccp_cle_valid(self):
        account = 12345678
        remainder = (account * 100) % 97
        expected_cle = 97 - remainder if remainder != 0 else 97
        assert verify_ccp_cle(str(account), f"{expected_cle:02d}") is True
        assert verify_ccp_cle(str(account), str(expected_cle)) is True

    def test_verify_ccp_cle_single_digit_keys(self):
        # Account 63: (63 * 100) % 97 = 6300 % 97 = 92 -> expected_cle = 97 - 92 = 5
        assert verify_ccp_cle("63", "05") is True
        assert verify_ccp_cle("63", "5") is True
        # 3-digit key with leading zero or wrong keys must be rejected
        assert verify_ccp_cle("63", "005") is False
        assert verify_ccp_cle("63", "50") is False
        assert verify_ccp_cle("63", "06") is False

    def test_verify_ccp_cle_zero_remainder(self):
        # Account 97: (97 * 100) % 97 = 0 -> expected_cle = 97 - 0 = 97
        assert verify_ccp_cle("97", "97") is True
        assert verify_ccp_cle("97", "00") is False
        assert verify_ccp_cle("97", "0") is False

    def test_verify_ccp_cle_leading_zeros_and_formatting(self):
        # Account with leading zeros and punctuation formatting
        assert verify_ccp_cle("0063", "05") is True
        assert verify_ccp_cle("0063", "5") is True
        assert verify_ccp_cle("0012345678", "88") is True
        assert verify_ccp_cle("12 345-678", "88") is True

    def test_verify_ccp_cle_malformed_and_invalid(self):
        assert verify_ccp_cle("63", "") is False
        assert verify_ccp_cle("63", "   ") is False
        assert verify_ccp_cle("63", "abc") is False
        assert verify_ccp_cle("63", "05a") is False
        assert verify_ccp_cle("63", "-5") is False
        assert verify_ccp_cle("63", "+5") is False
        assert verify_ccp_cle("63", "98") is False
        assert verify_ccp_cle("63", "99") is False
        assert verify_ccp_cle("abc", "05") is False
        assert verify_ccp_cle("0", "97") is False
        assert verify_ccp_cle("-63", "05") is False
        assert verify_ccp_cle("", "05") is False

    def test_normalize_algerian_text_arabic_digits(self):
        arabic_text = "اتصل بي على ٠٥٥٠١٢٣٤٥٦"
        normalized = normalize_algerian_text(arabic_text)
        assert "0550123456" in normalized

    def test_mask_algerian_phone_numbers(self):
        text = "Mon numero est le 0550 12 34 56 contacte moi"
        sanitized, flagged, flags = inspect_and_mask_disintermediation(text)
        assert flagged is True
        assert "ALGERIAN_PHONE_NUMBER" in flags
        assert "[NUMÉRO DE TÉLÉPHONE MASQUÉ]" in sanitized
        assert "0550" not in sanitized

    def test_mask_external_channels(self):
        text = "Add me on whatsapp: amine_dev or telegram t.me/amine"
        sanitized, flagged, flags = inspect_and_mask_disintermediation(text)
        assert flagged is True
        assert "OFF_PLATFORM_CHANNEL_LEAK" in flags
        assert "[CANAL EXTERNE MASQUÉ]" in sanitized

    def test_clean_text_passes_unflagged(self):
        text = "Bonjour, j'ai bien finalisé le pipeline SQL pour le dashboard."
        sanitized, flagged, flags = inspect_and_mask_disintermediation(text)
        assert flagged is False
        assert len(flags) == 0
        assert sanitized == text


class TestMessagingService:
    """Test suite for MessagingService core logic."""

    @pytest.mark.asyncio
    async def test_send_message_creates_attachments_with_conversation_id(self):
        from app.schemas.messaging import MessageAttachmentCreate

        mock_conversation = MagicMock()
        mock_conversation.id = 42
        mock_conversation.conversationId = "conv-42"
        mock_conversation.participants = [
            MagicMock(userId=1001),
            MagicMock(userId=1002),
        ]

        mock_message = MagicMock()
        mock_message.id = 99
        mock_message.messageId = "msg-99"
        mock_message.conversationId = 42
        mock_message.senderId = 1001
        mock_message.content = "[Voice Note]"
        mock_message.messageType = "TEXT"
        mock_message.sender = MagicMock(
            id=1001, fullName="User 1", profilePictureUrl=None, role="CLIENT"
        )
        mock_message.attachments = []
        mock_message.reactions = []
        mock_message.readReceipts = []
        mock_message.status = "SENT"
        mock_message.isEdited = False
        mock_message.createdAt = datetime.now(timezone.utc)
        mock_message.replyToId = None
        mock_message.version = 1

        mock_conversation.deletedAt = None
        mock_participant = MagicMock(userId=1001, leftAt=None, mutedUntil=None)

        with (
            patch("app.services.messaging_service.prisma") as mock_prisma,
            patch("app.routers.websocket.manager"),
        ):
            mock_prisma.conversation.find_unique = AsyncMock(
                return_value=mock_conversation
            )
            mock_prisma.conversationparticipant.find_first = AsyncMock(
                return_value=mock_participant
            )
            mock_prisma.message.create = AsyncMock(return_value=mock_message)
            mock_prisma.messageattachment.create = AsyncMock()
            mock_prisma.message.find_unique = AsyncMock(return_value=mock_message)
            mock_prisma.conversation.update = AsyncMock()

            attachment = MessageAttachmentCreate(
                fileName="voice-note.webm",
                fileType="audio/webm",
                fileSize=15000,
                fileUrl="data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAA...",
            )
            msg_create = MessageCreate(content="[Voice Note]", attachments=[attachment])

            result = await MessagingService.send_message("conv-42", msg_create, 1001)

            # Assert messageattachment.create was called with conversationId
            mock_prisma.messageattachment.create.assert_awaited_once()
            call_kwargs = mock_prisma.messageattachment.create.call_args[1]
            assert call_kwargs["data"]["conversationId"] == 42
            assert call_kwargs["data"]["messageId"] == 99
            assert call_kwargs["data"]["fileName"] == "voice-note.webm"
            assert result is not None

    @pytest.mark.asyncio
    async def test_send_message_with_empty_content_and_attachments(self, mocker):
        mock_prisma = mocker.patch("app.services.messaging_service.prisma")
        mocker.patch(
            "app.services.messaging_service.rate_limiter.check_rate_limit",
            return_value=True,
        )
        mocker.patch("app.services.messaging_service.MessageEventPublisher.publish")

        mock_conv = mocker.MagicMock()
        mock_conv.id = 42
        mock_conv.conversationId = "conv-42"
        mock_conv.deletedAt = None

        mock_part = mocker.MagicMock()
        mock_part.userId = 1001
        mock_part.leftAt = None
        mock_part.mutedUntil = None

        mock_created_msg = mocker.MagicMock()
        mock_created_msg.id = 100
        mock_created_msg.messageId = "msg-uuid-100"
        mock_created_msg.conversationId = 42
        mock_created_msg.senderId = 1001
        mock_created_msg.content = ""
        mock_created_msg.messageType = MessageType.TEXT
        mock_created_msg.isEdited = False
        mock_created_msg.createdAt = datetime.now(timezone.utc)
        mock_created_msg.deletedAt = None
        mock_created_msg.status = "SENT"
        mock_created_msg.version = 0
        mock_created_msg.replyToId = None
        mock_created_msg.metadata = None
        mock_created_msg.sender = None
        mock_created_msg.attachments = []
        mock_created_msg.reactions = []
        mock_created_msg.readReceipts = []

        mock_prisma.conversation.find_unique = mocker.AsyncMock(return_value=mock_conv)
        mock_prisma.conversation.update = mocker.AsyncMock()
        mock_prisma.conversationparticipant.find_first = mocker.AsyncMock(
            return_value=mock_part
        )
        mock_prisma.message.create = mocker.AsyncMock(return_value=mock_created_msg)
        mock_prisma.message.find_unique = mocker.AsyncMock(
            return_value=mock_created_msg
        )
        mock_prisma.messageattachment.create = mocker.AsyncMock()

        attachment = MessageAttachmentCreate(
            fileName="screenshot.png",
            fileType="image/png",
            fileSize=10240,
            fileUrl="https://storage.podacium.com/screenshot.png",
        )
        msg_create = MessageCreate(content="", attachments=[attachment])

        result = await MessagingService.send_message("conv-42", msg_create, 1001)

        mock_prisma.message.create.assert_awaited_once()
        create_args = mock_prisma.message.create.call_args[1]
        assert create_args["data"]["content"] == ""
        assert result is not None

        @pytest.mark.asyncio
        async def test_delete_message_for_everyone(self, mocker):
            mock_prisma = mocker.patch("app.services.messaging_service.prisma")
            mocker.patch("app.services.messaging_service.MessageEventPublisher.publish")

            mock_message = mocker.MagicMock()
            mock_message.id = 101
            mock_message.messageId = "msg-101"
            mock_message.senderId = 1001
            mock_message.conversationId = 42
            mock_message.deletedAt = None
            mock_message.conversation = mocker.MagicMock(conversationId="conv-42")

            mock_participant = mocker.MagicMock()
            mock_participant.role = ParticipantRole.MEMBER

            mock_prisma.message.find_unique = mocker.AsyncMock(
                return_value=mock_message
            )
            mock_prisma.conversationparticipant.find_first = mocker.AsyncMock(
                return_value=mock_participant
            )
            mock_prisma.message.update = mocker.AsyncMock()

            result = await MessagingService.delete_message(
                "msg-101", 1001, scope="everyone"
            )
            assert result is True
            mock_prisma.message.update.assert_awaited_once()
            call_kwargs = mock_prisma.message.update.call_args[1]
            assert "deletedAt" in call_kwargs["data"]
            assert call_kwargs["data"]["deletedById"] == 1001

        @pytest.mark.asyncio
        async def test_delete_message_for_me_only(self, mocker):
            mock_prisma = mocker.patch("app.services.messaging_service.prisma")
            mocker.patch("app.services.messaging_service.MessageEventPublisher.publish")

            mock_message = mocker.MagicMock()
            mock_message.id = 102
            mock_message.messageId = "msg-102"
            mock_message.senderId = 1002  # Not sent by 1001
            mock_message.conversationId = 42
            mock_message.deletedAt = None
            mock_message.metadata = {}
            mock_message.conversation = mocker.MagicMock(conversationId="conv-42")

            mock_participant = mocker.MagicMock()
            mock_participant.role = ParticipantRole.MEMBER

            mock_prisma.message.find_unique = mocker.AsyncMock(
                return_value=mock_message
            )
            mock_prisma.conversationparticipant.find_first = mocker.AsyncMock(
                return_value=mock_participant
            )
            mock_prisma.message.update = mocker.AsyncMock()

            result = await MessagingService.delete_message("msg-102", 1001, scope="me")
            assert result is True
            mock_prisma.message.update.assert_awaited_once()
            call_kwargs = mock_prisma.message.update.call_args[1]
            assert "metadata" in call_kwargs["data"]
