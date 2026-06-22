"""
Test Professional Course Management APIs
Tests: Courses, Modules, Lessons, Quizzes CRUD operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"

# Test data IDs (from main agent context)
TEST_COURSE_ID = "a84496de-1c3e-45ee-869c-a0fa1f7c3da3"
TEST_MODULE_ID = "29328656-25b2-4383-8ffe-894ca569a88f"

class TestAuthAndCourses:
    """Test authentication and course management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def get_auth_token(self):
        """Get authentication token for admin user"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            # API returns access_token directly, not nested in data
            if data.get("access_token"):
                return data["access_token"]
        return None
    
    def test_01_login_admin(self):
        """Test admin login works"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        print(f"Login response status: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # API returns access_token and user directly
        assert "access_token" in data, f"No access_token in response: {data}"
        assert "user" in data
        
        user = data["user"]
        print(f"Logged in user: {user.get('email')}, is_professional: {user.get('is_professional')}")
        assert user.get("is_professional") == True, "Admin user should be professional"
        
        self.token = data["access_token"]
        print("Login test PASSED")
    
    def test_02_get_courses_unauthorized(self):
        """Test courses endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/pro/courses")
        # Can be 401 or 403 depending on implementation
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthorized access test PASSED")
    
    def test_03_get_courses_authorized(self):
        """Test GET /api/pro/courses with auth"""
        token = self.get_auth_token()
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/pro/courses")
        
        print(f"GET courses response: {response.status_code}")
        assert response.status_code == 200, f"GET courses failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        print(f"Found {len(data['data'])} courses")
        for course in data["data"]:
            print(f"  - {course.get('title')} (id: {course.get('id')}, published: {course.get('is_published')})")
        
        print("GET courses test PASSED")
    
    def test_04_create_course(self):
        """Test POST /api/pro/courses - create new course"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        course_data = {
            "title": "TEST_Automated Testing Course",
            "description": "A course created by automated testing",
            "price": 29.99,
            "category": "trading",
            "difficulty": "beginner",
            "is_published": False
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/courses",
            json=course_data
        )
        
        print(f"Create course response: {response.status_code}")
        assert response.status_code == 200, f"Create course failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        
        created_course = data["data"]
        assert created_course.get("title") == course_data["title"]
        assert created_course.get("price") == course_data["price"]
        assert "id" in created_course
        
        # Store for cleanup
        self.__class__.created_course_id = created_course["id"]
        print(f"Created course ID: {created_course['id']}")
        print("Create course test PASSED")
    
    def test_05_get_course_detail(self):
        """Test GET /api/pro/courses/{id} - get course with modules"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Use the test course ID if we have it
        course_id = getattr(self.__class__, 'created_course_id', TEST_COURSE_ID)
        
        response = self.session.get(f"{BASE_URL}/api/pro/courses/{course_id}")
        
        print(f"Get course detail response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            course = data.get("data", {})
            print(f"Course: {course.get('title')}")
            print(f"Modules: {len(course.get('modules', []))}")
            print("Get course detail test PASSED")
        else:
            # Course might not exist yet
            print(f"Course {course_id} not found (this is OK if testing with new course)")
            assert response.status_code in [200, 404]
    
    def test_06_create_module(self):
        """Test POST /api/pro/courses/{course_id}/modules"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        course_id = getattr(self.__class__, 'created_course_id', TEST_COURSE_ID)
        
        module_data = {
            "title": "TEST_Module 1",
            "description": "First test module",
            "order": 1
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/courses/{course_id}/modules",
            json=module_data
        )
        
        print(f"Create module response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            module = data.get("data", {})
            assert "id" in module
            self.__class__.created_module_id = module["id"]
            print(f"Created module ID: {module['id']}")
            print("Create module test PASSED")
        elif response.status_code == 404:
            print("Course not found - skipping module creation")
            pytest.skip("Course not found for module creation")
        else:
            assert False, f"Create module failed: {response.text}"
    
    def test_07_create_lesson(self):
        """Test POST /api/pro/modules/{module_id}/lessons"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        module_id = getattr(self.__class__, 'created_module_id', TEST_MODULE_ID)
        
        lesson_data = {
            "title": "TEST_Lesson 1: Introduction",
            "content": "This is the lesson content for introduction",
            "video_url": "https://youtube.com/watch?v=test123",
            "duration_minutes": 15,
            "order": 1
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/modules/{module_id}/lessons",
            json=lesson_data
        )
        
        print(f"Create lesson response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            lesson = data.get("data", {})
            assert "id" in lesson
            self.__class__.created_lesson_id = lesson["id"]
            print(f"Created lesson ID: {lesson['id']}")
            print("Create lesson test PASSED")
        elif response.status_code == 404:
            print("Module not found - skipping lesson creation")
            pytest.skip("Module not found for lesson creation")
        else:
            assert False, f"Create lesson failed: {response.text}"
    
    def test_08_create_quiz(self):
        """Test POST /api/pro/modules/{module_id}/quiz"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        module_id = getattr(self.__class__, 'created_module_id', TEST_MODULE_ID)
        
        quiz_data = {
            "title": "TEST_Module Quiz",
            "passing_score": 70,
            "questions": [
                {
                    "question": "What is Bitcoin?",
                    "options": ["Cryptocurrency", "Stock", "Bond", "Commodity"],
                    "correct_answer": 0,
                    "explanation": "Bitcoin is the first cryptocurrency"
                },
                {
                    "question": "What does DeFi stand for?",
                    "options": ["Digital Finance", "Decentralized Finance", "Defined Finance", "Default Finance"],
                    "correct_answer": 1,
                    "explanation": "DeFi stands for Decentralized Finance"
                }
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/modules/{module_id}/quiz",
            json=quiz_data
        )
        
        print(f"Create quiz response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            quiz = data.get("data", {})
            assert "id" in quiz
            print(f"Created quiz ID: {quiz['id']}")
            print(f"Quiz has {len(quiz.get('questions', []))} questions")
            print("Create quiz test PASSED")
        elif response.status_code == 404:
            print("Module not found - skipping quiz creation")
            pytest.skip("Module not found for quiz creation")
        else:
            assert False, f"Create quiz failed: {response.text}"
    
    def test_09_update_course(self):
        """Test PUT /api/pro/courses/{course_id}"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        course_id = getattr(self.__class__, 'created_course_id', None)
        if not course_id:
            pytest.skip("No course created to update")
        
        update_data = {
            "title": "TEST_Updated Course Title",
            "description": "Updated description",
            "price": 39.99,
            "category": "defi",
            "difficulty": "intermediate",
            "is_published": True
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/pro/courses/{course_id}",
            json=update_data
        )
        
        print(f"Update course response: {response.status_code}")
        assert response.status_code == 200, f"Update course failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("Update course test PASSED")
    
    def test_10_delete_quiz(self):
        """Test DELETE /api/pro/modules/{module_id}/quiz"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        module_id = getattr(self.__class__, 'created_module_id', None)
        if not module_id:
            pytest.skip("No module created to delete quiz from")
        
        response = self.session.delete(f"{BASE_URL}/api/pro/modules/{module_id}/quiz")
        
        print(f"Delete quiz response: {response.status_code}")
        # Either success or quiz doesn't exist
        assert response.status_code in [200, 404], f"Delete quiz failed: {response.text}"
        print("Delete quiz test PASSED")
    
    def test_11_delete_lesson(self):
        """Test DELETE /api/pro/lessons/{lesson_id}"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        lesson_id = getattr(self.__class__, 'created_lesson_id', None)
        if not lesson_id:
            pytest.skip("No lesson created to delete")
        
        response = self.session.delete(f"{BASE_URL}/api/pro/lessons/{lesson_id}")
        
        print(f"Delete lesson response: {response.status_code}")
        assert response.status_code in [200, 404], f"Delete lesson failed: {response.text}"
        print("Delete lesson test PASSED")
    
    def test_12_delete_module(self):
        """Test DELETE /api/pro/modules/{module_id}"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        module_id = getattr(self.__class__, 'created_module_id', None)
        if not module_id:
            pytest.skip("No module created to delete")
        
        response = self.session.delete(f"{BASE_URL}/api/pro/modules/{module_id}")
        
        print(f"Delete module response: {response.status_code}")
        assert response.status_code in [200, 404], f"Delete module failed: {response.text}"
        print("Delete module test PASSED")
    
    def test_13_delete_course_cleanup(self):
        """Test DELETE /api/pro/courses/{course_id} - cleanup"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        course_id = getattr(self.__class__, 'created_course_id', None)
        if not course_id:
            pytest.skip("No course created to delete")
        
        response = self.session.delete(f"{BASE_URL}/api/pro/courses/{course_id}")
        
        print(f"Delete course response: {response.status_code}")
        assert response.status_code in [200, 404], f"Delete course failed: {response.text}"
        print("Delete course (cleanup) test PASSED")


class TestVideoSessions:
    """Test video session management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self):
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("access_token"):
                return data["access_token"]
        return None
    
    def test_01_get_video_sessions(self):
        """Test GET /api/pro/video-sessions"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/pro/video-sessions")
        
        print(f"Get video sessions response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"Found {len(data.get('data', []))} video sessions")
        print("Get video sessions test PASSED")
    
    def test_02_create_video_session(self):
        """Test POST /api/pro/video-sessions"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        session_data = {
            "title": "TEST_1-on-1 Trading Session",
            "description": "Personal trading mentorship session",
            "session_type": "one_on_one",
            "price": 99.0,
            "duration_minutes": 60,
            "max_participants": 1,
            "is_active": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/video-sessions",
            json=session_data
        )
        
        print(f"Create video session response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            created = data.get("data", {})
            self.__class__.created_session_id = created.get("id")
            print(f"Created video session ID: {created.get('id')}")
            print("Create video session test PASSED")
        else:
            print(f"Create video session response: {response.text}")
            assert response.status_code == 200


class TestDocuments:
    """Test document management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self):
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("access_token"):
                return data["access_token"]
        return None
    
    def test_01_get_documents(self):
        """Test GET /api/pro/documents"""
        token = self.get_auth_token()
        assert token is not None
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/pro/documents")
        
        print(f"Get documents response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"Found {len(data.get('data', []))} documents")
        print("Get documents test PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
