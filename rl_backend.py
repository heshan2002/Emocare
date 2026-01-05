"""
EMOTION-AWARE RL CANDY CRUSH BACKEND
Complete implementation with PyTorch neural network
"""

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import random
from collections import deque
import os

# ============================================
# CONFIGURATION
# ============================================

app = Flask(__name__)
CORS(app)

BOARD_SIZE = 8
CANDY_TYPES = 5
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ============================================
# EMOTION LEVEL CONFIGURATION
# ============================================

EMOTION_LEVELS = {
    "happy": {
        "1": {"move_bonus": 0, "combo_multiplier": 1.0, "special_candies": False},
        "1.1": {"move_bonus": -5, "combo_multiplier": 1.2, "special_candies": True},
        "1.1.1": {"move_bonus": -10, "combo_multiplier": 1.5, "special_candies": True}
    },
    "sad": {
        "1": {"move_bonus": +10, "combo_multiplier": 0.8, "auto_hint": True},
        "1.1": {"move_bonus": +5, "combo_multiplier": 1.0, "auto_hint": True},
        "1.1.1": {"move_bonus": 0, "combo_multiplier": 1.1, "auto_hint": False}
    },
    "angry": {
        "1": {"move_bonus": +5, "combo_multiplier": 0.9, "no_dead_board": True},
        "1.1": {"move_bonus": 0, "combo_multiplier": 1.1, "time_pressure": True},
        "1.1.1": {"move_bonus": -5, "combo_multiplier": 1.3, "time_pressure": True}
    },
    "surprise": {
        "1": {"random_events": True},
        "1.1": {"random_events": True, "special_blocks": True},
        "1.1.1": {"random_events": True, "special_blocks": True, "board_shuffle": True}
    }
}

# ============================================
# PLAYER STATE TRACKER
# ============================================

class PlayerState:
    def __init__(self, player_id: str):
        self.player_id = player_id
        self.games_played = 0
        self.wins = 0
        self.losses = 0
        self.total_score = 0
        self.total_moves_used = 0
        self.consecutive_losses = 0
        self.frustration = 0.0
        self.emotion_history = deque(maxlen=10)

    def update(self, result: str, score: int, moves_used: int, emotion: str):
        self.games_played += 1
        self.total_score += score
        self.total_moves_used += moves_used
        self.emotion_history.append(emotion)

        if result == "win":
            self.wins += 1
            self.consecutive_losses = 0
            self.frustration = max(0.0, self.frustration - 0.15)
        else:
            self.losses += 1
            self.consecutive_losses += 1
            self.frustration = min(1.0, self.frustration + 0.2)

    def get_win_rate(self) -> float:
        return self.wins / max(1, self.games_played)

    def get_avg_score(self) -> float:
        return self.total_score / max(1, self.games_played)

    def get_state_vector(self, emotion: str) -> np.ndarray:
        emotion_map = {"happy": 0, "sad": 1, "angry": 2, "neutral": 3}
        emotion_vec = [0, 0, 0, 0]
        emotion_vec[emotion_map.get(emotion, 3)] = 1

        return np.array([
            self.get_win_rate(),
            self.get_avg_score() / 2000.0,
            self.frustration,
            *emotion_vec
        ], dtype=np.float32)

# ============================================
# RL NEURAL NETWORK
# ============================================

class EmotionRLNetwork(nn.Module):
    def __init__(self, state_dim=7, action_dim=5):
        super().__init__()
        self.fc1 = nn.Linear(state_dim, 128)
        self.fc2 = nn.Linear(128, 128)
        self.fc3 = nn.Linear(128, 64)
        self.output = nn.Linear(64, action_dim)
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = F.relu(self.fc2(x))
        x = self.dropout(x)
        x = F.relu(self.fc3(x))
        x = torch.sigmoid(self.output(x))
        return x

# ============================================
# RL AGENT
# ============================================

class EmotionRLAgent:
    def __init__(self, learning_rate=0.001):
        self.network = EmotionRLNetwork().to(DEVICE)
        self.optimizer = optim.Adam(self.network.parameters(), lr=learning_rate)
        self.experience_buffer = deque(maxlen=1000)
        self.gamma = 0.95

    def select_params(self, state_vector: np.ndarray):
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state_vector).unsqueeze(0).to(DEVICE)
            output = self.network(state_tensor)[0].cpu().numpy()

        return {
            "difficulty": float(output[0]),
            "moveLimit": int(20 + output[1] * 25),
            "targetScore": int(600 + output[2] * 800),
            "hintDelay": float(2 + output[3] * 10),
            "rewardMultiplier": float(0.8 + output[4] * 0.6)
        }

    def store_experience(self, state, action, reward, next_state):
        self.experience_buffer.append({
            'state': state,
            'action': action,
            'reward': reward,
            'next_state': next_state
        })

    def train_step(self, batch_size=32):
        if len(self.experience_buffer) < batch_size:
            return None
        batch = random.sample(self.experience_buffer, batch_size)

        states = torch.FloatTensor([exp['state'] for exp in batch]).to(DEVICE)
        rewards = torch.FloatTensor([exp['reward'] for exp in batch]).to(DEVICE)
        next_states = torch.FloatTensor([exp['next_state'] for exp in batch]).to(DEVICE)

        self.optimizer.zero_grad()
        current_q = self.network(states)
        next_q = self.network(next_states)
        target_q = rewards.unsqueeze(1) + self.gamma * next_q.mean(dim=1, keepdim=True)
        loss = F.mse_loss(current_q.mean(dim=1, keepdim=True), target_q.detach())
        loss.backward()
        self.optimizer.step()
        return loss.item()

    def save_model(self, path="rl_model.pt"):
        torch.save({
            'network_state': self.network.state_dict(),
            'optimizer_state': self.optimizer.state_dict(),
        }, path)

    def load_model(self, path="rl_model.pt"):
        if os.path.exists(path):
            checkpoint = torch.load(path, map_location=DEVICE)
            self.network.load_state_dict(checkpoint['network_state'])
            self.optimizer.load_state_dict(checkpoint['optimizer_state'])
            print(f"✅ Loaded model from {path}")
        else:
            print(f"⚠️ No saved model found at {path}")

