import React, { useState, useEffect, useRef } from "react";
import "./loading.css";

/* ── Loading page sounds (Web Audio) ── */
function createLoadingSounds() {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  // Magical sparkle chime on mount
  const playIntro = () => {
    try {
      const c = getCtx();
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(c.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = c.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
      });
    } catch (e) {}
  };

  // Bubbly pop when progress bar ticks
  const playPop = () => {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(600 + Math.random() * 400, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      osc.start(); osc.stop(c.currentTime + 0.12);
    } catch (e) {}
  };

  // Fanfare when "Start Game" button appears
  const playFanfare = () => {
    try {
      const c = getCtx();
      const chord = [523, 659, 784, 1047];
      chord.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(c.destination);
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.value = freq;
        const t = c.currentTime + i * 0.06;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.start(t); osc.stop(t + 0.8);
      });
    } catch (e) {}
  };

  // Button hover tick
  const playTick = () => {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "sine"; osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.08, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
      osc.start(); osc.stop(c.currentTime + 0.07);
    } catch (e) {}
  };

  return { playIntro, playPop, playFanfare, playTick };
}

const loadingSounds = createLoadingSounds();

export default function LoadingPage({ onFinish }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const popCountRef = useRef(0);

  useEffect(() => {
    // Play intro chime immediately on mount
    loadingSounds.playIntro();

    // Animate progress bar with pops
    const interval = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + Math.random() * 8 + 3, 100);
        // Play a pop every ~20% increment
        const popEvery = 20;
        const newCount = Math.floor(next / popEvery);
        if (newCount > popCountRef.current) {
          popCountRef.current = newCount;
          loadingSounds.playPop();
        }
        return next;
      });
    }, 120);

    const timer = setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setReady(true);
      loadingSounds.playFanfare();
    }, 2800);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, []);

  // Fixed star positions (computed once, not on every render)
  const stars = React.useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      left: `${(i * 37 + 11) % 100}%`,
      top: `${(i * 53 + 7) % 100}%`,
      delay: `${(i * 0.3) % 3}s`,
      size: `${10 + (i % 4) * 4}px`,
    })), []);

  return (
    <div className="loading-wrapper">
      <div className="stars">
        {stars.map((s, i) => (
          <div key={i} className="star"
            style={{ left: s.left, top: s.top, animationDelay: s.delay, fontSize: s.size }}>
            ✦
          </div>
        ))}
      </div>

      <div className="candy-title">🍬 Candy Crush RL 🍬</div>
      <div className="candy-subtitle">Emotion-Aware AI Edition</div>

      <div className="candy-loader">
        <div className="candy candy-1">🍬</div>
        <div className="candy candy-2">🍭</div>
        <div className="candy candy-3">🧁</div>
        <div className="candy candy-4">🍫</div>
        <div className="candy candy-5">🌈</div>
      </div>

      {!ready ? (
        <div className="loading-bar-wrapper">
          <div className="loading-bar-track">
            <div className="loading-bar-fill" style={{ width: `${progress}%`, transition: "width 0.15s ease" }} />
          </div>
          <div className="loading-text">Loading your sweet adventure... {Math.round(progress)}%</div>
        </div>
      ) : (
        <button
          className="start-btn"
          onMouseEnter={() => loadingSounds.playTick()}
          onClick={onFinish}
        >
          🎮 Start Game
        </button>
      )}

      <div className="loading-tip">
        💡 Tip: Match 3 or more candies in a row to score points!
      </div>
    </div>
  );
}
