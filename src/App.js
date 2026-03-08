import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain,
  RotateCcw,
  Heart,
  Frown,
  Flame,
  Meh,
  Sparkles,
  Trophy,
  Target,
  Zap,
} from "lucide-react";

/* ================= SOUND SYSTEM ================= */
const createSoundSystem = () => {
  let audioCtx = null;
  let bgGainNode = null;
  let bgOscillators = [];
  let isBgPlaying = false;

  const getCtx = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  };

  const playClick = () => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  const playMatch = (comboCount = 0) => {
    try {
      const ctx = getCtx();
      const baseFreq = 523 + comboCount * 100;
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (e) {}
  };

  const playInvalid = () => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  const playWin = () => {
    try {
      const ctx = getCtx();
      const melody = [523, 659, 784, 1047];
      melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  };

  const playLose = () => {
    try {
      const ctx = getCtx();
      const melody = [440, 370, 311, 277];
      melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    } catch (e) {}
  };

  // ── Beautiful Candy Crush style background music ──
  // Full looping track: melody + chords + bass + arpeggios + sparkle layer

  let musicLoopTimer = null;
  const allMusicNodes = [];

  const NOTE = {
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
    C6:1046.50, D6:1174.66, E6:1318.51, G6:1567.98,
    G3:196.00, A3:220.00, B3:246.94,
    C3:130.81, G2:98.00, F2:87.31, A2:110.00,
  };

  // Play a single note with envelope
  const playNote = (ctx, dest, freq, startTime, dur, vol, type = "sine", detune = 0) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(gain);
      gain.connect(dest);
      const att = Math.min(0.04, dur * 0.1);
      const rel = Math.min(0.18, dur * 0.4);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + att);
      gain.gain.setValueAtTime(vol, startTime + dur - rel);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
      allMusicNodes.push(osc, gain);
    } catch (e) {}
  };

  // Glockenspiel-style sparkle note
  const playSparkle = (ctx, dest, freq, startTime) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain); gain.connect(dest);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.09, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.6);
      osc.start(startTime); osc.stop(startTime + 0.65);
      allMusicNodes.push(osc, gain);
    } catch (e) {}
  };

  // Soft pad chord
  const playPad = (ctx, dest, freqs, startTime, dur, vol = 0.045) => {
    freqs.forEach(f => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.connect(gain); gain.connect(dest);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.3);
        gain.gain.setValueAtTime(vol, startTime + dur - 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
        osc.start(startTime); osc.stop(startTime + dur + 0.1);
        allMusicNodes.push(osc, gain);
      } catch(e) {}
    });
  };

  // Schedule one full loop of the song (8-bar, ~16s at 120bpm)
  const scheduleMusicLoop = (ctx, dest, loopStart) => {
    const BPM = 118;
    const BEAT = 60 / BPM;          // ~0.508s per beat
    const BAR  = BEAT * 4;          // ~2.03s per bar
    const t    = loopStart;

    // ── MELODY (glockenspiel / sine, bright) ──
    // Key of C major, 8 bars, playful candy-crush style
    const melody = [
      // Bar 1 - C E G E
      [0,       NOTE.C5, BEAT*0.9], [1,       NOTE.E5, BEAT*0.9],
      [2,       NOTE.G5, BEAT*0.9], [3,       NOTE.E5, BEAT*0.9],
      // Bar 2 - F A C A
      [4,       NOTE.F5, BEAT*0.9], [5,       NOTE.A5, BEAT*0.9],
      [6,       NOTE.C6, BEAT*1.4], [7.5,     NOTE.A5, BEAT*0.4],
      // Bar 3 - G B D B
      [8,       NOTE.G5, BEAT*0.5], [8.5,     NOTE.A5, BEAT*0.5],
      [9,       NOTE.B5, BEAT*0.9], [10,      NOTE.D6, BEAT*1.8],
      // Bar 4 - E D C rest
      [12,      NOTE.E5, BEAT*0.5], [12.5,    NOTE.D5, BEAT*0.5],
      [13,      NOTE.C5, BEAT*1.8],
      // Bar 5 - A G F E
      [16,      NOTE.A5, BEAT*0.9], [17,      NOTE.G5, BEAT*0.9],
      [18,      NOTE.F5, BEAT*0.9], [19,      NOTE.E5, BEAT*0.9],
      // Bar 6 - D E F G (ascending run)
      [20,      NOTE.D5, BEAT*0.5], [20.5,    NOTE.E5, BEAT*0.5],
      [21,      NOTE.F5, BEAT*0.5], [21.5,    NOTE.G5, BEAT*0.5],
      [22,      NOTE.A5, BEAT*1.8],
      // Bar 7 - turnaround
      [24,      NOTE.G5, BEAT*0.5], [24.5,    NOTE.E5, BEAT*0.5],
      [25,      NOTE.C5, BEAT*0.5], [25.5,    NOTE.E5, BEAT*0.5],
      [26,      NOTE.G5, BEAT*0.9], [27,      NOTE.A5, BEAT*0.9],
      // Bar 8 - resolve
      [28,      NOTE.G5, BEAT*0.5], [28.5,    NOTE.E5, BEAT*0.5],
      [29,      NOTE.C5, BEAT*0.5], [29.5,    NOTE.D5, BEAT*0.5],
      [30,      NOTE.C5, BEAT*1.9],
    ];
    melody.forEach(([beat, freq, dur]) => {
      playNote(ctx, dest, freq, t + beat * BEAT, dur, 0.18, "sine");
      // Sparkle overtone an octave up, softer
      playSparkle(ctx, dest, freq * 2, t + beat * BEAT);
    });

    // ── COUNTER-MELODY (triangle, warmer) ──
    const counter = [
      [0, NOTE.E4, BEAT*1.8], [2, NOTE.G4, BEAT*1.8],
      [4, NOTE.A4, BEAT*1.8], [6, NOTE.C5, BEAT*1.8],
      [8, NOTE.B4, BEAT*1.8], [10,NOTE.G4, BEAT*1.8],
      [12,NOTE.A4, BEAT*1.8], [14,NOTE.E4, BEAT*1.8],
      [16,NOTE.F4, BEAT*1.8], [18,NOTE.A4, BEAT*1.8],
      [20,NOTE.G4, BEAT*1.8], [22,NOTE.E4, BEAT*1.8],
      [24,NOTE.D4, BEAT*1.8], [26,NOTE.F4, BEAT*1.8],
      [28,NOTE.E4, BEAT*3.5],
    ];
    counter.forEach(([beat, freq, dur]) => {
      playNote(ctx, dest, freq, t + beat * BEAT, dur, 0.07, "triangle");
    });

    // ── PADS / CHORDS (soft sine pads every bar) ──
    const chords = [
      [0,  [NOTE.C3, NOTE.E4, NOTE.G4]],
      [4,  [NOTE.F2, NOTE.A3, NOTE.C4]],
      [8,  [NOTE.G2, NOTE.B3, NOTE.D4]],
      [12, [NOTE.A2, NOTE.C4, NOTE.E4]],
      [16, [NOTE.F2, NOTE.A3, NOTE.C4]],
      [20, [NOTE.G2, NOTE.B3, NOTE.D4]],
      [24, [NOTE.C3, NOTE.E4, NOTE.G4]],
      [28, [NOTE.G2, NOTE.D4, NOTE.G4]],
    ];
    chords.forEach(([beat, freqs]) => {
      playPad(ctx, dest, freqs, t + beat * BEAT, BAR * 1.02, 0.04);
    });

    // ── BASS (triangle, punchy) ──
    const bass = [
      [0, NOTE.C3], [2, NOTE.G3], [4, NOTE.F2], [6, NOTE.A2],
      [8, NOTE.G2], [10,NOTE.B3], [12,NOTE.A2], [14,NOTE.E4],
      [16,NOTE.F2], [18,NOTE.C3], [20,NOTE.G2], [22,NOTE.D4],
      [24,NOTE.C3], [26,NOTE.G3], [28,NOTE.C3], [30,NOTE.G3],
    ];
    bass.forEach(([beat, freq]) => {
      playNote(ctx, dest, freq, t + beat * BEAT, BEAT * 0.75, 0.13, "triangle");
    });

    // ── ARPEGGIO (high, fast, glittery) ──
    const arpPatterns = [
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6],
      [NOTE.F5, NOTE.A5, NOTE.C6, NOTE.F5],
      [NOTE.G5, NOTE.B5, NOTE.D6, NOTE.G5],
      [NOTE.A5, NOTE.C6, NOTE.E6, NOTE.A5],
      [NOTE.F5, NOTE.A5, NOTE.C6, NOTE.F5],
      [NOTE.G5, NOTE.B5, NOTE.D6, NOTE.G5],
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6],
      [NOTE.G5, NOTE.D6, NOTE.G6, NOTE.D6],
    ];
    arpPatterns.forEach((pattern, bar) => {
      pattern.forEach((freq, i) => {
        playSparkle(ctx, dest, freq, t + bar * BAR + i * BEAT * 0.5);
      });
    });

    // ── KICK-STYLE BASS PULSE (every beat, subtle) ──
    for (let beat = 0; beat < 32; beat++) {
      try {
        const kickTime = t + beat * BEAT;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(80, kickTime);
        osc.frequency.exponentialRampToValueAtTime(30, kickTime + 0.12);
        gain.gain.setValueAtTime(0.08, kickTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, kickTime + 0.18);
        osc.connect(gain); gain.connect(dest);
        osc.start(kickTime); osc.stop(kickTime + 0.2);
        allMusicNodes.push(osc, gain);
      } catch(e) {}
    }
  };

  const startBackground = () => {
    if (isBgPlaying) return;
    try {
      const ctx = getCtx();

      // Master chain: compressor → reverb → gain → output
      bgGainNode = ctx.createGain();
      bgGainNode.gain.setValueAtTime(0.72, ctx.currentTime);

      // Simple reverb via convolver
      const reverbLen = ctx.sampleRate * 1.5;
      const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = reverbBuf.getChannelData(ch);
        for (let i = 0; i < reverbLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/reverbLen, 2.5) * 0.35;
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = reverbBuf;

      const dryGain  = ctx.createGain(); dryGain.gain.value  = 0.75;
      const wetGain  = ctx.createGain(); wetGain.gain.value  = 0.28;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      bgGainNode.connect(dryGain);
      bgGainNode.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(compressor);
      wetGain.connect(compressor);
      compressor.connect(ctx.destination);

      isBgPlaying = true;
      bgOscillators = [{ osc: { stop: () => {} }, lfo: null }];

      const LOOP_DUR = (60 / 118) * 32; // 32 beats at 118bpm ≈ 16.27s

      const loop = (startTime) => {
        if (!isBgPlaying) return;
        scheduleMusicLoop(ctx, bgGainNode, startTime);
        musicLoopTimer = setTimeout(() => loop(startTime + LOOP_DUR), (LOOP_DUR - 0.1) * 1000);
      };

      loop(ctx.currentTime + 0.05);
    } catch (e) { console.error("Music error:", e); }
  };

  const stopBackground = () => {
    try {
      clearTimeout(musicLoopTimer);
      musicLoopTimer = null;
      allMusicNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch(e){} });
      allMusicNodes.length = 0;
      bgOscillators = [];
      isBgPlaying = false;
    } catch (e) {}
  };

  const setBgVolume = (vol) => {
    try {
      if (bgGainNode) bgGainNode.gain.setValueAtTime(vol, getCtx().currentTime);
    } catch (e) {}
  };

  return { playClick, playMatch, playInvalid, playWin, playLose, startBackground, stopBackground, setBgVolume };
};

