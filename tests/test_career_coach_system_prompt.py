"""Test: Career coach — system prompt building with resume context from sample.pdf"""
import sys
import io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from conftest_helpers import save_log, save_result

FEATURE = "career_coach"
SCENARIO = "system_prompt"

# Minimal .env so Settings doesn't fail
import os
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("LLM_MODEL", "llama3.2")


def run():
    log = io.StringIO()

    def p(msg):
        print(msg)
        log.write(msg + "\n")

    p("=" * 60)
    p("TEST: career_coach / system_prompt")
    p("=" * 60)

    from app.ml.llm.coach import CareerCoach

    coach = CareerCoach()

    # Resume entities from sample.pdf
    resume_entities = {
        "name": "Pratham Rajbhar",
        "email": "pratham.rajbhar@gmail.com",
        "skills": [
            {"raw": "Python", "normalized": "Python"},
            {"raw": "FastAPI", "normalized": "FastAPI"},
            {"raw": "React.js", "normalized": "React.js"},
        ],
        "experience": [
            {"role": "Full-Stack Developer", "company": "Hackathon Projects", "duration": "2022-2024"},
        ],
        "education": [
            {"degree": "B.Tech Computer Engineering", "institution": "Ganpat University", "year": "2024"},
        ],
    }

    jd_text = "We need a Python FastAPI developer with React.js experience."

    # 1. System prompt with both resume and JD
    p("\n[1] System prompt with resume + JD")
    prompt = coach._build_system_prompt(resume_entities, jd_text)
    assert isinstance(prompt, str) and len(prompt) > 100, "System prompt should be non-empty"
    assert "Pratham" in prompt or "pratham" in prompt.lower(), \
        "System prompt should contain resume context"
    assert "Python" in prompt or "FastAPI" in prompt, \
        "System prompt should contain skill context"
    p(f"  OK — prompt length: {len(prompt)} chars")

    # 2. System prompt with no JD
    p("\n[2] System prompt without JD")
    prompt_no_jd = coach._build_system_prompt(resume_entities, None)
    assert "No specific job description" in prompt_no_jd, \
        "Should indicate no JD when jd_text is None"
    p("  OK — no-JD placeholder present")

    # 3. System prompt with empty entities
    p("\n[3] System prompt with empty entities")
    prompt_empty = coach._build_system_prompt({}, None)
    assert "No resume data" in prompt_empty, \
        "Should indicate no resume data when entities is empty"
    p("  OK — no-resume placeholder present")

    p("\nAll assertions PASSED")
    save_log(FEATURE, SCENARIO, log.getvalue())
    save_result(FEATURE, SCENARIO, {
        "prompt_with_context_length": len(prompt),
        "no_jd_placeholder": True,
        "empty_entities_placeholder": True,
    })
    print("PASS: career_coach/system_prompt")
    return True


if __name__ == "__main__":
    run()
