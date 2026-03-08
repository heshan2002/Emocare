# ==========================
# RL GAME BACKEND - IMPROVED
# FastAPI + PyTorch
# ✅ IMPROVEMENTS:
#   - STATE_SIZE 4 → 8 (sessionDuration, consecutiveLosses, hintAcceptRate, moveHesitation)
#   - Dueling DQN architecture (Value + Advantage streams)
#   - Prioritized Experience Replay Buffer (capacity 10,000)
#   - Elder-calibrated reward function (safety caps, frustration prevention)
#   - ACTION_SIZE 5 → 7 (PAUSE_SUGGEST, SIMPLIFY_BOARD)
#   - Continuous emotion (valence + arousal)
#   - Session logging to research_log.jsonl
#   - Safety: frustration spiral detection, session cap enforcement
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
import json
from datetime import datetime
from typing import Dict, Any, Optional
from collections import deque
import numpy as np

from checkpoint import CheckpointManager, TrainState

# ==========================
# FASTAPI SETUP
# ==========================
app = FastAPI(title="Emotion Adaptive RL Game Backend (Improved)")

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
STATE_SIZE = 8      # winRate, avgTime, retries, valence, arousal,
                    # sessionDuration, consecutiveLosses, hintAcceptRate
ACTION_SIZE = 7     # +PAUSE_SUGGEST, +SIMPLIFY_BOARD
GAMMA = 0.95
LR = 0.0005
EPSILON_START = 1.0
EPSILON_MIN = 0.05
EPSILON_DECAY = 0.995

MAX_SESSION_MINUTES = 45
FRUSTRATION_WINDOW = 3

action_counts = [0] * ACTION_SIZE
pending_decisions: Dict[str, Dict[str, Any]] = {}
MAX_PENDING = 5000

# ==========================
# ACTION NAMES
# ==========================
ACTIONS = [
    "NO_HELP",
    "SHOW_HINT",
    "GIVE_BOMB",
    "REDUCE_DIFFICULTY",
    "INCREASE_DIFFICULTY",
    "PAUSE_SUGGEST",
    "SIMPLIFY_BOARD",
]

# ==========================
# DUELING DQN MODEL
# ==========================
class DuelingDQN(nn.Module):
    def __init__(self):
        super(DuelingDQN, self).__init__()
        self.shared = nn.Sequential(
            nn.Linear(STATE_SIZE, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
        )
        self.value_stream = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )
        self.advantage_stream = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, ACTION_SIZE),
        )

    def forward(self, x):
        features = self.shared(x)
        value = self.value_stream(features)
        advantage = self.advantage_stream(features)
        return value + advantage - advantage.mean(dim=1, keepdim=True)


# ==========================
# PRIORITIZED REPLAY BUFFER
# ==========================
class PrioritizedReplayBuffer:
    def __init__(self, capacity=10000, alpha=0.6, beta_start=0.4):
        self.capacity = capacity
        self.alpha = alpha
        self.beta = beta_start
        self.beta_increment = 0.001
        self.buffer = []
        self.priorities = []
        self.pos = 0

    def push(self, state, action, reward, next_state):
        max_priority = max(self.priorities, default=1.0)
        if len(self.buffer) < self.capacity:
            self.buffer.append((state, action, reward, next_state))
            self.priorities.append(max_priority)
        else:
            self.buffer[self.pos] = (state, action, reward, next_state)
            self.priorities[self.pos] = max_priority
            self.pos = (self.pos + 1) % self.capacity

    def sample(self, batch_size=32):
        if len(self.buffer) < batch_size:
            return None
        probs = np.array(self.priorities) ** self.alpha
        probs /= probs.sum()
        indices = np.random.choice(len(self.buffer), batch_size, p=probs, replace=False)
        samples = [self.buffer[i] for i in indices]
        total = len(self.buffer)
        weights = (total * probs[indices]) ** (-self.beta)
        weights /= weights.max()
        self.beta = min(1.0, self.beta + self.beta_increment)
        states = torch.FloatTensor([s[0] for s in samples])
        actions = torch.LongTensor([s[1] for s in samples])
        rewards = torch.FloatTensor([s[2] for s in samples])
        next_states = torch.FloatTensor([s[3] for s in samples])
        weights_t = torch.FloatTensor(weights)
        return states, actions, rewards, next_states, indices, weights_t

    def update_priorities(self, indices, td_errors):
        for i, err in zip(indices, td_errors):
            self.priorities[i] = abs(err) + 1e-6

    def __len__(self):
        return len(self.buffer)


