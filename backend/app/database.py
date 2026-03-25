from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


class Database:
    client: AsyncIOMotorClient = None
    db = None


db = Database()


async def connect_to_mongo():
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db.db = db.client[settings.DATABASE_NAME]

    await db.db.certificates.create_index("id", unique=True)
    await db.db.certificates.create_index("verification_hash", unique=True)
    await db.db.certificates.create_index("recipient_email")

    await db.db.users.create_index("email", unique=True)
    await db.db.users.create_index("username", unique=True, sparse=True)

    await db.db.recipient_profiles.create_index("username", unique=True)
    await db.db.recipient_profiles.create_index("recipient_email", unique=True)

    await db.db.team_members.create_index([("event_id", 1), ("member_user_id", 1)], unique=True)
    await db.db.api_keys.create_index([("event_id", 1), ("key_hash", 1)], unique=True)
    await db.db.certificate_events.create_index([("cert_id", 1), ("event_type", 1), ("created_at", -1)])


async def close_mongo_connection():
    if db.client:
        db.client.close()


def get_database():
    return db.db
