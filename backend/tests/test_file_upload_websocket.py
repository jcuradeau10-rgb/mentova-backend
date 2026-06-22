"""
Test file upload endpoint and WebSocket availability for CryptoNai P1 features.
Tests:
1. Backend health check - GET /api/health
2. Login - POST /api/auth/login with admin credentials
3. File upload API - POST /api/pro/upload-file with PDF file
4. Uploaded file accessibility - GET returned URL
5. File upload validation - reject invalid extensions (.exe)
6. File upload auth - require authentication
7. Content creation with file_url
8. WebSocket endpoint availability
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_check(self):
        """Test GET /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert "status" in data, "Health response missing 'status' field"
        print(f"Health check passed: {data}")
    
    def test_login_admin(self):
        """Test login with admin credentials returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, f"Response missing 'access_token': {data.keys()}"
        assert "user" in data, "Response missing 'user' field"
        assert data["user"]["is_professional"] == True, "Admin user should be professional"
        print(f"Login successful, user: {data['user']['email']}, is_professional: {data['user']['is_professional']}")
        return data["access_token"]


class TestFileUpload:
    """File upload endpoint tests - POST /api/pro/upload-file"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_file_upload_requires_auth(self):
        """Test that file upload requires authentication (401 without token)"""
        # Create a small fake PDF file
        pdf_content = b'%PDF-1.4 fake pdf content'
        files = {'file': ('test.pdf', io.BytesIO(pdf_content), 'application/pdf')}
        
        response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"File upload without auth correctly returned: {response.status_code}")
    
    def test_file_upload_success(self, auth_token):
        """Test successful PDF file upload"""
        # Create a small fake PDF file
        pdf_content = b'%PDF-1.4 This is test PDF content for upload testing'
        files = {'file': ('test_document.pdf', io.BytesIO(pdf_content), 'application/pdf')}
        headers = {'Authorization': f'Bearer {auth_token}'}
        
        response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files, headers=headers)
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got: {data}"
        assert "url" in data, f"Response missing 'url': {data}"
        assert data["url"].startswith("/api/uploads/"), f"URL should start with /api/uploads/: {data['url']}"
        
        print(f"File upload successful: {data}")
        return data["url"]
    
    def test_uploaded_file_accessible(self, auth_token):
        """Test that uploaded file can be retrieved via GET"""
        # First upload a file
        pdf_content = b'%PDF-1.4 Test PDF for accessibility check'
        files = {'file': ('accessibility_test.pdf', io.BytesIO(pdf_content), 'application/pdf')}
        headers = {'Authorization': f'Bearer {auth_token}'}
        
        upload_response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files, headers=headers)
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        file_url = upload_response.json()["url"]
        
        # Now GET the uploaded file
        get_response = requests.get(f"{BASE_URL}{file_url}")
        assert get_response.status_code == 200, f"Failed to GET uploaded file: {get_response.status_code}"
        assert len(get_response.content) > 0, "Retrieved file has no content"
        
        print(f"Uploaded file accessible at {file_url}, size: {len(get_response.content)} bytes")
    
    def test_file_upload_invalid_extension_rejected(self, auth_token):
        """Test that .exe files are rejected with 400"""
        exe_content = b'MZ fake exe content'
        files = {'file': ('malware.exe', io.BytesIO(exe_content), 'application/x-executable')}
        headers = {'Authorization': f'Bearer {auth_token}'}
        
        response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files, headers=headers)
        assert response.status_code == 400, f"Expected 400 for .exe, got: {response.status_code}"
        
        print(f"Invalid extension correctly rejected: {response.status_code} - {response.text}")
    
    def test_file_upload_various_allowed_types(self, auth_token):
        """Test upload of various allowed file types"""
        headers = {'Authorization': f'Bearer {auth_token}'}
        
        allowed_types = [
            ('test.doc', b'DOC content', 'application/msword'),
            ('test.docx', b'DOCX content', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
            ('test.txt', b'Plain text content', 'text/plain'),
            ('test.mp3', b'MP3 audio content', 'audio/mpeg'),
            ('test.jpg', b'JPEG image fake', 'image/jpeg'),
        ]
        
        for filename, content, mimetype in allowed_types:
            files = {'file': (filename, io.BytesIO(content), mimetype)}
            response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files, headers=headers)
            assert response.status_code == 200, f"Upload of {filename} failed: {response.status_code} - {response.text}"
            print(f"Successfully uploaded {filename}")


