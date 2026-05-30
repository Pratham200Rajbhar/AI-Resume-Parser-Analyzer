import structlog

logger = structlog.get_logger(__name__)


def parse_image(file_path: str) -> str:
    """Extract text from an image file using Pillow + pytesseract (OCR)."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "Pillow and pytesseract are required for image parsing. "
            "Install with: pip install Pillow pytesseract"
        ) from exc

    image = Image.open(file_path)

    # Convert to RGB if needed (handles RGBA, palette modes, etc.)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    # Use pytesseract with English language and page segmentation mode 1 (auto OSD)
    custom_config = r"--oem 3 --psm 1"
    text = pytesseract.image_to_string(image, lang="eng", config=custom_config)

    result = text.strip()
    logger.info("image_parsed", file_path=file_path, chars=len(result))
    return result
