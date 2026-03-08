import os
import time
from dataclasses import dataclass, asdict
import torch


# ==========================
# TRAIN STATE
# ==========================
@dataclass
class TrainState:
    step: int = 0
    episode: int = 0
    epsilon: float = 1.0
    best_win_rate: float = 0.0


# ==========================
# CHECKPOINT MANAGER
# ==========================
class CheckpointManager:
    def __init__(self, ckpt_dir="checkpoints", keep_last=5):
        self.ckpt_dir = ckpt_dir
        self.keep_last = keep_last
        os.makedirs(self.ckpt_dir, exist_ok=True)

    def _ckpt_path(self, name: str) -> str:
        return os.path.join(self.ckpt_dir, name)

    # --------------------------
    # SAVE CHECKPOINT
    # --------------------------
    def save(self, name, model, optimizer, train_state: TrainState, stats: dict):
        payload = {
            "time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "train_state": asdict(train_state),
            "stats": stats,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict() if optimizer is not None else None,
        }

        path = self._ckpt_path(name)
        torch.save(payload, path)
        print(f"[CHECKPOINT] saved -> {path}")

    # --------------------------
    # LOAD CHECKPOINT
    # --------------------------
    def load(self, path, model, optimizer=None, map_location="cpu"):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Checkpoint not found: {path}")

        payload = torch.load(path, map_location=map_location)

        model.load_state_dict(payload["model_state_dict"])

        if optimizer is not None and payload.get("optimizer_state_dict") is not None:
            optimizer.load_state_dict(payload["optimizer_state_dict"])

        train_state = TrainState(**payload.get("train_state", {}))
        stats = payload.get("stats", {})

        print(f"[CHECKPOINT] loaded <- {path}")
        return train_state, stats
