"""Shared helpers for all test scripts."""
import sys
import os
import json
from pathlib import Path

# Ensure backend app is importable
BACKEND_DIR = Path(__file__).parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

SAMPLE_PDF = str(Path(__file__).parent.parent / "sample.pdf")
OUTPUT_LOGS = Path(__file__).parent.parent / "output" / "logs"
OUTPUT_RESULTS = Path(__file__).parent.parent / "output" / "results"

OUTPUT_LOGS.mkdir(parents=True, exist_ok=True)
OUTPUT_RESULTS.mkdir(parents=True, exist_ok=True)


def save_log(feature: str, scenario: str, content: str) -> None:
    path = OUTPUT_LOGS / f"{feature}_{scenario}.log"
    path.write_text(content, encoding="utf-8")
    print(f"  [log saved] {path.name}")


def save_result(feature: str, scenario: str, data) -> None:
    path = OUTPUT_RESULTS / f"{feature}_{scenario}.json"
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    print(f"  [result saved] {path.name}")


def get_sample_text() -> str:
    """Extract text from sample.pdf using PyMuPDF."""
    import fitz
    pages = []
    with fitz.open(SAMPLE_PDF) as doc:
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                pages.append(text)
    return "\n\n".join(pages)
