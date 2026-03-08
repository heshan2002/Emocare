# ==========================
# Pretrain Candy Crush RL Agent - IMPROVED
# ✅ Elder-calibrated distributions (Beta, LogNormal, Geometric)
# ✅ Curriculum learning (3 phases)
# ✅ Counter-factual edge cases for elder safety
# ✅ Compatible with new 8-feature state + 7 actions
# ==========================

import random
import math
import torch
from rl_backend import DQNAgent, build_state, FeedbackRequest, calculate_reward

# ==========================
# Create agent
# ==========================
agent = DQNAgent()

emotions = ["happy", "neutral", "sad", "angry"]

# ==========================
# ELDER-CALIBRATED SAMPLERS
# ==========================

def beta_sample(alpha, beta):
    """Beta distribution — bounded [0,1], good for win rates."""
    return random.betavariate(alpha, beta)

def lognormal_sample(mu, sigma, lo=None, hi=None):
    """Log-normal distribution — right-skewed, good for time."""
    val = math.exp(random.gauss(mu, sigma))
    if lo is not None: val = max(lo, val)
    if hi is not None: val = min(hi, val)
    return val

def geometric_sample(p, max_val=10):
    """Geometric distribution — many 0s, heavy tail, good for retries."""
    val = 0
    while random.random() > p and val < max_val:
        val += 1
    return val

def elder_win_rate():
    """Elders typically win 20-40% initially (Beta(2,5))."""
    return beta_sample(2, 5)

def elder_avg_time():
    """Right-skewed move times: slow moves common in elders (LogNormal)."""
    return lognormal_sample(mu=4.5, sigma=0.6, lo=30, hi=600)

def elder_retries():
    """Heavy-tailed retries: many 0s, some high (Geometric(p=0.4))."""
    return geometric_sample(p=0.4, max_val=8)

def elder_emotion(phase=2):
    """Elder emotion distribution varies by phase."""
    if phase == 1:  # Phase 1: struggling elders
        return random.choices(emotions, weights=[0.05, 0.20, 0.40, 0.35])[0]
    elif phase == 2:  # Phase 2: mixed
        return random.choices(emotions, weights=[0.25, 0.40, 0.20, 0.15])[0]
    else:  # Phase 3: realistic full distribution
        return random.choices(emotions, weights=[0.25, 0.45, 0.20, 0.10])[0]

def elder_session_duration(min_played=0):
    """Session duration in seconds (LogNormal, 15-45 min peak)."""
    return lognormal_sample(mu=3.2, sigma=0.5, lo=60, hi=2700) + min_played

def elder_hint_accept_rate():
    """Most elders accept hints when offered (skewed high)."""
    return beta_sample(3, 2)

def elder_move_hesitation():
    """Elders often pause before moves (LogNormal, peak ~3s)."""
    return lognormal_sample(mu=1.1, sigma=0.6, lo=0.5, hi=15.0)

def elder_consecutive_losses(phase=2):
    """Consecutive losses — more in phase 1 (struggling)."""
    if phase == 1:
        return geometric_sample(p=0.3, max_val=6)
    return geometric_sample(p=0.5, max_val=4)

# ==========================
# SIMULATE A GAME (per phase)
# ==========================
def make_request(**kwargs):
    """Create a FeedbackRequest-compatible object with new fields."""
    class Req:
        def __init__(self, **kw):
            for k, v in kw.items():
                setattr(self, k, v)
    return Req(**kwargs)

def simulate_game(phase=2):
    wr = elder_win_rate()
    avg_t = elder_avg_time()
    retries = elder_retries()
    emo = elder_emotion(phase)
    session_dur = elder_session_duration()
    consec_losses = elder_consecutive_losses(phase)
    hint_accept = elder_hint_accept_rate()
    hesitation = elder_move_hesitation()

    state = build_state(make_request(
        winRate=wr, avgTime=avg_t, retries=retries, emotion=emo,
        sessionDurationSec=session_dur, consecutiveLosses=consec_losses,
        hintAcceptRate=hint_accept, moveHesitationSec=hesitation,
        result="lose", timePlayed=int(avg_t), quitEarly=False,
        hintsShown=0, hintsAccepted=0,
    ))

    n_moves = random.randint(5, 20)
    for _ in range(n_moves):
        action = agent.act(state)

        next_wr = elder_win_rate()
        next_emo = elder_emotion(phase)
        next_session = session_dur + random.uniform(30, 180)
        result = random.choices(["win", "lose"], weights=[0.3, 0.7])[0]
        quit_early = random.random() < (0.20 if phase == 1 else 0.10)

        next_req = make_request(
            winRate=next_wr, avgTime=elder_avg_time(), retries=elder_retries(),
            emotion=next_emo, sessionDurationSec=next_session,
            consecutiveLosses=max(0, consec_losses + (0 if result == "win" else 1)),
            hintAcceptRate=elder_hint_accept_rate(), moveHesitationSec=elder_move_hesitation(),
            result=result, timePlayed=int(next_session), quitEarly=quit_early,
            hintsShown=random.randint(0, 2), hintsAccepted=random.randint(0, 1),
        )

        next_state = build_state(next_req)
        reward = calculate_reward(next_req, action)

        agent.store(state, action, reward, next_state)
        agent.learn_from_buffer(batch_size=32)
        state = next_state
        consec_losses = int(getattr(next_req, 'consecutiveLosses', 0))

