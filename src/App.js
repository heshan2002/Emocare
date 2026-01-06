import React, { useState, useEffect, useCallback, useRef } from "react";
import { Brain, RotateCcw, Heart, Frown, Flame, Meh } from "lucide-react";

/* ================= CONFIG ================= */
const CANDY_TYPES = 5;
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
const CANDY_SYMBOLS = ["🔴", "🔵", "🟢", "🟡", "🟣"];
const API_URL = "http://localhost:8000/api";

/* Emotion → Difficulty (Grid Size) */
const getBoardSizeByEmotion = (emotion) => {
  switch (emotion) {
    case "happy": return 9;
    case "sad": return 7;
    case "angry": return 6;
    default: return 8;
  }
};

export default function EmotionRLCandyCrush() {
  /* ================= GAME STATE ================= */
  const [emotion, setEmotion] = useState("neutral");
  const [boardSize, setBoardSize] = useState(8);
  const [board, setBoard] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(30);
  const [gameWon, setGameWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  /* ================= RL UI ================= */
  const [hintCell, setHintCell] = useState(null);
  const [rewardPops, setRewardPops] = useState([]);

  const gameStartTime = useRef(Date.now());

  /* ================= BACKEND ================= */
  const callBackend = async (endpoint, payload) => {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      console.error("Backend error:", err);
      return null;
    }
  };

  /* ================= BOARD ================= */
  const generateBoard = (size) =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () =>
        Math.floor(Math.random() * CANDY_TYPES)
      )
    );

  const initGame = useCallback(async () => {
    const size = getBoardSizeByEmotion(emotion);
    setBoardSize(size);
    setBoard(generateBoard(size));
    setScore(0);
    setMoves(30);
    setGameWon(false);
    setGameOver(false);
    setHintCell(null);
    setRewardPops([]);
    gameStartTime.current = Date.now();

    const decision = await callBackend("/decision", {
      winRate: 0,
      avgTime: 0,
      retries: 0,
      emotion,
    });

    if (decision?.actionName === "SHOW_HINT") {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      setHintCell({ r, c });
      setTimeout(() => setHintCell(null), 2000);
    }
  }, [emotion]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  /* ================= MATCH LOGIC ================= */
  const findMatches = (b) => {
    const matches = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize - 2; c++) {
        if (b[r][c] === b[r][c + 1] && b[r][c] === b[r][c + 2]) {
          matches.push([r, c], [r, c + 1], [r, c + 2]);
        }
      }
    }
    for (let r = 0; r < boardSize - 2; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (b[r][c] === b[r + 1][c] && b[r][c] === b[r + 2][c]) {
          matches.push([r, c], [r + 1, c], [r + 2, c]);
        }
      }
    }
    return matches;
  };

  const applyMatches = (b) => {
    const matches = findMatches(b);
    if (!matches.length) return false;

    const points = matches.length * 10;
    setScore((s) => s + points);

    matches.forEach(([r, c]) => {
      const id = Date.now() + Math.random();
      setRewardPops((p) => [...p, { id, r, c, value: 10 }]);
      setTimeout(() =>
        setRewardPops((p) => p.filter((x) => x.id !== id)), 1000
      );
      b[r][c] = -1;
    });

    for (let c = 0; c < boardSize; c++) {
      let empty = 0;
      for (let r = boardSize - 1; r >= 0; r--) {
        if (b[r][c] === -1) empty++;
        else if (empty) {
          b[r + empty][c] = b[r][c];
          b[r][c] = -1;
        }
      }
      for (let r = 0; r < empty; r++) {
        b[r][c] = Math.floor(Math.random() * CANDY_TYPES);
      }
    }
    return true;
  };

  const handleClick = (r, c) => {
    if (gameWon || gameOver) return;

    if (!selected) {
      setSelected({ r, c });
      return;
    }

    const { r: r1, c: c1 } = selected;
    if (Math.abs(r - r1) + Math.abs(c - c1) === 1) {
      const copy = board.map((row) => [...row]);
      [copy[r][c], copy[r1][c1]] = [copy[r1][c1], copy[r][c]];

      if (findMatches(copy).length) {
        while (applyMatches(copy)) {}
        setBoard(copy);
        setMoves((m) => m - 1);
      }
    }
    setSelected(null);
  };

  /* ================= END GAME ================= */
  useEffect(() => {
    const timePlayed = (Date.now() - gameStartTime.current) / 1000;

    if ((gameWon || moves <= 0) && !gameOver) {
      callBackend("/feedback", {
        winRate: 0,
        avgTime: timePlayed,
        retries: 0,
        emotion,
        timePlayed,
        quitEarly: false,
        result: gameWon ? "win" : "loss",
      });
      setGameOver(true);
    }
  }, [moves, gameWon, emotion, gameOver]);

  /* ================= UI ================= */
  return (
    <div className="p-4 h-screen bg-gradient-to-br from-purple-400 to-pink-400">
      <h1 className="text-white text-2xl font-bold text-center mb-4 flex justify-center gap-2">
        <Brain /> Emotion-Aware RL Candy Crush
      </h1>

      <div className="flex justify-center gap-8 mb-3 text-white font-bold">
        <div>Score: {score}</div>
        <div>Moves: {moves}</div>
        <div>Grid: {boardSize}×{boardSize}</div>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        <button onClick={() => setEmotion("happy")}><Heart /></button>
        <button onClick={() => setEmotion("sad")}><Frown /></button>
        <button onClick={() => setEmotion("angry")}><Flame /></button>
        <button onClick={() => setEmotion("neutral")}><Meh /></button>
      </div>

      <div
        className="grid gap-2 mx-auto bg-white p-4 rounded relative"
        style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}
      >
        {board.map((row, r) =>
          row.map((candy, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => handleClick(r, c)}
              className={`aspect-square text-2xl rounded ${
                hintCell?.r === r && hintCell?.c === c
                  ? "ring-4 ring-yellow-400 animate-pulse"
                  : ""
              }`}
              style={{ background: COLORS[candy] }}
            >
              {CANDY_SYMBOLS[candy]}
            </button>
          ))
        )}

        {rewardPops.map((p) => (
          <div
            key={p.id}
            className="absolute text-green-500 font-bold animate-fade-up"
            style={{ top: p.r * 50, left: p.c * 50 }}
          >
            +{p.value}
          </div>
        ))}
      </div>

      {(gameWon || gameOver) && (
        <div className="text-center mt-4 text-white font-bold">
          {gameWon ? "🎉 YOU WON!" : "😢 GAME OVER"}
          <button
            onClick={initGame}
            className="block mx-auto mt-2 bg-white text-black px-4 py-2 rounded"
          >
            <RotateCcw /> Play Again
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-40px); }
        }
        .animate-fade-up {
          animation: fadeUp 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
