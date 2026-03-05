from __future__ import annotations

from typing import Dict, Tuple, Any
import io
import numpy as np
import soundfile as sf
from transformers import pipeline

# Strong public speech emotion model (4 classes)
# Labels typically: angry, happy, sad, neutral
_VOICE_MODEL_NAME = "superb/hubert-large-superb-er"

_classifier = None
TARGET5 = ["happy", "sad", "surprise", "neutral", "angry"]


def _lazy_load():
    global _classifier
    if _classifier is None:
        _classifier = pipeline(
            task="audio-classification",
            model=_VOICE_MODEL_NAME,
            top_k=None
        )


def _resample_linear(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    """Simple linear resample (good enough for demo)."""
    if sr_in == sr_out:
        return x.astype(np.float32)
    if x.size == 0:
        return x.astype(np.float32)
    duration = len(x) / float(sr_in)
    n_out = int(duration * sr_out)
    if n_out <= 1:
        return x.astype(np.float32)
    t_in = np.linspace(0.0, duration, num=len(x), endpoint=False)
    t_out = np.linspace(0.0, duration, num=n_out, endpoint=False)
    y = np.interp(t_out, t_in, x).astype(np.float32)
    return y


def _map_label_to_target5(label: str) -> str:
    l = (label or "").lower()
    if "happy" in l or "joy" in l:
        return "happy"
    if "sad" in l:
        return "sad"
    if "angry" in l or "anger" in l:
        return "angry"
    if "neutral" in l:
        return "neutral"
    # Anything else -> neutral (safe)
    return "neutral"


# -------------------- Voice quality helpers --------------------
def _rms(x: np.ndarray) -> float:
    if x.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(x * x) + 1e-12))


def _clip_ratio(x: np.ndarray, thr: float = 0.98) -> float:
    if x.size == 0:
        return 0.0
    return float(np.mean(np.abs(x) >= thr))


def _estimate_snr_db(x: np.ndarray, sr: int) -> float:
    """
    Simple SNR estimate:
      - compute short-time RMS frames
      - noise floor = 20th percentile
      - signal level = 80th percentile
    """
    if x.size < int(sr * 0.3):
        return -100.0
    frame = int(0.025 * sr)  # 25ms
    hop = int(0.010 * sr)    # 10ms
    if frame <= 0 or hop <= 0:
        return -100.0

    rms_list = []
    for i in range(0, len(x) - frame, hop):
        seg = x[i:i + frame]
        rms_list.append(_rms(seg))

    if not rms_list:
        return -100.0

    rms_arr = np.array(rms_list, dtype=np.float32)
    noise = float(np.percentile(rms_arr, 20)) + 1e-9
    signal = float(np.percentile(rms_arr, 80)) + 1e-9
    return float(20.0 * np.log10(signal / noise))


def _speech_presence(x: np.ndarray, sr: int) -> bool:
    """
    Lightweight gate:
      - enough length
      - RMS above threshold
      - ZCR within human speech range
    """
    if x.size < int(sr * 0.35):
        return False
    rms = _rms(x)

    # ZCR (manual, no librosa)
    s = np.sign(x)
    s[s == 0] = 1
    zc = float(np.mean(s[1:] != s[:-1]))  # ~0..1

    return (rms > 0.010) and (0.02 < zc < 0.25)


def _clamp01(v: float) -> float:
    return float(max(0.0, min(1.0, v)))


