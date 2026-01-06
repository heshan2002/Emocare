# ==========================
# Pretrain Candy Crush RL Agent
# ==========================

import random
import torch
from rl_backend import DQNAgent, build_state, FeedbackRequest, calculate_reward

# ==========================
# Create agent
# ==========================
agent = DQNAgent()

# Simulate emotions
emotions = ["happy", "neutral", "sad", "angry"]

# ==========================
# Simulate a game
# ==========================
def simulate_game():
    # Random game stats
    winRate = random.uniform(0, 1)
    avgTime = random.uniform(50, 600)  # seconds
    retries = random.randint(0, 5)
    emotion = random.choice(emotions)

    # Build initial state
    state = build_state(FeedbackRequest(
        winRate=winRate,
        avgTime=avgTime,
        retries=retries,
        emotion=emotion,
        result="loss",
        timePlayed=int(avgTime),   # convert to int
        quitEarly=False
    ))

    # Simulate moves (10–30 per game)
    for _ in range(random.randint(10, 30)):
        action = agent.act(state)

        # Simulate next state (random changes)
        next_state = build_state(FeedbackRequest(
            winRate=random.uniform(0, 1),
            avgTime=random.uniform(50, 600),
            retries=random.randint(0, 5),
            emotion=random.choice(emotions),
            result="loss",
            timePlayed=int(random.uniform(50, 600)),  # convert to int
            quitEarly=random.choice([True, False])
        ))

        # Simulate result for reward
        result = random.choice(["win", "loss"])
        timePlayed = int(random.uniform(50, 600))  # convert to int
        quitEarly = random.choice([True, False])

        feedback = FeedbackRequest(
            winRate=winRate,
            avgTime=avgTime,
            retries=retries,
            emotion=emotion,
            result=result,
            timePlayed=timePlayed,
            quitEarly=quitEarly
        )

        reward = calculate_reward(feedback)
        agent.learn(state, action, reward, next_state)

        # Move to next state
        state = next_state

# ==========================
# Pretrain loop
# ==========================
NUM_GAMES = 3000  # adjust as needed

for i in range(1, NUM_GAMES + 1):
    simulate_game()
    if i % 100 == 0:
        print(f"Simulated {i}/{NUM_GAMES} games, epsilon: {round(agent.epsilon,3)}")

# ==========================
# Save the model
# ==========================
torch.save(agent.model.state_dict(), "pretrained_agent.pth")
print("Pretraining complete! Model saved as pretrained_agent.pth")
