from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.user = MagicMock()
    db.resume = MagicMock()
    db.resumeanalysis = MagicMock()
    db.jobdescription = MagicMock()
    db.jdmatchresult = MagicMock()
    db.batchjob = MagicMock()
    db.coachingsession = MagicMock()
    return db


@pytest.fixture
def sample_user():
    user = MagicMock()
    user.id = "user-123"
    user.email = "test@example.com"
    user.fullName = "Test User"
    user.password = "$2b$12$hashedpassword"
    user.createdAt = "2024-01-01T00:00:00Z"
    return user


@pytest.fixture
def sample_resume():
    resume = MagicMock()
    resume.id = "resume-123"
    resume.userId = "user-123"
    resume.fileName = "test_resume.pdf"
    resume.fileType = "pdf"
    resume.fileSize = 102400
    resume.fileHash = "abc123hash"
    resume.status = "ANALYZED"
    resume.createdAt = "2024-01-01T00:00:00Z"
    resume.analysis = None
    return resume


@pytest.fixture
def sample_analysis():
    analysis = MagicMock()
    analysis.id = "analysis-123"
    analysis.resumeId = "resume-123"
    analysis.atsScore = 78
    analysis.atsBreakdown = {
        "keywords": 80, "format": 75, "sections": 90, "contact": 100, "length": 70,
        "suggestions": ["Add more keywords", "Improve formatting"]
    }
    analysis.entitiesJson = {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1-555-0100",
        "skills": [{"raw": "Python", "normalized": "Python", "confidence": 1.0}],
        "experience": [],
        "education": [],
        "certifications": [],
        "projects": [],
    }
    analysis.biasFlagsJson = []
    analysis.fraudFlagsJson = []
    analysis.createdAt = "2024-01-01T00:00:00Z"
    return analysis


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self):
        from app.main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestAuthEndpoints:
    @pytest.mark.asyncio
    async def test_register_success(self, mock_db, sample_user):
        from app.api.deps import get_db
        from app.main import app

        mock_db.user.find_unique = AsyncMock(return_value=None)
        mock_db.user.create = AsyncMock(return_value=sample_user)

        app.dependency_overrides[get_db] = lambda: mock_db

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/register",
                json={"email": "test@example.com", "password": "SecurePass123!", "fullName": "Test User"},
            )

        app.dependency_overrides.clear()
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, mock_db, sample_user):
        from app.api.deps import get_db
        from app.main import app

        mock_db.user.find_unique = AsyncMock(return_value=sample_user)

        app.dependency_overrides[get_db] = lambda: mock_db

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/register",
                json={"email": "test@example.com", "password": "SecurePass123!", "fullName": "Test User"},
            )

        app.dependency_overrides.clear()
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, mock_db):
        from app.api.deps import get_db
        from app.main import app

        mock_db.user.find_unique = AsyncMock(return_value=None)

        app.dependency_overrides[get_db] = lambda: mock_db

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": "nobody@example.com", "password": "wrongpass"},
            )

        app.dependency_overrides.clear()
        assert response.status_code == 401


class TestResumeEndpoints:
    def _auth_headers(self, user_id: str = "user-123") -> dict:
        from app.core.security import create_access_token
        token = create_access_token(user_id)
        return {"Authorization": f"Bearer {token}"}

    @pytest.mark.asyncio
    async def test_list_resumes_requires_auth(self, mock_db):
        from app.api.deps import get_db
        from app.main import app
        app.dependency_overrides[get_db] = lambda: mock_db
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/resumes/")
        app.dependency_overrides.clear()
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_resumes_returns_list(self, mock_db, sample_user, sample_resume):
        from app.api.deps import get_current_user, get_db
        from app.main import app

        mock_db.resume.find_many = AsyncMock(return_value=[sample_resume])
        mock_db.resume.count = AsyncMock(return_value=1)

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: sample_user

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/resumes/", headers=self._auth_headers())

        app.dependency_overrides.clear()
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    @pytest.mark.asyncio
    async def test_get_resume_not_found(self, mock_db, sample_user):
        from app.api.deps import get_current_user, get_db
        from app.main import app

        mock_db.resume.find_unique = AsyncMock(return_value=None)

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: sample_user

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/v1/resumes/nonexistent-id",
                headers=self._auth_headers(),
            )

        app.dependency_overrides.clear()
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_resume_wrong_user(self, mock_db, sample_user, sample_resume):
        from app.api.deps import get_current_user, get_db
        from app.main import app

        sample_resume.userId = "other-user-456"
        mock_db.resume.find_unique = AsyncMock(return_value=sample_resume)

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: sample_user

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/v1/resumes/resume-123",
                headers=self._auth_headers(),
            )

        app.dependency_overrides.clear()
        assert response.status_code == 404


class TestJDEndpoints:
    def _auth_headers(self, user_id: str = "user-123") -> dict:
        from app.core.security import create_access_token
        token = create_access_token(user_id)
        return {"Authorization": f"Bearer {token}"}

    @pytest.mark.asyncio
    async def test_create_jd(self, mock_db, sample_user):
        from app.api.deps import get_current_user, get_db
        from app.main import app

        jd = MagicMock()
        jd.id = "jd-123"
        jd.userId = "user-123"
        jd.title = "Senior Python Engineer"
        jd.company = "Acme Corp"
        jd.rawText = "We are looking for a Python engineer..."
        jd.embeddingVector = [0.1] * 384
        jd.createdAt = "2024-01-01T00:00:00Z"

        mock_db.jobdescription.create = AsyncMock(return_value=jd)

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: sample_user

        with patch("app.ml.analysis.jd_matcher.JDMatcher") as MockMatcher:
            instance = MockMatcher.return_value
            instance.embed.return_value = [0.1] * 384

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post(
                    "/api/v1/jds/",
                    json={
                        "title": "Senior Python Engineer",
                        "company": "Acme Corp",
                        "raw_text": "We are looking for a Python engineer with 5+ years experience.",
                    },
                    headers=self._auth_headers(),
                )

        app.dependency_overrides.clear()
        assert response.status_code == 201
