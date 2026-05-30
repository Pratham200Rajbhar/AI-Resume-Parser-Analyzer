from __future__ import annotations

import re
from datetime import datetime

import structlog

logger = structlog.get_logger(__name__)

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
_DATE_RANGE_RE = re.compile(
    r"(?P<start_month>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?"
    r"\.?\s*(?P<start_year>(?:19|20)\d{2})"
    r"\s*[-–—to]+\s*"
    r"(?:(?P<end_month>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?"
    r"\.?\s*(?P<end_year>(?:19|20)\d{2})|(?P<present>present|current|now|ongoing))",
    re.IGNORECASE,
)

_CURRENT_YEAR = datetime.now().year
_CURRENT_MONTH = datetime.now().month


def _parse_date_range(match: re.Match) -> tuple[tuple[int, int], tuple[int, int]] | None:
    """Parse a date range match into (start_year, start_month), (end_year, end_month)."""
    try:
        start_year = int(match.group("start_year"))
        start_month_str = (match.group("start_month") or "").lower()
        start_month = _MONTH_MAP.get(start_month_str, 1)

        if match.group("present"):
            end_year = _CURRENT_YEAR
            end_month = _CURRENT_MONTH
        else:
            end_year = int(match.group("end_year"))
            end_month_str = (match.group("end_month") or "").lower()
            end_month = _MONTH_MAP.get(end_month_str, 12)

        return (start_year, start_month), (end_year, end_month)
    except (TypeError, ValueError):
        return None


def _months_between(start: tuple[int, int], end: tuple[int, int]) -> int:
    return (end[0] - start[0]) * 12 + (end[1] - start[1])


class FraudDetector:
    """
    Detects inconsistencies and suspicious patterns in resume entities.
    Checks: overlapping employment, large gaps, future dates, implausible tenure,
    graduation year inconsistencies.
    """

    def detect(self, entities: dict) -> list[dict]:
        """
        Analyse entities for fraud/inconsistency signals.

        Returns a list of dicts:
            {type: str, description: str, severity: "low"|"medium"|"high"}
        """
        flags: list[dict] = []

        experience = entities.get("experience", [])
        education = entities.get("education", [])

        # ── Extract date ranges from experience ───────────────────────────────
        date_ranges: list[tuple[tuple[int, int], tuple[int, int], str]] = []

        for exp in experience:
            if not isinstance(exp, dict):
                continue
            duration = exp.get("duration", "")
            role = exp.get("role", "") or exp.get("company", "Unknown")
            if not duration:
                continue
            match = _DATE_RANGE_RE.search(duration)
            if match:
                parsed = _parse_date_range(match)
                if parsed:
                    date_ranges.append((parsed[0], parsed[1], role))

        # ── 1. Future dates ───────────────────────────────────────────────────
        for start, end, role in date_ranges:
            if start[0] > _CURRENT_YEAR or (start[0] == _CURRENT_YEAR and start[1] > _CURRENT_MONTH):
                flags.append({
                    "type": "future_start_date",
                    "description": f"Job '{role}' has a start date in the future ({start[0]}/{start[1]:02d}).",
                    "severity": "high",
                })
            if end[0] > _CURRENT_YEAR or (end[0] == _CURRENT_YEAR and end[1] > _CURRENT_MONTH):
                # Only flag if it's not a "present" job (end == current date)
                if not (end[0] == _CURRENT_YEAR and end[1] == _CURRENT_MONTH):
                    flags.append({
                        "type": "future_end_date",
                        "description": f"Job '{role}' has an end date in the future ({end[0]}/{end[1]:02d}).",
                        "severity": "medium",
                    })

        # ── 2. Implausible tenure (single job > 30 years) ─────────────────────
        for start, end, role in date_ranges:
            tenure_months = _months_between(start, end)
            if tenure_months > 360:  # 30 years
                flags.append({
                    "type": "implausible_tenure",
                    "description": (
                        f"Job '{role}' spans {tenure_months // 12} years, "
                        "which is unusually long. Please verify the dates."
                    ),
                    "severity": "medium",
                })

        # ── 3. Overlapping employment date ranges ─────────────────────────────
        sorted_ranges = sorted(date_ranges, key=lambda x: (x[0][0], x[0][1]))
        for i in range(len(sorted_ranges)):
            for j in range(i + 1, len(sorted_ranges)):
                start_i, end_i, role_i = sorted_ranges[i]
                start_j, end_j, role_j = sorted_ranges[j]
                # Overlap: start_j is before end_i
                if (start_j[0], start_j[1]) < (end_i[0], end_i[1]):
                    overlap_months = _months_between(start_j, end_i)
                    if overlap_months > 1:  # Allow 1-month overlap (rounding)
                        severity = "high" if overlap_months > 6 else "low"
                        flags.append({
                            "type": "overlapping_employment",
                            "description": (
                                f"'{role_i}' and '{role_j}' overlap by approximately "
                                f"{overlap_months} month(s). Verify the dates."
                            ),
                            "severity": severity,
                        })

        # ── 4. Employment gaps > 2 years ──────────────────────────────────────
        if len(sorted_ranges) >= 2:
            for i in range(len(sorted_ranges) - 1):
                _, end_i, role_i = sorted_ranges[i]
                start_next, _, role_next = sorted_ranges[i + 1]
                gap_months = _months_between(end_i, start_next)
                if gap_months > 24:
                    flags.append({
                        "type": "employment_gap",
                        "description": (
                            f"There is a gap of approximately {gap_months} months "
                            f"between '{role_i}' and '{role_next}'. "
                            "Consider addressing this in your cover letter."
                        ),
                        "severity": "low",
                    })

        # ── 5. Graduation year inconsistencies ───────────────────────────────
        grad_years: list[int] = []
        for edu in education:
            if not isinstance(edu, dict):
                continue
            year_str = edu.get("year", "")
            if year_str:
                try:
                    grad_years.append(int(year_str))
                except ValueError:
                    pass

        for year in grad_years:
            if year > _CURRENT_YEAR:
                flags.append({
                    "type": "future_graduation_year",
                    "description": f"Graduation year {year} is in the future.",
                    "severity": "medium",
                })
            elif year < 1950:
                flags.append({
                    "type": "implausible_graduation_year",
                    "description": f"Graduation year {year} seems implausible.",
                    "severity": "low",
                })

        # Check if earliest job start predates graduation
        if grad_years and sorted_ranges:
            earliest_grad = min(grad_years)
            earliest_job_year = sorted_ranges[0][0][0]
            if earliest_job_year < earliest_grad - 1:
                flags.append({
                    "type": "job_before_graduation",
                    "description": (
                        f"Employment starts in {earliest_job_year}, "
                        f"but earliest graduation is {earliest_grad}. "
                        "Verify dates or clarify if this was an internship/part-time role."
                    ),
                    "severity": "low",
                })

        logger.debug("fraud_detection_done", flag_count=len(flags))
        return flags
