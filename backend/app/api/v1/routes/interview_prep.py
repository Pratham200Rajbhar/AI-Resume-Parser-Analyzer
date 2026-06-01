import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/interview-prep", tags=["interview-prep"])


class InterviewPrepRequest(BaseModel):
    resume_id: str
    job_description_id: str | None = None


class PracticeAnswerRequest(BaseModel):
    question: str
    answer: str


class InterviewQuestion(BaseModel):
    category: str
    question: str
    star_template: str


class PracticeFeedback(BaseModel):
    score: int
    clarity: str
    specificity: str
    metrics_usage: str
    improvement_notes: str


_STAR = (
    "Situation: [describe the context]\n"
    "Task: [your specific responsibility]\n"
    "Action: [the steps you took]\n"
    "Result: [the measurable outcome]"
)


def _static_questions(skills: list[str]) -> list["InterviewQuestion"]:
    """Deterministic 10-question set used when LLM generation is unavailable.

    Parameterized by the candidate's top skills so it stays relevant, and always
    returns the promised 4 behavioural / 3 technical / 3 situational mix.
    """
    s1 = skills[0] if len(skills) > 0 else "your core technical skill"
    s2 = skills[1] if len(skills) > 1 else "a key tool you use"
    s3 = skills[2] if len(skills) > 2 else "a technology from your stack"
    q = InterviewQuestion
    return [
        q(category="behavioural", question="Tell me about a time you overcame a significant challenge at work.", star_template=_STAR),
        q(category="behavioural", question="Describe a situation where you had to collaborate with a difficult stakeholder.", star_template=_STAR),
        q(category="behavioural", question="Give an example of a goal you set and how you achieved it.", star_template=_STAR),
        q(category="behavioural", question="Tell me about a time you failed and what you learned from it.", star_template=_STAR),
        q(category="technical", question=f"How have you applied {s1} to deliver results in a real project?", star_template=_STAR),
        q(category="technical", question=f"Walk me through how you would design a solution using {s2}.", star_template=_STAR),
        q(category="technical", question=f"Describe a tricky bug or problem you solved with {s3}.", star_template=_STAR),
        q(category="situational", question="How would you handle a tight deadline with competing priorities?", star_template=_STAR),
        q(category="situational", question="What would you do if you disagreed with your manager's technical decision?", star_template=_STAR),
        q(category="situational", question="How would you onboard onto an unfamiliar codebase under time pressure?", star_template=_STAR),
    ]


@router.post("/generate", response_model=list[InterviewQuestion])
async def generate_questions(
    body: InterviewPrepRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InterviewQuestion]:
    resume = await db.resume.find_unique(where={"id": body.resume_id}, include={"analysis": True})
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    if resume.analysis is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume must be analyzed first")

    entities = resume.analysis.entitiesJson or {}
    jd_text = None
    if body.job_description_id:
        jd = await db.jobdescription.find_unique(where={"id": body.job_description_id})
        if jd and jd.userId == current_user.id:
            jd_text = jd.rawText

    skills = [s.get("normalized", s.get("raw", "")) for s in entities.get("skills", [])[:8]]
    experience = entities.get("experience", [])
    name = entities.get("name", "the candidate")

    prompt = f"""Generate exactly 10 interview questions for {name}.
Skills: {', '.join(skills)}.
Experience: {'; '.join(f"{e.get('role','')} at {e.get('company','')}" for e in experience[:3])}.
{f'Job description context: {jd_text[:800]}' if jd_text else ''}

Return a JSON array of 10 objects with fields:
- category: "behavioural" | "technical" | "situational"
- question: the interview question
- star_template: a STAR-format answer template pre-filled with details from the resume

Mix: 4 behavioural, 3 technical, 3 situational. Return only the JSON array."""

    try:
        import json

        from app.ml.llm.coach import CareerCoach
        coach = CareerCoach()
        raw = await coach.chat(session_messages=[], user_message=prompt, resume_entities=entities, jd_text=jd_text)
        # Extract JSON from response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            questions_data = json.loads(raw[start:end])
            parsed = [InterviewQuestion(**q) for q in questions_data[:10]]
            if len(parsed) == 10:
                return parsed
    except Exception as e:
        logger.error("interview_questions_generation_failed", error=str(e))

    # Deterministic fallback — always returns the promised 10 questions.
    return _static_questions(skills)


@router.post("/practice-feedback", response_model=PracticeFeedback)
async def get_practice_feedback(
    body: PracticeAnswerRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PracticeFeedback:
    prompt = f"""Evaluate this interview answer:

Question: {body.question}

Answer: {body.answer}

Provide feedback as JSON with fields:
- score: integer 1-10
- clarity: brief feedback on clarity
- specificity: brief feedback on specificity and concrete details
- metrics_usage: feedback on use of numbers/metrics
- improvement_notes: 1-2 specific improvement suggestions

Return only the JSON object."""

    try:
        import json

        from app.ml.llm.coach import CareerCoach
        coach = CareerCoach()
        raw = await coach.chat(session_messages=[], user_message=prompt, resume_entities={}, jd_text=None)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            return PracticeFeedback(**data)
    except Exception as e:
        logger.error("practice_feedback_failed", error=str(e))

    return PracticeFeedback(
        score=5,
        clarity="Answer could be clearer.",
        specificity="Add more specific examples.",
        metrics_usage="Include quantifiable results.",
        improvement_notes="Use the STAR format and include specific metrics.",
    )