# ==========================
# DQN AGENT
# ==========================
class DQNAgent:
    def __init__(self):
        self.model = DuelingDQN()
        self.target_model = DuelingDQN()
        self.target_model.load_state_dict(self.model.state_dict())
        self.target_model.eval()
        self.optimizer = optim.Adam(self.model.parameters(), lr=LR)
        self.loss_fn = nn.SmoothL1Loss(reduction='none')
        self.replay_buffer = PrioritizedReplayBuffer(capacity=10000)
        self.epsilon = EPSILON_START
        self.learn_steps = 0
        self.target_update_freq = 50

    def act(self, state):
        if random.random() < self.epsilon:
            a = random.randint(0, ACTION_SIZE - 1)
            print(f"[QVALUES] explore=True -> RANDOM action={a}({ACTIONS[a]}) epsilon={self.epsilon:.4f}")
            return a
        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            q_values = self.model(state_tensor)[0]
        q_list = q_values.detach().cpu().tolist()
        best_action = int(torch.argmax(q_values).item())
        q_text = "  ".join([f"{ACTIONS[i]}={q_list[i]:.3f}" for i in range(ACTION_SIZE)])
        print(f"[QVALUES] explore=False -> {q_text}  best={best_action}({ACTIONS[best_action]}) epsilon={self.epsilon:.4f}")
        return best_action

    def get_q_values(self, state):
        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            q_values = self.model(state_tensor)[0]
        return q_values.detach().cpu().tolist()

    def store(self, state, action, reward, next_state):
        self.replay_buffer.push(state, action, reward, next_state)

    def learn_from_buffer(self, batch_size=32):
        sample = self.replay_buffer.sample(batch_size)
        if sample is None:
            return None
        states, actions, rewards, next_states, indices, weights = sample
        self.model.train()
        q_values = self.model(states)
        current_q = q_values.gather(1, actions.unsqueeze(1)).squeeze(1)
        with torch.no_grad():
            next_actions = self.model(next_states).argmax(1)
            next_q = self.target_model(next_states).gather(1, next_actions.unsqueeze(1)).squeeze(1)
            target_q = rewards + GAMMA * next_q
        td_errors = (target_q - current_q).detach().cpu().numpy()
        self.replay_buffer.update_priorities(indices, td_errors)
        loss_per_sample = self.loss_fn(current_q, target_q)
        loss = (loss_per_sample * weights).mean()
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()
        if self.epsilon > EPSILON_MIN:
            self.epsilon *= EPSILON_DECAY
        self.learn_steps += 1
        self.model.eval()
        if self.learn_steps % self.target_update_freq == 0:
            self.target_model.load_state_dict(self.model.state_dict())
            print(f"[TARGET] synced at step {self.learn_steps}")
        loss_val = loss.item()
        print(f"[LEARN] step={self.learn_steps} loss={loss_val:.4f} epsilon={self.epsilon:.4f} buffer={len(self.replay_buffer)}")
        return loss_val


agent = DQNAgent()

PRETRAIN_PATH = "pretrained_agent.pth"
if os.path.exists(PRETRAIN_PATH):
    try:
        agent.model.load_state_dict(torch.load(PRETRAIN_PATH, map_location="cpu"))
        agent.target_model.load_state_dict(agent.model.state_dict())
        agent.epsilon = EPSILON_MIN  # ✅ FIX: always set epsilon to 0.05 after loading pretrained model
        agent.model.eval()
        print(f"[LOAD] Loaded pretrained model from {PRETRAIN_PATH} | epsilon set to {EPSILON_MIN}")
    except Exception as e:
        print(f"[LOAD] Architecture mismatch — starting fresh: {e}")
        agent.model.eval()
else:
    agent.model.eval()
    print("[LOAD] No pretrained model — starting fresh")

# ==========================
# CHECKPOINT SETUP
# ==========================
ckpt = CheckpointManager(ckpt_dir="checkpoints")
train_state = TrainState(step=0, episode=0, epsilon=agent.epsilon, best_win_rate=0.0)
win_history = deque(maxlen=50)
loss_history = deque(maxlen=200)
SAVE_EVERY_EPISODES = 25
MODEL = agent.model
OPTIMIZER = agent.optimizer

