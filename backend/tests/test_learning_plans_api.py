import json

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_learning_plan_static_fallback(async_client: AsyncClient, test_db, mock_user, monkeypatch):
    # Setup test data
    resume = await test_db.resume.create(data={
        "userId": mock_user.id,
        "fileName": "test.pdf",
        "filePath": "/test/path.pdf",
        "fileType": "application/pdf",
        "fileSize": 1024,
        "fileHash": "test_hash"
    })
    
    jd = await test_db.jobdescription.create(data={
        "userId": mock_user.id,
        "title": "Software Engineer",
        "rawText": "Test JD",
        "embeddingVector": []
    })
    
    # Create MatchResult
    await test_db.jdmatchresult.create(data={
        "resumeId": resume.id,
        "jobDescriptionId": jd.id,
        "matchScore": 80.0,
        "matchedSkills": json.dumps(["Python"]),
        "gapSkills": json.dumps(["React"]),
    })

    # Mock CareerCoach to throw exception
    class MockCoach:
        async def chat(self, *args, **kwargs):
            raise Exception("LLM Failed")

    monkeypatch.setattr("app.api.v1.routes.learning_plans.CareerCoach", MockCoach)

    response = await async_client.post("/api/v1/learning-plans/generate", json={
        "resume_id": resume.id,
        "job_description_id": jd.id
    })
    
    assert response.status_code == 200
    plan = response.json()
    assert plan["title"] == "Learning Plan for Software Engineer"
    
    # Fallback should be generated
    plan_json = plan["planJson"]
    assert len(plan_json) == 1
    assert plan_json[0]["skill"] == "React"
    assert plan_json[0]["action"] == "Online course"
