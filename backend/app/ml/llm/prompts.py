"""Prompt templates for the CareerCoach LLM."""

SYSTEM_PROMPT = """You are an expert career coach and resume consultant with 15+ years of experience helping professionals land their dream jobs. You have deep knowledge of ATS systems, hiring practices across industries, and modern resume best practices.

You have access to the candidate's resume analysis:
{resume_context}

{jd_context}

Your role is to:
1. Provide specific, actionable advice tailored to this candidate's resume and target role
2. Rewrite weak bullet points using the STAR method (Situation, Task, Action, Result)
3. Identify skill gaps and suggest concrete ways to address them
4. Help craft compelling cover letters and interview responses
5. Give honest, constructive feedback — not empty praise

Always be specific. Reference actual content from the resume when giving advice.
Keep responses concise and structured. Use bullet points for lists of recommendations.
"""

BULLET_REWRITE_PROMPT = """Please rewrite the following resume bullet point to be more impactful.

Original bullet:
{bullet}

Requirements:
- Use strong action verbs
- Quantify achievements where possible (add placeholder metrics if exact numbers are unknown, e.g. "X%", "N users")
- Follow the STAR method: what you did, how you did it, and the result
- Keep it to 1–2 lines maximum
- Make it ATS-friendly with relevant keywords

Provide 2–3 alternative rewrites ranked from most to least impactful.
"""

COVER_LETTER_PROMPT = """Write a compelling cover letter for the following:

Candidate profile:
{candidate_summary}

Target role / Job description:
{jd_text}

Requirements:
- 3–4 paragraphs, professional but personable tone
- Opening: hook that connects candidate's top achievement to the role
- Middle: 2–3 specific examples from the resume that match JD requirements
- Closing: clear call to action
- Avoid clichés like "I am writing to apply for..."
- Keep it under 400 words
"""

SKILL_GAP_PROMPT = """Based on the candidate's resume and the target job description, provide a skill gap analysis.

Gap skills identified: {gap_skills}

For each gap skill:
1. Assess how critical it is for the role (High/Medium/Low)
2. Suggest the fastest way to acquire it (online course, project, certification)
3. Recommend a specific resource (Coursera, Udemy, official docs, etc.)
4. Estimate time to reach a job-ready level

Format as a prioritised action plan the candidate can start this week.
"""

INTERVIEW_PREP_PROMPT = """Prepare the candidate for interviews for this role.

Candidate background: {candidate_summary}
Target role: {role_title}

Provide:
1. **5 likely interview questions** specific to this role and the candidate's background
2. **STAR-method answer framework** for each question using the candidate's actual experience
3. **3 questions the candidate should ask** the interviewer to demonstrate strategic thinking
4. **Key talking points** — the 3 most compelling things this candidate should emphasise

Be specific and reference actual items from the candidate's resume.
"""
