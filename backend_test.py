#!/usr/bin/env python3
"""
CryptoNAi Backend API Testing Suite
Tests all backend endpoints for the crypto education platform
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BASE_URL = "https://academy-preview-11.preview.emergentagent.com/api"

class CryptoNAiTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.jwt_token = None
        self.test_user = {
            "email": "tester@cryptonai.com",
            "password": "test123456", 
            "name": "Test User"
        }
        self.results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_auth_register(self):
        """Test user registration"""
        try:
            response = self.session.post(
                f"{self.base_url}/auth/register",
                json=self.test_user,
                timeout=10
            )
            
            if response.status_code == 201 or response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.jwt_token = data["access_token"]
                    self.log_result("User Registration", True, "Registration successful, JWT token received")
                    return True
                else:
                    self.log_result("User Registration", False, "Missing token or user in response", data)
                    return False
            elif response.status_code == 400:
                # User might already exist, try login instead
                return self.test_auth_login()
            else:
                self.log_result("User Registration", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Request failed: {str(e)}")
            return False
    
    def test_auth_login(self):
        """Test user login"""
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json={"email": self.test_user["email"], "password": self.test_user["password"]},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.jwt_token = data["access_token"]
                    self.log_result("User Login", True, "Login successful, JWT token received")
                    return True
                else:
                    self.log_result("User Login", False, "Missing token or user in response", data)
                    return False
            else:
                self.log_result("User Login", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User Login", False, f"Request failed: {str(e)}")
            return False
    
    def test_auth_me(self):
        """Test get current user with JWT token"""
        if not self.jwt_token:
            self.log_result("Get Current User", False, "No JWT token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            response = self.session.get(
                f"{self.base_url}/auth/me",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data and "name" in data:
                    self.log_result("Get Current User", True, "User data retrieved successfully")
                    return True
                else:
                    self.log_result("Get Current User", False, "Missing user fields in response", data)
                    return False
            else:
                self.log_result("Get Current User", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Current User", False, f"Request failed: {str(e)}")
            return False
    
    def test_crypto_prices(self):
        """Test crypto prices API"""
        try:
            response = self.session.get(f"{self.base_url}/crypto/prices", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "data" in data and isinstance(data["data"], list):
                    if len(data["data"]) > 0:
                        self.log_result("Crypto Prices", True, f"Retrieved {len(data['data'])} crypto prices")
                        return True
                    else:
                        self.log_result("Crypto Prices", False, "No crypto data returned", data)
                        return False
                else:
                    self.log_result("Crypto Prices", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Crypto Prices", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Crypto Prices", False, f"Request failed: {str(e)}")
            return False
    
    def test_crypto_trending(self):
        """Test trending cryptos API"""
        try:
            response = self.session.get(f"{self.base_url}/crypto/trending", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "data" in data:
                    self.log_result("Trending Cryptos", True, "Trending cryptos retrieved successfully")
                    return True
                else:
                    self.log_result("Trending Cryptos", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Trending Cryptos", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Trending Cryptos", False, f"Request failed: {str(e)}")
            return False
    
    def test_crypto_global(self):
        """Test global market stats API"""
        try:
            response = self.session.get(f"{self.base_url}/crypto/global", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "data" in data:
                    self.log_result("Global Market Stats", True, "Global market stats retrieved successfully")
                    return True
                else:
                    self.log_result("Global Market Stats", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Global Market Stats", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Global Market Stats", False, f"Request failed: {str(e)}")
            return False
    
    def test_education_modules(self):
        """Test education modules API"""
        try:
            response = self.session.get(f"{self.base_url}/education/modules", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "data" in data and isinstance(data["data"], list):
                    if len(data["data"]) > 0:
                        self.log_result("Education Modules", True, f"Retrieved {len(data['data'])} education modules")
                        return True
                    else:
                        self.log_result("Education Modules", False, "No modules returned", data)
                        return False
                else:
                    self.log_result("Education Modules", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Education Modules", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Education Modules", False, f"Request failed: {str(e)}")
            return False
    
    def test_education_module_detail(self):
        """Test specific module detail API"""
        try:
            response = self.session.get(f"{self.base_url}/education/modules/intro-crypto", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "data" in data:
                    module = data["data"]
                    if "id" in module and "title" in module and "lessons" in module:
                        self.log_result("Module Detail", True, "Module detail retrieved successfully")
                        return True
                    else:
                        self.log_result("Module Detail", False, "Missing module fields", data)
                        return False
                else:
                    self.log_result("Module Detail", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Module Detail", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Module Detail", False, f"Request failed: {str(e)}")
            return False
    
    def test_progress_get(self):
        """Test get user progress (requires auth)"""
        if not self.jwt_token:
            self.log_result("Get Progress", False, "No JWT token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            response = self.session.get(
                f"{self.base_url}/progress",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "progress" in data:
                    self.log_result("Get Progress", True, "User progress retrieved successfully")
                    return True
                else:
                    self.log_result("Get Progress", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Get Progress", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Progress", False, f"Request failed: {str(e)}")
            return False
    
    def test_progress_update(self):
        """Test update user progress (requires auth)"""
        if not self.jwt_token:
            self.log_result("Update Progress", False, "No JWT token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            progress_data = {
                "module_id": "intro-crypto",
                "completed": True,
                "score": 85
            }
            response = self.session.post(
                f"{self.base_url}/progress/update",
                headers=headers,
                json=progress_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "progress" in data:
                    self.log_result("Update Progress", True, "Progress updated successfully")
                    return True
                else:
                    self.log_result("Update Progress", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Update Progress", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Update Progress", False, f"Request failed: {str(e)}")
            return False
    
    def test_ai_assistant(self):
        """Test AI assistant API"""
        try:
            ai_query = {
                "query": "What is Bitcoin?",
                "context": "general"
            }
            response = self.session.post(
                f"{self.base_url}/ai/ask",
                json=ai_query,
                timeout=30  # AI requests can take longer
            )
            
            if response.status_code == 200:
                data = response.json()
                if "response" in data and data["response"]:
                    self.log_result("AI Assistant", True, "AI response generated successfully")
                    return True
                else:
                    self.log_result("AI Assistant", False, "Empty or invalid AI response", data)
                    return False
            else:
                self.log_result("AI Assistant", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("AI Assistant", False, f"Request failed: {str(e)}")
            return False
    
    def test_investment_checklist(self):
        """Test investment checklist API"""
        try:
            response = self.session.get(f"{self.base_url}/tools/checklist", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "data" in data and isinstance(data["data"], list):
                    if len(data["data"]) > 0:
                        self.log_result("Investment Checklist", True, f"Retrieved {len(data['data'])} checklist items")
                        return True
                    else:
                        self.log_result("Investment Checklist", False, "No checklist items returned", data)
                        return False
                else:
                    self.log_result("Investment Checklist", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Investment Checklist", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Investment Checklist", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print(f"🚀 Starting CryptoNAi Backend API Tests")
        print(f"📡 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests (required for other tests)
        auth_success = self.test_auth_register()
        if not auth_success:
            auth_success = self.test_auth_login()
        
        if auth_success:
            self.test_auth_me()
        
        # Crypto market tests
        self.test_crypto_prices()
        self.test_crypto_trending()
        self.test_crypto_global()
        
        # Education tests
        self.test_education_modules()
        self.test_education_module_detail()
        
        # Progress tests (require auth)
        if auth_success:
            self.test_progress_get()
            self.test_progress_update()
        
        # AI and tools tests
        self.test_ai_assistant()
        self.test_investment_checklist()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        return self.results

if __name__ == "__main__":
    tester = CryptoNAiTester()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    failed_count = sum(1 for r in results if not r["success"])
    sys.exit(failed_count)