import json
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.db.repositories.jd_repo import MatchRepository
from app.ml.llm.coach import CareerCoach
from app.ml.llm.prompts import SKILL_GAP_PROMPT
from prisma import Json, Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/learning-plans", tags=["learning-plans"])

class GeneratePlanRequest(BaseModel):
    resume_id: str
    job_description_id: str

def get_static_fallback_plan(gap_skills: list[str]) -> list[dict[str, Any]]:
    """Return a rich deterministic static plan if LLM fails."""
    plan = []
    for skill in gap_skills:
        plan.append({
            "skill": skill,
            "importance": "High",
            "action": "Online course",
            "resource": f"Search for '{skill}' on Coursera or Udemy",
            "time_estimate": "2-4 weeks",
            "project_idea": f"Build a small project that uses {skill} to solve a real-world problem."
        })
    return plan

@router.post("/generate")
async def generate_learning_plan(
    req: GeneratePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Ownership checks
    resume = await db.resume.find_first(
        where={"id": req.resume_id, "userId": current_user.id}
    )
    if not resume:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Resume not found")

    jd = await db.jobdescription.find_first(
        where={"id": req.job_description_id, "userId": current_user.id}
    )
    if not jd:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job description not found")

    # Load match result for gap_skills
    match_repo = MatchRepository(db)
    match_result = await match_repo.get(req.resume_id, req.job_description_id)
    
    if not match_result:
        # If no match result exists, we could theoretically compute it here,
        # but the Matching Studio should be run first normally.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Please run match analysis first")

    # The DB stores Json, so parse if needed
    try:
        gap_skills_data = match_result.gapSkills
        if isinstance(gap_skills_data, str):
            gap_skills = json.loads(gap_skills_data)
        else:
            gap_skills = gap_skills_data
    except Exception:
        gap_skills = []

    if not isinstance(gap_skills, list) or not gap_skills:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No gap skills found to create a plan for")

    # Generate title
    title = f"Learning Plan for {jd.title}"

    # Generate plan with LLM
    try:
        coach = CareerCoach()
        prompt = SKILL_GAP_PROMPT.format(gap_skills=", ".join(gap_skills))
        
        # Request response as JSON
        llm_response = await coach.chat(
            session_messages=[],
            user_message=prompt,
            resume_entities={},
        )
        
        # Try to parse the LLM output as JSON array
        # Look for [ ] bounds
        start_idx = llm_response.find("[")
        end_idx = llm_response.rfind("]")
        
        if start_idx != -1 and end_idx != -1:
            json_str = llm_response[start_idx:end_idx+1]
            plan_data = json.loads(json_str)
            if not isinstance(plan_data, list):
                raise ValueError("LLM response is not a JSON array")
        else:
            raise ValueError("No JSON array bounds found in response")
            
    except Exception as e:
        logger.error("learning_plan_generation_failed", error=str(e), user_id=current_user.id)
        # On failure persist a rich deterministic static plan
        plan_data = get_static_fallback_plan(gap_skills)

    # Persist the LearningPlan
    learning_plan = await db.learningplan.create(
        data={
            "userId": current_user.id,
            "resumeId": req.resume_id,
            "jobDescriptionId": req.job_description_id,
            "title": title,
            "planJson": Json(plan_data)
        }
    )

    return learning_plan

@router.get("")
async def list_learning_plans(
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    plans = await db.learningplan.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"}
    )
    return plans

@router.get("/{plan_id}")
async def get_learning_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    plan = await db.learningplan.find_first(
        where={"id": plan_id, "userId": current_user.id}
    )
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Learning plan not found")
    return plan

@router.delete("/{plan_id}")
async def delete_learning_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    plan = await db.learningplan.find_first(
        where={"id": plan_id, "userId": current_user.id}
    )
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Learning plan not found")
        
    await db.learningplan.delete(where={"id": plan_id})
    return {"status": "success", "id": plan_id}
