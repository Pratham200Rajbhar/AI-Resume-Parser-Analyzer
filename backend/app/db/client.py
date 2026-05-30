from prisma import Prisma

_client: Prisma | None = None


async def get_db() -> Prisma:
    global _client
    if _client is None:
        _client = Prisma()
        await _client.connect()
    return _client


async def disconnect_db() -> None:
    global _client
    if _client is not None:
        await _client.disconnect()
        _client = None
