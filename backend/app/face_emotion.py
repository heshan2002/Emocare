from __future__ import annotations

import time
from pathlib import Path
from typing import Dict, Tuple, Optional

import cv2
import numpy as np
import requests
from ultralytics import YOLO
from deepface import DeepFace

TARGET5 = ["happy", "sad", "surprise", "neutral", "angry"]


# ---------------- YOLO face model (download if missing) ----------------
def _download_file(url: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)

def _get_yolo_face_model() -> YOLO:
    models_dir = Path(__file__).resolve().parent.parent / "models"
    weights_path = models_dir / "yolov8n-face.pt"
    if not weights_path.exists():
        url = "https://huggingface.co/junjiang/GestureFace/resolve/main/yolov8n-face.pt"
        try:
            print(f"[face] Downloading YOLO face weights to: {weights_path}")
            _download_file(url, weights_path)
        except Exception as e:
            raise RuntimeError(
                f"Could not download yolov8n-face.pt automatically.\n"
                f"Download manually and place at: {weights_path}\n"
                f"Download error: {e}"
            )
    return YOLO(str(weights_path))

_YOLO_FACE: Optional[YOLO] = None
def _ensure_model() -> YOLO:
    global _YOLO_FACE
    if _YOLO_FACE is None:
        _YOLO_FACE = _get_yolo_face_model()
    return _YOLO_FACE


# ---------------- Utility: mapping + normalize ----------------
def _softmax_like(scores: Dict[str, float]) -> Dict[str, float]:
    out = {k: float(scores.get(k, 0.0)) for k in scores.keys()}
    s = float(sum(out.values()))
    if s <= 0:
        return {}
    return {k: v / s for k, v in out.items()}

def _map_to_5(emotions: Dict[str, float]) -> Dict[str, float]:
    p = _softmax_like(emotions)
    mapped = {k: 0.0 for k in TARGET5}
    mapped["happy"] += p.get("happy", 0.0)
    mapped["sad"] += p.get("sad", 0.0)
    mapped["surprise"] += p.get("surprise", 0.0)
    mapped["neutral"] += p.get("neutral", 0.0)
    mapped["neutral"] += p.get("fear", 0.0)
    mapped["angry"] += p.get("angry", 0.0) + p.get("disgust", 0.0)
    s = float(sum(mapped.values()))
    if s <= 0:
        return {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0}
    return {k: v / s for k, v in mapped.items()}

def _argmax(probs: Dict[str, float]) -> Tuple[str, float]:
    best_k = "neutral"
    best_v = -1.0
    for k in TARGET5:
        v = float(probs.get(k, 0.0))
        if v > best_v:
            best_v = v
            best_k = k
    return best_k, max(0.0, best_v)


# ---------------- Quality checks -> produce score 0..1 ----------------
def _blur_score(gray_face: np.ndarray) -> float:
    return float(cv2.Laplacian(gray_face, cv2.CV_64F).var())

def _brightness_score(gray_face: np.ndarray) -> float:
    return float(np.mean(gray_face))

def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def _quality_eval(face_bgr: np.ndarray) -> Tuple[bool, Dict[str, float], str, float]:
    """
    Returns:
      ok: usable for emotion
      metrics
      reason
      quality_score in [0..1]
    """
    h, w = face_bgr.shape[:2]
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)

    blur = _blur_score(gray)
    bright = _brightness_score(gray)
    min_side = float(min(h, w))

    # thresholds
    MIN_SIZE = 80
    MIN_BLUR = 55.0
    MIN_BRIGHT = 50.0
    MAX_BRIGHT = 220.0

    # score components
    # blur: 55 -> 0, 140 -> 1
    blur_score = _clamp01((blur - 55.0) / (140.0 - 55.0))

    # size: 80 -> 0, 160 -> 1
    size_score = _clamp01((min_side - 80.0) / (160.0 - 80.0))

    # brightness: best around 120; penalize too dark/too bright
    # map distance from 120 to a score
    dist = abs(bright - 120.0)
    # dist 0 -> 1, dist 80 -> ~0
    bright_score = _clamp01(1.0 - (dist / 80.0))

    # overall quality
    quality = 0.45 * blur_score + 0.35 * bright_score + 0.20 * size_score

    reason = "ok"
    ok = True

    if min_side < MIN_SIZE:
        ok = False
        reason = "face_too_small"
    elif blur < MIN_BLUR:
        ok = False
        reason = "too_blurry"
    elif bright < MIN_BRIGHT:
        ok = False
        reason = "too_dark"
    elif bright > MAX_BRIGHT:
        ok = False
        reason = "too_bright"

    metrics = {"blur": blur, "bright": bright, "min_side": min_side}
    return ok, metrics, reason, float(quality)


