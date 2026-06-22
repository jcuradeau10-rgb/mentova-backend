"""
Test VIP Academy Courses - Advanced Courses with Module Content and Progress Tracking
Tests: GET /api/vip/academy, POST /api/vip/academy/{course_id}/progress
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_VIP_EMAIL = "admin@cryptonai.com"
ADMIN_VIP_PASSWORD = "Admin123!"
VIP_USER_EMAIL = "jcuradeau.7@gmail.com"
VIP_USER_PASSWORD = "Crypto2026!"

class TestVIPAcademyAuth:
    """Test authentication for VIP Academy endpoints"""
    
    def test_login_admin_vip(self):
        """Login with admin VIP user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_VIP_EMAIL,
            "password": ADMIN_VIP_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"PASS: Admin login successful, is_vip={data['user'].get('is_vip')}")
        return data["access_token"]
    
    def test_login_vip_user(self):
        """Login with VIP user credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"PASS: VIP user login successful, is_vip={data['user'].get('is_vip')}, role={data['user'].get('role')}")
        return data["access_token"]


class TestVIPAcademyCourses:
    """Test GET /api/vip/academy - Advanced courses listing"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for VIP user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_academy_requires_auth(self):
        """Academy endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/academy")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Academy endpoint requires authentication")
    
    def test_get_academy_courses(self, auth_token):
        """Get list of advanced courses"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=headers)
        assert response.status_code == 200, f"Failed to get courses: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        courses = data["data"]
        assert isinstance(courses, list)
        assert len(courses) >= 5, f"Expected at least 5 courses, got {len(courses)}"
        print(f"PASS: Got {len(courses)} courses from academy")
        
        # Verify course structure
        for course in courses:
            assert "id" in course
            assert "title" in course
            assert "description" in course
            assert "modules" in course
            assert "duration" in course
            assert "difficulty" in course
            assert "module_content" in course
            assert "progress_percent" in course
            
        print("PASS: All courses have required fields including module_content")
    
    def test_course_has_module_content(self, auth_token):
        """Verify each course has module_content array with detailed content"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        
        for course in courses:
            module_content = course.get("module_content", [])
            assert isinstance(module_content, list), f"Course {course['id']} has invalid module_content"
            assert len(module_content) > 0, f"Course {course['id']} has empty module_content"
            
            # Verify module structure
            for module in module_content:
                assert "id" in module, f"Module missing 'id' in course {course['id']}"
                assert "title" in module, f"Module missing 'title' in course {course['id']}"
                assert "duration" in module, f"Module missing 'duration' in course {course['id']}"
                assert "content" in module, f"Module missing 'content' in course {course['id']}"
                
            print(f"PASS: Course '{course['title']}' has {len(module_content)} modules with content")
    
    def test_course_difficulty_levels(self, auth_token):
        """Verify courses have different difficulty levels"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        difficulties = set(c.get("difficulty", "") for c in courses)
        
        # Should have at least 2 different difficulty levels
        assert len(difficulties) >= 2, f"Expected multiple difficulty levels, got {difficulties}"
        print(f"PASS: Courses have multiple difficulty levels: {difficulties}")


