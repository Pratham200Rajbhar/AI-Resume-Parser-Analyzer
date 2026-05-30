import structlog

logger = structlog.get_logger(__name__)


def parse_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError("PyMuPDF (fitz) is required for PDF parsing. Install it with: pip install pymupdf") from exc

    pages: list[str] = []
    with fitz.open(file_path) as doc:
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                pages.append(text)
            else:
                # Fallback: try extracting blocks for scanned-like pages
                blocks = page.get_text("blocks")
                block_texts = [b[4] for b in blocks if isinstance(b[4], str) and b[4].strip()]
                if block_texts:
                    pages.append("\n".join(block_texts))

    result = "\n\n".join(pages)
    logger.info("pdf_parsed", file_path=file_path, pages=len(pages), chars=len(result))
    return result
