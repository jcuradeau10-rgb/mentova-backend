"""Tests for Atlas AI language parameter handling (P0 bug fix verification).

Validates that:
- /api/atlas/chat/simple respects lang=en|fr|es
- /api/atlas/chat/simple defaults to English when no lang given
- /api/atlas/chat streaming respects lang
- /api/atlas/teach/chat respects lang
- /api/atlas/teach/chat defaults to English when no lang given
"""
import os
import re
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")
TIMEOUT = 60


# Strong language fingerprints
FRENCH_WORDS = re.compile(r"\b(le|la|les|une?|du|des|est|sont|c'est|monnaie|crypto-monnaie|décentralisé|réseau|réseaux|numérique|qui|pour|dans|sur|avec|cette?|ces|aux?|par)\b", re.IGNORECASE)
ENGLISH_WORDS = re.compile(r"\b(the|is|are|a|an|of|in|on|with|that|this|which|cryptocurrency|digital|network|decentralized|currency|by|and|to|for)\b", re.IGNORECASE)
SPANISH_WORDS = re.compile(r"\b(el|la|los|las|un|una|es|son|del|que|para|por|con|este?|esta|esos?|esas?|criptomoneda|moneda|red|digital|descentralizada?|y|o|en)\b", re.IGNORECASE)


def _lang_scores(text: str):
    t = text or ""
    return {
        "fr": len(FRENCH_WORDS.findall(t)),
        "en": len(ENGLISH_WORDS.findall(t)),
        "es": len(SPANISH_WORDS.findall(t)),
    }


def _detect(text: str) -> str:
    s = _lang_scores(text)
    return max(s, key=s.get)


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _post_simple(session, payload):
    sid = f"TEST_{uuid.uuid4().hex[:8]}"
    payload = {"session_id": sid, **payload}
    r = session.post(f"{BASE_URL}/api/atlas/chat/simple", json=payload, timeout=TIMEOUT)
    return r


# ============ /api/atlas/chat/simple ============

class TestAtlasChatSimple:
    def test_simple_english(self, session):
        r = _post_simple(session, {"message": "What is Bitcoin?", "lang": "en"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "response" in data and data["response"]
        text = data["response"]
        scores = _lang_scores(text)
        print(f"\nEN response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["en"] > scores["fr"], f"Expected English, got fr-heavy text: {text[:200]}"
        assert scores["en"] > scores["es"], f"Expected English, got es-heavy text: {text[:200]}"

    def test_simple_french(self, session):
        r = _post_simple(session, {"message": "What is Bitcoin?", "lang": "fr"})
        assert r.status_code == 200, r.text
        data = r.json()
        text = data["response"]
        scores = _lang_scores(text)
        print(f"\nFR response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["fr"] > scores["en"], f"Expected French, got en-heavy text: {text[:200]}"

    def test_simple_spanish(self, session):
        r = _post_simple(session, {"message": "What is Bitcoin?", "lang": "es"})
        assert r.status_code == 200, r.text
        data = r.json()
        text = data["response"]
        scores = _lang_scores(text)
        print(f"\nES response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["es"] > scores["fr"], f"Expected Spanish, got fr-heavy text: {text[:200]}"
        assert scores["es"] > scores["en"], f"Expected Spanish, got en-heavy text: {text[:200]}"

    def test_simple_default_is_english(self, session):
        # No lang field at all - should default to English per ChatMessage model (lang='en')
        r = _post_simple(session, {"message": "What is Bitcoin?"})
        assert r.status_code == 200, r.text
        text = r.json()["response"]
        scores = _lang_scores(text)
        print(f"\nDEFAULT response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["en"] >= scores["fr"], f"Expected English default, got fr-heavy: {text[:200]}"


# ============ /api/atlas/chat (streaming) ============

class TestAtlasChatStreaming:
    def test_chat_streaming_english(self, session):
        sid = f"TEST_{uuid.uuid4().hex[:8]}"
        with session.post(
            f"{BASE_URL}/api/atlas/chat",
            json={"message": "What is Bitcoin?", "lang": "en", "session_id": sid},
            stream=True,
            timeout=TIMEOUT,
        ) as r:
            assert r.status_code == 200, r.text
            chunks = []
            for raw in r.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                if raw.startswith("data: "):
                    payload = raw[len("data: "):]
                    if payload == "[DONE]":
                        break
                    chunks.append(payload)
            text = "".join(chunks)
            assert text.strip(), "Got empty streamed response"
            scores = _lang_scores(text)
            print(f"\nSTREAM EN response (first 200): {text[:200]}")
            print(f"Scores: {scores}")
            assert scores["en"] > scores["fr"], f"Expected English stream, got fr-heavy: {text[:200]}"


# ============ /api/atlas/teach/chat ============

class TestTeachChat:
    def test_teach_chat_english(self, session):
        r = session.post(
            f"{BASE_URL}/api/atlas/teach/chat",
            json={
                "chapter_id": "what-is-crypto",
                "level_id": "beginner",
                "message": "explain this",
                "lang": "en",
                "session_id": f"TEST_{uuid.uuid4().hex[:8]}",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        text = r.json()["response"]
        scores = _lang_scores(text)
        print(f"\nTEACH EN response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["en"] > scores["fr"], f"Expected English in teach/chat, got fr-heavy: {text[:200]}"

    def test_teach_chat_default_is_english(self, session):
        r = session.post(
            f"{BASE_URL}/api/atlas/teach/chat",
            json={
                "chapter_id": "what-is-crypto",
                "level_id": "beginner",
                "message": "explain this",
                "session_id": f"TEST_{uuid.uuid4().hex[:8]}",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        text = r.json()["response"]
        scores = _lang_scores(text)
        print(f"\nTEACH DEFAULT response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["en"] >= scores["fr"], f"Expected English default in teach/chat, got fr-heavy: {text[:200]}"

    def test_teach_chat_french(self, session):
        r = session.post(
            f"{BASE_URL}/api/atlas/teach/chat",
            json={
                "chapter_id": "what-is-crypto",
                "level_id": "beginner",
                "message": "explain this",
                "lang": "fr",
                "session_id": f"TEST_{uuid.uuid4().hex[:8]}",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        text = r.json()["response"]
        scores = _lang_scores(text)
        print(f"\nTEACH FR response (first 200): {text[:200]}")
        print(f"Scores: {scores}")
        assert scores["fr"] > scores["en"], f"Expected French in teach/chat, got en-heavy: {text[:200]}"
