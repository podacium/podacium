from app.agent.token_counter import estimate_token_count


def test_token_counter_empty():
    assert estimate_token_count("") == 0
    assert estimate_token_count(None) == 0


def test_token_counter_english():
    text = "The quick brown fox jumps over the lazy dog"
    tokens = estimate_token_count(text)
    # 9 words, ~9-12 tokens
    assert 9 <= tokens <= 15


def test_token_counter_arabic_agglutination():
    # "وبالمؤسسات الوطنية الجزائرية للتعليم العالي والبحث العلمي"
    # 7 whitespace words, but heavily agglutinated prefixes (و-, ب-, ال-, لل-)
    text = "وبالمؤسسات الوطنية الجزائرية للتعليم العالي والبحث العلمي"
    naive_count = len(text.split())  # 7
    tokens = estimate_token_count(text)
    # Should be significantly higher than naive whitespace count
    assert tokens > naive_count * 2
    assert tokens >= 16


def test_token_counter_arabic_diacritics():
    # Fully vocalized text with Tashkeel
    text_plain = "بالمؤسسات التعليمية"
    text_vocalized = "بِالْمُؤَسَّسَاتِ التَّعْلِيمِيَّةِ"
    plain_tokens = estimate_token_count(text_plain)
    vocalized_tokens = estimate_token_count(text_vocalized)
    assert vocalized_tokens > plain_tokens


def test_token_counter_french_elisions():
    # French contractions: l'étudiant, d'affaires, s'est, c'est-à-dire
    text = "L'étudiant d'affaires s'est inscrit à l'évaluation"
    naive_count = len(text.split())  # 6 words
    tokens = estimate_token_count(text)
    assert tokens > naive_count
    assert tokens >= 10


def test_token_counter_arabizi():
    # Darija in Arabizi with numbers
    text = "w l'khdma 3endak ma tnsach tab3athom l'dar"
    tokens = estimate_token_count(text)
    assert tokens >= 12
