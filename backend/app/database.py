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

async def close_mongo_connection():
    if db.client:
        db.client.close()

def get_database():
    return db.db
