# Emocare Web App 🌟

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)  
[![Python](https://img.shields.io/badge/Python-3.10-blue.svg)](https://www.python.org/)  
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)  

**Emocare** is a web application that provides **safe, evidence-based emotional support** for older adults, combining:  

- Multimodal Emotion Detection  
- Emotion-Adaptive UI  
- RAG-based Chatbot  
- Emotion-Adaptive Cognitive Game  

![System Architecture](./images/system_diagram.png)  
*Figure: Overall System Architecture*  

---

## 🚀 Features Overview

- Real-time **emotion detection** from face & voice  
- **Adaptive UI** for accessibility and comfort  
- **Evidence-based chatbot** for emotional support  
- **Cognitive game** with emotion-based difficulty  
- Personalized user profiles & long-term memory  
- Mood trend analysis and insights  

---

## 📂 Modules

<details>
<summary>1️⃣ Multimodal Emotion Detection (Member 1)</summary>

**Purpose:** Detects emotions from facial expressions and voice in real-time.  

**Features:**
- Input Acquisition: Camera & microphone  
- Face Emotion Detection: CNN + temporal smoothing  
- Voice Emotion Detection: MFCC + CNN + memory for silent periods  
- Multimodal Fusion: Combines face & voice emotions  
- UI Display: Shows face detection, individual & fused emotion  

**Tech Stack:** Python, OpenCV, TensorFlow / PyTorch, NumPy  

</details>

<details>
<summary>2️⃣ Emotion-Adaptive User Interface (Member 2)</summary>

**Purpose:** Provides an **adaptive UI** for elders based on detected emotions.  

**Features:**
- Dynamic layout, button size, spacing, and colors  
- Addresses 8 usability barriers for elderly users  

**Tech Stack:** React.js, CSS, Framer Motion, React Router, Figma  

</details>

<details>
<summary>3️⃣ Emocare Chatbot (Member 3)</summary>

**Purpose:** RAG-based chatbot providing **evidence-based emotional support**.  

**Features:**
- Evidence-based responses from 5 professor-approved PDFs stored in FAISS  
- Personalized responses via MongoDB user profiles  
- Simple emotion buttons for elders  
- Long-term chat memory & history sidebar  
- Mood trend analysis & proactive insights  

**Tech Stack:**  
- Frontend: Streamlit  
- Backend: Python, LangChain  
- LLM: Groq Llama-3.1-8B-Instant  
- Embeddings: sentence-transformers/all-MiniLM-L6-v2  
- Vector Store: FAISS  
- Database: MongoDB Atlas  

</details>

<details>
<summary>4️⃣ Emotion-Adaptive Cognitive Game (Member 4)</summary>

**Purpose:** Cognitive game adapting gameplay using **emotion & Reinforcement Learning (RL)**.  

**Features:**
- Match-3 Candy Crush-style gameplay  
- Emotion-based difficulty, hints, rewards, and grid size  
- RL agent improves via Deep Q-Learning (DQN)  

**Emotion Adaptation Table:**

| Emotion | Grid Size | Behavior |
|---------|-----------|----------|
| Happy   | 10×10     | Harder, fewer hints |
| Neutral | 8×8       | Balanced |
| Sad     | 6×6       | Easier, more hints |
| Angry   | 8×8       | Medium, faster pace |

**Tech Stack:** React.js, CSS Animations, Python, TensorFlow.js (optional backend)  

**Run Frontend:**  
```bash
cd frontend
npm install
npm start
