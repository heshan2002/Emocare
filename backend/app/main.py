from __future__ import annotations

from fastapi import FastAPI, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

# Google Auth router
from app.auth_google_routes import router as auth_router

# Emotion modules
from app.text_emotion import predict_text_emotion
from app.voice_emotion import predict_voice_emotion
from app.face_emotion import detect_face_emotion
from app.fusion import fuse_emotions


# ============================================================
# FASTAPI APP CONFIGURATION
# ============================================================

app = FastAPI(
    title="Elder Emotion Care – Multimodal Emotion Detection API",
    description="""
This API powers the Elder Emotion Care web application.

It performs real-time multimodal emotion detection using:
• Face
• Voice
• Text
• Fusion (Dynamic weighted multimodal emotion fusion)

Designed specifically for elder-friendly emotional monitoring.
""",
    version="2.0.0",
)

# ============================================================
# CORS (Allow React Frontend)
# IMPORTANT: DO NOT use "*" when allow_credentials=True
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# BASIC ENDPOINTS
# ============================================================

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "message": "Backend is running successfully."}

@app.get("/hello", tags=["System"])
def hello(name: str = "buddy"):
    return {"message": f"Hello {name} 👋 Elder Emotion Care API is running."}

# ============================================================
# AUTH ROUTES
# ============================================================

app.include_router(auth_router)

# ============================================================
# TEXT EMOTION
# ============================================================

class TextRequest(BaseModel):
    text: str

@app.post("/emotion/text", tags=["Emotion - Text"])
def emotion_text(req: TextRequest):
    label, conf, probs = predict_text_emotion(req.text)
    return {
        "modality": "text",
        "label": label,
        "confidence": float(conf),
        "probs": probs,
    }

# ============================================================
# VOICE EMOTION (WITH QUALITY ANALYSIS)
# ============================================================

@app.post("/emotion/voice", tags=["Emotion - Voice"])
async def emotion_voice(file: UploadFile = File(...)):
    wav_bytes = await file.read()
    label, conf, probs, quality = predict_voice_emotion(wav_bytes)
    return {
        "modality": "voice",
        "label": label,
        "confidence": float(conf),
        "probs": probs,
        **quality,
    }

# ============================================================
# FACE EMOTION
# ============================================================

@app.post("/emotion/face", tags=["Emotion - Face"])
async def emotion_face(file: UploadFile = File(...)):
    img_bytes = await file.read()
    return detect_face_emotion(img_bytes)

# ============================================================
# MULTIMODAL FUSION
# ============================================================

@app.post("/emotion/fuse", tags=["Emotion - Fusion"])
async def emotion_fuse(payload: Dict[str, Any] = Body(...)):
    return fuse_emotions(payload)