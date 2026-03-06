from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime, timedelta
from user_memory import get_user, verify_password, create_user, save_chat_session, load_user_chat_history
from auth import User, prepare_user_data
from emotionchat import get_advice, valid_emotions
from config import *
import os
from analysis import analyze_user_data

app = FastAPI()

# CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use JWT secret from .env
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"

class LoginData(BaseModel):
    email: str
    password: str

class EmotionData(BaseModel):
    emotion: str

def create_jwt_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    if authorization is None:
        raise HTTPException(status_code=401, detail="No token provided")
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = get_user(email)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")

@app.post("/signup")
def signup(user: User):
    existing_user = get_user(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_data = prepare_user_data(user)
    create_user(user_data)
    return {"message": "Account created successfully"}

@app.post("/login")
def login(data: LoginData):
    user = get_user(data.email)
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    token = create_jwt_token({"sub": user["email"]})
    # Convert ObjectId to string for JSON serialization
    user["_id"] = str(user["_id"])
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password"}}

@app.get("/emotions")
def get_emotions():
    return {"emotions": valid_emotions}

@app.post("/advice")
def advice(data: EmotionData, current_user: dict = Depends(get_current_user)):
    query = data.emotion.lower().strip()
    print(f"\n📨 Received advice request: '{query}' from user: {current_user.get('name')}")
    
    response, sources = get_advice(current_user, query)
    
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])
    
    # Save session
    title = query[:30] + "..." if len(query) > 30 else query
    messages = [
        {"role": "user", "content": query},
        {"role": "assistant", "content": response["answer"]}
    ]
    save_chat_session(current_user["_id"], title, messages)
    
    # Format sources only if they exist
    formatted_sources = []
    if sources and len(sources) > 0:
        formatted_sources = [
            {
                "filename": os.path.basename(doc.metadata.get("source", "Unknown.pdf")),
                "page": doc.metadata.get("page", "?")
            } 
            for doc in sources
        ]
    
    # Return answer with sources (frontend can decide whether to show them)
    return {
        "answer": response["answer"], 
        "sources": formatted_sources
    }

@app.get("/history")
def history(current_user: dict = Depends(get_current_user)):
    return load_user_chat_history(current_user["_id"])

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/analysis")
def get_analysis(current_user: dict = Depends(get_current_user)):
    """Get emotional analysis report for the user"""
    
    # Get user's chat history
    history = load_user_chat_history(current_user["_id"])
    
    # Generate analysis
    report = analyze_user_data(current_user, history)
    
    return report