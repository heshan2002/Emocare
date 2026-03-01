from __future__ import annotations

from fastapi import FastAPI, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

# Import your modules
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
• Face (YOLO-based detection + expression analysis)
• Voice (HuBERT speech emotion model + quality analysis)
• Text (Transformer-based text emotion classification)
• Fusion (Dynamic weighted multimodal emotion fusion)

Designed specifically for elder-friendly emotional monitoring.
""",
    version="2.0.0",
    contact={
        "name": "Elder Emotion Care Research Team",
        "email": "research@emocare.ai",
    }
)


# ============================================================
# CORS (Allow React Frontend)
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
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
        "probs": probs
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
        **quality  # includes speech_present, snr_est, clip_ratio, quality_score, usable
    }


# ============================================================
# FACE EMOTION (YOLO + TRACKING + QUALITY)
# ============================================================

@app.post("/emotion/face", tags=["Emotion - Face"])
async def emotion_face(file: UploadFile = File(...)):
    img_bytes = await file.read()

    # detect_face_emotion already returns:
    # label, confidence, probs,
    # face_present, usable, quality_score, bbox, etc.
    return detect_face_emotion(img_bytes)


# ============================================================
# MULTIMODAL FUSION
# ============================================================

@app.post("/emotion/fuse", tags=["Emotion - Fusion"])
async def emotion_fuse(payload: Dict[str, Any] = Body(...)):
    """
    Expected payload from frontend:

    {
        "face": {
            "confidence": 0.0,
            "probs": {...},
            "quality_score": 0.0,
            "usable": true,
            "face_present": true
        },
        "voice": {
            "confidence": 0.0,
            "probs": {...},
            "quality_score": 0.0
        },
        "text": {
            "confidence": 0.0,
            "probs": {...}
        },
        "text_available": true
    }
    """

    return fuse_emotions(payload)