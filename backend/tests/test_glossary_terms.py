"""Tests for /api/glossary/terms endpoint - crypto glossary with FR/EN/ES."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")

EXPECTED_TERMS_EN = {
    "Blockchain", "Bitcoin", "Ethereum", "Wallet", "DeFi", "NFT",
    "Smart Contract", "Staking", "Altcoin", "Halving", "HODL", "Gas",
    "Token", "Stablecoin", "Mining", "Whale", "Bull Market",
    "Bear Market", "ATH", "Liquidation"
}


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _validate_payload(data, lang):
    assert "terms" in data, f"Missing 'terms' field: {data}"
    assert "count" in data, f"Missing 'count' field: {data}"
    assert data["count"] == 20, f"Expected count=20, got {data['count']}"
    assert len(data["terms"]) == 20, f"Expected 20 terms, got {len(data['terms'])}"
    for entry in data["terms"]:
        assert "term" in entry and isinstance(entry["term"], str) and len(entry["term"]) > 0
        assert "definition" in entry and isinstance(entry["definition"], str) and len(entry["definition"]) > 10
        assert "example" in entry and isinstance(entry["example"], str) and len(entry["example"]) > 10


def test_glossary_default_lang_fr(api):
    r = api.get(f"{BASE_URL}/api/glossary/terms")
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_payload(data, "fr")


def test_glossary_lang_fr(api):
    r = api.get(f"{BASE_URL}/api/glossary/terms", params={"lang": "fr"})
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_payload(data, "fr")
    # FR-specific text expected
    btc = next((t for t in data["terms"] if t["term"] == "Bitcoin"), None)
    assert btc is not None, "Bitcoin term missing"
    assert "cryptomonnaie" in btc["definition"].lower() or "premiere" in btc["definition"].lower()


def test_glossary_lang_en(api):
    r = api.get(f"{BASE_URL}/api/glossary/terms", params={"lang": "en"})
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_payload(data, "en")
    terms_set = {t["term"] for t in data["terms"]}
    assert EXPECTED_TERMS_EN.issubset(terms_set), f"Missing English terms: {EXPECTED_TERMS_EN - terms_set}"
    # EN-specific definition check
    btc = next((t for t in data["terms"] if t["term"] == "Bitcoin"), None)
    assert btc is not None
    assert "cryptocurrency" in btc["definition"].lower()


def test_glossary_lang_es(api):
    r = api.get(f"{BASE_URL}/api/glossary/terms", params={"lang": "es"})
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_payload(data, "es")
    # ES-specific term checks: "Mining" maps to "Mineria" in ES, "Whale" -> "Ballena"
    terms_set = {t["term"] for t in data["terms"]}
    assert "Bitcoin" in terms_set
    assert "Mineria" in terms_set or "Mining" in terms_set
    btc = next((t for t in data["terms"] if t["term"] == "Bitcoin"), None)
    assert btc is not None
    assert "criptomoneda" in btc["definition"].lower()


def test_glossary_unknown_lang_fallback(api):
    """Unknown lang should fall back to English."""
    r = api.get(f"{BASE_URL}/api/glossary/terms", params={"lang": "de"})
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_payload(data, "en")
    btc = next((t for t in data["terms"] if t["term"] == "Bitcoin"), None)
    assert btc is not None
    assert "cryptocurrency" in btc["definition"].lower(), "Expected English fallback"
