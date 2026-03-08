import React, { useEffect, useRef } from "react";
import "./instructions.css";

/* ── Instruction page sounds ── */
function createInstrSounds() {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const playWhoosh = () => {
    try {
      const c = getCtx();
      const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const gain = c.createGain();
      src.buffer = buf;
      filter.type = "bandpass"; filter.frequency.value = 800; filter.Q.value = 0.5;
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      gain.gain.setValueAtTime(0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
      src.start(); src.stop(c.currentTime + 0.3);
    } catch (e) {}
  };

  const playCardFlip = (index) => {
    try {
      const c = getCtx();
      const freq = 300 + index * 80;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "triangle"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
      osc.start(); osc.stop(c.currentTime + 0.18);
    } catch (e) {}
  };

  const playReady = () => {
    try {
      const c = getCtx();
      const notes = [392, 523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(c.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        const t = c.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
      });
    } catch (e) {}
  };

  const playHover = () => {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "sine"; osc.frequency.value = 900;
      gain.gain.setValueAtTime(0.06, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
      osc.start(); osc.stop(c.currentTime + 0.08);
    } catch (e) {}
  };

  return { playWhoosh, playCardFlip, playReady, playHover };
}

const instrSounds = createInstrSounds();

const instructions = [
  { icon: "🎯", title: "Goal", desc: "Reach 800 points before your moves or time runs out!" },
  { icon: "🔄", title: "How to Swap", desc: "Click a candy, then click an adjacent candy to swap them." },
  { icon: "🍬", title: "Make Matches", desc: "Match 3 or more candies in a row or column to clear them and earn points." },
  { icon: "🔥", title: "Combos", desc: "Chain multiple matches in one move to earn a combo multiplier bonus!" },
  { icon: "🧱", title: "Blockers", desc: "Dark blocks cannot be swapped. Work around them strategically." },
  { icon: "🧠", title: "AI Adapts", desc: "The game's difficulty adjusts to your skill level automatically." },
  { icon: "😊", title: "Emotions", desc: "Pick Happy, Sad, Angry or Neutral — each changes the board size!" },
  { icon: "💡", title: "Hints", desc: "Win games to earn free hints that highlight a valid swap for you." },
];

export default function InstructionsPage({ onPlay }) {
  const shownRef = useRef(new Set());

  useEffect(() => {
    instrSounds.playWhoosh();
  }, []);

  const handleCardVisible = (index) => {
    if (!shownRef.current.has(index)) {
      shownRef.current.add(index);
      setTimeout(() => instrSounds.playCardFlip(index), index * 80);
    }
  };

  return (
    <div className="instr-wrapper">
      {/* Background blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="instr-container">
        <div className="instr-header">
          <div className="instr-badge">📖 How To Play</div>
          <h1 className="instr-title">Candy Crush RL</h1>
          <p className="instr-subtitle">Master the board — outsmart the AI!</p>
        </div>

        <div className="instr-grid">
          {instructions.map((item, i) => (
            <div
              key={i}
              className="instr-card"
              style={{ animationDelay: `${i * 0.08}s` }}
              onAnimationStart={() => handleCardVisible(i)}
            >
              <div className="instr-icon">{item.icon}</div>
              <div className="instr-card-title">{item.title}</div>
              <div className="instr-card-desc">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="instr-controls">
          <div className="instr-controls-title">⌨️ Controls</div>
          <div className="instr-controls-row">
            <span className="instr-key">Click</span><span>Select a candy</span>
            <span className="instr-key">Click again</span><span>Swap with adjacent candy</span>
          </div>
        </div>

        <button
          className="instr-play-btn"
          onMouseEnter={() => instrSounds.playHover()}
          onClick={() => { instrSounds.playReady(); setTimeout(onPlay, 300); }}
        >
          🚀 Let's Play!
        </button>
      </div>
    </div>
  );
}
