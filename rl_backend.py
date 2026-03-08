# ==========================
# RL GAME BACKEND (ONE FILE)
# FastAPI + PyTorch
# + Checkpoint Saving (latest.pt + best.pt)
# + ✅ Q-VALUE LOGGING ADDED (Terminal + Optional API response)
# ==========================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
import torch.optim as optim
import random
import os
import uuid
from typing import Dict, Any
from collections import deque  # ✅ ADDED

# ✅ ADDED: checkpoint utilities (make sure checkpoint.py is in same folder)
from checkpoint import CheckpointManager, TrainState  # ✅ ADDED

# ==========================
# FASTAPI SETUP
# ==========================
app = FastAPI(title="Emotion Adaptive RL Game Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# RL CONFIG
# ==========================
STATE_SIZE = 4
ACTION_SIZE = 5
GAMMA = 0.95
LR = 0.001
EPSILON_START = 1.0
EPSILON_MIN = 0.05
EPSILON_DECAY = 0.995

# Debug counters
action_counts = [0] * ACTION_SIZE

# ✅ Store decisions safely so they won't be overwritten
pending_decisions: Dict[str, Dict[str, Any]] = {}

# Optional: avoid memory growth
MAX_PENDING = 5000

# ==========================
# ACTION NAMES (kept here as original)
# ==========================
ACTIONS = [
    "NO_HELP",
    "SHOW_HINT",
    "GIVE_BOMB",
    "REDUCE_DIFFICULTY",
    "INCREASE_DIFFICULTY"
]

# ==========================
# DQN MODEL
# ==========================
class DQN(nn.Module):
    def __init__(self):
        super(DQN, self).__init__()
        self.fc1 = nn.Linear(STATE_SIZE, 32)
        self.fc2 = nn.Linear(32, 32)
        self.fc3 = nn.Linear(32, ACTION_SIZE)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)

# ==========================
# RL AGENT
# ==========================
class DQNAgent:
    def __init__(self):
        self.model = DQN()
        self.optimizer = optim.Adam(self.model.parameters(), lr=LR)
        self.loss_fn = nn.MSELoss()
        self.epsilon = EPSILON_START
        self.learn_steps = 0

    # ✅ UPDATED: act() now prints Q-values in terminal (does NOT remove existing behavior)
    def act(self, state):
        # Exploration (random action)
        if random.random() < self.epsilon:
            a = random.randint(0, ACTION_SIZE - 1)
            print(f"[QVALUES] explore=True state={state} -> RANDOM action={a}({ACTIONS[a]}) epsilon={self.epsilon:.4f}")
            return a

        # Exploitation (DQN prediction)
        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            q_values = self.model(state_tensor)[0]  # shape: [ACTION_SIZE]

        q_list = q_values.detach().cpu().tolist()
        best_action = int(torch.argmax(q_values).item())

        q_text = "  ".join([f"{ACTIONS[i]}={q_list[i]:.3f}" for i in range(ACTION_SIZE)])
        print(f"[QVALUES] explore=False state={state} -> {q_text}  best={best_action}({ACTIONS[best_action]}) epsilon={self.epsilon:.4f}")

        return best_action

    # ✅ ADDED: helper to return Q-values (optional use in API response)
    def get_q_values(self, state):
        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            q_values = self.model(state_tensor)[0]
        return q_values.detach().cpu().tolist()

    def learn(self, state, action, reward, next_state):
        self.model.train()

        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        next_state_tensor = torch.FloatTensor(next_state).unsqueeze(0)

        q_values = self.model(state_tensor)
        next_q_values = self.model(next_state_tensor)

        target_q = q_values.clone().detach()
        target_q[0][action] = reward + GAMMA * torch.max(next_q_values).item()

        loss = self.loss_fn(q_values, target_q)

        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        if self.epsilon > EPSILON_MIN:
            self.epsilon *= EPSILON_DECAY

        self.learn_steps += 1
        self.model.eval()

        print(f"[LEARN] step={self.learn_steps} loss={loss.item():.4f} epsilon={self.epsilon:.4f}")

        # ✅ IMPORTANT: return loss value for checkpoint stats
        return loss.item()

agent = DQNAgent()

# ✅ Load pretrained model safely
PRETRAIN_PATH = "pretrained_agent.pth"
if os.path.exists(PRETRAIN_PATH):
    agent.model.load_state_dict(torch.load(PRETRAIN_PATH, map_location="cpu"))
    agent.model.eval()
    print(f"[LOAD] Loaded pretrained model from {PRETRAIN_PATH}")
else:
    agent.model.eval()
    print(f"[LOAD] Pretrained model not found: {PRETRAIN_PATH} (starting fresh)")

# ==========================
# ✅ CHECKPOINT SETUP (GLOBAL) - ADDED
# ==========================
ckpt = CheckpointManager(ckpt_dir="checkpoints")
train_state = TrainState(step=0, episode=0, epsilon=agent.epsilon, best_win_rate=0.0)

win_history = deque(maxlen=50)     # rolling win-rate window
loss_history = deque(maxlen=200)   # rolling avg loss window
SAVE_EVERY_EPISODES = 25

# ✅ Correct mapping for your code:
MODEL = agent.model
OPTIMIZER = agent.optimizer

