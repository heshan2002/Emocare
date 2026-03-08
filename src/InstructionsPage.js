import React, { useEffect, useRef, useState } from "react";
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
      src.buffer = buf; filter.type = "bandpass"; filter.frequency.value = 800; filter.Q.value = 0.5;
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      gain.gain.setValueAtTime(0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
      src.start(); src.stop(c.currentTime + 0.3);
    } catch (e) {}
  };
  const playCardFlip = (index) => {
    try {
      const c = getCtx();
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "triangle"; osc.frequency.value = 300 + index * 80;
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
      osc.start(); osc.stop(c.currentTime + 0.18);
    } catch (e) {}
  };
  const playReady = () => {
    try {
      const c = getCtx();
      [392, 523, 659, 784].forEach((freq, i) => {
        const osc = c.createOscillator(); const gain = c.createGain();
        osc.connect(gain); gain.connect(c.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        const t = c.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.2, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
      });
    } catch (e) {}
  };
  const playHover = () => {
    try {
      const c = getCtx();
      const osc = c.createOscillator(); const gain = c.createGain();
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

/* ── Mini candy board animation component ── */
function CandyBoard({ type }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const CANDIES = ["🔴","🔵","🟢","🟡","🟣"];

  // SWAP animation: two adjacent candies swap positions
  if (type === "swap") {
    const swapped = step >= 2;
    return (
      <div className="anim-board">
        <div className="anim-label">Swap</div>
        <div className="anim-row">
          {[0,1,2,3].map(i => {
            const isA = i === 1, isB = i === 2;
            const highlight = (isA || isB) && step === 1;
            const emoji = swapped
              ? [CANDIES[0], CANDIES[2], CANDIES[1], CANDIES[3]][i]
              : [CANDIES[0], CANDIES[1], CANDIES[2], CANDIES[3]][i];
            return (
              <div key={i} className={`anim-cell ${highlight ? "anim-selected" : ""} ${(isA||isB) && step >= 2 ? "anim-swapped" : ""}`}>
                {emoji}
              </div>
            );
          })}
        </div>
        <div className="anim-hint">{step <= 1 ? "Click to select" : "✨ Swapped!"}</div>
      </div>
    );
  }

  // MATCH animation: 3 in a row disappear
  if (type === "match") {
    const cleared = step >= 2;
    return (
      <div className="anim-board">
        <div className="anim-label">Match 3</div>
        <div className="anim-row">
          {[0,1,2,3].map(i => {
            const isMatch = i <= 2;
            return (
              <div key={i} className={`anim-cell ${isMatch && step === 1 ? "anim-matching" : ""} ${isMatch && cleared ? "anim-cleared" : ""}`}>
                {cleared && isMatch ? "✨" : isMatch ? CANDIES[1] : CANDIES[0]}
              </div>
            );
          })}
        </div>
        <div className="anim-hint">{cleared ? "🎉 +30 points!" : "3 in a row matched!"}</div>
      </div>
    );
  }

  // COMBO animation: chain of matches with multiplier
  if (type === "combo") {
    const multiplier = [1, 1, 1.5, 2][step];
    return (
      <div className="anim-board">
        <div className="anim-label">Combo!</div>
        <div className="anim-col">
          {[0,1,2].map(i => (
            <div key={i} className="anim-row">
              {[0,1,2,3].map(j => {
                const isCombo = step > i && j <= 2;
                return (
                  <div key={j} className={`anim-cell ${isCombo ? "anim-combo" : ""}`}>
                    {isCombo ? "✨" : CANDIES[(i + j) % 5]}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="anim-hint anim-multiplier">×{multiplier} multiplier!</div>
      </div>
    );
  }

  // HINT animation: hint flashes on two cells
  if (type === "hint") {
    const pulse = step % 2 === 0;
    return (
      <div className="anim-board">
        <div className="anim-label">Hint</div>
        <div className="anim-row">
          {[0,1,2,3].map(i => (
            <div key={i} className={`anim-cell ${(i === 1 || i === 2) && pulse ? "anim-hint-cell" : ""}`}>
              {CANDIES[i % 5]}
            </div>
          ))}
        </div>
        <div className="anim-hint">💡 Swap highlighted cells!</div>
      </div>
    );
  }

  // BLOCKER animation: shows blockers to avoid
  if (type === "blocker") {
    return (
      <div className="anim-board">
        <div className="anim-label">Blockers</div>
        <div className="anim-row">
          {[0,1,2,3].map(i => (
            <div key={i} className={`anim-cell ${i === 1 ? "anim-blocker" : step >= 2 && i !== 1 ? "anim-combo" : ""}`}>
              {i === 1 ? "🧱" : step >= 2 ? "✨" : CANDIES[i % 5]}
            </div>
          ))}
        </div>
        <div className="anim-hint">{step >= 2 ? "Work around them!" : "🧱 Can't swap blockers"}</div>
      </div>
    );
  }

  // EMOTION animation: shows different board sizes
  if (type === "emotion") {
    const emotions = [
      { label: "😊 Happy", size: 9, color: "#facc15" },
      { label: "😢 Sad",   size: 7, color: "#ef4444" },
      { label: "😠 Angry", size: 6, color: "#22c55e" },
      { label: "😐 Neutral",size: 8, color: "#3b82f6" },
    ];
    const cur = emotions[step % 4];
    return (
      <div className="anim-board">
        <div className="anim-label">Emotions</div>
        <div className="anim-emotion-box" style={{ borderColor: cur.color, color: cur.color }}>
          <div className="anim-emotion-label">{cur.label}</div>
          <div className="anim-emotion-grid">{cur.size}×{cur.size} board</div>
        </div>
        <div className="anim-hint">Board size changes!</div>
      </div>
    );
  }

  // AI ADAPT animation
  if (type === "ai") {
    const stages = ["Easy 😊", "Medium 🔥", "Hard 💀", "Adapting... 🧠"];
    return (
      <div className="anim-board">
        <div className="anim-label">AI Adapts</div>
        <div className="anim-ai-bar">
          <div className="anim-ai-fill" style={{ width: `${[25,55,85,60][step]}%`, background: ["#22c55e","#facc15","#ef4444","#a855f7"][step] }} />
        </div>
        <div className="anim-hint" style={{ color: ["#22c55e","#facc15","#ef4444","#a855f7"][step] }}>
          {stages[step]}
        </div>
      </div>
    );
  }

  // GOAL animation
  if (type === "goal") {
    const pct = [20, 45, 75, 100][step];
    return (
      <div className="anim-board">
        <div className="anim-label">Goal</div>
        <div className="anim-score-display">{[160, 360, 600, 800][step]}</div>
        <div className="anim-goal-bar">
          <div className="anim-goal-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="anim-hint">{pct === 100 ? "🏆 You Win!" : `${pct}% to 800 pts`}</div>
      </div>
    );
  }

  return null;
}

/* ── Main page ── */
const instructions = [
  { anim: "goal",    icon: "🎯", title: "Goal",       desc: "Reach 800 points before moves or time runs out!" },
  { anim: "swap",    icon: "🔄", title: "How to Swap", desc: "Click a candy, then click an adjacent candy to swap." },
  { anim: "match",   icon: "🍬", title: "Make Matches",desc: "Match 3+ in a row or column to clear and score." },
  { anim: "combo",   icon: "🔥", title: "Combos",      desc: "Chain matches to earn a score multiplier bonus!" },
  { anim: "blocker", icon: "🧱", title: "Blockers",    desc: "Dark blocks can't be swapped — work around them." },
  { anim: "ai",      icon: "🧠", title: "AI Adapts",   desc: "Difficulty adjusts automatically to your skill." },
  { anim: "emotion", icon: "😊", title: "Emotions",    desc: "Pick an emotion — each changes the board size!" },
  { anim: "hint",    icon: "💡", title: "Hints",       desc: "Win games to earn free hints highlighting valid swaps." },
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
              {/* Live animation demo */}
              <CandyBoard type={item.anim} />

              <div className="instr-card-title">{item.icon} {item.title}</div>
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