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
    Messages are published to Redis channel `job:{job_id}` by background tasks.
    The connection closes automatically when a COMPLETE or ERROR event is received.
    """
    await websocket.accept()
    logger.info("ws_connected", job_id=job_id)

    cache = CacheService()
    redis_client = await cache.get_client()
    pubsub = redis_client.pubsub()
    channel = f"job:{job_id}"

    async def read_from_redis() -> None:
        try:
            await pubsub.subscribe(channel)
            logger.info("ws_subscribed", channel=channel)

            while True:
                # get_message with timeout blocks until a message is available
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message is None:
                    # Send a heartbeat ping to keep connection alive and detect stale connections
                    try:
                        await websocket.send_text(json.dumps({"type": "PING"}))
                    except WebSocketDisconnect:
                        break
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
                    logger.info("ws_terminal_event", job_id=job_id, event_type=event_type)
                    break
        except Exception as exc:
            logger.error("ws_redis_stream_error", job_id=job_id, error=str(exc))
            try:
                await websocket.send_text(json.dumps({"type": "ERROR", "message": "Internal server error"}))
            except Exception:
                pass

    async def client_listener() -> None:
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass

    listener_task = asyncio.create_task(client_listener())
    redis_task = asyncio.create_task(read_from_redis())

    try:
        # Wait until either the redis stream finishes or client disconnects
        await asyncio.wait(
            [listener_task, redis_task],
            return_when=asyncio.FIRST_COMPLETED
        )
    except Exception as exc:
        logger.error("ws_wait_error", job_id=job_id, error=str(exc))
    finally:
        # Cancel tasks
        listener_task.cancel()
        redis_task.cancel()
        
        # Clean up Redis pubsub and WebSocket connection
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("ws_closed", job_id=job_id)
