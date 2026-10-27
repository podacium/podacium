"""Tests for the content moderation service."""

from app.services.content_moderation_service import (
    contains_profanity,
    moderate_text,
    get_flagged_words,
)


def test_clean_text():
    """Verify that legitimate educational text passes without flagging."""
    clean_texts = [
        "Welcome to the live Python data science masterclass!",
        "Bonjour a tous, bienvenue a cette session de formation.",
        "مرحبا بكم جميعا في هذه الدورة التعليمية",
        "Wassup everyone, how do we solve question 3?",
        "Saha ftourkoum w salam alaykoum",
    ]
    for text in clean_texts:
        assert not contains_profanity(text)
        sanitized, was_flagged = moderate_text(text)
        assert not was_flagged
        assert sanitized == text
        assert get_flagged_words(text) == []


def test_english_profanity_censoring():
    """Verify English profanity is detected and masked."""
    text = "This is fucking awesome"
    assert contains_profanity(text)
    sanitized, was_flagged = moderate_text(text)
    assert was_flagged
    assert "fucking" not in sanitized
    assert "***" in sanitized


def test_french_profanity_censoring():
    """Verify French profanity is detected and masked."""
    text = "C'est de la grosse merde ce code"
    assert contains_profanity(text)
    sanitized, was_flagged = moderate_text(text)
    assert was_flagged
    assert "merde" not in sanitized
    assert "***" in sanitized


def test_arabic_profanity_censoring():
    """Verify Arabic profanity is detected and masked."""
    text = "يا حقير يا سافل"
    assert contains_profanity(text)
    sanitized, was_flagged = moderate_text(text)
    assert was_flagged
    assert "حقير" not in sanitized
    assert "سافل" not in sanitized


def test_darja_arabizi_profanity_censoring():
    """Verify Algerian Darja Arabizi with numeral substitutions is detected."""
    arabizi_texts = [
        "hada wahed el 9ahba",
        "chouf hadak el hmar",
        "roh ya zbi",
    ]
    for text in arabizi_texts:
        assert contains_profanity(text)
        sanitized, was_flagged = moderate_text(text)
        assert was_flagged
        assert "***" in sanitized


def test_empty_or_whitespace_text():
    """Verify empty or None text behaves gracefully."""
    assert not contains_profanity("")
    assert not contains_profanity("   ")
    assert moderate_text("")[0] == ""
    assert not moderate_text("")[1]