latest_path = os.path.join("checkpoints", "latest.pt")
if os.path.exists(latest_path):
    try:
        loaded_state, loaded_stats = ckpt.load(latest_path, MODEL, OPTIMIZER, map_location="cpu")
        train_state = loaded_state
        agent.epsilon = train_state.epsilon
        print("[CHECKPOINT] Resumed from latest.pt | stats:", loaded_stats)
    except Exception as e:
        print(f"[CHECKPOINT] Could not load: {e}")

# ==========================
# PLAYER SESSION TRACKING
# ==========================
player_sessions: Dict[str, Dict] = {}

# ==========================
# DATA MODELS
# ==========================
class DecisionRequest(BaseModel):
    winRate: float = 0
    avgTime: float = 0
    retries: int = 0
    emotion: str = "neutral"
    sessionDurationSec: float = 0
    consecutiveLosses: int = 0
    hintAcceptRate: float = 0.5
    moveHesitationSec: float = 2.0
    playerId: Optional[str] = None

class FeedbackRequest(BaseModel):
    decisionId: str
    winRate: float = 0
    avgTime: float = 0
    retries: int = 0
    emotion: str = "neutral"
    result: str = "lose"
    timePlayed: int = 0
    quitEarly: bool = False
    sessionDurationSec: float = 0
    consecutiveLosses: int = 0
    hintAcceptRate: float = 0.5
    moveHesitationSec: float = 2.0
    hintsShown: int = 0
    hintsAccepted: int = 0
    playerId: Optional[str] = None

class SessionLogRequest(BaseModel):
    playerId: str
    sessionDurationSec: float
    gamesPlayed: int
    wins: int
    emotionSequence: list = []
    actionsReceived: list = []
    endEmotion: str = "neutral"
    completedVoluntarily: bool = True

# ==========================
# HELPERS
# ==========================
def emotion_to_valence_arousal(emotion: str):
    mapping = {
        "happy":   (0.8,  0.5),
        "neutral": (0.0,  0.0),
        "sad":     (-0.8, -0.7),
        "angry":   (-0.6,  0.8),
    }
    return mapping.get(str(emotion).lower(), (0.0, 0.0))

def build_state(data) -> list:
    valence, arousal = emotion_to_valence_arousal(data.emotion)
    session_dur_norm = min(1.0, float(getattr(data, 'sessionDurationSec', 0)) / 2700.0)
    consec_losses_norm = min(1.0, float(getattr(data, 'consecutiveLosses', 0)) / 5.0)
    hint_accept = float(getattr(data, 'hintAcceptRate', 0.5))
    return [
        float(data.winRate),
        min(1.0, float(data.avgTime) / 300.0),
        min(1.0, float(data.retries) / 5.0),
        valence,
        arousal,
        session_dur_norm,
        consec_losses_norm,
        hint_accept,
    ]

def calculate_reward(data, action: int) -> float:
    reward = 0.0
    reward += 15 if data.result == "win" else -15
    emo = str(data.emotion).lower()
    if emo == "happy":
        reward += 5
    elif emo == "sad":
        reward -= 7
    elif emo == "angry":
        reward -= 12
    session_min = float(getattr(data, 'sessionDurationSec', 0)) / 60.0
    if session_min > MAX_SESSION_MINUTES:
        reward -= 15
    consec_losses = int(getattr(data, 'consecutiveLosses', 0))
    if consec_losses >= FRUSTRATION_WINDOW:
        reward -= 6
    if data.quitEarly:
        reward -= 5
    if int(action) == 0:
        reward -= 1.0
    if int(action) == 3 and consec_losses >= 2 and emo in ["angry", "sad"]:
        reward += 4
    if int(action) == 4 and (float(data.winRate) < 0.2 or consec_losses >= 2):
        reward -= 8
    if int(action) == 5 and session_min > 20:
        reward += 3
    hints_shown = int(getattr(data, 'hintsShown', 0))
    hints_accepted = int(getattr(data, 'hintsAccepted', 0))
    if hints_shown > 0 and hints_accepted > 0:
        reward += 3
    return reward

def _maybe_trim_pending():
    if len(pending_decisions) > MAX_PENDING:
        for k in list(pending_decisions.keys())[:1000]:
            pending_decisions.pop(k, None)

def _is_frustration_spiral(player_id: Optional[str]) -> bool:
    if not player_id or player_id not in player_sessions:
        return False
    return player_sessions.get(player_id, {}).get('consecutive_losses', 0) >= FRUSTRATION_WINDOW

