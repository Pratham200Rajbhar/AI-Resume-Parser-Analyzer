from prisma.models import User

from app.core.security import hash_password
from prisma import Prisma


class UserRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def create(self, email: str, password: str, full_name: str | None = None) -> User:
        return await self.db.user.create(
            data={"email": email, "password": hash_password(password), "fullName": full_name}
        )

    async def get_by_id(self, user_id: str) -> User | None:
        return await self.db.user.find_unique(where={"id": user_id})

    async def get_by_email(self, email: str) -> User | None:
        return await self.db.user.find_unique(where={"email": email})

    async def update(self, user_id: str, **fields) -> User:
        return await self.db.user.update(where={"id": user_id}, data=fields)