const soundSystem = createSoundSystem();

/* ================= CONFIG ================= */
const BASE_CANDY_TYPES = 5;

// Keep your existing 5 colors/symbols, and extend for HARD mode (6th/7th candy)
const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#B388FF", // extra for hard (6th)
  "#FFB74D", // extra (if you ever go 7)
];

const CANDY_SYMBOLS = ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠", "🟤"];

// ✅ Backend base URL (matches your backend)
const API_URL = "http://localhost:8000/api";

// Base values (your existing)
const TIME_LIMIT_SECONDS = 120; // 2 minutes
const WIN_SCORE = 800;

// Special cell codes
const EMPTY = -1;
const BLOCKER = -2;

const getBoardSizeByEmotion = (emotion) => {
  switch (emotion) {
    case "happy":
      return 9;
    case "sad":
      return 7;
    case "angry":
      return 6;
    default:
      return 8;
  }
};

/* ================= DIFFICULTY SETTINGS ================= */
const getDifficultySettings = (difficulty) => {
  switch (difficulty) {
    case "hard":
      return {
        label: "Hard",
        candyTypes: 6,
        timeLimit: 90,
        startMoves: 26,
        blockers: 8,
        invalidPenaltySeconds: 2,
      };
    case "medium":
      return {
        label: "Medium",
        candyTypes: 5,
        timeLimit: 110,
        startMoves: 28,
        blockers: 4,
        invalidPenaltySeconds: 1,
      };
    default:
      return {
        label: "Easy",
        candyTypes: 5,
        timeLimit: TIME_LIMIT_SECONDS,
        startMoves: 30,
        blockers: 0,
        invalidPenaltySeconds: 0,
      };
  }
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const computeDifficultyScore = ({
  validMoves,
  invalidMoves,
  score,
  timePlayedSec,
  maxMovesWindow,
}) => {
  const total = Math.max(1, validMoves + invalidMoves);
  const invalidRate = invalidMoves / total;

  // Speed: points per second, normalized
  const pps = score / Math.max(1, timePlayedSec);
  const speedScore = clamp01(pps / 6); // tune

  // Accuracy: lower invalid rate -> higher
  const accuracyScore = clamp01(1 - invalidRate * 1.8);

  // Activity: number of valid moves in window
  const activityScore = clamp01(validMoves / Math.max(1, maxMovesWindow));

  return clamp01(0.45 * speedScore + 0.40 * accuracyScore + 0.15 * activityScore);
};

const randInt = (n) => Math.floor(Math.random() * n);

/** Adjust the current board to match NEW settings:
 * - If candyTypes decreases, remap any candy >= candyTypes
 * - If blockers target changes, add/remove blockers to hit target
 */
const adjustBoardForSettings = (prevBoard, newSettings) => {
  const N = prevBoard.length;
  const b = prevBoard.map((row) => row.slice());

  // 1) Remap candies if candyTypes decreased (or just to be safe)
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] >= 0 && b[r][c] >= newSettings.candyTypes) {
        b[r][c] = randInt(newSettings.candyTypes);
      }
    }
  }

  // 2) Adjust blockers count to match target
  const blockersNow = [];
  const candyCells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] === BLOCKER) blockersNow.push([r, c]);
      else if (b[r][c] >= 0) candyCells.push([r, c]);
    }
  }

  const target = Math.max(0, Math.min(newSettings.blockers, Math.floor(N * N * 0.18)));

  // Remove extra blockers (make game easier)
  if (blockersNow.length > target) {
    // shuffle blockers
    for (let i = blockersNow.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [blockersNow[i], blockersNow[j]] = [blockersNow[j], blockersNow[i]];
    }
    const toRemove = blockersNow.length - target;
    for (let k = 0; k < toRemove; k++) {
      const [r, c] = blockersNow[k];
      b[r][c] = randInt(newSettings.candyTypes);
    }
  }

  // Add missing blockers (make game harder)
  if (blockersNow.length < target) {
    // recompute candidates after any removals
    const candidates = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (b[r][c] >= 0) candidates.push([r, c]);
      }
    }
    // shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const need = Math.min(target - blockersNow.length, candidates.length);
    for (let k = 0; k < need; k++) {
      const [r, c] = candidates[k];
      b[r][c] = BLOCKER;
    }
  }

  return b;
};

