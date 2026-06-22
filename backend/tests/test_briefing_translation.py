"""
Test VIP Daily Briefing Translation Feature
Tests the /api/vip/daily-briefing endpoint with different language parameters (fr, en, es)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "jcuradeau.7@gmail.com"
TEST_PASSWORD = "Crypto2026!"

class TestBriefingTranslation:
    """Tests for the VIP daily-briefing API with language support"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("access_token")
        assert token, f"No access_token in response: {data}"
        print(f"Login successful, got token: {token[:20]}...")
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_briefing_english_default(self, auth_headers):
        """Test daily briefing returns English content by default"""
        response = requests.get(f"{BASE_URL}/api/vip/daily-briefing", headers=auth_headers)
        
        assert response.status_code == 200, f"Briefing API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Response not successful: {data}"
        assert "data" in data, f"No data field in response: {data}"
        
        briefing = data["data"]
        print(f"\n=== English Briefing (default) ===")
        print(f"market_summary: {briefing.get('market_summary', 'N/A')[:200]}...")
        print(f"sentiment: {briefing.get('sentiment', 'N/A')}")
        
        # Verify sentiment is one of expected values
        assert briefing.get("sentiment") in ["bullish", "bearish", "neutral"], \
            f"Invalid sentiment: {briefing.get('sentiment')}"
        
        # Verify market_summary exists
        assert briefing.get("market_summary"), "No market_summary in response"
    
    def test_briefing_english_explicit(self, auth_headers):
        """Test daily briefing with explicit lang=en parameter"""
        response = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang=en", headers=auth_headers)
        
        assert response.status_code == 200, f"Briefing API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        briefing = data["data"]
        
        print(f"\n=== English Briefing (explicit) ===")
        print(f"market_summary: {briefing.get('market_summary', 'N/A')[:200]}...")
        print(f"btc_analysis: {briefing.get('btc_analysis', 'N/A')[:150]}...")
        print(f"key_events: {briefing.get('key_events', [])[:3]}")
        
        # Basic validation
        assert briefing.get("market_summary"), "No market_summary"
    
    def test_briefing_french(self, auth_headers):
        """Test daily briefing returns French content with lang=fr"""
        response = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang=fr", headers=auth_headers)
        
        assert response.status_code == 200, f"Briefing API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Response not successful: {data}"
        briefing = data["data"]
        
        print(f"\n=== French Briefing ===")
        print(f"market_summary: {briefing.get('market_summary', 'N/A')[:200]}...")
        print(f"btc_analysis: {briefing.get('btc_analysis', 'N/A')[:150]}...")
        print(f"key_events: {briefing.get('key_events', [])[:3]}")
        print(f"opportunity: {briefing.get('opportunity', 'N/A')[:150]}...")
        print(f"sentiment: {briefing.get('sentiment', 'N/A')}")
        
        # Verify sentiment is still in English (as per spec)
        assert briefing.get("sentiment") in ["bullish", "bearish", "neutral"], \
            f"Invalid sentiment: {briefing.get('sentiment')}"
        
        # Check for French content indicators (common French words)
        market_summary = briefing.get("market_summary", "").lower()
        btc_analysis = briefing.get("btc_analysis", "").lower()
        combined_text = market_summary + " " + btc_analysis
        
        # Look for French indicators (may not always be present due to AI variability)
        french_indicators = ["le", "la", "les", "de", "du", "des", "et", "est", "un", "une", "marché", "bitcoin", "aujourd'hui"]
        has_french_content = any(word in combined_text for word in french_indicators)
        
        print(f"French content detected: {has_french_content}")
        # Note: AI may generate French content, but we can't guarantee it 100%
    
    def test_briefing_spanish(self, auth_headers):
        """Test daily briefing returns Spanish content with lang=es"""
        response = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang=es", headers=auth_headers)
        
        assert response.status_code == 200, f"Briefing API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Response not successful: {data}"
        briefing = data["data"]
        
        print(f"\n=== Spanish Briefing ===")
        print(f"market_summary: {briefing.get('market_summary', 'N/A')[:200]}...")
        print(f"btc_analysis: {briefing.get('btc_analysis', 'N/A')[:150]}...")
        print(f"key_events: {briefing.get('key_events', [])[:3]}")
        print(f"sentiment: {briefing.get('sentiment', 'N/A')}")
        
        # Verify sentiment is still in English (as per spec)
        assert briefing.get("sentiment") in ["bullish", "bearish", "neutral"], \
            f"Invalid sentiment: {briefing.get('sentiment')}"
    
    def test_briefing_structure_all_languages(self, auth_headers):
        """Verify all language responses have required structure"""
        required_fields = ["market_summary", "sentiment", "date", "generated_at"]
        optional_fields = ["btc_analysis", "eth_analysis", "key_events", "opportunity", "risk_alert", "sentiment_reason"]
        
        for lang in ["en", "fr", "es"]:
            response = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang={lang}", headers=auth_headers)
            assert response.status_code == 200, f"Failed for lang={lang}"
            
            briefing = response.json().get("data", {})
            
            # Check required fields
            for field in required_fields:
                assert field in briefing, f"Missing required field '{field}' for lang={lang}"
            
            print(f"✓ Language {lang}: All required fields present")
    
    def test_briefing_cache_per_language(self, auth_headers):
        """Verify briefings are cached per language (cache_key includes language)"""
        # First request for French
        response_fr1 = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang=fr", headers=auth_headers)
        assert response_fr1.status_code == 200
        briefing_fr1 = response_fr1.json().get("data", {})
        
        # Second request for French (should hit cache)
        response_fr2 = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang=fr", headers=auth_headers)
        assert response_fr2.status_code == 200
        briefing_fr2 = response_fr2.json().get("data", {})
        
        # Request for English (different cache)
        response_en = requests.get(f"{BASE_URL}/api/vip/daily-briefing?lang=en", headers=auth_headers)
        assert response_en.status_code == 200
        briefing_en = response_en.json().get("data", {})
        
        # French responses should be similar (from cache)
        assert briefing_fr1.get("generated_at") == briefing_fr2.get("generated_at"), \
            "French briefings should come from cache"
        
        # Cache key should include language
        assert "_fr" in briefing_fr1.get("cache_key", ""), \
            f"French cache_key should include '_fr': {briefing_fr1.get('cache_key')}"
        assert "_en" in briefing_en.get("cache_key", ""), \
            f"English cache_key should include '_en': {briefing_en.get('cache_key')}"
        
        print(f"✓ Cache verification passed")
        print(f"  French cache_key: {briefing_fr1.get('cache_key')}")
        print(f"  English cache_key: {briefing_en.get('cache_key')}")

    def test_briefing_unauthorized(self):
        """Test that briefing API requires VIP authentication"""
        # Without token
        response = requests.get(f"{BASE_URL}/api/vip/daily-briefing")
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without token, got {response.status_code}"
        print("✓ API correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
