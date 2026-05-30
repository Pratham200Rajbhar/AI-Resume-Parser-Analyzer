import structlog

logger = structlog.get_logger(__name__)

# Map file extensions to parser functions
_EXT_MAP = {
    "pdf": "pdf",
    "docx": "docx",
    "doc": "docx",
    "txt": "text",
    "text": "text",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "tiff": "image",
    "bmp": "image",
    "webp": "image",
}


def parse_file(file_path: str, file_type: str) -> str:
    """
    Route to the correct parser based on file_type extension.

    Args:
        file_path: Absolute path to the file on disk.
        file_type: File extension without leading dot (e.g. "pdf", "docx", "png").

    Returns:
        Extracted plain text from the file.

    Raises:
        ValueError: If the file type is not supported.
    """
    normalised = file_type.lower().lstrip(".")
    parser_key = _EXT_MAP.get(normalised)

    if parser_key is None:
        raise ValueError(f"Unsupported file type: '{file_type}'. Supported: {', '.join(_EXT_MAP.keys())}")

    logger.info("parse_file_routing", file_path=file_path, file_type=file_type, parser=parser_key)

    if parser_key == "pdf":
        from app.ml.parsers.pdf_parser import parse_pdf  # noqa: PLC0415
        return parse_pdf(file_path)

    if parser_key == "docx":
        from app.ml.parsers.docx_parser import parse_docx  # noqa: PLC0415
        return parse_docx(file_path)

    if parser_key == "text":
        from app.ml.parsers.text_parser import parse_text  # noqa: PLC0415
        return parse_text(file_path)

    if parser_key == "image":
        from app.ml.parsers.ocr_parser import parse_image  # noqa: PLC0415
        return parse_image(file_path)

    # Should never reach here given the map above
    raise ValueError(f"No parser registered for key: '{parser_key}'")