export default function EmotionRLCandyCrush() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bgMusicEnabled, setBgMusicEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const bgMusicEnabledRef = useRef(true);

  const playSound = useCallback((name, ...args) => {
    if (!soundEnabledRef.current) return;
    soundSystem[name]?.(...args);
  }, []);

  const [emotion, setEmotion] = useState("neutral");
  const [boardSize, setBoardSize] = useState(8);
  const [board, setBoard] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const [moves, setMoves] = useState(30);
  const [gameOver, setGameOver] = useState(false);

  // ✅ NEW: track win state for UI
  const [didWin, setDidWin] = useState(false);

  // ✅ Hint highlights TWO cells to swap
  const [hintSwap, setHintSwap] = useState(null);
  // hintSwap = { a:{r,c}, b:{r,c} }

  const [rewardPops, setRewardPops] = useState([]);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const gameStartTime = useRef(Date.now());

  // ✅ REQUIRED for time limit UI
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SECONDS);

  // ✅ Prevent double endGame calls
  const gameEndedRef = useRef(false);

  // ✅ store the latest decisionId from backend
  const lastDecisionIdRef = useRef(null);

  // ✅ memory box: prevents duplicate mid-game decision calls (one per move)
  const lastFeedbackMoveRef = useRef(null);

  /* ================== Behaviour Tracking (DDA) ================== */
  const MAX_WINDOW = 12; // look at last N swap attempts
  const [difficulty, setDifficulty] = useState("easy"); // easy | medium | hard
  const difficultyRef = useRef("easy");
  const settingsRef = useRef(getDifficultySettings("easy"));

  const moveWindowRef = useRef([]); // array of booleans: true=valid, false=invalid
  const resetBehaviourTracking = useCallback(() => {
    moveWindowRef.current = [];
  }, []);

  /* ================== WIN REWARD SYSTEM ================== */
  const [coins, setCoins] = useState(0);
  const [winReward, setWinReward] = useState(null);
  // winReward shown on modal: { coinsGained, bonusStartTimeSec, bonusHint, difficulty, emotion }

  const pendingRewardRef = useRef(null); // reward applied in the NEXT game start
  const winRewardGivenRef = useRef(false); // avoids double-give

  // Load/save coins (simple persistence)
  useEffect(() => {
    const saved = localStorage.getItem("cc_coins");
    if (saved != null) setCoins(Number(saved) || 0);
  }, []);
  useEffect(() => {
    localStorage.setItem("cc_coins", String(coins));
  }, [coins]);

  const giveWinReward = useCallback(() => {
    if (winRewardGivenRef.current) return; // already rewarded this game
    winRewardGivenRef.current = true;

    const d = difficultyRef.current;

    // ✅ Reward amounts (you can change these)
    const coinsGained = d === "hard" ? 60 : d === "medium" ? 35 : 20;
    const bonusStartTimeSec = d === "hard" ? 10 : d === "medium" ? 7 : 5;
    const bonusHint = d !== "easy"; // give 1 free hint next game on medium/hard

    const reward = {
      coinsGained,
      bonusStartTimeSec,
      bonusHint,
      difficulty: d,
      emotion,
      at: Date.now(),
    };

    // Add coins now
    setCoins((c) => c + coinsGained);

    // Show reward in win modal
    setWinReward(reward);

    // Store for next game to apply start bonuses
    pendingRewardRef.current = reward;
  }, [emotion]);

  // Generate board with candyTypes + optional blockers
  const generateBoard = (size, candyTypes, blockersCount = 0) => {
    const b = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.floor(Math.random() * candyTypes))
    );

    // Place blockers randomly
    const totalCells = size * size;
    const count = Math.min(blockersCount, Math.floor(totalCells * 0.18));
    const used = new Set();

    while (used.size < count) {
      const idx = Math.floor(Math.random() * totalCells);
      if (used.has(idx)) continue;
      used.add(idx);
      const r = Math.floor(idx / size);
      const c = idx % size;
      b[r][c] = BLOCKER;
    }
    return b;
  };

  const callBackend = useCallback(async (endpoint, payload) => {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Backend error:", endpoint, txt);
        return null;
      }

      return await res.json();
    } catch (e) {
      console.error("Backend call failed:", endpoint, e);
      return null;
    }
  }, []);

  // ✅ Find matches (uses boardSize) — ignore negatives properly
  const findMatches = (b) => {
    const matches = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize - 2; c++) {
        const v = b[r][c];
        if (v >= 0 && v === b[r][c + 1] && v === b[r][c + 2]) {
          matches.push([r, c], [r, c + 1], [r, c + 2]);
        }
      }
    }
    for (let r = 0; r < boardSize - 2; r++) {
      for (let c = 0; c < boardSize; c++) {
        const v = b[r][c];
        if (v >= 0 && v === b[r + 1][c] && v === b[r + 2][c]) {
          matches.push([r, c], [r + 1, c], [r + 2, c]);
        }
      }
    }
    return matches;
  };

  // ✅ Correct hint: find an ACTUAL swap that creates a match (blockers cannot be swapped)
  const findHintSwap = useCallback((b) => {
    const N = b.length;

    const findMatchesLocal = (grid) => {
      const matches = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N - 2; c++) {
          const v = grid[r][c];
          if (v >= 0 && v === grid[r][c + 1] && v === grid[r][c + 2]) {
            matches.push([r, c], [r, c + 1], [r, c + 2]);
          }
        }
      }
      for (let r = 0; r < N - 2; r++) {
        for (let c = 0; c < N; c++) {
          const v = grid[r][c];
          if (v >= 0 && v === grid[r + 1][c] && v === grid[r + 2][c]) {
            matches.push([r, c], [r + 1, c], [r + 2, c]);
          }
        }
      }
      return matches;
    };

    const clone = (x) => x.map((row) => [...row]);

    const trySwap = (r1, c1, r2, c2) => {
      if (b[r1][c1] === BLOCKER || b[r2][c2] === BLOCKER) return false;
      const t = clone(b);
      [t[r1][c1], t[r2][c2]] = [t[r2][c2], t[r1][c1]];
      return findMatchesLocal(t).length > 0;
    };

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (c + 1 < N && trySwap(r, c, r, c + 1)) {
          return { a: { r, c }, b: { r, c: c + 1 } };
        }
        if (r + 1 < N && trySwap(r, c, r + 1, c)) {
          return { a: { r, c }, b: { r: r + 1, c } };
        }
      }
    }
    return null;
  }, []);

  const applyMatches = (b, candyTypes) => {
    const matches = findMatches(b);
    if (!matches.length) {
      setCombo(0);
      return false;
    }

    const comboMultiplier = 1 + combo * 0.5;
    const points = matches.length * 10 * comboMultiplier;

    matches.forEach(([r, c]) => {
      if (b[r][c] >= 0) {
        const id = Date.now() + Math.random();
        setRewardPops((p) => [
          ...p,
          { id, r, c, value: Math.round(points / matches.length) },
        ]);
        setTimeout(() => setRewardPops((p) => p.filter((x) => x.id !== id)), 1200);
        b[r][c] = EMPTY;
      }
    });

    setScore((s) => {
      const newScore = s + points;
      scoreRef.current = newScore;
      setHighScore((h) => Math.max(h, newScore));
      return newScore;
    });

    setCombo((c) => c + 1);

    // Drop candies, blockers stay fixed and block falling through them
    for (let c = 0; c < boardSize; c++) {
      let r = boardSize - 1;
      while (r >= 0) {
        if (b[r][c] === BLOCKER) {
          r--;
          continue;
        }

        let segBottom = r;
        let segTop = r;
        while (segTop >= 0 && b[segTop][c] !== BLOCKER) segTop--;
        segTop++;

        const candies = [];
        for (let rr = segBottom; rr >= segTop; rr--) {
          if (b[rr][c] >= 0) candies.push(b[rr][c]);
        }

        let write = segBottom;
        for (let i = 0; i < candies.length; i++) {
          b[write][c] = candies[i];
          write--;
        }
        while (write >= segTop) {
          b[write][c] = Math.floor(Math.random() * candyTypes);
          write--;
        }

        r = segTop - 1;
      }
    }

    return true;
  };

  const applyDecisionToUI = useCallback(
    (decision, currentBoard) => {
      if (!decision) return;

      if (decision.actionName === "SHOW_HINT") {
        const hint = findHintSwap(currentBoard);
        if (!hint) return;

        setHintSwap(hint);
        setTimeout(() => setHintSwap(null), 4000);
      }
    },
    [findHintSwap]
  );

  /** ✅ Update DDA based on behaviour; can DOWNGRADE happy-start hard to easy. */
  const updateDifficultyFromBehaviour = useCallback((isValidMove) => {
    moveWindowRef.current.push(isValidMove);
    if (moveWindowRef.current.length > MAX_WINDOW) moveWindowRef.current.shift();

    const validMoves = moveWindowRef.current.filter(Boolean).length;
    const invalidMoves = moveWindowRef.current.length - validMoves;

    const timePlayedSec = Math.floor((Date.now() - gameStartTime.current) / 1000);

    const dScore = computeDifficultyScore({
      validMoves,
      invalidMoves,
      score: scoreRef.current,
      timePlayedSec,
      maxMovesWindow: MAX_WINDOW,
    });

    // Hysteresis thresholds (less bouncing)
    const cur = difficultyRef.current;
    let next = cur;

    if (cur === "easy") {
      if (dScore >= 0.78) next = "hard";
      else if (dScore >= 0.55) next = "medium";
    } else if (cur === "medium") {
      if (dScore >= 0.80) next = "hard";
      else if (dScore <= 0.40) next = "easy";
    } else if (cur === "hard") {
      // ✅ allow hard -> easier if player struggles
      if (dScore <= 0.32) next = "easy";
      else if (dScore <= 0.52) next = "medium";
    }

    if (next !== cur) {
      difficultyRef.current = next;
      setDifficulty(next);

      const newSettings = getDifficultySettings(next);
      const oldSettings = settingsRef.current;
      settingsRef.current = newSettings;

      // ✅ APPLY changes immediately so you can SEE them:
      // If harder -> cap down. If easier -> raise up.
      setTimeLeft((t) => {
        if (newSettings.timeLimit < oldSettings.timeLimit) return Math.min(t, newSettings.timeLimit);
        return Math.max(t, newSettings.timeLimit);
      });

      setMoves((m) => {
        if (newSettings.startMoves < oldSettings.startMoves) return Math.min(m, newSettings.startMoves);
        return Math.max(m, newSettings.startMoves);
      });

      // ✅ Adjust board: blockers + candy types (also removes blockers when going easier)
      setBoard((prev) => adjustBoardForSettings(prev, newSettings));
    }
  }, []);

  // ✅ initGame: HAPPY starts HARD, then behaviour can drop hard->easy
  const initGame = useCallback(async () => {
    const size = getBoardSizeByEmotion(emotion);
    setBoardSize(size);

    // ✅ reset win reward for this new round
    winRewardGivenRef.current = false;
    setWinReward(null);

    // ✅ Start difficulty rule:
    // happy => start hard
    // otherwise => start easy
    const startDiff = emotion === "happy" ? "hard" : "easy";

    setDifficulty(startDiff);
    difficultyRef.current = startDiff;
    settingsRef.current = getDifficultySettings(startDiff);

    resetBehaviourTracking();

    const s = settingsRef.current;

    const newBoard = generateBoard(size, s.candyTypes, s.blockers);
    setBoard(newBoard);

    setScore(0);
    scoreRef.current = 0;

    setMoves(s.startMoves);

    // ✅ reset "mid-game feedback memory" at new game
    lastFeedbackMoveRef.current = s.startMoves;

    setCombo(0);
    setGameOver(false);
    setDidWin(false);
    setHintSwap(null);
    setRewardPops([]);
    gameStartTime.current = Date.now();

    // ✅ reset timer + end flag
    // Apply any pending reward to NEXT game start (bonus time + optional free hint)
    const pending = pendingRewardRef.current;
    if (pending?.bonusStartTimeSec) {
      setTimeLeft(s.timeLimit + pending.bonusStartTimeSec);
    } else {
      setTimeLeft(s.timeLimit);
    }
    gameEndedRef.current = false;

    // If pending reward gives a free hint, show it at start
    if (pending?.bonusHint) {
      const hint = findHintSwap(newBoard);
      if (hint) {
        setHintSwap(hint);
        setTimeout(() => setHintSwap(null), 4000);
      }
    }
    // Clear pending so it doesn't repeat
    pendingRewardRef.current = null;

    // ✅ Ask backend for decision (returns decisionId)
    const decision = await callBackend("/decision", {
      winRate: 0,
      avgTime: 0,
      retries: 0,
      emotion,
    });

    if (decision?.decisionId) {
      lastDecisionIdRef.current = decision.decisionId;
    } else {
      lastDecisionIdRef.current = null;
    }

    // ✅ Apply decision actions (SHOW_HINT -> real swap hint using newBoard)
    applyDecisionToUI(decision, newBoard);
  }, [emotion, callBackend, applyDecisionToUI, resetBehaviourTracking, findHintSwap]);

  // Background music effect
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    bgMusicEnabledRef.current = bgMusicEnabled;
    if (bgMusicEnabled && !gameOver) {
      soundSystem.startBackground();
    } else {
      soundSystem.stopBackground();
    }
  }, [bgMusicEnabled, gameOver]);

  useEffect(() => {
    if (!gameOver && bgMusicEnabled) {
      soundSystem.startBackground();
    } else {
      soundSystem.stopBackground();
    }
    return () => soundSystem.stopBackground();
  }, [gameOver, bgMusicEnabled]);

  const toggleSound = () => {
    setSoundEnabled(v => !v);
  };

  const toggleBgMusic = () => {
    setBgMusicEnabled(v => !v);
  };

  useEffect(() => {
    initGame();
  }, [initGame]);

  // ✅ TIME LIMIT countdown
  useEffect(() => {
    if (gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver]);

  const endGame = useCallback(
    async ({ result = "lose", quitEarly = false } = {}) => {
      if (gameEndedRef.current) return;
      gameEndedRef.current = true;

      const timePlayed = Math.floor((Date.now() - gameStartTime.current) / 1000);
      const decisionId = lastDecisionIdRef.current;

      setDidWin(result === "win");
      if (result === "win") playSound("playWin");
      else playSound("playLose");

      if (decisionId) {
        await callBackend("/feedback", {
          decisionId,
          winRate: 0,
          avgTime: timePlayed,
          retries: 0,
          emotion,
          timePlayed,
          quitEarly,
          result,
        });
        lastDecisionIdRef.current = null;
      } else {
        console.warn("[FRONTEND] endGame: no decisionId (feedback skipped)");
      }

      setGameOver(true);
    },
    [emotion, callBackend]
  );

  // ✅ WIN condition (+ reward on win)
  useEffect(() => {
    if (!gameOver && score >= WIN_SCORE && !gameEndedRef.current) {
      // ✅ Give reward once when win happens
      giveWinReward();
      endGame({ result: "win", quitEarly: false });
    }
  }, [score, gameOver, endGame, giveWinReward]);

  // ✅ If timer reaches 0, end game (lose)
  useEffect(() => {
    if (!gameOver && timeLeft === 0) {
      endGame({ result: "lose", quitEarly: true });
    }
  }, [timeLeft, gameOver, endGame]);

  const handleClick = (r, c) => {
    if (gameOver) return;

    // Blockers cannot be selected/swapped
    if (board?.[r]?.[c] === BLOCKER) return;

    if (!selected) {
      playSound("playClick");
      return setSelected({ r, c });
    }

    const { r: r1, c: c1 } = selected;

    if (Math.abs(r - r1) + Math.abs(c - c1) === 1) {
      // Prevent swapping with blocker
      if (board?.[r1]?.[c1] === BLOCKER || board?.[r]?.[c] === BLOCKER) {
        setSelected(null);
        return;
      }

      const copy = board.map((row) => [...row]);
      [copy[r][c], copy[r1][c1]] = [copy[r1][c1], copy[r][c]];

      // ✅ Spend a move for every swap attempt
      setMoves((m) => m - 1);

      const isValid = findMatches(copy).length > 0;

      if (isValid) {
        playSound("playMatch", combo);
        const s = settingsRef.current;
        while (applyMatches(copy, s.candyTypes)) {}
        setBoard(copy);

        // ✅ Behaviour update (valid)
        updateDifficultyFromBehaviour(true);

        // ✅ Ask AI after a VALID move (one decision per move, guarded)
        if (lastFeedbackMoveRef.current !== moves - 1) {
          lastFeedbackMoveRef.current = moves - 1;

          (async () => {
            const timePlayed = Math.floor(
              (Date.now() - gameStartTime.current) / 1000
            );

            const decision = await callBackend("/decision", {
              winRate: 0,
              avgTime: timePlayed,
              retries: 0,
              emotion,
            });

            if (decision?.decisionId) lastDecisionIdRef.current = decision.decisionId;

            applyDecisionToUI(decision, copy);
          })();
        }
      } else {
        // ❌ Invalid move -> revert swap (move still counts)
        [copy[r][c], copy[r1][c1]] = [copy[r1][c1], copy[r][c]];
        setBoard(copy);
        playSound("playInvalid");

        // ✅ Behaviour update (invalid)
        updateDifficultyFromBehaviour(false);

        // ✅ penalty depends on current settings
        const s = settingsRef.current;
        if (s.invalidPenaltySeconds > 0) {
          setTimeLeft((t) => Math.max(0, t - s.invalidPenaltySeconds));
        }
      }
    }

    setSelected(null);
  };

  // ✅ When game ends by moves, lose
  useEffect(() => {
    if (moves <= 0 && !gameOver) {
      endGame({ result: "lose", quitEarly: false });
    }
  }, [moves, gameOver, endGame]);

  const emotionStyles = {
    happy: {
      bg: "from-amber-400 via-yellow-400 to-orange-400",
      text: "text-yellow-600",
      icon: Heart,
    },
    sad: {
      bg: "from-blue-400 via-indigo-500 to-purple-500",
      text: "text-blue-600",
      icon: Frown,
    },
    angry: {
      bg: "from-red-400 via-orange-500 to-pink-500",
      text: "text-red-600",
      icon: Flame,
    },
    neutral: {
      bg: "from-purple-400 via-pink-400 to-rose-400",
      text: "text-purple-600",
      icon: Meh,
    },
  };

  const EmotionIcon = emotionStyles[emotion].icon;

  const difficultyBadge = (() => {
    const s = settingsRef.current;
    const color =
      difficulty === "hard"
        ? "bg-red-100 text-red-700 border-red-200"
        : difficulty === "medium"
        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${color} font-semibold text-xs`}
        title="Difficulty adapts based on behaviour (valid/invalid swaps + score speed)."
      >
        <span>Difficulty:</span>
        <span className="font-black">{s.label}</span>
      </div>
    );
  })();

  return (
    <div
      className={`h-screen flex bg-gradient-to-br ${emotionStyles[emotion].bg} relative overflow-hidden`}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* ===== SIDEBAR ===== */}
      <div className="w-80 bg-white/95 backdrop-blur-xl shadow-2xl relative z-10 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-800">Candy Crush RL</h1>
              <p className="text-xs text-gray-500">Emotion-Aware AI</p>
            </div>
          </div>

          {/* ✅ Difficulty badge */}
          <div className="mt-3 flex items-center justify-between gap-2">
            {difficultyBadge}
            <div className="text-xs font-bold bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl">
              🪙 {coins}
            </div>
          </div>

          {/* Sound controls */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={toggleSound}
              title="Toggle sound effects"
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${soundEnabled ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}
            >
              {soundEnabled ? "🔊 SFX On" : "🔇 SFX Off"}
            </button>
            <button
              onClick={toggleBgMusic}
              title="Toggle background music"
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${bgMusicEnabled ? "bg-pink-100 text-pink-700 border-pink-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}
            >
              {bgMusicEnabled ? "🎵 Music On" : "🎵 Music Off"}
            </button>
          </div>

          {emotion === "happy" && (
            <div className="mt-2 text-[11px] text-gray-500">
              Happy emotion starts in <span className="font-bold">Hard</span>, then adapts by behaviour.
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4 flex-1 overflow-auto">
          {/* Current Emotion */}
          <div
            className={`p-4 rounded-2xl bg-gradient-to-br ${emotionStyles[emotion].bg} text-white shadow-lg transform transition-all duration-300 hover:scale-105`}
          >
            <div className="flex items-center gap-3 mb-2">
              <EmotionIcon className="w-6 h-6" />
              <span className="font-bold text-lg capitalize">{emotion}</span>
            </div>
            <div className="text-sm opacity-90">
              Grid Size: {boardSize}×{boardSize}
            </div>
            <div className="text-xs opacity-80 mt-1">Target: {WIN_SCORE} pts</div>
          </div>

          {/* Score Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl shadow-md border border-emerald-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <Trophy className="w-5 h-5" />
                <span className="font-semibold">Score</span>
              </div>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-4xl font-black text-emerald-600 mb-1">
              {Math.round(score)}
            </div>
            <div className="text-xs text-emerald-600/70">
              High Score: {Math.round(highScore)}
            </div>
          </div>

          {/* Moves Card */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-2xl shadow-md border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 mb-3">
              <Target className="w-5 h-5" />
              <span className="font-semibold">Moves Remaining</span>
            </div>
            <div className="text-4xl font-black text-blue-600">{moves}</div>
            <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                style={{
                  width: `${(moves / Math.max(1, settingsRef.current.startMoves)) * 100}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Time Left Card */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-5 rounded-2xl shadow-md border border-gray-100">
            <div className="flex items-center gap-2 text-gray-700 mb-3">
              <span className="font-semibold">Time Left</span>
            </div>
            <div className="text-4xl font-black text-gray-800">
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
            {settingsRef.current.invalidPenaltySeconds > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                Invalid swap penalty: -{settingsRef.current.invalidPenaltySeconds}s
              </div>
            )}
          </div>

          {/* Combo Card */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-2xl shadow-md border border-orange-100">
            <div className="flex items-center gap-2 text-orange-700 mb-3">
              <Zap className="w-5 h-5" />
              <span className="font-semibold">Combo Multiplier</span>
            </div>
            <div className="text-4xl font-black text-orange-600">×{combo}</div>
            {combo > 0 && (
              <div className="mt-2 text-xs text-orange-600 font-semibold animate-pulse">
                🔥 On Fire!
              </div>
            )}
          </div>

          {/* Emotion Selector */}
          <div className="pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Change Emotion</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(emotionStyles).map(([key, style]) => {
                const Icon = style.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setEmotion(key)}
                    className={`p-3 rounded-xl transition-all duration-300 ${
                      emotion === key
                        ? `bg-gradient-to-br ${style.bg} text-white shadow-lg scale-105`
                        : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-semibold capitalize">{key}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Restart Button */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={initGame}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-105"
          >
            <RotateCcw className="w-5 h-5" />
            New Game
          </button>
        </div>
      </div>

      {/* ===== GAME AREA ===== */}
      <div className="flex-1 flex justify-center items-center p-8 relative z-10">
        <div className="relative">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 relative">
            <div
              className="grid gap-2 relative"
              style={{
                gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
                width: "fit-content",
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isBlocker = cell === BLOCKER;
                  const isEmpty = cell === EMPTY;

                  const bg = isBlocker
                    ? "linear-gradient(135deg, #374151, #111827)"
                    : isEmpty
                    ? "linear-gradient(135deg, #e5e7eb, #cbd5e1)"
                    : `linear-gradient(135deg, ${COLORS[cell]}, ${COLORS[cell]}dd)`;

                  const symbol = isBlocker ? "🧱" : isEmpty ? " " : CANDY_SYMBOLS[cell];

                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => handleClick(r, c)}
                      disabled={isBlocker || isEmpty}
                      className={`w-14 h-14 text-3xl rounded-xl transition-all duration-200 transform shadow-md hover:shadow-xl ${
                        isBlocker || isEmpty
                          ? "opacity-90 cursor-not-allowed"
                          : "hover:scale-110 hover:rotate-6"
                      } ${
                        selected?.r === r && selected?.c === c
                          ? "ring-4 ring-white scale-110 shadow-2xl"
                          : ""
                      } ${
                        (hintSwap?.a?.r === r && hintSwap?.a?.c === c) ||
                        (hintSwap?.b?.r === r && hintSwap?.b?.c === c)
                          ? "ring-4 ring-yellow-400 animate-bounce"
                          : ""
                      }`}
                      style={{ background: bg }}
                    >
                      <span className="drop-shadow-lg">{symbol}</span>
                    </button>
                  );
                })
              )}

              {rewardPops.map((p) => (
                <div
                  key={p.id}
                  className="absolute text-green-500 font-black text-2xl animate-float-up pointer-events-none drop-shadow-lg"
                  style={{
                    top: `${p.r * 56 + 28}px`,
                    left: `${p.c * 56 + 28}px`,
                    zIndex: 1000,
                  }}
                >
                  +{p.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Win / Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-10 max-w-md mx-4 text-center shadow-2xl transform animate-scale-in">
            <div className="text-7xl mb-4">{didWin ? "🏆" : "😢"}</div>
            <h2 className="text-4xl font-black text-gray-800 mb-3">
              {didWin ? "You Win!" : "Game Over"}
            </h2>

            {/* ✅ Reward box on WIN */}
            {didWin && winReward && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 text-left">
                <div className="font-black text-emerald-700 mb-2">🎁 Win Reward</div>
                <div className="text-sm text-emerald-800">
                  <div>🪙 +{winReward.coinsGained} coins</div>
                  <div>⏱️ +{winReward.bonusStartTimeSec}s start time (next game)</div>
                  {winReward.bonusHint && <div>💡 +1 free hint (next game)</div>}
                  <div className="text-xs text-emerald-700/80 mt-2">
                    Won on <span className="font-bold">{winReward.difficulty}</span> ({winReward.emotion})
                  </div>
                </div>
              </div>
            )}

            <p className="text-gray-600 mb-2">
              {didWin ? `Reached ${WIN_SCORE} points!` : "Final Score"}
            </p>
            <div className="text-5xl font-black text-purple-600 mb-6">
              {Math.round(score)}
            </div>
            {score === highScore && score > 0 && (
              <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full inline-block mb-6 font-semibold">
                🎉 New High Score!
              </div>
            )}
            <button
              onClick={initGame}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 mx-auto transform hover:scale-105"
            >
              <RotateCcw className="w-5 h-5" />
              Play Again
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-60px) scale(1.3); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-float-up { animation: floatUp 1.2s ease-out forwards; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>
  );
}