def _quality_report(x: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Returns voice quality fields for fusion.
    """
    if x.size == 0:
        return {
            "speech_present": False,
            "snr_est": -100.0,
            "clip_ratio": 0.0,
            "rms": 0.0,
            "quality_score": 0.0,
            "usable": False,
            "warning": "empty_audio",
        }

    rms = _rms(x)
    clip = _clip_ratio(x)
    snr = _estimate_snr_db(x, sr)
    speech = _speech_presence(x, sr)

    # scoring
    # snr: 0dB -> 0, 20dB -> 1
    snr_score = _clamp01((snr - 0.0) / 20.0)
    # rms: 0.01 -> 0, 0.08 -> 1
    rms_score = _clamp01((rms - 0.01) / (0.08 - 0.01))
    # clipping: 0 -> 1, 5% -> 0
    clip_score = _clamp01(1.0 - (clip / 0.05))

    quality = float(0.55 * snr_score + 0.25 * clip_score + 0.20 * rms_score)

    usable = True
    warning = None

    # hard gates
    if not speech:
        usable = False
        warning = "no_speech_detected"
    elif rms < 0.010:
        usable = False
        warning = "too_quiet"
    elif clip > 0.06:
        usable = False
        warning = "too_much_clipping"
    elif snr < 3.0:
        usable = False
        warning = "too_noisy"

    return {
        "speech_present": bool(speech),
        "snr_est": float(snr),
        "clip_ratio": float(clip),
        "rms": float(rms),
        "quality_score": float(quality),
        "usable": bool(usable),
        "warning": warning,
    }


# -------------------- NEW: trim silence before model --------------------
def _trim_silence(x: np.ndarray, thr: float = 0.012, min_keep: int = 16000) -> np.ndarray:
    """
    Remove leading/trailing silence based on abs amplitude threshold.
    Keeps at least min_keep samples (1s at 16k).
    """
    if x.size == 0:
        return x
    a = np.abs(x)
    idx = np.where(a > thr)[0]
    if idx.size == 0:
        return x[:min_keep] if x.size > min_keep else x

    start = int(idx[0])
    end = int(idx[-1]) + 1
    y = x[start:end]

    if y.size < min_keep and x.size >= min_keep:
        mid = (start + end) // 2
        half = min_keep // 2
        s = max(0, mid - half)
        e = min(x.size, s + min_keep)
        return x[s:e]

    return y


def _neutral_low() -> Tuple[str, float, Dict[str, float]]:
    probs = {k: 0.05 for k in TARGET5}
    probs["neutral"] = 0.80
    probs["surprise"] = 0.05
    return "neutral", 0.15, probs


def predict_voice_emotion(wav_bytes: bytes) -> Tuple[str, float, Dict[str, float], Dict[str, Any]]:
    """
    Input: WAV bytes (mono recommended)
    Output: (label, confidence, probs for TARGET5, quality_fields)
    """
    _lazy_load()

    # Read wav bytes
    data, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32", always_2d=False)

    # Convert stereo -> mono
    if isinstance(data, np.ndarray) and data.ndim == 2:
        data = np.mean(data, axis=1).astype(np.float32)

    x = _resample_linear(np.asarray(data, dtype=np.float32), int(sr), 16000)

    # if too short -> neutral (usable false)
    if len(x) < int(16000 * 0.35):
        label, conf, probs = "neutral", 1.0, {k: 0.0 for k in TARGET5}
        probs["neutral"] = 1.0
        q = {
            "speech_present": False,
            "snr_est": -100.0,
            "clip_ratio": float(_clip_ratio(x)) if x.size else 0.0,
            "rms": float(_rms(x)) if x.size else 0.0,
            "quality_score": 0.0,
            "usable": False,
            "warning": "too_short",
        }
        return label, float(conf), probs, q

    # quality report (on raw)
    q = _quality_report(x, 16000)

    # if unusable -> low confidence neutral so fusion downweights voice
    if not q["usable"]:
        label, conf, probs = _neutral_low()
        return label, float(conf), probs, q

    # ✅ NEW: trim silence before model inference
    x = _trim_silence(x, thr=0.012, min_keep=int(16000 * 1.0))

    # model inference
    out = _classifier({"array": x, "sampling_rate": 16000})
    agg = {k: 0.0 for k in TARGET5}

    for item in out:
        tgt = _map_label_to_target5(item.get("label", ""))
        agg[tgt] += float(item.get("score", 0.0))

    # Surprise is not reliable in this voice model
    agg["surprise"] = 0.0

    total = float(sum(agg.values()))
    if total <= 0:
        agg = {k: 0.0 for k in TARGET5}
        agg["neutral"] = 1.0
        total = 1.0

    probs = {k: float(v / total) for k, v in agg.items()}
    label = max(probs, key=probs.get)
    conf = float(probs[label])

    # quality-aware confidence scaling (smooth)
    conf = conf * (0.6 + 0.4 * float(q["quality_score"]))

    # ✅ NEW: low-confidence => neutral (prevents random sad)
    if conf < 0.45:
        label, conf, probs = _neutral_low()

    return label, float(conf), probs, q