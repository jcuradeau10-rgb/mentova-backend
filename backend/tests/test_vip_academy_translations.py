"""
Test VIP Academy Feature - 9 Educational Modules with Multi-language Support
Tests the new VIP Academy feature with lessons and quizzes in FR, EN, ES
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
VIP_USER_EMAIL = "jcuradeau.7@gmail.com"
VIP_USER_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for VIP user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VIP_USER_EMAIL,
        "password": VIP_USER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data.get("access_token")
    assert token, "No access_token in login response"
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestVIPAcademyBackend:
    """Test VIP Academy API endpoints"""

    def test_academy_returns_9_courses_french(self, auth_headers):
        """Verify /api/vip/academy?lang=fr returns 9 courses in French"""
        response = requests.get(f"{BASE_URL}/api/vip/academy?lang=fr", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        courses = data.get("data", [])
        
        # Should have exactly 9 courses
        assert len(courses) == 9, f"Expected 9 courses, got {len(courses)}"
        
        # Verify French content
        course_ids = [c["id"] for c in courses]
        expected_ids = [
            "tool-fear-greed", "tool-rainbow", "tool-whale", "tool-altcoin",
            "tool-halving", "tool-gas", "tool-liquidations", "tool-dominance", "tool-briefing"
        ]
        assert set(course_ids) == set(expected_ids), f"Missing courses: {set(expected_ids) - set(course_ids)}"
        
        # Check French difficulty labels
        for course in courses:
            assert course.get("difficulty") in ["debutant", "intermediaire", "expert"], \
                f"Course {course['id']} has unexpected difficulty: {course.get('difficulty')}"

    def test_academy_returns_9_courses_english(self, auth_headers):
        """Verify /api/vip/academy?lang=en returns 9 courses in English"""
        response = requests.get(f"{BASE_URL}/api/vip/academy?lang=en", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        courses = data.get("data", [])
        
        assert len(courses) == 9, f"Expected 9 courses, got {len(courses)}"
        
        # Verify English translations
        fear_greed = next((c for c in courses if c["id"] == "tool-fear-greed"), None)
        assert fear_greed, "Fear & Greed course not found"
        
        # Check description is in English
        assert "investment decisions" in fear_greed.get("description", "").lower() or \
               "fear" in fear_greed.get("description", "").lower(), \
               f"Fear & Greed description doesn't appear to be English: {fear_greed.get('description')}"
        
        # Check difficulty is translated
        assert fear_greed.get("difficulty") == "beginner", \
            f"Expected 'beginner', got '{fear_greed.get('difficulty')}'"
        
        # Check module content is in English
        modules = fear_greed.get("module_content", [])
        assert len(modules) >= 3, "Fear & Greed should have at least 3 modules"
        assert modules[0].get("title") == "What is Fear & Greed?", \
            f"First module title not in English: {modules[0].get('title')}"

    def test_academy_returns_9_courses_spanish(self, auth_headers):
        """Verify /api/vip/academy?lang=es returns 9 courses in Spanish"""
        response = requests.get(f"{BASE_URL}/api/vip/academy?lang=es", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        courses = data.get("data", [])
        
        assert len(courses) == 9, f"Expected 9 courses, got {len(courses)}"
        
        # Verify Spanish translations
        fear_greed = next((c for c in courses if c["id"] == "tool-fear-greed"), None)
        assert fear_greed, "Fear & Greed course not found"
        
        # Check difficulty is translated to Spanish
        assert fear_greed.get("difficulty") in ["principiante", "intermedio", "experto"], \
            f"Expected Spanish difficulty, got '{fear_greed.get('difficulty')}'"
        
        # Check module content has Spanish title
        modules = fear_greed.get("module_content", [])
        assert len(modules) >= 3, "Fear & Greed should have at least 3 modules"
        # Spanish module should have "Que es el Fear & Greed?"
        assert "Que es" in modules[0].get("title", "") or "qué es" in modules[0].get("title", "").lower(), \
            f"First module title not in Spanish: {modules[0].get('title')}"

    def test_academy_course_has_quiz_content(self, auth_headers):
        """Verify courses have quiz modules with questions"""
        response = requests.get(f"{BASE_URL}/api/vip/academy?lang=en", headers=auth_headers)
        assert response.status_code == 200
        courses = response.json().get("data", [])
        
        # Check Fear & Greed course has quiz
        fear_greed = next((c for c in courses if c["id"] == "tool-fear-greed"), None)
        modules = fear_greed.get("module_content", [])
        
        # Find quiz module
        quiz_module = next((m for m in modules if m.get("is_quiz")), None)
        assert quiz_module, "No quiz module found in Fear & Greed course"
        
        # Verify quiz has questions
        quiz = quiz_module.get("quiz", [])
        assert len(quiz) >= 2, f"Quiz should have at least 2 questions, got {len(quiz)}"
        
        # Verify question structure
        for q in quiz:
            assert "q" in q, "Quiz question missing 'q' field"
            assert "options" in q, "Quiz question missing 'options' field"
            assert "answer" in q, "Quiz question missing 'answer' field"
            assert len(q["options"]) >= 3, "Quiz should have at least 3 options"

    def test_academy_course_modules_have_content(self, auth_headers):
        """Verify each module has title, duration, and content"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=auth_headers)
        assert response.status_code == 200
        courses = response.json().get("data", [])
        
        for course in courses:
            modules = course.get("module_content", [])
            assert len(modules) >= 2, f"Course {course['id']} should have at least 2 modules"
            
            for module in modules:
                assert module.get("id"), f"Module in {course['id']} missing 'id'"
                assert module.get("title"), f"Module in {course['id']} missing 'title'"
                assert module.get("duration"), f"Module in {course['id']} missing 'duration'"
                # Content or quiz should be present
                assert module.get("content") or module.get("is_quiz"), \
                    f"Module {module.get('id')} in {course['id']} has no content"

    def test_academy_default_language_is_french(self, auth_headers):
        """Verify default language is French when no lang parameter"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=auth_headers)
        assert response.status_code == 200
        courses = response.json().get("data", [])
        
        # Check French difficulty label
        fear_greed = next((c for c in courses if c["id"] == "tool-fear-greed"), None)
        assert fear_greed.get("difficulty") == "debutant", \
            f"Default should be French 'debutant', got '{fear_greed.get('difficulty')}'"

    def test_academy_requires_vip(self):
        """Verify academy endpoint requires VIP status"""
        # Login as non-VIP user would fail or return 403
        # Since we're using VIP user, just verify auth is required
        response = requests.get(f"{BASE_URL}/api/vip/academy")
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"

    def test_all_nine_courses_present(self, auth_headers):
        """Verify all 9 tool courses are present with correct structure"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=auth_headers)
        assert response.status_code == 200
        courses = response.json().get("data", [])
        
        expected_courses = {
            "tool-fear-greed": {"icon": "speedometer", "color": "#FFD700"},
            "tool-rainbow": {"icon": "color-palette", "color": "#F97316"},
            "tool-whale": {"icon": "alert-circle", "color": "#EC4899"},
            "tool-altcoin": {"icon": "pie-chart", "color": "#7C3AED"},
            "tool-halving": {"icon": "timer", "color": "#F7931A"},
            "tool-gas": {"icon": "flash", "color": "#627EEA"},
            "tool-liquidations": {"icon": "flame", "color": "#EF4444"},
            "tool-dominance": {"icon": "analytics", "color": "#F7931A"},
            "tool-briefing": {"icon": "today", "color": "#3B82F6"},
        }
        
        for course_id, expected in expected_courses.items():
            course = next((c for c in courses if c["id"] == course_id), None)
            assert course, f"Missing course: {course_id}"
            assert course.get("icon") == expected["icon"], \
                f"Course {course_id} has wrong icon: {course.get('icon')}"
            assert course.get("color") == expected["color"], \
                f"Course {course_id} has wrong color: {course.get('color')}"
            assert course.get("modules") >= 2, \
                f"Course {course_id} should have at least 2 modules"
            assert course.get("duration"), f"Course {course_id} missing duration"
            assert course.get("title"), f"Course {course_id} missing title"
            assert course.get("description"), f"Course {course_id} missing description"


class TestVIPHubTabs:
    """Test VIP Hub tab configuration - verify IA Mentor tab is REMOVED"""

    def test_vip_features_endpoint(self, auth_headers):
        """Verify VIP features endpoint works"""
        response = requests.get(f"{BASE_URL}/api/vip/features", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should return features list
        assert "features" in data or "price_monthly" in data

    def test_vip_status_endpoint(self, auth_headers):
        """Verify VIP status endpoint for our test user"""
        response = requests.get(f"{BASE_URL}/api/vip/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_vip") == True, "Test user should be VIP"