def _update_player_session(player_id: Optional[str], result: str):
    if not player_id:
        return
    if player_id not in player_sessions:
        player_sessions[player_id] = {'consecutive_losses': 0, 'total_games': 0}
    session = player_sessions[player_id]
    session['total_games'] += 1
    if result == 'win':
        session['consecutive_losses'] = 0
    else:
        session['consecutive_losses'] += 1

# ==========================
# API ENDPOINTS
# ==========================
@app.post("/api/decision")
def get_decision(req: DecisionRequest):
    state = build_state(req)
    action = agent.act(state)
    if _is_frustration_spiral(req.playerId) and action not in [1, 3, 5]:
        print(f"[SAFETY] Frustration spiral for {req.playerId} -> REDUCE_DIFFICULTY")
        action = 3
    session_min = float(req.sessionDurationSec) / 60.0
    if session_min >= 25 and action == 0:
        action = 5
    q_values = agent.get_q_values(state)
    decision_id = str(uuid.uuid4())
    pending_decisions[decision_id] = {"state": state, "action": action}
    _maybe_trim_pending()
    action_counts[action] += 1
    print(f"[DECISION] id={decision_id} action={action}({ACTIONS[action]}) epsilon={round(agent.epsilon, 4)}")
    print(f"[ACTIONS] counts={action_counts} pending={len(pending_decisions)}")
    return {
        "decisionId": decision_id,
        "action": action,
        "actionName": ACTIONS[action],
        "epsilon": round(agent.epsilon, 3),
        "qValues": [round(x, 4) for x in q_values],
        "qValuesNamed": {ACTIONS[i]: round(q_values[i], 4) for i in range(ACTION_SIZE)},
        "safetyFlags": {
            "frustrationSpiral": _is_frustration_spiral(req.playerId),
            "longSession": session_min >= 25,
            "approachingHardCap": session_min >= MAX_SESSION_MINUTES - 5,
        }
    }

@app.post("/api/feedback")
def feedback(req: FeedbackRequest):
    info = pending_decisions.pop(req.decisionId, None)
    if info is None:
        print("[FEEDBACK] unknown decisionId:", req.decisionId)
        return {"reward": 0, "learning": "skipped (unknown decisionId)"}
    state = info["state"]
    action = info["action"]
    reward = calculate_reward(req, action)
    next_state = build_state(req)
    print(f"[FEEDBACK] id={req.decisionId} result={req.result} reward={reward} action={action}({ACTIONS[action]})")
    agent.store(state, action, reward, next_state)
    loss_value = agent.learn_from_buffer(batch_size=32)
    _update_player_session(req.playerId, req.result)
    train_state.episode += 1
    train_state.step = agent.learn_steps
    train_state.epsilon = agent.epsilon
    win_history.append(1 if req.result == "win" else 0)
    if loss_value is not None:
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
        "replay_buffer_size": len(agent.replay_buffer),
    }
    if train_state.episode % SAVE_EVERY_EPISODES == 0:
        ckpt.save("latest.pt", MODEL, OPTIMIZER, train_state, stats)
    if len(win_history) == win_history.maxlen and rolling_win_rate > train_state.best_win_rate:
        train_state.best_win_rate = rolling_win_rate
        ckpt.save("best.pt", MODEL, OPTIMIZER, train_state, stats)
    return {
        "reward": reward,
        "learning": "updated",
        "bufferSize": len(agent.replay_buffer),
        "consecutiveLosses": player_sessions.get(req.playerId, {}).get('consecutive_losses', 0),
    }

@app.post("/api/log_session")
def log_session(req: SessionLogRequest):
    entry = {
        "timestamp": datetime.now().isoformat(),
        "player_id": req.playerId,
        "session_duration_sec": req.sessionDurationSec,
        "games_played": req.gamesPlayed,
        "wins": req.wins,
        "win_rate": req.wins / max(1, req.gamesPlayed),
        "emotion_sequence": req.emotionSequence,
        "actions_received": req.actionsReceived,
        "end_emotion": req.endEmotion,
        "completed_voluntarily": req.completedVoluntarily,
    }
    try:
        with open("research_log.jsonl", "a") as f:
            f.write(json.dumps(entry) + "\n")
        print(f"[LOG] Session logged for {req.playerId}")
        return {"status": "logged"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "state_size": STATE_SIZE,
        "action_size": ACTION_SIZE,
        "actions": ACTIONS,
        "replay_buffer_size": len(agent.replay_buffer),
        "learn_steps": agent.learn_steps,
        "epsilon": round(agent.epsilon, 4),
        "episode": train_state.episode,
    }

# Run with:
# python -m uvicorn rl_backend:app --reload