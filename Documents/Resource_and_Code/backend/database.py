from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DB_NAME]
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.claims.create_index("claim_id", unique=True)
    await db.otps.create_index("email")
    await db.otps.create_index("expires_at", expireAfterSeconds=0)
    print("✅ Connected to MongoDB")

async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

def get_db():
    return db