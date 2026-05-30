import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.cache import CacheService

logger = structlog.get_logger(__name__)
ws_router = APIRouter(tags=["websocket"])


@ws_router.websocket("/ws/jobs/{job_id}")
async def job_status_ws(websocket: WebSocket, job_id: str) -> None:
    """
    Subscribe to real-time job progress events for a given job_id.
    Messages are published to Redis channel `job:{job_id}` by Celery tasks.
    The connection closes automatically when a COMPLETE or ERROR event is received.
    """
    await websocket.accept()
    logger.info("ws_connected", job_id=job_id)

    cache = CacheService()
    redis_client = await cache.get_client()
    pubsub = redis_client.pubsub()
    channel = f"job:{job_id}"

    try:
        await pubsub.subscribe(channel)
        logger.info("ws_subscribed", channel=channel)

        while True:
            try:
                # Poll for a message with a short timeout so we can detect client disconnects
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=1.0)
            except TimeoutError:
                # Send a heartbeat ping to detect stale connections
                try:
                    await websocket.send_text(json.dumps({"type": "PING"}))
                except WebSocketDisconnect:
                    break
                continue

            if message is None:
                continue

            data_raw = message.get("data")
            if isinstance(data_raw, bytes):
                data_raw = data_raw.decode("utf-8")

            try:
                payload = json.loads(data_raw)
            except (json.JSONDecodeError, TypeError):
                payload = {"type": "MESSAGE", "data": data_raw}

            try:
                await websocket.send_text(json.dumps(payload))
            except WebSocketDisconnect:
                break

            # Terminal events — close the connection
            event_type = payload.get("type", "")
            if event_type in ("COMPLETE", "ERROR"):
                logger.info("ws_terminal_event", job_id=job_id, event=event_type)
                break

    except WebSocketDisconnect:
        logger.info("ws_disconnected", job_id=job_id)
    except Exception as exc:
        logger.error("ws_error", job_id=job_id, error=str(exc))
        try:
            await websocket.send_text(json.dumps({"type": "ERROR", "message": "Internal server error"}))
        except Exception:
            pass
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("ws_closed", job_id=job_id)
