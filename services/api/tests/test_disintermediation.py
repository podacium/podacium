"""
Unit tests for Phonetic Darja, Arabizi, and Disintermediation Contact Filter.
"""

from app.services.content_moderation_service import (
    detect_disintermediation,
    mask_disintermediation,
)


def test_detect_direct_algerian_phone():
    detected, reasons = detect_disintermediation("Contacte moi sur 0550123456 svp")
    assert detected is True
    assert "phone_number" in reasons


def test_detect_obfuscated_algerian_phone():
    detected, reasons = detect_disintermediation("appel moi sur 0 6.55-12 34 56")
    assert detected is True
    assert "phone_number" in reasons


def test_detect_baridimob_rip():
    detected, reasons = detect_disintermediation(
        "Voici mon RIP 00799999001234567890 envoie l'argent"
    )
    assert detected is True
    assert "algerian_rip" in reasons


def test_detect_external_channels():
    detected, reasons = detect_disintermediation(
        "Viens sur whatsapp +213550123456 ou t.me/superdev"
    )
    assert detected is True
    assert "external_social_channel" in reasons


def test_detect_phonetic_darja():
    detected, reasons = detect_disintermediation(
        "numéro diali sefra khamsa khamsa ouahed..."
    )
    assert detected is True
    assert "phonetic_phone_number" in reasons


def test_mask_disintermediation():
    text = "Mon tel c'est 0770112233 et mon whatsapp: dev_pro"
    masked, was_modified = mask_disintermediation(text)
    assert was_modified is True
    assert "0770112233" not in masked
    assert "[NUMÉRO MASQUÉ]" in masked
