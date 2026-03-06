import os
from pymongo import MongoClient
from dotenv import load_dotenv
import datetime
from passlib.context import CryptContext
from bson import ObjectId

load_dotenv()

# Fixed environment variable name
MONGO_URI = os.getenv("MONGODB_URI")  # Changed from MONGO_URI
DB_NAME = os.getenv("DB_NAME", "Chatbotuser")

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
users = db["users"]
chat_history = db["chat_history"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_user(user):
    try:
        # Hash password
        user["password"] = pwd_context.hash(user["password"])
        # Ensure lists are properly formatted
        user["medical"] = user.get("medical", [])
        user["habits"] = user.get("habits", [])
        user["hobbies"] = user.get("hobbies", [])
        user["family"] = user.get("family", "")
        user["created_at"] = datetime.datetime.now()
        
        result = users.insert_one(user)
        return result.inserted_id
    except Exception as e:
        print(f"Error creating user: {e}")
        raise e

def get_user(email):
    try:
        user = users.find_one({"email": email})
        if user and "_id" in user:
            user["_id"] = str(user["_id"])
        return user
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def save_chat_session(user_id, emotion, messages):
    try:
        chat_entry = {
            "user_id": user_id,
            "emotion": emotion,
            "timestamp": datetime.datetime.now(),
            "messages": messages
        }
        chat_history.insert_one(chat_entry)
    except Exception as e:
        print(f"Error saving chat: {e}")

def load_user_chat_history(user_id):
    try:
        history = list(chat_history.find({"user_id": user_id}).sort("timestamp", -1))
        for h in history:
            h["_id"] = str(h["_id"])
            h["timestamp"] = h["timestamp"].isoformat() if h["timestamp"] else None
        return history
    except Exception as e:
        print(f"Error loading history: {e}")
        return []