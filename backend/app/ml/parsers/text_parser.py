import structlog

logger = structlog.get_logger(__name__)


def parse_text(file_path: str) -> str:
    """Read a plain text file and return its contents."""
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    for encoding in encodings:
        try:
            with open(file_path, encoding=encoding) as f:
                text = f.read()
            logger.info("text_parsed", file_path=file_path, encoding=encoding, chars=len(text))
            return text.strip()
        except (UnicodeDecodeError, LookupError):
            continue

    # Last resort: read as bytes and decode with errors replaced
    with open(file_path, "rb") as f:
        raw = f.read()
    text = raw.decode("utf-8", errors="replace").strip()
    logger.warning("text_parsed_with_replacement", file_path=file_path, chars=len(text))
    return text
