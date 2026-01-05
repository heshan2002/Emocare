import React, { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Lightbulb, RotateCcw, Heart, Frown, Flame, Meh } from "lucide-react";

const BOARD_SIZE = 8;
const CANDY_TYPES = 5;
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
const CANDY_SYMBOLS = ["🔴", "🔵", "🟢", "🟡", "🟣"];
const API_URL = "http://localhost:5000/api";

const INSTRUCTIONS = {
  happy: {
    icon: "😊",
    title: "You're feeling happy!",
    tips: ["Try making big combos", "Match 4 or more candies", "Challenge yourself!"]
  },
  sad: {
    icon: "😢",
    title: "Take it easy today",
    tips: ["No rush, take your time", "Simple matches are fine", "You'll get hints quickly"]
  },
  angry: {
    icon: "😡",
    title: "Let's calm down together",
    tips: ["Slow down and breathe", "One move at a time", "Every small win counts"]
  },
  neutral: {
    icon: "😐",
    title: "Let's play!",
    tips: ["Swap adjacent candies", "Match 3 or more", "Reach the target score"]
  }
};

export default function EmotionRLCandyCrush() {
  // Game State
  const [board, setBoard] = useState([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(30);
  const [targetScore, setTargetScore] = useState(1000);
  const [combo, setCombo] = useState(0);
  const [selected, setSelected] = useState(null);
  const [gameWon, setGameWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Emotion & RL
  const [emotion, setEmotion] = useState("neutral");
  
  const [showInstructions, setShowInstructions] = useState(true);
  const [rlParams, setRlParams] = useState({
    difficulty: 0.5,
    moveLimit: 30,
    hintDelay: 6,
    targetScore: 1000,
    rewardMultiplier: 1
  });

  // Hints
  const [hintCells, setHintCells] = useState([]);
  const [showHintMessage, setShowHintMessage] = useState(false);
  const lastMoveTime = useRef(Date.now());

  // Player tracking
  const playerId = useRef(`player_${Date.now()}`);
  const sessionId = useRef(null);
  const gameStartTime = useRef(Date.now());

  // Status messages
  const [statusMessage, setStatusMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  // Reward animations
  const [rewardAnimations, setRewardAnimations] = useState([]);

  // ============================================
  // BACKEND COMMUNICATION
  // ============================================

  const callRLBackend = async (endpoint, payload) => {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Backend error");
      return await res.json();
    } catch (error) {
      console.log(`Backend offline for ${endpoint}:`, error.message);
      return null;
    }
  };

  // ============================================
  // BOARD INITIALIZATION
  // ============================================

  const generateFallbackBoard = () => {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () =>
        Math.floor(Math.random() * CANDY_TYPES)
      )
    );
  };

  const initBoard = useCallback(async () => {
    setStatusMessage("🧠 RL Agent is configuring your game...");
    
    const response = await callRLBackend("/generate_board", {
      player_id: playerId.current,
      session_id: sessionId.current,
      emotion: emotion
    });

    let newBoard = generateFallbackBoard();

    if (response && response.rlParams) {
      // RL backend is working
      setIsConnected(true);
      setRlParams(response.rlParams);
      setMoves(response.rlParams.moveLimit);
      setTargetScore(response.rlParams.targetScore);
      setStatusMessage(`✅ RL configured: ${emotion} mode`);
      
      if (response.board) {
        newBoard = response.board;
      }
    } else {
      // Fallback mode
      setIsConnected(false);
      setStatusMessage("⚠️ Running offline (no RL backend)");
      
      // Simple emotion-based fallback
      const emotionDefaults = {
        happy: { moveLimit: 25, targetScore: 1200, hintDelay: 10 },
        sad: { moveLimit: 40, targetScore: 800, hintDelay: 4 },
        angry: { moveLimit: 35, targetScore: 900, hintDelay: 5 },
        neutral: { moveLimit: 30, targetScore: 1000, hintDelay: 6 }
      };
      
      const defaults = emotionDefaults[emotion];
      setMoves(defaults.moveLimit);
      setTargetScore(defaults.targetScore);
      setRlParams(prev => ({
        ...prev,
        moveLimit: defaults.moveLimit,
        targetScore: defaults.targetScore,
        hintDelay: defaults.hintDelay
      }));
    }

    lastMoveTime.current = Date.now();
    gameStartTime.current = Date.now();
    return newBoard;
  }, [emotion]);

  const resetGame = useCallback(async () => {
    const newBoard = await initBoard();
    setBoard(newBoard);
    setScore(0);
    setCombo(0);
    setGameWon(false);
    setGameOver(false);
    setSelected(null);
    setHintCells([]);
    setShowHintMessage(false);
  }, [initBoard]);

  // ============================================
  // SESSION INITIALIZATION
  // ============================================

  useEffect(() => {
    const startSession = async () => {
      const res = await callRLBackend("/start_session", {
        player_id: playerId.current,
        emotion: emotion
      });
      
      if (res && res.session_id) {
        sessionId.current = res.session_id;
        setIsConnected(true);
        setStatusMessage("🤖 RL Session started!");
      }
      
      resetGame();
    };
    
    startSession();
  }, [emotion]);

  // Show instructions when emotion changes
  useEffect(() => {
    setShowInstructions(true);
  }, [emotion]);

  // ============================================
  // MATCH LOGIC
  // ============================================

  const findMatches = (b) => {
    const matches = [];
    
    // Horizontal matches
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE - 2; j++) {
        if (b[i][j] === b[i][j + 1] && b[i][j] === b[i][j + 2]) {
          matches.push([i, j], [i, j + 1], [i, j + 2]);
        }
      }
    }
    
    // Vertical matches
    for (let i = 0; i < BOARD_SIZE - 2; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (b[i][j] === b[i + 1][j] && b[i][j] === b[i + 2][j]) {
          matches.push([i, j], [i + 1, j], [i + 2, j]);
        }
      }
    }
    
    return matches;
  };

  const removeMatches = (b) => {
    const matches = findMatches(b);
    if (!matches.length) return false;

    const unique = [...new Set(matches.map(m => `${m[0]},${m[1]}`))];
    
    // Calculate points
    const basePoints = unique.length * 10;
    const multiplier = rlParams.rewardMultiplier || 1;
    const points = Math.round(basePoints * multiplier);
    
    // Create reward animation for each matched cell
    unique.forEach(key => {
      const [i, j] = key.split(",").map(Number);
      const candy = b[i][j];
      
      // Add floating reward animation
      const animId = `${Date.now()}-${i}-${j}`;
      setRewardAnimations(prev => [...prev, {
        id: animId,
        row: i,
        col: j,
        points: Math.round(10 * multiplier),
        color: COLORS[candy]
      }]);
      
      // Remove animation after 1 second
      setTimeout(() => {
        setRewardAnimations(prev => prev.filter(a => a.id !== animId));
      }, 1000);
      
      b[i][j] = -1;
    });

    setScore(s => s + points);
    setCombo(c => c + 1);

    // Show combo animation for 3+ combos
    if (combo >= 2) {
      const comboAnimId = `combo-${Date.now()}`;
      setRewardAnimations(prev => [...prev, {
        id: comboAnimId,
        row: BOARD_SIZE / 2,
        col: BOARD_SIZE / 2,
        isCombo: true,
        comboCount: combo + 1,
        color: '#FFD700'
      }]);
      
      setTimeout(() => {
        setRewardAnimations(prev => prev.filter(a => a.id !== comboAnimId));
      }, 1500);
    }

    // Apply gravity
    for (let j = 0; j < BOARD_SIZE; j++) {
      let empty = 0;
      for (let i = BOARD_SIZE - 1; i >= 0; i--) {
        if (b[i][j] === -1) {
          empty++;
        } else if (empty > 0) {
          b[i + empty][j] = b[i][j];
          b[i][j] = -1;
        }
      }
      
      // Fill from top
      for (let i = 0; i < empty; i++) {
        b[i][j] = Math.floor(Math.random() * CANDY_TYPES);
      }
    }
    
    return true;
  };

  // ============================================
  // HINT SYSTEM
  // ============================================

  const findPossibleMove = (b) => {
    if (!b || b.length === 0) return null;
    
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        // Try all 4 directions
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        
        for (const [dx, dy] of directions) {
          const ni = i + dx;
          const nj = j + dy;
          
          if (ni < 0 || nj < 0 || ni >= BOARD_SIZE || nj >= BOARD_SIZE) continue;
          
          // Swap
          [b[i][j], b[ni][nj]] = [b[ni][nj], b[i][j]];
          
          // Check for matches
          if (findMatches(b).length > 0) {
            // Swap back
            [b[i][j], b[ni][nj]] = [b[ni][nj], b[i][j]];
            return [[i, j], [ni, nj]];
          }
          
          // Swap back
          [b[i][j], b[ni][nj]] = [b[ni][nj], b[i][j]];
        }
      }
    }
    
    return null;
  };

  // Auto-hint timer
  useEffect(() => {
    if (gameWon || gameOver || board.length === 0) return;

    const interval = setInterval(() => {
      const idleTime = (Date.now() - lastMoveTime.current) / 1000;
      const hintDelay = rlParams.hintDelay || 6;
      
      if (idleTime >= hintDelay) {
        const boardCopy = board.map(row => [...row]);
        const hint = findPossibleMove(boardCopy);
        
        if (hint) {
          setHintCells(hint);
          setShowHintMessage(true);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [board, gameWon, gameOver, rlParams.hintDelay]);

  // ============================================
  // CLICK HANDLER
  // ============================================

  const handleCellClick = async (r, c) => {
    if (gameWon || gameOver) return;

    // Reset hint
    lastMoveTime.current = Date.now();
    setHintCells([]);
    setShowHintMessage(false);

    if (!selected) {
      setSelected({ r, c });
      return;
    }

    const { r: r1, c: c1 } = selected;
    const isAdjacent = Math.abs(r - r1) + Math.abs(c - c1) === 1;

    if (isAdjacent) {
      const boardCopy = board.map(row => [...row]);
      
      // Swap
      [boardCopy[r][c], boardCopy[r1][c1]] = [boardCopy[r1][c1], boardCopy[r][c]];

      if (findMatches(boardCopy).length > 0) {
        // Valid move
        while (removeMatches(boardCopy)) {}
        setBoard(boardCopy);
        setMoves(m => m - 1);

        // Send move to RL backend
        if (isConnected) {
          await callRLBackend("/record_move", {
            player_id: playerId.current,
            session_id: sessionId.current,
            emotion: emotion,
            move: { from: [r1, c1], to: [r, c] },
            score: score,
            moves_left: moves - 1
          });
        }
      }
    }

    setSelected(null);
  };

  // ============================================
  // WIN/LOSS DETECTION
  // ============================================

  useEffect(() => {
    if (score >= targetScore && !gameWon) {
      setGameWon(true);
      
      // Send win to RL backend
      if (isConnected) {
        callRLBackend("/end_game", {
          player_id: playerId.current,
          session_id: sessionId.current,
          emotion: emotion,
          result: "win",
          score: score,
          moves_used: rlParams.moveLimit - moves,
          time_taken: Date.now() - gameStartTime.current
        });
      }
    } else if (moves <= 0 && !gameWon) {
      setGameOver(true);
      
      // Send loss to RL backend
      if (isConnected) {
        callRLBackend("/end_game", {
          player_id: playerId.current,
          session_id: sessionId.current,
          emotion: emotion,
          result: "lose",
          score: score,
          moves_used: rlParams.moveLimit,
          time_taken: Date.now() - gameStartTime.current
        });
      }
    }
  }, [score, moves, targetScore, gameWon, emotion, isConnected, rlParams.moveLimit]);

  // ============================================
  // RENDER
  // ============================================

  const isHintCell = (r, c) => {
    return hintCells.some(([hr, hc]) => hr === r && hc === c);
  };

  const EmotionButton = ({ type, icon: Icon, label }) => (
    <button
      onClick={() => setEmotion(type)}
      className={`flex flex-col items-center gap-1 p-3 rounded-lg transition ${
        emotion === type 
          ? 'bg-purple-600 text-white scale-110' 
          : 'bg-white hover:bg-purple-100'
      }`}
    >
      <Icon size={24} />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-4 flex overflow-hidden">
      
      {/* Left Panel: Header, Emotions, Instructions, Stats */}
      <div className="flex flex-col w-1/3 gap-4 overflow-y-auto pr-2">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Brain size={30} className="animate-pulse" />
            Emotion-Aware RL Candy Crush
          </h1>
          <p className="text-white/90 text-sm">
            {isConnected ? "🟢 Connected to RL Backend" : "🔴 Running in Offline Mode"}
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-3 text-center">
            <p className="text-blue-800 font-semibold">{statusMessage}</p>
          </div>
        )}

        {/* Emotion Selector */}
        <div className="bg-white rounded-lg p-4 shadow-lg">
          <p className="font-bold mb-3 text-center">How are you feeling?</p>
          <div className="flex justify-center gap-3">
            <EmotionButton type="happy" icon={Heart} label="Happy" />
            <EmotionButton type="sad" icon={Frown} label="Sad" />
            <EmotionButton type="angry" icon={Flame} label="Angry" />
            <EmotionButton type="neutral" icon={Meh} label="Neutral" />
          </div>
        </div>

        {/* Instructions */}
        {showInstructions && (
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-4 shadow-lg border-l-4 border-purple-600">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <span className="text-2xl">{INSTRUCTIONS[emotion].icon}</span>
                  {INSTRUCTIONS[emotion].title}
                </h3>
                <ul className="space-y-1 text-sm">
                  {INSTRUCTIONS[emotion].tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="ml-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
              >
                Got it! 👍
              </button>
            </div>
          </div>
        )}

        {/* Game Stats */}
        <div className="bg-white rounded-lg p-4 shadow-lg">
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Score</p>
              <p className="text-2xl font-bold text-purple-600 score-pop">{score}</p>
              <p className="text-xs text-gray-500">Goal: {targetScore}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Moves</p>
              <p className="text-2xl font-bold text-blue-600">{moves}</p>
              <p className="text-xs text-gray-500">Remaining</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Combo</p>
              <p className={`text-2xl font-bold text-green-600 ${combo > 0 ? 'score-pop' : ''}`}>
                x{combo}
              </p>
              {combo >= 3 && (
                <p className="text-xs text-orange-600 font-bold animate-pulse">🔥 ON FIRE!</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">RL Difficulty</p>
              <p className="text-2xl font-bold text-orange-600">
                {Math.round((rlParams.difficulty || 0.5) * 100)}%
              </p>
            </div>
          </div>
        </div>

        {/* Hint Message */}
        {showHintMessage && hintCells.length > 0 && (
          <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 animate-pulse">
            <p className="text-yellow-800 font-semibold text-center flex items-center justify-center gap-2">
              <Lightbulb size={20} />
              💡 Hint: Try swapping the glowing candies!
            </p>
          </div>
        )}

      </div>

      {/* Right Panel: Game Board */}
      <div className="flex-1 flex justify-center items-center overflow-hidden p-2">
        <div
          className="grid gap-2 bg-white p-4 rounded-lg shadow-xl relative w-full max-w-md"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
        >
          {board.map((row, i) =>
            row.map((candy, j) => {
              const isSelected = selected?.r === i && selected?.c === j;
              const isHint = isHintCell(i, j);

              return (
                <button
                  key={`${i}-${j}`}
                  onClick={() => handleCellClick(i, j)}
                  className={`
                    aspect-square text-3xl rounded-lg transition-all
                    ${isSelected ? 'ring-4 ring-white scale-110 shadow-lg' : ''}
                    ${isHint ? 'ring-4 ring-yellow-400 animate-pulse scale-105' : ''}
                    hover:scale-105
                  `}
                  style={{
                    background: COLORS[candy],
                    boxShadow: isHint ? '0 0 20px rgba(250, 204, 21, 0.6)' : ''
                  }}
                >
                  {CANDY_SYMBOLS[candy]}
                </button>
              );
            })
          )}

          {/* Reward Animations */}
          {rewardAnimations.map(anim => {
            const cellSize = 100 / BOARD_SIZE;
            const left = anim.col * cellSize + cellSize / 2;
            const top = anim.row * cellSize + cellSize / 2;

            if (anim.isCombo) {
              return (
                <div
                  key={anim.id}
                  className="absolute pointer-events-none animate-bounce"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100
                  }}
                >
                  <div className="text-6xl font-bold text-yellow-400 drop-shadow-lg animate-pulse">
                    🔥 x{anim.comboCount} COMBO! 🔥
                  </div>
                </div>
              );
            }

            return (
              <div
                key={anim.id}
                className="absolute pointer-events-none animate-float-up"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: 'translate(-50%, -50%)',
                  animation: 'floatUp 1s ease-out forwards',
                  zIndex: 50
                }}
              >
                <div
                  className="text-2xl font-bold drop-shadow-lg"
                  style={{
                    color: anim.color,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3), 0 0 10px rgba(255,255,255,0.5)'
                  }}
                >
                  +{anim.points}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game Over Modal */}
      {(gameWon || gameOver) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="text-6xl mb-4">{gameWon ? '🎉' : '😢'}</div>
              <h2 className="text-3xl font-bold mb-2">{gameWon ? 'You Won!' : 'Game Over'}</h2>
              <p className="text-xl mb-2">
                Final Score: <span className="font-bold text-purple-600">{score}</span>
              </p>
              <p className="text-sm text-gray-600 mb-6">
                {isConnected ? '🧠 RL Agent learned from your game!' : 'Play online to enable RL learning'}
              </p>
              <button
                onClick={resetGame}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto transition shadow-lg"
              >
                <RotateCcw size={20} />
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}