# ---------------- Tracking helpers ----------------
def _xyxy_to_xywh(x1, y1, x2, y2) -> Tuple[int, int, int, int]:
    return int(x1), int(y1), int(max(0, x2 - x1)), int(max(0, y2 - y1))

def _iou_xywh(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ax2, ay2 = ax + aw, ay + ah
    bx2, by2 = bx + bw, by + bh
    ix1, iy1 = max(ax, bx), max(ay, by)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    inter = iw * ih
    union = (aw * ah) + (bw * bh) - inter
    if union <= 0:
        return 0.0
    return float(inter / union)

def _expand_bbox(x: int, y: int, w: int, h: int, img_w: int, img_h: int, pad: float = 0.22) -> Tuple[int, int, int, int]:
    px = int(w * pad)
    py = int(h * pad)
    x1 = max(0, x - px)
    y1 = max(0, y - py)
    x2 = min(img_w, x + w + px)
    y2 = min(img_h, y + h + py)
    return x1, y1, x2 - x1, y2 - y1


# ---------------- Face selection (main + tracking) ----------------
_LAST_FACE: Optional[Tuple[int, int, int, int]] = None  # xywh

def _pick_main_face(xyxy: np.ndarray, confs: np.ndarray, img_w: int, img_h: int, conf_thres: float) -> Optional[Tuple[int,int,int,int,float]]:
    cx_img = img_w / 2.0
    cy_img = img_h / 2.0
    best = None
    best_score = -1.0

    for (x1, y1, x2, y2), c in zip(xyxy, confs):
        c = float(c)
        if c < conf_thres:
            continue
        w = max(0.0, x2 - x1)
        h = max(0.0, y2 - y1)
        area = w * h
        if area <= 0:
            continue

        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        dist = ((cx - cx_img) ** 2 + (cy - cy_img) ** 2) ** 0.5
        max_dist = ((cx_img) ** 2 + (cy_img) ** 2) ** 0.5
        center_bonus = 1.0 - (dist / max_dist)

        score = (area * 0.7) + (center_bonus * area * 0.3)

        if score > best_score:
            best_score = score
            x, y, ww, hh = _xyxy_to_xywh(x1, y1, x2, y2)
            best = (x, y, ww, hh, c)

    return best

def _pick_tracked_face(xyxy: np.ndarray, confs: np.ndarray, conf_thres: float, min_iou: float = 0.20) -> Optional[Tuple[int,int,int,int,float]]:
    global _LAST_FACE
    if _LAST_FACE is None:
        return None

    best = None
    best_iou = -1.0
    for (x1, y1, x2, y2), c in zip(xyxy, confs):
        c = float(c)
        if c < conf_thres:
            continue
        cand = _xyxy_to_xywh(x1, y1, x2, y2)
        iou = _iou_xywh(_LAST_FACE, cand)
        if iou > best_iou:
            best_iou = iou
            best = (cand[0], cand[1], cand[2], cand[3], c)

    if best is None or best_iou < min_iou:
        return None
    return best

def _face_bbox_yolo_tracked(bgr: np.ndarray, conf_thres: float = 0.35) -> Optional[Tuple[int,int,int,int,float]]:
    model = _ensure_model()
    res = model.predict(bgr, verbose=False, conf=conf_thres)
    if not res or len(res) == 0:
        return None
    boxes = res[0].boxes
    if boxes is None or len(boxes) == 0:
        return None

    xyxy = boxes.xyxy.cpu().numpy()
    confs = boxes.conf.cpu().numpy() if boxes.conf is not None else np.ones((xyxy.shape[0],), dtype=np.float32)

    picked = _pick_tracked_face(xyxy, confs, conf_thres, min_iou=0.20)
    if picked is None:
        H, W = bgr.shape[:2]
        picked = _pick_main_face(xyxy, confs, W, H, conf_thres)
    return picked


# ---------------- DeepFace speed cache ----------------
_DEEPFACE_CALL_COUNT = 0
_LAST_EMO: Dict = {
    "label": "neutral",
    "confidence": 0.15,
    "probs": {"happy": 0.05, "sad": 0.05, "surprise": 0.05, "neutral": 0.80, "angry": 0.05},
}
_LAST_EMO_TIME = 0.0


def detect_face_emotion(image_bytes: bytes) -> Dict:
    global _LAST_FACE, _DEEPFACE_CALL_COUNT, _LAST_EMO, _LAST_EMO_TIME

    npbuf = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(npbuf, cv2.IMREAD_COLOR)
    if bgr is None:
        return {
            "modality": "face",
            "face_present": False,
            "usable": False,
            "quality_score": 0.0,
            "label": "neutral",
            "confidence": 1.0,
            "probs": {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0},
            "error": "invalid_image",
        }

    H, W = bgr.shape[:2]

    bbox = _face_bbox_yolo_tracked(bgr, conf_thres=0.35)
    if bbox is None:
        _LAST_FACE = None
        return {
            "modality": "face",
            "face_present": False,
            "usable": False,
            "quality_score": 0.0,
            "label": "neutral",
            "confidence": 1.0,
            "probs": {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0},
            "error": "no_face",
        }

    x, y, w, h, det_conf = bbox
    _LAST_FACE = (int(x), int(y), int(w), int(h))

    x, y, w, h = _expand_bbox(int(x), int(y), int(w), int(h), W, H, pad=0.22)
    face_bgr = bgr[y : y + h, x : x + w]
    if face_bgr.size == 0:
        return {
            "modality": "face",
            "face_present": True,
            "usable": False,
            "quality_score": 0.0,
            "label": "neutral",
            "confidence": 1.0,
            "probs": {"happy": 0, "sad": 0, "surprise": 0, "neutral": 1, "angry": 0},
            "error": "bad_crop",
        }

    ok, metrics, reason, quality_score = _quality_eval(face_bgr)

    # If not usable -> neutral low confidence so fusion downweights
    if not ok:
        return {
            "modality": "face",
            "face_present": True,
            "usable": False,
            "quality_score": float(quality_score),
            "label": "neutral",
            "confidence": 0.15,
            "probs": {"happy": 0.05, "sad": 0.05, "surprise": 0.05, "neutral": 0.80, "angry": 0.05},
            "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "quality": metrics,
            "warning": reason,
            "det_conf": float(det_conf),
            "tracked": True,
            "cached": True,
        }

    # ---------------- DeepFace throttling ----------------
    RUN_EVERY_N_CALLS = 2
    MAX_CACHE_AGE_SEC = 1.5

    _DEEPFACE_CALL_COUNT += 1
    now_t = time.time()
    should_run = (_DEEPFACE_CALL_COUNT % RUN_EVERY_N_CALLS == 0) or ((now_t - _LAST_EMO_TIME) > MAX_CACHE_AGE_SEC)

    if not should_run:
        out = dict(_LAST_EMO)
        out.update({
            "modality": "face",
            "face_present": True,
            "usable": True,
            "quality_score": float(quality_score),
            "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "quality": metrics,
            "det_conf": float(det_conf),
            "tracked": True,
            "cached": True,
        })
        return out

    # run DeepFace
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    try:
        analysis = DeepFace.analyze(img_path=face_rgb, actions=["emotion"], enforce_detection=False)
        if isinstance(analysis, list) and len(analysis) > 0:
            analysis = analysis[0]

        emotions = analysis.get("emotion", {}) if isinstance(analysis, dict) else {}
        probs5 = _map_to_5(emotions)
        label, conf = _argmax(probs5)

        conf = float(conf) * (0.6 + 0.4 * float(det_conf))

        out = {
            "modality": "face",
            "face_present": True,
            "usable": True,
            "quality_score": float(quality_score),
            "label": label,
            "confidence": float(conf),
            "probs": probs5,
            "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "quality": metrics,
            "det_conf": float(det_conf),
            "tracked": True,
            "cached": False,
        }

        _LAST_EMO = {"label": label, "confidence": float(conf), "probs": probs5}
        _LAST_EMO_TIME = now_t
        return out

    except Exception as e:
        out = dict(_LAST_EMO)
        out.update({
            "modality": "face",
            "face_present": True,
            "usable": True,  # face is usable, but deepface failed
            "quality_score": float(quality_score),
            "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "quality": metrics,
            "det_conf": float(det_conf),
            "tracked": True,
            "cached": True,
            "error": f"deepface_error: {e}",
        })
        return out