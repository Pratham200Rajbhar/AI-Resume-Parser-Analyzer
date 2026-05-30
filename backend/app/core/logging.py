import logging
import sys

import structlog

from app.core.config import settings


def configure_logging() -> None:
    """Configure structlog and standard library logging framework to be unified."""
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Shared processors between structlog and standard logging
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Formatter to convert standard logging records or structlog records into final text/JSON
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(colors=True) if not settings.is_production
            else structlog.processors.JSONRenderer(),
        ],
    )

    # Stdout handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    # Clear existing handlers
    for h in list(root_logger.handlers):
        root_logger.removeHandler(h)
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Configure third-party loggers to propagate to root logger and disable their own handlers
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "prisma"):
        logging_logger = logging.getLogger(logger_name)
        for h in list(logging_logger.handlers):
            logging_logger.removeHandler(h)
        logging_logger.propagate = True


def get_logger(name: str) -> structlog.BoundLogger:
    """Retrieve a bound structlog logger instance by name."""
    return structlog.get_logger(name)
