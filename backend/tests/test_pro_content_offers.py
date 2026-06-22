"""
Test: Pro Content Library and Offers APIs (Flexibilité Totale)
Tests for content-library CRUD and offers CRUD operations
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')).rstrip('/')

# Test user credentials (must be professional/VIP)
TEST_EMAIL = "admin@cryptonai.com"
TEST_PASSWORD = "Admin123!"

# Store test IDs for cleanup
test_content_ids = []
test_offer_ids = []


class TestProContentLibrary:
    """Tests for /api/pro/content-library endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = response.json()["user"]
        print(f"Logged in as: {self.user['email']} (VIP: {self.user.get('is_vip')}, Pro: {self.user.get('is_professional')})")
    
    def test_01_get_content_library(self):
        """GET /api/pro/content-library - List content"""
        response = requests.get(f"{BASE_URL}/api/pro/content-library", headers=self.headers)
        print(f"GET content-library: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"Found {len(data['data'])} existing content items")
    
    def test_02_create_pdf_content(self):
        """POST /api/pro/content-library - Create PDF content"""
        payload = {
            "content_type": "pdf",
            "title": "TEST_Guide Trading Crypto",
            "description": "Un guide complet pour débuter en trading",
            "file_url": "https://example.com/guide.pdf",
            "tags": ["trading", "débutant", "crypto"],
            "is_premium": True
        }
        response = requests.post(f"{BASE_URL}/api/pro/content-library", json=payload, headers=self.headers)
        print(f"POST content-library (PDF): {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        content = data["data"]
        assert content["title"] == payload["title"]
        assert content["content_type"] == "pdf"
        assert content["is_premium"] == True
        assert "id" in content
        test_content_ids.append(content["id"])
        print(f"Created PDF content with ID: {content['id']}")
    
    def test_03_create_quiz_content(self):
        """POST /api/pro/content-library - Create quiz content with questions"""
        payload = {
            "content_type": "quiz",
            "title": "TEST_Quiz Bitcoin Basics",
            "description": "Testez vos connaissances sur Bitcoin",
            "content_data": {
                "questions": [
                    {
                        "question": "Qui a créé Bitcoin?",
                        "options": ["Vitalik Buterin", "Satoshi Nakamoto", "Elon Musk", "Charlie Lee"],
                        "correct_answer": 1
                    },
                    {
                        "question": "En quelle année Bitcoin a-t-il été lancé?",
                        "options": ["2005", "2009", "2013", "2017"],
                        "correct_answer": 1
                    }
                ]
            },
            "tags": ["quiz", "bitcoin", "éducation"],
            "is_premium": False
        }
        response = requests.post(f"{BASE_URL}/api/pro/content-library", json=payload, headers=self.headers)
        print(f"POST content-library (Quiz): {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        content = data["data"]
        assert content["content_type"] == "quiz"
        assert "content_data" in content
        assert "questions" in content["content_data"]
        assert len(content["content_data"]["questions"]) == 2
        test_content_ids.append(content["id"])
        print(f"Created Quiz content with ID: {content['id']}")
    
    def test_04_create_video_content(self):
        """POST /api/pro/content-library - Create video content"""
        payload = {
            "content_type": "video",
            "title": "TEST_Analyse Technique - Les Bases",
            "description": "Apprenez les bases de l'analyse technique",
            "video_url": "https://youtube.com/watch?v=example123",
            "duration_minutes": 45,
            "tags": ["vidéo", "analyse", "trading"],
            "is_premium": True
        }
        response = requests.post(f"{BASE_URL}/api/pro/content-library", json=payload, headers=self.headers)
        print(f"POST content-library (Video): {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        content = data["data"]
        assert content["content_type"] == "video"
        assert content["duration_minutes"] == 45
        test_content_ids.append(content["id"])
        print(f"Created Video content with ID: {content['id']}")
    
    def test_05_get_content_item(self):
        """GET /api/pro/content-library/{id} - Get specific content"""
        if not test_content_ids:
            pytest.skip("No content created yet")
        
        content_id = test_content_ids[0]
        response = requests.get(f"{BASE_URL}/api/pro/content-library/{content_id}", headers=self.headers)
        print(f"GET content-library/{content_id}: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data["data"]["id"] == content_id
    
    def test_06_update_content_item(self):
        """PUT /api/pro/content-library/{id} - Update content"""
        if not test_content_ids:
            pytest.skip("No content created yet")
        
        content_id = test_content_ids[0]
        payload = {
            "title": "TEST_Guide Trading Crypto - UPDATED",
            "description": "Un guide mis à jour",
            "is_premium": False
        }
        response = requests.put(f"{BASE_URL}/api/pro/content-library/{content_id}", json=payload, headers=self.headers)
        print(f"PUT content-library/{content_id}: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/pro/content-library/{content_id}", headers=self.headers)
        verify_data = verify_response.json()
        assert verify_data["data"]["title"] == payload["title"]
        assert verify_data["data"]["is_premium"] == False
        print("Content updated and verified successfully")


class TestProOffers:
    """Tests for /api/pro/offers endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_get_offers_list(self):
        """GET /api/pro/offers - List offers"""
        response = requests.get(f"{BASE_URL}/api/pro/offers", headers=self.headers)
        print(f"GET pro/offers: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"Found {len(data['data'])} existing offers")
    
    def test_02_create_bundle_offer(self):
        """POST /api/pro/offers - Create bundle offer"""
        payload = {
            "offer_type": "bundle",
            "title": "TEST_Pack Complet Trading",
            "description": "Un pack complet pour apprendre le trading crypto",
            "short_description": "Tout ce qu'il faut pour trader!",
            "price": 99.99,
            "pricing_model": "one_time",
            "included_content_ids": test_content_ids[:2] if len(test_content_ids) >= 2 else [],
            "category": "trading",
            "difficulty": "beginner",
            "tags": ["pack", "trading", "complet"],
            "is_published": False
        }
        response = requests.post(f"{BASE_URL}/api/pro/offers", json=payload, headers=self.headers)
        print(f"POST pro/offers (bundle): {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        offer = data["data"]
        assert offer["title"] == payload["title"]
        assert offer["offer_type"] == "bundle"
        assert offer["price"] == 99.99
        assert offer["is_published"] == False
        test_offer_ids.append(offer["id"])
        print(f"Created bundle offer with ID: {offer['id']}")
    
    def test_03_create_subscription_offer(self):
        """POST /api/pro/offers - Create subscription offer"""
        payload = {
            "offer_type": "subscription",
            "title": "TEST_Abonnement Premium",
            "description": "Accès mensuel à tout le contenu premium",
            "price": 29.99,
            "pricing_model": "subscription",
            "subscription_interval": "monthly",
            "access_duration_days": 30,
            "tags": ["abonnement", "premium"],
            "is_published": False
        }
        response = requests.post(f"{BASE_URL}/api/pro/offers", json=payload, headers=self.headers)
        print(f"POST pro/offers (subscription): {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        offer = data["data"]
        assert offer["offer_type"] == "subscription"
        assert offer["pricing_model"] == "subscription"
        assert offer["subscription_interval"] == "monthly"
        test_offer_ids.append(offer["id"])
        print(f"Created subscription offer with ID: {offer['id']}")
    
    def test_04_get_offer_detail(self):
        """GET /api/pro/offers/{id} - Get offer details"""
        if not test_offer_ids:
            pytest.skip("No offers created yet")
        
        offer_id = test_offer_ids[0]
        response = requests.get(f"{BASE_URL}/api/pro/offers/{offer_id}", headers=self.headers)
        print(f"GET pro/offers/{offer_id}: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data["data"]["id"] == offer_id
    
    def test_05_update_offer(self):
        """PUT /api/pro/offers/{id} - Update offer"""
        if not test_offer_ids:
            pytest.skip("No offers created yet")
        
        offer_id = test_offer_ids[0]
        payload = {
            "title": "TEST_Pack Complet Trading - UPDATED",
            "price": 79.99,
            "difficulty": "intermediate"
        }
        response = requests.put(f"{BASE_URL}/api/pro/offers/{offer_id}", json=payload, headers=self.headers)
        print(f"PUT pro/offers/{offer_id}: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/pro/offers/{offer_id}", headers=self.headers)
        verify_data = verify_response.json()
        assert verify_data["data"]["title"] == payload["title"]
        assert verify_data["data"]["price"] == 79.99
        print("Offer updated and verified successfully")
    
    def test_06_publish_offer(self):
        """PUT /api/pro/offers/{id}/publish - Publish offer"""
        if not test_offer_ids:
            pytest.skip("No offers created yet")
        
        offer_id = test_offer_ids[0]
        response = requests.put(f"{BASE_URL}/api/pro/offers/{offer_id}/publish", headers=self.headers)
        print(f"PUT pro/offers/{offer_id}/publish: {response.status_code} - {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("is_published") == True
        print("Offer published successfully")
    
    def test_07_get_marketplace_offers(self):
        """GET /api/marketplace/offers - Public marketplace list"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        print(f"GET marketplace/offers: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"Found {len(data['data'])} published offers in marketplace")
    
    def test_08_unpublish_offer(self):
        """PUT /api/pro/offers/{id}/publish - Toggle to unpublish"""
        if not test_offer_ids:
            pytest.skip("No offers created yet")
        
        offer_id = test_offer_ids[0]
        response = requests.put(f"{BASE_URL}/api/pro/offers/{offer_id}/publish", headers=self.headers)
        print(f"PUT pro/offers/{offer_id}/publish (toggle off): {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("is_published") == False
        print("Offer unpublished successfully")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_99_cleanup_offers(self):
        """DELETE /api/pro/offers/{id} - Clean up test offers"""
        for offer_id in test_offer_ids:
            response = requests.delete(f"{BASE_URL}/api/pro/offers/{offer_id}", headers=self.headers)
            print(f"DELETE offer {offer_id}: {response.status_code}")
            # Accept 200 or 404 (already deleted)
            assert response.status_code in [200, 404]
        print(f"Cleaned up {len(test_offer_ids)} offers")
    
    def test_99_cleanup_content(self):
        """DELETE /api/pro/content-library/{id} - Clean up test content"""
        for content_id in test_content_ids:
            response = requests.delete(f"{BASE_URL}/api/pro/content-library/{content_id}", headers=self.headers)
            print(f"DELETE content {content_id}: {response.status_code}")
            # Accept 200 or 404 (already deleted)
            assert response.status_code in [200, 404]
        print(f"Cleaned up {len(test_content_ids)} content items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