# Optional: auto-load latest checkpoint if exists
latest_path = os.path.join("checkpoints", "latest.pt")
if os.path.exists(latest_path):
    loaded_state, loaded_stats = ckpt.load(latest_path, MODEL, OPTIMIZER, map_location="cpu")
    train_state = loaded_state
    # keep agent epsilon in sync with loaded state
    agent.epsilon = train_state.epsilon
    print("[CHECKPOINT] Resumed from latest.pt | stats:", loaded_stats)

# ==========================
# DATA MODELS
# ==========================
class DecisionRequest(BaseModel):
    winRate: float = 0
    avgTime: float = 0
    retries: int = 0
    emotion: str = "neutral"

class FeedbackRequest(BaseModel):
    decisionId: str  # ✅ REQUIRED now
    winRate: float = 0
    avgTime: float = 0
    retries: int = 0
    emotion: str = "neutral"
    result: str = "lose"  # "win" or "lose"
    timePlayed: int = 0
    quitEarly: bool = False

# ==========================
# HELPERS
# ==========================
def emotion_to_number(emotion: str) -> float:
    return {
        "happy": 1.0,
        "neutral": 0.5,
        "sad": -0.5,
        "angry": -1.0
    }.get(str(emotion).lower(), 0.0)

def build_state(data) -> list:
    return [
        float(data.winRate),
        float(data.avgTime),
        float(data.retries),
        float(emotion_to_number(data.emotion))
    ]

def calculate_reward(data) -> float:
    reward = 0.0

    reward += 15 if data.result == "win" else -15

    emo = str(data.emotion).lower()
    if emo == "happy":
        reward += 5
    elif emo == "sad":
        reward -= 5
    elif emo == "angry":
        reward -= 8

    if data.timePlayed > 300:
        reward += 5
    if data.quitEarly:
        reward -= 10

    # small penalty for always doing nothing
    # action index 0 == NO_HELP
    return reward

def _maybe_trim_pending():
    if len(pending_decisions) > MAX_PENDING:
        for k in list(pending_decisions.keys())[:1000]:
            pending_decisions.pop(k, None)

# ==========================
# API ENDPOINTS
# ==========================
@app.post("/api/decision")
def get_decision(req: DecisionRequest):
    state = build_state(req)
    action = agent.act(state)

    # ✅ ADDED: get Q-values so you can also view in response (does not remove existing fields)
    q_values = agent.get_q_values(state)

    decision_id = str(uuid.uuid4())
    pending_decisions[decision_id] = {"state": state, "action": action}
    _maybe_trim_pending()

    action_counts[action] += 1
    print("[DECISION] id=", decision_id, " state=", state,
          " action=", action, ACTIONS[action], " epsilon=", round(agent.epsilon, 4))
    print("[ACTIONS] counts=", action_counts, " pending=", len(pending_decisions))

    return {
        "decisionId": decision_id,
        "action": action,
        "actionName": ACTIONS[action],
        "epsilon": round(agent.epsilon, 3),

        # ✅ ADDED: Q-values in API response
        "qValues": [round(x, 4) for x in q_values],
        "qValuesNamed": {ACTIONS[i]: round(q_values[i], 4) for i in range(ACTION_SIZE)}
    }

@app.post("/api/feedback")
def feedback(req: FeedbackRequest):
    info = pending_decisions.pop(req.decisionId, None)
    if info is None:
        print("[FEEDBACK] unknown decisionId:", req.decisionId)
        return {
            "reward": 0,
            "learning": "skipped (unknown decisionId - server restarted or wrong id)"
        }

    state = info["state"]
    action = info["action"]

    reward = calculate_reward(req)
    # penalize NO_HELP a bit so it doesn't dominate
    if int(action) == 0:
        reward -= 1.0

    next_state = build_state(req)

    print("[FEEDBACK] id=", req.decisionId, " result=", req.result,
          " reward=", reward, " action=", action, ACTIONS[action])

    # ✅ Capture loss value for checkpoint stats
    loss_value = agent.learn(state, action, reward, next_state)

    # =========================
    # ✅ CHECKPOINT SAVE (PER EPISODE) - ADDED
    # =========================
    train_state.episode += 1
    train_state.step = agent.learn_steps
    train_state.epsilon = agent.epsilon

    # update rolling histories
    win_history.append(1 if req.result == "win" else 0)
    try:
        loss_history.append(float(loss_value))
    except Exception:
        pass

    rolling_win_rate = (sum(win_history) / len(win_history)) if len(win_history) > 0 else 0.0
    avg_loss = (sum(loss_history) / len(loss_history)) if len(loss_history) > 0 else None

    stats = {
        "rolling_win_rate_50": rolling_win_rate,
        "wins_50": int(sum(win_history)),
        "episodes_in_window": int(len(win_history)),
        "avg_loss_200": avg_loss,
    }

    # Save latest every N episodes (overwrite latest.pt)
    if train_state.episode % SAVE_EVERY_EPISODES == 0:
        ckpt.save("latest.pt", MODEL, OPTIMIZER, train_state, stats)

    # Save best when win rate improves (only after window fills)
    if len(win_history) == win_history.maxlen and rolling_win_rate > train_state.best_win_rate:
        train_state.best_win_rate = rolling_win_rate
        ckpt.save("best.pt", MODEL, OPTIMIZER, train_state, stats)

    return {
        "reward": reward,
        "learning": "updated"
    }

# Run with:
# python -m uvicorn rl_backend:app --reload