# ==========================
# COUNTER-FACTUAL EDGE CASES
# ==========================
def simulate_frustration_spiral():
    """Train on: angry elder + 3+ losses → agent should REDUCE_DIFFICULTY."""
    for _ in range(3):
        req = make_request(
            winRate=0.05, avgTime=300, retries=5, emotion="angry",
            sessionDurationSec=900, consecutiveLosses=4,
            hintAcceptRate=0.2, moveHesitationSec=5.0,
            result="lose", timePlayed=300, quitEarly=False,
            hintsShown=1, hintsAccepted=0,
        )
        state = build_state(req)
        action = 3  # REDUCE_DIFFICULTY (correct action)
        next_req = make_request(
            winRate=0.3, avgTime=200, retries=2, emotion="neutral",
            sessionDurationSec=1000, consecutiveLosses=0,
            hintAcceptRate=0.5, moveHesitationSec=3.0,
            result="win", timePlayed=200, quitEarly=False,
            hintsShown=1, hintsAccepted=1,
        )
        next_state = build_state(next_req)
        reward = calculate_reward(next_req, action)
        agent.store(state, action, reward, next_state)

def simulate_long_session_pause():
    """Train on: long session → agent should PAUSE_SUGGEST."""
    for _ in range(3):
        req = make_request(
            winRate=0.4, avgTime=150, retries=1, emotion="neutral",
            sessionDurationSec=1800, consecutiveLosses=0,
            hintAcceptRate=0.6, moveHesitationSec=4.0,
            result="win", timePlayed=150, quitEarly=False,
            hintsShown=0, hintsAccepted=0,
        )
        state = build_state(req)
        action = 5  # PAUSE_SUGGEST
        next_req = make_request(
            winRate=0.4, avgTime=120, retries=1, emotion="happy",
            sessionDurationSec=1900, consecutiveLosses=0,
            hintAcceptRate=0.6, moveHesitationSec=3.0,
            result="win", timePlayed=120, quitEarly=False,
            hintsShown=0, hintsAccepted=0,
        )
        next_state = build_state(next_req)
        reward = calculate_reward(next_req, action)
        agent.store(state, action, reward, next_state)

# ==========================
# CURRICULUM PRETRAINING
# ==========================

# Phase 1 (500 games): Struggling elders — learn critical intervention
print("=== Phase 1: Struggling Elders (500 games) ===")
for i in range(1, 501):
    simulate_game(phase=1)
    # Add edge cases every 50 games
    if i % 50 == 0:
        simulate_frustration_spiral()
        simulate_long_session_pause()
        agent.learn_from_buffer(batch_size=32)
    if i % 100 == 0:
        print(f"Phase 1: {i}/500 games, epsilon: {round(agent.epsilon, 3)}")

# Phase 2 (1000 games): Mixed scenarios
print("\n=== Phase 2: Mixed Difficulty (1000 games) ===")
for i in range(1, 1001):
    simulate_game(phase=2)
    if i % 100 == 0:
        print(f"Phase 2: {i}/1000 games, epsilon: {round(agent.epsilon, 3)}")

# Phase 3 (1500 games): Full realistic distribution
print("\n=== Phase 3: Full Distribution (1500 games) ===")
for i in range(1, 1501):
    simulate_game(phase=3)
    if i % 150 == 0:
        print(f"Phase 3: {i}/1500 games, epsilon: {round(agent.epsilon, 3)}")

# ==========================
# Save the model
# ==========================
torch.save(agent.model.state_dict(), "pretrained_agent.pth")
print("\nPretraining complete! Model saved as pretrained_agent.pth")
print(f"Total learn steps: {agent.learn_steps}")
print(f"Final epsilon: {round(agent.epsilon, 3)}")
print(f"Replay buffer size: {len(agent.replay_buffer)}")