class TestContentWithFileUrl:
    """Test content creation with file_url field"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_create_content_with_file_url(self, auth_token):
        """Test creating content with file_url pointing to uploaded file"""
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
        
        # First upload a file
        pdf_content = b'%PDF-1.4 Content library PDF test'
        files = {'file': ('library_content.pdf', io.BytesIO(pdf_content), 'application/pdf')}
        upload_headers = {'Authorization': f'Bearer {auth_token}'}
        
        upload_response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files, headers=upload_headers)
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        file_url = upload_response.json()["url"]
        
        # Create content with file_url
        content_data = {
            "content_type": "pdf",
            "title": "TEST_Content_With_File_URL",
            "description": "Test content created with uploaded file",
            "file_url": file_url,
            "tags": ["test", "pdf"],
            "is_premium": False
        }
        
        create_response = requests.post(f"{BASE_URL}/api/pro/content-library", json=content_data, headers=headers)
        assert create_response.status_code in [200, 201], f"Content creation failed: {create_response.status_code} - {create_response.text}"
        
        data = create_response.json()
        content_id = data.get("data", {}).get("id") or data.get("id")
        assert content_id, f"No content ID in response: {data}"
        
        print(f"Content created with file_url: {content_id}, file: {file_url}")
        
        # Cleanup - delete the test content
        delete_response = requests.delete(f"{BASE_URL}/api/pro/content-library/{content_id}", headers=headers)
        print(f"Cleanup - deleted content: {delete_response.status_code}")


class TestWebSocketAvailability:
    """Test WebSocket/Socket.IO endpoint availability"""
    
    def test_socketio_endpoint_exists(self):
        """Test that socket.io endpoint responds (even if not establishing full WebSocket)"""
        # Socket.IO responds to GET /socket.io/ with specific response
        response = requests.get(f"{BASE_URL}/socket.io/", params={"EIO": "4", "transport": "polling"})
        
        # Socket.IO should return 200 with a session id or similar
        # It may return 400 if parameters are wrong, but endpoint should exist
        assert response.status_code in [200, 400], f"Socket.IO endpoint check failed: {response.status_code}"
        
        print(f"Socket.IO endpoint responded: {response.status_code}")
        if response.status_code == 200:
            print(f"Socket.IO response: {response.text[:200]}...")
    
    def test_socketio_polling_transport(self):
        """Test socket.io with polling transport"""
        # This tests that the socket.io server is mounted
        response = requests.get(
            f"{BASE_URL}/socket.io/",
            params={
                "EIO": "4",
                "transport": "polling"
            },
            timeout=10
        )
        
        # Socket.IO server should respond with some data
        print(f"Socket.IO polling response status: {response.status_code}")
        print(f"Socket.IO polling response (first 300 chars): {response.text[:300]}")
        
        # The key test is that it doesn't return 404
        assert response.status_code != 404, "Socket.IO endpoint not found (404)"


class TestAPIStaticFiles:
    """Test static file serving under /api/uploads"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_uploads_directory_accessible(self, auth_token):
        """Test that /api/uploads/ path is working"""
        # Upload a file first
        headers = {'Authorization': f'Bearer {auth_token}'}
        pdf_content = b'%PDF-1.4 Static file test'
        files = {'file': ('static_test.pdf', io.BytesIO(pdf_content), 'application/pdf')}
        
        upload_response = requests.post(f"{BASE_URL}/api/pro/upload-file", files=files, headers=headers)
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        file_url = upload_response.json()["url"]
        
        # Verify URL format
        assert file_url.startswith("/api/uploads/"), f"URL should start with /api/uploads/: {file_url}"
        
        # GET the file
        get_response = requests.get(f"{BASE_URL}{file_url}")
        assert get_response.status_code == 200, f"Static file not accessible: {get_response.status_code}"
        
        print(f"Static file accessible at {BASE_URL}{file_url}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
