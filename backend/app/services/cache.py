import json
from typing import Any

import redis.asyncio as aioredis
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


class CacheService:
    """Async Redis cache wrapper with pub/sub support."""

    def __init__(self) -> None:
        self._client = _get_redis()

    async def get(self, key: str) -> Any | None:
        """Return the cached value for key, or None if missing."""
        raw = await self._client.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Persist value under key. ttl is in seconds."""
        serialised = json.dumps(value) if not isinstance(value, str) else value
        if ttl:
            await self._client.setex(key, ttl, serialised)
        else:
            await self._client.set(key, serialised)

    async def delete(self, key: str) -> None:
        """Remove a key from the cache."""
        await self._client.delete(key)

    async def publish(self, channel: str, message: Any) -> None:
        """Publish a message to a Redis pub/sub channel."""
        payload = json.dumps(message) if not isinstance(message, str) else message
        await self._client.publish(channel, payload)
        logger.debug("cache_publish", channel=channel)

    async def get_client(self) -> aioredis.Redis:
        """Return the raw redis.asyncio client for pub/sub subscribe operations."""
        return self._client
