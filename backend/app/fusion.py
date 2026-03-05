from __future__ import annotations

from typing import Dict, Any, Tuple
import math

TARGET5 = ["happy", "sad", "surprise", "neutral", "angry"]


def _safe_probs(p: Any) -> Dict[str, float]:
    if not isinstance(p, dict):
        return {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0}
    out = {k: float(p.get(k, 0.0)) for k in TARGET5}
    s = sum(out.values())
    if s <= 0:
        return {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0}
    return {k: out[k] / s for k in TARGET5}


def _clamp01(x: float) -> float:
    try:
        x = float(x)
    except Exception:
        return 0.0
    return max(0.0, min(1.0, x))


def _argmax(probs: Dict[str, float]) -> Tuple[str, float]:
    best_k = "neutral"
    best_v = -1.0
    for k in TARGET5:
        v = float(probs.get(k, 0.0))
        if v > best_v:
            best_v = v
            best_k = k
    return best_k, max(0.0, best_v)


def _confidence_gate(conf: float) -> float:
    """
    Soft gate: low confidence becomes almost 0 contribution.
    """
    c = _clamp01(conf)
    # non-linear to punish low confidence
    return c * c


def _quality_gate(q: float) -> float:
    """
    Soft gate: low quality reduces contribution.
    """
    return _clamp01(q)


def _emotion_bias_for_elders(label: str, conf: float) -> float:
    """
    Elder-safe bias:
    - require a bit more confidence to declare angry/sad
    - neutral/happy allowed easier
    Returns multiplier 0..1
    """
    l = (label or "neutral").lower()
    c = _clamp01(conf)

    if l in ("angry", "sad"):
        # if confidence is not strong, reduce
        if c < 0.62:
            return 0.75
        return 1.0

    if l == "surprise":
        if c < 0.55:
            return 0.85
        return 1.0

    if l == "happy":
        return 1.05

    # neutral
    return 1.0


def fuse_probs(
    face_probs: Dict[str, float] | None,
    face_conf: float,
    voice_probs: Dict[str, float] | None,
    voice_conf: float,
    text_probs: Dict[str, float] | None,
    text_conf: float,
    text_available: bool,
    face_quality: float = 1.0,
    voice_quality: float = 1.0,
    face_present: bool = True,
    face_usable: bool = True,
) -> Tuple[str, float, Dict[str, float], Dict[str, float]]:
    """
    Returns: (label, confidence, fused_probs, weights)
    """

    fp = _safe_probs(face_probs)
    vp = _safe_probs(voice_probs)
    tp = _safe_probs(text_probs) if (text_available and text_probs is not None) else None

    # --- modality raw weights from confidence & quality
    w_face = _confidence_gate(face_conf) * _quality_gate(face_quality)
    w_voice = _confidence_gate(voice_conf) * _quality_gate(voice_quality)
    w_text = _confidence_gate(text_conf) if text_available else 0.0

    # Face extra safety:
    # if no face detected or not usable, reduce face weight hard
    if (not face_present) or (not face_usable):
        w_face *= 0.15

    # Minimum contribution so fusion doesn’t collapse
    w_face = max(w_face, 0.05)
    w_voice = max(w_voice, 0.05)
    if text_available:
        w_text = max(w_text, 0.02)

    # If text not available, force 0
    if not text_available:
        w_text = 0.0

    # Normalize weights
    total_w = w_face + w_voice + w_text
    if total_w <= 0:
        w_face, w_voice, w_text = 0.5, 0.5, 0.0
        total_w = 1.0

    w_face /= total_w
    w_voice /= total_w
    w_text /= total_w

    # --- fuse probs
    fused = {k: 0.0 for k in TARGET5}

    for k in TARGET5:
        fused[k] += w_face * float(fp.get(k, 0.0))
        fused[k] += w_voice * float(vp.get(k, 0.0))
        if tp is not None:
            fused[k] += w_text * float(tp.get(k, 0.0))

    # normalize fused probs
    s = sum(fused.values())
    if s <= 0:
        fused = {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0}
    else:
        fused = {k: fused[k] / s for k in TARGET5}

    label, conf = _argmax(fused)

    # elder-safe bias (don’t panic on small noise)
    conf = _clamp01(conf) * _emotion_bias_for_elders(label, conf)

    weights = {"face": float(w_face), "voice": float(w_voice), "text": float(w_text)}
    return label, float(conf), fused, weights


def fuse_emotions(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Payload from frontend:

    {
      "face": {"confidence": 0.0, "probs": {...}, "quality_score":0.0, "usable":true, "face_present":true},
      "voice":{"confidence": 0.0, "probs": {...}, "quality_score":0.0},
      "text": {"confidence": 0.0, "probs": {...}},
      "text_available": true
    }
    """
    face = payload.get("face") or {}
    voice = payload.get("voice") or {}
    text = payload.get("text") or {}
    text_available = bool(payload.get("text_available", False))

    label, conf, probs, weights = fuse_probs(
        face_probs=face.get("probs"),
        face_conf=float(face.get("confidence", 0.0) or 0.0),
        voice_probs=voice.get("probs"),
        voice_conf=float(voice.get("confidence", 0.0) or 0.0),
        text_probs=text.get("probs") if text_available else None,
        text_conf=float(text.get("confidence", 0.0) or 0.0),
        text_available=text_available,
        face_quality=float(face.get("quality_score", 1.0) or 1.0),
        voice_quality=float(voice.get("quality_score", 1.0) or 1.0),
        face_present=bool(face.get("face_present", True)),
        face_usable=bool(face.get("usable", True)),
    )

    return {
        "modality": "fusion",
        "label": label,
        "confidence": float(conf),
        "probs": probs,
        "weights": weights,
        "text_available": text_available,
    }