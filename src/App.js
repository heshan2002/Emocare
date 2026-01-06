import React, { useState, useEffect, useCallback, useRef } from "react";
import { Brain, RotateCcw, Heart, Frown, Flame, Meh, Sparkles, Trophy, Target, Zap } from "lucide-react";

/* ================= CONFIG ================= */
const CANDY_TYPES = 5;
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
const CANDY_SYMBOLS = ["🔴", "🔵", "🟢", "🟡", "🟣"];
const API_URL = "http://localhost:8000/api";

const getBoardSizeByEmotion = (emotion) => {
  switch (emotion) {
    case "happy": return 9;
    case "sad": return 7;
    case "angry": return 6;
    default: return 8;
  }
};

export default function EmotionRLCandyCrush() {
  const [emotion, setEmotion] = useState("neutral");
  const [boardSize, setBoardSize] = useState(8);
  const [board, setBoard] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [hintCell, setHintCell] = useState(null);
  const [rewardPops, setRewardPops] = useState([]);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const gameStartTime = useRef(Date.now());

  const callBackend = async (endpoint, payload) => {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return null;
    }
  };

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
    setCombo(0);
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

  useEffect(() => { initGame(); }, [initGame]);

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
    if (!matches.length) {
      setCombo(0);
      return false;
    }

    const comboMultiplier = 1 + combo * 0.5;
    const points = matches.length * 10 * comboMultiplier;
    
    matches.forEach(([r, c]) => {
      const id = Date.now() + Math.random();
      setRewardPops(p => [...p, { id, r, c, value: Math.round(points / matches.length) }]);
      setTimeout(() =>
        setRewardPops(p => p.filter(x => x.id !== id)), 1200
      );
      b[r][c] = -1;
    });

    setScore(s => {
      const newScore = s + points;
      setHighScore(h => Math.max(h, newScore));
      return newScore;
    });
    setCombo(c => c + 1);

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
    if (gameOver) return;
    if (!selected) return setSelected({ r, c });

    const { r: r1, c: c1 } = selected;
    if (Math.abs(r - r1) + Math.abs(c - c1) === 1) {
      const copy = board.map(row => [...row]);
      [copy[r][c], copy[r1][c1]] = [copy[r1][c1], copy[r][c]];
      if (findMatches(copy).length) {
        while (applyMatches(copy)) {}
        setBoard(copy);
        setMoves(m => m - 1);
      }
    }
    setSelected(null);
  };

  useEffect(() => {
    if (moves <= 0 && !gameOver) {
      const timePlayed = (Date.now() - gameStartTime.current) / 1000;
      callBackend("/feedback", {
        winRate: 0,
        avgTime: timePlayed,
        retries: 0,
        emotion,
        timePlayed,
        quitEarly: false,
        result: "loss",
      });
      setGameOver(true);
    }
  }, [moves, gameOver, emotion]);

  const emotionStyles = {
    happy: { bg: "from-amber-400 via-yellow-400 to-orange-400", text: "text-yellow-600", icon: Heart },
    sad: { bg: "from-blue-400 via-indigo-500 to-purple-500", text: "text-blue-600", icon: Frown },
    angry: { bg: "from-red-400 via-orange-500 to-pink-500", text: "text-red-600", icon: Flame },
    neutral: { bg: "from-purple-400 via-pink-400 to-rose-400", text: "text-purple-600", icon: Meh }
  };

  const EmotionIcon = emotionStyles[emotion].icon;

  return (
    <div className={`h-screen flex bg-gradient-to-br ${emotionStyles[emotion].bg} relative overflow-hidden`}>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
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
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4 flex-1 overflow-auto">
          
          {/* Current Emotion */}
          <div className={`p-4 rounded-2xl bg-gradient-to-br ${emotionStyles[emotion].bg} text-white shadow-lg transform transition-all duration-300 hover:scale-105`}>
            <div className="flex items-center gap-3 mb-2">
              <EmotionIcon className="w-6 h-6" />
              <span className="font-bold text-lg capitalize">{emotion}</span>
            </div>
            <div className="text-sm opacity-90">Grid Size: {boardSize}×{boardSize}</div>
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
            <div className="text-4xl font-black text-blue-600">
              {moves}
            </div>
            <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${(moves / 30) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Combo Card */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-2xl shadow-md border border-orange-100">
            <div className="flex items-center gap-2 text-orange-700 mb-3">
              <Zap className="w-5 h-5" />
              <span className="font-semibold">Combo Multiplier</span>
            </div>
            <div className="text-4xl font-black text-orange-600">
              ×{combo}
            </div>
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
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
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
          
          {/* Game Board Container */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 relative">
            
            <div
              className="grid gap-2 relative"
              style={{ 
                gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
                width: 'fit-content'
              }}
            >
              {board.map((row, r) =>
                row.map((candy, c) => (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => handleClick(r, c)}
                    className={`w-14 h-14 text-3xl rounded-xl transition-all duration-200 transform hover:scale-110 hover:rotate-6 shadow-md hover:shadow-xl ${
                      selected?.r === r && selected?.c === c
                        ? "ring-4 ring-white scale-110 shadow-2xl"
                        : ""
                    } ${
                      hintCell?.r === r && hintCell?.c === c
                        ? "ring-4 ring-yellow-400 animate-bounce"
                        : ""
                    }`}
                    style={{ 
                      background: `linear-gradient(135deg, ${COLORS[candy]}, ${COLORS[candy]}dd)`,
                    }}
                  >
                    <span className="drop-shadow-lg">{CANDY_SYMBOLS[candy]}</span>
                  </button>
                ))
              )}

              {/* Reward Popups */}
              {rewardPops.map(p => (
                <div
                  key={p.id}
                  className="absolute text-green-500 font-black text-2xl animate-float-up pointer-events-none drop-shadow-lg"
                  style={{ 
                    top: `${p.r * 56 + 28}px`, 
                    left: `${p.c * 56 + 28}px`,
                    zIndex: 1000
                  }}
                >
                  +{p.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-10 max-w-md mx-4 text-center shadow-2xl transform animate-scale-in">
            <div className="text-7xl mb-4">😢</div>
            <h2 className="text-4xl font-black text-gray-800 mb-3">Game Over</h2>
            <p className="text-gray-600 mb-2">Final Score</p>
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
          from { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
          to { 
            opacity: 0; 
            transform: translateY(-60px) scale(1.3);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-float-up {
          animation: floatUp 1.2s ease-out forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
}