class TestVIPCourseProgress:
    """Test POST /api/vip/academy/{course_id}/progress - Update course progress"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for VIP user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_progress_requires_auth(self):
        """Progress endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/vip/academy/course-1/progress",
            params={"progress_percent": 25}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Progress endpoint requires authentication")
    
    def test_update_course_progress(self, auth_token):
        """Update progress for a course"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        course_id = "course-1"  # Analyse Technique Avancée
        
        # Update progress
        response = requests.post(
            f"{BASE_URL}/api/vip/academy/{course_id}/progress",
            params={"progress_percent": 25},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update progress: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"PASS: Updated progress for {course_id} to 25%")
    
    def test_progress_persists_in_course_list(self, auth_token):
        """Verify progress is reflected when getting courses"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        course_id = "course-2"  # DeFi Mastery
        
        # First update progress
        requests.post(
            f"{BASE_URL}/api/vip/academy/{course_id}/progress",
            params={"progress_percent": 50},
            headers=headers
        )
        
        # Now get courses and verify progress
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        course = next((c for c in courses if c["id"] == course_id), None)
        
        assert course is not None, f"Course {course_id} not found"
        assert course["progress_percent"] >= 50, f"Progress not updated: {course['progress_percent']}"
        assert course["started"] == True, "Course should be marked as started"
        print(f"PASS: Progress persisted - Course {course_id} at {course['progress_percent']}%")
    
    def test_complete_course_100_percent(self, auth_token):
        """Complete a course (100% progress)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        course_id = "course-4"  # Analyse On-Chain
        
        # Update to 100%
        response = requests.post(
            f"{BASE_URL}/api/vip/academy/{course_id}/progress",
            params={"progress_percent": 100},
            headers=headers
        )
        assert response.status_code == 200
        
        # Verify completion
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=headers)
        courses = response.json()["data"]
        course = next((c for c in courses if c["id"] == course_id), None)
        
        assert course["completed"] == True, "Course should be marked as completed"
        print(f"PASS: Course {course_id} marked as completed at 100%")
    
    def test_module_by_module_progress(self, auth_token):
        """Test incremental module-by-module progress"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        course_id = "course-3"  # Trading Algorithmique (15 modules)
        
        # Get course info first
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=headers)
        courses = response.json()["data"]
        course = next((c for c in courses if c["id"] == course_id), None)
        
        # Calculate progress per module
        total_modules = course["modules"]
        progress_per_module = 100 / total_modules
        
        # Complete first module
        new_progress = round(progress_per_module)
        response = requests.post(
            f"{BASE_URL}/api/vip/academy/{course_id}/progress",
            params={"progress_percent": new_progress},
            headers=headers
        )
        assert response.status_code == 200
        print(f"PASS: Updated progress to {new_progress}% (1/{total_modules} modules)")


class TestVIPLandingPage:
    """Test VIP Features endpoint for landing page"""
    
    def test_get_vip_features_public(self):
        """VIP features endpoint should be accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/vip/features")
        assert response.status_code == 200, f"Failed to get VIP features: {response.text}"
        
        data = response.json()
        assert "features" in data
        assert "price_monthly" in data
        assert data["price_monthly"] == 6.99
        
        features = data["features"]
        assert len(features) >= 6, f"Expected at least 6 features, got {len(features)}"
        print(f"PASS: Got {len(features)} VIP features, price=${data['price_monthly']}/month")
    
    def test_vip_status_authenticated(self):
        """VIP status endpoint requires auth"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        token = login_response.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/vip/status", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "is_vip" in data
        assert "days_remaining" in data or data["is_vip"] == False
        print(f"PASS: VIP status check - is_vip={data['is_vip']}")


class TestVIPHubTabNavigation:
    """Test VIP Hub tabs work properly"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for VIP user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_tools_endpoint(self, auth_token):
        """Test crypto tools endpoint for Tools tab"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=headers)
        assert response.status_code == 200, f"Tools endpoint failed: {response.text}"
        print("PASS: Tools tab endpoint works")
    
    def test_alerts_endpoint(self, auth_token):
        """Test alerts endpoint for Alerts tab"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/alerts", headers=headers)
        assert response.status_code == 200, f"Alerts endpoint failed: {response.text}"
        print("PASS: Alerts tab endpoint works")
    
    def test_wallet_endpoint(self, auth_token):
        """Test wallet endpoint for Wallet tab"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/wallet", headers=headers)
        assert response.status_code == 200, f"Wallet endpoint failed: {response.text}"
        print("PASS: Wallet tab endpoint works")
    
    def test_achievements_endpoint(self, auth_token):
        """Test achievements endpoint for Achievements tab"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/achievements", headers=headers)
        assert response.status_code == 200, f"Achievements endpoint failed: {response.text}"
        print("PASS: Achievements tab endpoint works")
    
    def test_social_feed_endpoint(self, auth_token):
        """Test social feed endpoint for Social tab"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/social/feed", headers=headers)
        assert response.status_code == 200, f"Social feed endpoint failed: {response.text}"
        print("PASS: Social feed tab endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
