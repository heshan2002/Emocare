# config.py - Secure configuration management
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "Chatbotuser")

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HF_TOKEN = os.getenv("HF_TOKEN")  # Hugging Face token (optional)

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY is not set in .env file")

# Validate required environment variables
def validate_config():
    """Check if all required environment variables are set"""
    missing_vars = []
    
    if not MONGODB_URI:
        missing_vars.append("MONGODB_URI")
    if not GROQ_API_KEY:
        missing_vars.append("GROQ_API_KEY")
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    return True

# Run validation
try:
    validate_config()
    print("✅ Configuration loaded successfully")
except ValueError as e:
    print(f"❌ Configuration error: {e}")
    # Don't exit, just print error - app will handle it

# Database names
USERS_COLLECTION = "users"
CHAT_HISTORY_COLLECTION = "chat_history"

# API Settings
API_TITLE = "Emocare API"
API_VERSION = "1.0.0"

# Vector Store Settings
VECTORSTORE_PATH = "vectorstore/db_faiss"
PDF_DATA_PATH = "data/"

# Emotion Settings
VALID_EMOTIONS = ["sad", "lonely", "anxious", "angry", "tired", "depressed", "hopeless", "happy", "calm"]

# LLM Settings
LLM_MODEL = "llama-3.1-8b-instant"
LLM_TEMPERATURE = 0.7
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# JWT Settings
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 30

# CORS Settings
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Logging configuration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
}