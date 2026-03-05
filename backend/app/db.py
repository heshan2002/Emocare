import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://savipl2001:savipl2001@cluster0.w1w6mgv.mongodb.net/?appName=Cluster0")
MONGO_DB = os.getenv("MONGO_DB", "emocare")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[MONGO_DB]

users_col = db["users"]