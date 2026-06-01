import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db
from app.main import app
from prisma import Prisma

# Test Database URL (using a different db for testing to prevent wiping local dev)
os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL_TEST", "postgresql://postgres:apple@localhost:5432/resume_analyzer_test")

@pytest.fixture(scope="session")
async def test_db():
    db = Prisma(auto_register=True)
    await db.connect()
    
    # Simple truncate to ensure clean state
    await db.execute_raw('TRUNCATE TABLE "User" CASCADE;')
    
    yield db
    await db.disconnect()

@pytest.fixture
async def mock_user(test_db):
    user = await test_db.user.create(
        data={
            "email": "test@example.com",
            "password": "hashed_password",
            "fullName": "Test User"
        }
    )
    yield user
    await test_db.user.delete(where={"id": user.id})

@pytest.fixture
async def async_client(test_db, mock_user):
    # Override dependencies
    async def override_get_db():
        yield test_db

    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
