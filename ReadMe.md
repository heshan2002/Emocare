# 🍬 Candy Crush RL — Emotion-Aware AI Edition

> A research-grade, elder-safe Candy Crush game powered by a **Dueling Deep Q-Network (DQN)** that adapts difficulty, detects frustration, and protects player wellbeing in real time.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [How the AI Works](#how-the-ai-works)
- [API Endpoints](#api-endpoints)
- [Research Data Collection](#research-data-collection)
- [Elder Safety System](#elder-safety-system)
- [Emotion Color System](#emotion-color-system)
- [Contributing](#contributing)

---

## Overview

This project is an **emotion-aware, AI-adaptive Candy Crush game** built for cognitive research with elderly users. The game uses a **Reinforcement Learning agent** (Dueling DQN with Prioritized Experience Replay) to observe player behavior and emotion in real time, then decide which intervention to apply — such as showing a hint, reducing difficulty, simplifying the board, or suggesting a rest break.

The system is designed to:
- Keep elderly players **engaged without frustrating them**
- **Automatically detect** frustration spirals and intervene
- **Enforce safe session limits** (45-minute hard cap)
- **Log research-quality data** automatically for longitudinal studies

---

## Features

### 🧠 AI & Reinforcement Learning
- **Dueling DQN** architecture with Value + Advantage streams
- **Prioritized Experience Replay** buffer (10,000 experiences)
- **Double DQN** — prevents Q-value overestimation
- **Elder-calibrated pretraining** with 3-phase curriculum (37,365 steps)
- **7 adaptive actions**: NO_HELP, SHOW_HINT, GIVE_BOMB, REDUCE_DIFFICULTY, INCREASE_DIFFICULTY, PAUSE_SUGGEST, SIMPLIFY_BOARD

### ❤️ Emotion Awareness
- **Russell Circumplex Model** — continuous valence + arousal instead of discrete labels
- Real-time emotion selection (Happy / Sad / Angry / Neutral)
- Emotion-dependent board size (6×6 to 9×9)
- **Color-coded UI** that changes with emotion state

### 🛡️ Elder Safety
- **45-minute hard session cap** with automatic game end
- **25-minute soft warning** — friendly break suggestion
- **Frustration spiral detection** — 3 losses in a row triggers forced difficulty reduction
- Session timer in sidebar with color warning (amber → red)

### 🎮 Gameplay
- Dynamic difficulty adjustment (Easy / Medium / Hard)
- Combo multiplier system
- Blocker cells
- Score progress bar toward win target (800 pts)
- Animated loading and instructions pages with live action demos
- Background music + sound effects (Web Audio API)
- Win reward system with coins and bonuses

### 📊 Research Tools
- Automatic session logging to `research_log.jsonl`
- Per-player ID tracking across sessions
- Emotion sequence, actions received, hesitation time all captured
- `/api/health` endpoint for live system monitoring

---

## System Architecture

```
┌─────────────────────────────────────┐
│         React Frontend              │
│  (App.js + LoadingPage + Instructions)│
│  - Tracks: emotion, session time,   │
│    consecutive losses, hint usage,  │
│    move hesitation                  │
└────────────────┬────────────────────┘
                 │ HTTP POST (JSON)
                 ▼
┌─────────────────────────────────────┐
│       FastAPI Backend               │
│       (rl_backend.py)               │
│  - /api/decision  → AI picks action │
│  - /api/feedback  → AI learns       │
│  - /api/log_session → saves data    │
│  - /api/health    → system stats    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│       Dueling DQN Agent             │
│  State (8 features) → Action (7)    │
│  Prioritized Replay Buffer (10,000) │
│  Pretrained: pretrained_agent.pth   │
└─────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, Lucide React |
| Backend | FastAPI, Uvicorn |
| AI / ML | PyTorch (Dueling DQN, PER) |
| Audio | Web Audio API (no dependencies) |
| Data | JSON Lines (`.jsonl`) flat file logging |
| State Mgmt | React useState / useRef / useCallback |

---

## Project Structure

```
candy-crush-improved/
│
├── src/
│   ├── App.js                # Main game component (RL-connected)
│   ├── LoadingPage.js        # Animated loading screen
│   ├── InstructionsPage.js   # How-to-play with live animations
│   ├── index.js              # Root — manages page phases
│   ├── loading.css           # Loading page styles
│   └── instructions.css      # Instructions page styles
│
├── public/
│   └── index.html
│
├── rl_backend.py             # FastAPI server + DQN agent
├── pretrain.py               # Elder-calibrated pretraining script
├── checkpoint.py             # Checkpoint save/load manager
├── pretrained_agent.pth      # Pretrained model weights
├── checkpoints/              # Runtime checkpoints (auto-saved)
├── research_log.jsonl        # Auto-generated session research data
├── players.json              # Player session tracking
├── package.json
└── requirements.txt
```

---

## Installation

### Prerequisites

- **Node.js** v18+ and npm
- **Python** 3.9+
- **pip**

### 1. Clone the repository

```bash
git clone https://github.com/your-username/candy-crush-rl.git
cd candy-crush-rl
```

### 2. Install Python dependencies

```bash
pip install fastapi uvicorn torch numpy pydantic
```

### 3. Install Node dependencies

```bash
npm install
```

### 4. Run pretraining (first time only)

```bash
python pretrain.py
```

This runs the 3-phase elder-calibrated curriculum and saves `pretrained_agent.pth`. Takes about 1–2 minutes.

> ⚠️ If you already have `pretrained_agent.pth`, skip this step.

---

## Running the App

You need **two terminals** running simultaneously.

### Terminal 1 — Start the AI Backend

```bash
python -m uvicorn rl_backend:app --reload
```

Backend runs at: `http://127.0.0.1:8000`

You should see:
```
[LOAD] Loaded pretrained model from pretrained_agent.pth | epsilon set to 0.05
INFO:  Application startup complete.
```

### Terminal 2 — Start the React Frontend

```bash
npm start
```

Frontend runs at: `http://localhost:3000`

The browser will open automatically.

> ⚠️ **Important:** Start the backend BEFORE the frontend. If the backend is not running, the game still works but without AI adaptive features.

---

## How the AI Works

### State Space (8 features)

| Feature | Description |
|---|---|
| `winRate` | Player's recent win ratio (0–1) |
| `avgTime` | Average time per game (normalized) |
| `retries` | Number of invalid moves (normalized) |
| `valence` | Emotional valence — Russell Circumplex Model (−1 to +1) |
| `arousal` | Emotional arousal — Russell Circumplex Model (−1 to +1) |
| `sessionDuration` | Total session time normalized to 45 min |
| `consecutiveLosses` | Streak of losses normalized to 5 |
| `hintAcceptRate` | Ratio of hints accepted vs shown |

### Action Space (7 actions)

| # | Action | Description |
|---|---|---|
| 0 | NO_HELP | Do nothing |
| 1 | SHOW_HINT | Flash a valid swap on the board |
| 2 | GIVE_BOMB | Reserved for future power-up |
| 3 | REDUCE_DIFFICULTY | Drop to easier settings |
| 4 | INCREASE_DIFFICULTY | Raise to harder settings |
| 5 | PAUSE_SUGGEST | Show friendly rest break overlay |
| 6 | SIMPLIFY_BOARD | Reduce candy types for 15 seconds |

### Reward Function

| Event | Reward |
|---|---|
| Win | +15 |
| Loss | −15 |
| Happy emotion | +5 |
| Sad emotion | −7 |
| Angry emotion | −12 |
| Frustration spiral (3+ losses) | −6 |
| Quit early | −5 |
| Session over 45 min | −15 |
| Correct intervention when struggling | +4 |
| Wrong intervention (increase difficulty when losing) | −8 |
| PAUSE_SUGGEST after 20+ min session | +3 |
| Hint accepted by player | +3 |

### Pretraining Curriculum

| Phase | Games | Focus |
|---|---|---|
| Phase 1 | 500 | Struggling elders (angry 35%, sad 40%) |
| Phase 2 | 1,000 | Mixed realistic scenarios |
| Phase 3 | 1,500 | Full realistic distribution (happy 25%, neutral 45%) |

---

## API Endpoints

### `POST /api/decision`
Get the AI's recommended action for the current player state.

**Request:**
```json
{
  "winRate": 0.3,
  "avgTime": 45,
  "retries": 2,
  "emotion": "sad",
  "sessionDurationSec": 600,
  "consecutiveLosses": 3,
  "hintAcceptRate": 0.7,
  "moveHesitationSec": 3.5,
  "playerId": "player_abc123"
}
```

**Response:**
```json
{
  "decisionId": "uuid-...",
  "action": 3,
  "actionName": "REDUCE_DIFFICULTY",
  "epsilon": 0.05,
  "qValues": [-362.1, -360.5, -359.8, -359.3, -367.4, -359.6, -359.4],
  "safetyFlags": {
    "frustrationSpiral": true,
    "longSession": false,
    "approachingHardCap": false
  }
}
```

### `POST /api/feedback`
Send the game outcome so the AI can learn from it.

**Key fields:** `decisionId`, `result` (win/lose), `emotion`, `sessionDurationSec`, `consecutiveLosses`, `hintsShown`, `hintsAccepted`, `playerId`

### `POST /api/log_session`
Log a complete session for research purposes.

### `GET /api/health`
Returns current agent status: epsilon, learn steps, buffer size, episode count.

---

## Research Data Collection

Every session is automatically saved to `research_log.jsonl`:

```json
{
  "timestamp": "2025-01-15T14:23:11",
  "player_id": "player_1736950991_x7k2mn",
  "session_duration_sec": 1247,
  "games_played": 8,
  "wins": 3,
  "win_rate": 0.375,
  "emotion_sequence": ["neutral", "neutral", "sad", "sad", "angry", "neutral"],
  "actions_received": ["SHOW_HINT", "REDUCE_DIFFICULTY", "PAUSE_SUGGEST"],
  "end_emotion": "neutral",
  "completed_voluntarily": true
}
```

This enables longitudinal research questions such as:
- Does adaptive difficulty improve elder engagement over 4 weeks?
- Which emotions correlate with dropout?
- Does hint acceptance rate improve with repeated sessions?

---

## Elder Safety System

| Layer | Trigger | Response |
|---|---|---|
| Frustration Detection | 3 consecutive losses | AI forces REDUCE_DIFFICULTY |
| Soft Session Warning | 25 minutes played | Friendly break suggestion overlay |
| Hard Session Cap | 45 minutes played | Automatic session end |
| Long Session + No Help | AI picks NO_HELP at 25+ min | Overridden to PAUSE_SUGGEST |
| Sidebar Warning | 25 min = amber, 40 min = red | Color-coded session timer |

---

## Emotion Color System

Each emotion changes the entire game UI background color and board size:

| Emotion | Color | Board Size |
|---|---|---|
| 😊 Happy | 🟡 Yellow | 9×9 |
| 😢 Sad | 🔴 Red | 7×7 |
| 😠 Angry | 🟢 Green | 6×6 |
| 😐 Neutral | 🔵 Blue | 8×8 |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is developed for academic research purposes.

---

## Acknowledgements

- Built with [React](https://react.dev/) and [FastAPI](https://fastapi.tiangolo.com/)
- RL based on [Dueling DQN](https://arxiv.org/abs/1511.06581) and [Prioritized Experience Replay](https://arxiv.org/abs/1511.05952)
- Emotion model based on [Russell's Circumplex Model of Affect](https://en.wikipedia.org/wiki/Circumplex_model_of_affect)
- Designed with elder cognitive safety guidelines in mind