# ============================================
# BOARD GENERATOR
# ============================================

class BoardGenerator:
    def generate_board(self, rules=None):
        board = [[random.randint(0, CANDY_TYPES - 1) for _ in range(BOARD_SIZE)]
                 for _ in range(BOARD_SIZE)]

        if rules and rules.get("board_shuffle"):
            random.shuffle(board)

        for _ in range(10):
            for i in range(BOARD_SIZE):
                for j in range(BOARD_SIZE):
                    if j < BOARD_SIZE - 2 and board[i][j] == board[i][j+1] == board[i][j+2]:
                        board[i][j] = random.randint(0, CANDY_TYPES - 1)
                    if i < BOARD_SIZE - 2 and board[i][j] == board[i+1][j] == board[i+2][j]:
                        board[i][j] = random.randint(0, CANDY_TYPES - 1)
        return board

# ============================================
# REWARD CALCULATOR
# ============================================

class RewardCalculator:
    @staticmethod
    def calculate_reward(result, score, moves_used, emotion, player_state):
        reward = 0.0
        reward += 20.0 if result == "win" else -10.0
        reward += (score / 1000.0) * 5.0

        if emotion == "sad":
            reward += 15.0 if result == "win" else -15.0
        elif emotion == "angry":
            reward += 20.0 if player_state.consecutive_losses == 0 else -10.0
        elif emotion == "happy":
            if result == "win" and moves_used < 10:
                reward += 10.0

        reward -= player_state.frustration * 10.0
        reward += 5.0  # retention
        return reward

# ============================================
# GLOBAL STATE
# ============================================

players = {}
rl_agent = EmotionRLAgent()
board_gen = BoardGenerator()
reward_calc = RewardCalculator()
rl_agent.load_model()

def get_player(player_id: str) -> PlayerState:
    if player_id not in players:
        players[player_id] = PlayerState(player_id)
    return players[player_id]

def determine_emotion_level(player: PlayerState, emotion: str) -> str:
    win_rate = player.get_win_rate()
    if player.games_played < 3:
        return "1"
    if win_rate < 0.4 or player.consecutive_losses >= 2:
        return "1.1"
    return "1.1.1"

# ============================================
# API ENDPOINTS
# ============================================

@app.route("/api/start_session", methods=["POST"])
def start_session():
    data = request.json
    player_id = data.get("player_id")
    emotion = data.get("emotion", "neutral")
    get_player(player_id)
    session_id = str(uuid.uuid4())
    return jsonify({"session_id": session_id, "status": "success"})

@app.route("/api/generate_board", methods=["POST"])
def api_generate_board():
    data = request.json
    player_id = data.get("player_id")
    emotion = data.get("emotion", "neutral")
    player = get_player(player_id)
    state_vector = player.get_state_vector(emotion)
    level = determine_emotion_level(player, emotion)
    level_rules = EMOTION_LEVELS.get(emotion, {}).get(level, {})
    rl_params = rl_agent.select_params(state_vector)
    rl_params["moveLimit"] += level_rules.get("move_bonus", 0)
    rl_params["rewardMultiplier"] *= level_rules.get("combo_multiplier", 1.0)
    board = board_gen.generate_board(level_rules)
    return jsonify({
        "board": board,
        "rlParams": rl_params,
        "emotion": emotion,
        "level": level,
        "levelRules": level_rules,
        "status": "success"
    })

@app.route("/api/record_move", methods=["POST"])
def record_move():
    return jsonify({"status": "recorded"})

@app.route("/api/end_game", methods=["POST"])
def end_game():
    data = request.json
    player_id = data.get("player_id")
    emotion = data.get("emotion", "neutral")
    result = data.get("result")
    score = data.get("score", 0)
    moves_used = data.get("moves_used", 30)
    player = get_player(player_id)
    old_state = player.get_state_vector(emotion)
    player.update(result, score, moves_used, emotion)
    new_state = player.get_state_vector(emotion)
    reward = reward_calc.calculate_reward(result, score, moves_used, emotion, player)
    rl_agent.store_experience(old_state, None, reward, new_state)
    loss = rl_agent.train_step(batch_size=16)
    if player.games_played % 10 == 0:
        rl_agent.save_model()
    return jsonify({
        "reward": reward,
        "loss": loss,
        "player_stats": {
            "games_played": player.games_played,
            "win_rate": player.get_win_rate(),
            "frustration": player.frustration
        },
        "status": "success"
    })

@app.route("/api/stats", methods=["GET"])
def get_stats():
    total_players = len(players)
    total_games = sum(p.games_played for p in players.values())
    avg_win_rate = float(np.mean([p.get_win_rate() for p in players.values()])) if players else 0
    return jsonify({
        "total_players": total_players,
        "total_games": total_games,
        "average_win_rate": avg_win_rate,
        "experience_buffer_size": len(rl_agent.experience_buffer)
    })

# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("🧠 EMOTION-AWARE RL CANDY CRUSH BACKEND")
    print("=" * 50)
    print(f"Device: {DEVICE}")
    print(f"Network parameters: {sum(p.numel() for p in rl_agent.network.parameters())}")
    print("=" * 50)
    print("🚀 Server starting on http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
