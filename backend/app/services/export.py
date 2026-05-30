import csv
import io
from typing import Any

import structlog
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = structlog.get_logger(__name__)


class ExportService:
    """Generates PDF reports and CSV exports."""

    # ── PDF ──────────────────────────────────────────────────────────────────

    def resume_to_pdf(self, analysis_data: dict, resume_filename: str) -> bytes:
        """
        Generate a styled PDF analysis report.
        Returns raw PDF bytes.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()
        story: list[Any] = []

        # ── Title ──
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Title"],
            fontSize=20,
            textColor=colors.HexColor("#1a1a2e"),
            spaceAfter=6,
        )
        story.append(Paragraph("Resume Analysis Report", title_style))
        story.append(Paragraph(f"File: {resume_filename}", styles["Normal"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4a90d9")))
        story.append(Spacer(1, 0.4 * cm))

        entities: dict = analysis_data.get("entities", {})
        ats_score: int = analysis_data.get("ats_score", 0)
        ats_breakdown: dict = analysis_data.get("ats_breakdown", {})
        bias_flags: list = analysis_data.get("bias_flags", [])
        fraud_flags: list = analysis_data.get("fraud_flags", [])

        # ── Candidate name ──
        candidate_name = entities.get("name", "Unknown Candidate")
        heading_style = ParagraphStyle(
            "Heading",
            parent=styles["Heading2"],
            textColor=colors.HexColor("#1a1a2e"),
            spaceAfter=4,
        )
        story.append(Paragraph(f"Candidate: {candidate_name}", heading_style))
        story.append(Spacer(1, 0.3 * cm))

        # ── ATS Score ──
        story.append(Paragraph("ATS Score", heading_style))
        score_color = (
            colors.HexColor("#27ae60") if ats_score >= 70
            else colors.HexColor("#e67e22") if ats_score >= 50
            else colors.HexColor("#e74c3c")
        )
        score_style = ParagraphStyle(
            "Score",
            parent=styles["Normal"],
            fontSize=36,
            textColor=score_color,
            spaceAfter=4,
        )
        story.append(Paragraph(f"{ats_score}/100", score_style))

        # ATS breakdown table
        if ats_breakdown:
            breakdown_data = [["Category", "Score"]]
            for category, score in ats_breakdown.items():
                breakdown_data.append([category.replace("_", " ").title(), str(score)])
            breakdown_table = Table(breakdown_data, colWidths=[10 * cm, 4 * cm])
            breakdown_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4a90d9")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                    ("ALIGN", (1, 0), (1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(breakdown_table)
        story.append(Spacer(1, 0.5 * cm))

        # ── Skills ──
        skills: list = entities.get("skills", [])
        if skills:
            story.append(Paragraph("Skills", heading_style))
            skill_names = []
            for s in skills:
                if isinstance(s, dict):
                    skill_names.append(s.get("normalized") or s.get("raw", ""))
                else:
                    skill_names.append(str(s))
            story.append(Paragraph(", ".join(filter(None, skill_names)), styles["Normal"]))
            story.append(Spacer(1, 0.4 * cm))

        # ── Experience ──
        experience: list = entities.get("experience", [])
        if experience:
            story.append(Paragraph("Experience", heading_style))
            exp_data = [["Role", "Company", "Duration"]]
            for exp in experience:
                if isinstance(exp, dict):
                    exp_data.append([
                        exp.get("role", ""),
                        exp.get("company", ""),
                        exp.get("duration", ""),
                    ])
            if len(exp_data) > 1:
                exp_table = Table(exp_data, colWidths=[6 * cm, 6 * cm, 4 * cm])
                exp_table.setStyle(
                    TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4a90d9")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ])
                )
                story.append(exp_table)
            story.append(Spacer(1, 0.4 * cm))

        # ── Education ──
        education: list = entities.get("education", [])
        if education:
            story.append(Paragraph("Education", heading_style))
            for edu in education:
                if isinstance(edu, dict):
                    line = f"{edu.get('degree', '')} — {edu.get('institution', '')} ({edu.get('year', '')})"
                    story.append(Paragraph(line, styles["Normal"]))
            story.append(Spacer(1, 0.4 * cm))

        # ── Bias Flags ──
        if bias_flags:
            story.append(Paragraph("Bias Flags", heading_style))
            bias_data = [["Type", "Term", "Suggestion"]]
            for flag in bias_flags:
                if isinstance(flag, dict):
                    bias_data.append([
                        flag.get("type", ""),
                        flag.get("term", ""),
                        flag.get("suggestion", ""),
                    ])
            if len(bias_data) > 1:
                bias_table = Table(bias_data, colWidths=[3 * cm, 4 * cm, 9 * cm])
                bias_table.setStyle(
                    TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e74c3c")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fdf0f0")]),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ])
                )
                story.append(bias_table)
            story.append(Spacer(1, 0.4 * cm))

        # ── Fraud Flags ──
        if fraud_flags:
            story.append(Paragraph("Fraud / Inconsistency Flags", heading_style))
            for flag in fraud_flags:
                if isinstance(flag, dict):
                    severity = flag.get("severity", "low")
                    sev_color = (
                        colors.HexColor("#e74c3c") if severity == "high"
                        else colors.HexColor("#e67e22") if severity == "medium"
                        else colors.HexColor("#f39c12")
                    )
                    sev_style = ParagraphStyle(
                        f"Sev_{severity}",
                        parent=styles["Normal"],
                        textColor=sev_color,
                        fontSize=9,
                    )
                    story.append(Paragraph(
                        f"[{severity.upper()}] {flag.get('type', '')}: {flag.get('description', '')}",
                        sev_style,
                    ))
            story.append(Spacer(1, 0.4 * cm))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        logger.info("pdf_generated", filename=resume_filename, size=len(pdf_bytes))
        return pdf_bytes

    # ── CSV ──────────────────────────────────────────────────────────────────

    def batch_to_csv(self, ranked_results: list) -> str:
        """Convert ranked batch results to a CSV string."""
        if not ranked_results:
            return ""

        output = io.StringIO()
        fieldnames = [
            "rank",
            "resume_id",
            "candidate_name",
            "composite_score",
            "ats_score",
            "match_score",
            "skills_score",
            "experience_score",
            "education_score",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for result in ranked_results:
            component_scores = result.get("component_scores", {})
            writer.writerow({
                "rank": result.get("rank", ""),
                "resume_id": result.get("resume_id", ""),
                "candidate_name": result.get("candidate_name", ""),
                "composite_score": round(result.get("composite_score", 0), 2),
                "ats_score": component_scores.get("ats_score", ""),
                "match_score": round(component_scores.get("match_score", 0), 4),
                "skills_score": round(component_scores.get("skills_score", 0), 4),
                "experience_score": round(component_scores.get("experience_score", 0), 4),
                "education_score": round(component_scores.get("education_score", 0), 4),
            })

        return output.getvalue()
