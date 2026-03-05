from __future__ import annotations

import os
import uuid
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

from app.db import users_col
from app.auth_utils import create_access_token, decode_token

load_dotenv()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------- Schemas ----------------
class GoogleLoginReq(BaseModel):
    id_token: str = Field(min_length=20)


class ProfileExtrasReq(BaseModel):
    # keep both, but your UI can send only age OR ageGroup (or both)
    age: Optional[int] = None
    ageGroup: Optional[str] = None

    # these match your MongoDB schema exactly
    medical: List[str] = []
    family: str = ""
    habits: List[str] = []
    hobbies: List[str] = []


# ---------------- Helpers ----------------
def _public_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "google_sub": doc.get("google_sub"),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "picture": doc.get("picture", ""),
        "age": doc.get("age"),
        "ageGroup": doc.get("ageGroup", ""),
        "medical": doc.get("medical", []),
        "family": doc.get("family", ""),
        "habits": doc.get("habits", []),
        "hobbies": doc.get("hobbies", []),
        "is_profile_complete": bool(doc.get("is_profile_complete", False)),
    }


def _verify_google_id_token(token: str) -> Dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not set in backend .env")

    try:
        info = id_token.verify_oauth2_token(token, grequests.Request(), GOOGLE_CLIENT_ID)
        return info
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # IMPORTANT: your _id is stored as STRING uuid -> query using string
    user = await users_col.find_one({"_id": str(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def _clean_list(items: List[str]) -> List[str]:
    # remove blanks and trim
    out: List[str] = []
    for x in items or []:
        s = str(x or "").strip()
        if s:
            out.append(s)
    # unique keep order
    uniq: List[str] = []
    seen = set()
    for s in out:
        if s.lower() not in seen:
            uniq.append(s)
            seen.add(s.lower())
    return uniq


def _is_profile_complete(req: ProfileExtrasReq) -> bool:
    # minimal completion rule: family OR at least one habit OR at least one hobby
    if (req.family or "").strip():
        return True
    if len(_clean_list(req.habits)) > 0:
        return True
    if len(_clean_list(req.hobbies)) > 0:
        return True
    # age or ageGroup can also count
    if req.age is not None:
        return True
    if (req.ageGroup or "").strip():
        return True
    return False


# ---------------- Routes ----------------
@router.post("/google")
async def google_login(req: GoogleLoginReq):
    info = _verify_google_id_token(req.id_token)

    google_sub = info.get("sub")
    email = info.get("email", "") or ""
    name = info.get("name", "User") or "User"
    picture = info.get("picture", "") or ""

    if not google_sub:
        raise HTTPException(status_code=401, detail="Google token missing sub")

    # Find user by google_sub (best unique key)
    user = await users_col.find_one({"google_sub": google_sub})

    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "google_sub": google_sub,
            "name": name,
            "email": email,
            "picture": picture,

            # elder profile fields
            "age": None,
            "ageGroup": "",
            "medical": [],
            "family": "",
            "habits": [],
            "hobbies": [],
            "is_profile_complete": False,
        }
        await users_col.insert_one(user)
    else:
        # Update basic Google fields (do not overwrite elder fields)
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": name, "email": email, "picture": picture}},
        )
        user = await users_col.find_one({"_id": user["_id"]})

    token = create_access_token({"sub": str(user["_id"])})
    return {"message": "ok", "token": token, "user": _public_user(user)}


# ✅ Support BOTH POST and PUT so frontend never gets "Method Not Allowed"
@router.post("/profile")
async def create_or_update_profile(req: ProfileExtrasReq, user=Depends(get_current_user)):
    return await _save_profile(req, user)


@router.put("/profile")
async def update_profile(req: ProfileExtrasReq, user=Depends(get_current_user)):
    return await _save_profile(req, user)


async def _save_profile(req: ProfileExtrasReq, user: Dict[str, Any]):
    # clean arrays
    medical = _clean_list(req.medical)
    habits = _clean_list(req.habits)
    hobbies = _clean_list(req.hobbies)
    family = str(req.family or "").strip()

    update = {
        "age": req.age,
        "ageGroup": (req.ageGroup or "").strip(),
        "medical": medical,
        "family": family,
        "habits": habits,
        "hobbies": hobbies,
        "is_profile_complete": _is_profile_complete(req),
    }

    await users_col.update_one({"_id": str(user["_id"])}, {"$set": update})
    new_user = await users_col.find_one({"_id": str(user["_id"])})
    return {"message": "updated", "user": _public_user(new_user)}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {"user": _public_user(user)}