from __future__ import annotations
from typing import Dict, Tuple
import numpy as np
from transformers import pipeline

# We use a strong public emotion classifier and map to your 5 labels.
# This model outputs: joy, sadness, anger, fear, surprise, disgust, neutral (varies by model)
_TEXT_MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"

_classifier = None

TARGET5 = ["happy", "sad", "surprise", "neutral", "angry"]

def _lazy_load():
    global _classifier
    if _classifier is None:
        _classifier = pipeline(
            "text-classification",
            model=_TEXT_MODEL_NAME,
            top_k=None,          # return all labels with scores
            truncation=True
        )

def _map_label_to_target5(label: str) -> str:
    l = label.lower()
    # Common label sets across emotion models
    if l in ["joy", "happiness", "happy"]:
        return "happy"
    if l in ["sadness", "sad"]:
        return "sad"
    if l in ["surprise"]:
        return "surprise"
    if l in ["anger", "angry"]:
        return "angry"
    if l in ["neutral"]:
        return "neutral"

    # Others (fear, disgust, etc.) -> neutral (safer for elders)
    return "neutral"


def predict_text_emotion(text: str) -> Tuple[str, float, Dict[str, float]]:
    """
    Returns:
      - final_label: one of TARGET5
      - confidence: float in [0,1] of final_label
      - probs: dict TARGET5 -> probability (sums to 1)
    """
    _lazy_load()

    text = (text or "").strip()
    if len(text) == 0:
        probs = {k: 0.0 for k in TARGET5}
        probs["neutral"] = 1.0
        return "neutral", 1.0, probs

    # Get model outputs (list of dicts with label + score)
    out = _classifier(text)
    # pipeline returns list for each input; for single string => list[dict] OR list[list[dict]]
    scores_list = out[0] if isinstance(out, list) and len(out) > 0 and isinstance(out[0], list) else out

    # Aggregate into TARGET5
    agg = {k: 0.0 for k in TARGET5}
    for item in scores_list:
        lab = item["label"]
        sc = float(item["score"])
        tgt = _map_label_to_target5(lab)
        agg[tgt] += sc

    # Normalize
    total = sum(agg.values())
    if total <= 0:
        agg["neutral"] = 1.0
        total = 1.0
    probs = {k: v / total for k, v in agg.items()}

    final_label = max(probs, key=probs.get)
    confidence = float(probs[final_label])
    return final_label, confidence, probs