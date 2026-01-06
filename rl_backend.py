# ==========================
# RL GAME BACKEND (ONE FILE)
# FastAPI + PyTorch
# ==========================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
import torch.optim as optim
import random

# ==========================
# FASTAPI SETUP
# ==========================
app = FastAPI(title="Emotion Adaptive RL Game Backend")

# ✅ Enable CORS so frontend (localhost:3000) can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# RL CONFIG
# ==========================
STATE_SIZE = 4     # winRate, avgTime, retries, emotion
ACTION_SIZE = 5    # no help, hint, bomb, easier, harder
GAMMA = 0.95
LR = 0.001
EPSILON_START = 1.0
EPSILON_MIN = 0.05
EPSILON_DECAY = 0.995

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

        self.last_state = None
        self.last_action = None

    def act(self, state):
        if random.random() < self.epsilon:
            return random.randint(0, ACTION_SIZE - 1)

        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            q_values = self.model(state_tensor)
        return torch.argmax(q_values).item()

    def learn(self, state, action, reward, next_state):
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

# Create agent instance
agent = DQNAgent()

# ✅ Load pretrained model
agent.model.load_state_dict(torch.load("pretrained_agent.pth"))
agent.model.eval()  # Important! Makes sure model is in inference mode
# ==========================
# DATA MODELS
# ==========================
class DecisionRequest(BaseModel):
    winRate: float = 0
    avgTime: float = 0
    retries: int = 0
    emotion: str = "neutral"

class FeedbackRequest(BaseModel):
    winRate: float = 0
    avgTime: float = 0
    retries: int = 0
    emotion: str = "neutral"
    result: str = "lose"
    timePlayed: int = 0
    quitEarly: bool = False

# ==========================
# HELPERS
# ==========================
def emotion_to_number(emotion):
    return {
        "happy": 1.0,
        "neutral": 0.5,
        "sad": -0.5,
        "angry": -1.0
    }.get(emotion, 0)

def build_state(data):
    return [
        data.winRate,
        data.avgTime,
        data.retries,
        emotion_to_number(data.emotion)
    ]

def calculate_reward(data):
    reward = 0

    # Win / Lose
    reward += 15 if data.result == "win" else -15

    # Emotion shaping
    if data.emotion == "happy":
        reward += 5
    elif data.emotion == "sad":
        reward -= 5
    elif data.emotion == "angry":
        reward -= 8

    # Engagement
    if data.timePlayed > 300:
        reward += 5
    if data.quitEarly:
        reward -= 10

    return reward

ACTIONS = [
    "NO_HELP",
    "SHOW_HINT",
    "GIVE_BOMB",
    "REDUCE_DIFFICULTY",
    "INCREASE_DIFFICULTY"
]

# ==========================
# API ENDPOINTS
# ==========================
@app.post("/api/decision")
def get_decision(req: DecisionRequest):
    state = build_state(req)
    action = agent.act(state)

    agent.last_state = state
    agent.last_action = action

    return {
        "action": action,
        "actionName": ACTIONS[action],
        "epsilon": round(agent.epsilon, 3)
    }

@app.post("/api/feedback")
def feedback(req: FeedbackRequest):
    reward = calculate_reward(req)
    next_state = build_state(req)

    if agent.last_state is not None:
        agent.learn(
            agent.last_state,
            agent.last_action,
            reward,
            next_state
        )

    return {
        "reward": reward,
        "learning": "updated"
    }

# ==========================
# RUN SERVER
# ==========================
# Run with:
# uvicorn rl_backend:app --reload
