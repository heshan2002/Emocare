// src/components/MoodLayout.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEmotion } from "../context/EmotionContext";

function themeFor(mood) {
  const m = (mood || "neutral").toLowerCase();

  // Your given colors
  // Happy - FFD93D
  // Sad - FF8A65
  // Neutral - 11B6F2
  // Angry - 81C784
  // Surprise - (safe amber)
  if (m === "happy") {
    return {
      name: "Happy",
      emoji: "🙂",
      main: "#FFD93D",
      bg: "linear-gradient(135deg, #0b1220, #10192d, #0b1220)",
      glow: "rgba(255,217,61,0.22)",
      glow2: "rgba(34,197,94,0.10)",
      panel: "rgba(255,255,255,0.10)",
      panelBorder: "rgba(255,255,255,0.18)",
    };
  }
  if (m === "sad") {
    return {
      name: "Sad",
      emoji: "😟",
      main: "#FF8A65",
      bg: "linear-gradient(135deg, #0b1220, #10192d, #0b1220)",
      glow: "rgba(255,138,101,0.22)",
      glow2: "rgba(17,182,242,0.10)",
      panel: "rgba(255,255,255,0.10)",
      panelBorder: "rgba(255,255,255,0.18)",
    };
  }
  if (m === "angry") {
    return {
      name: "Angry",
      emoji: "😠",
      main: "#81C784",
      bg: "linear-gradient(135deg, #0b1220, #10192d, #0b1220)",
      glow: "rgba(129,199,132,0.22)",
      glow2: "rgba(255,138,101,0.10)",
      panel: "rgba(255,255,255,0.10)",
      panelBorder: "rgba(255,255,255,0.18)",
    };
  }
  if (m === "surprise") {
    return {
      name: "Surprise",
      emoji: "😲",
      main: "#F59E0B",
      bg: "linear-gradient(135deg, #0b1220, #10192d, #0b1220)",
      glow: "rgba(245,158,11,0.22)",
      glow2: "rgba(255,217,61,0.10)",
      panel: "rgba(255,255,255,0.10)",
      panelBorder: "rgba(255,255,255,0.18)",
    };
  }
  // Neutral default
  return {
    name: "Neutral",
    emoji: "😌",
    main: "#11B6F2",
    bg: "linear-gradient(135deg, #0b1220, #10192d, #0b1220)",
    glow: "rgba(17,182,242,0.22)",
    glow2: "rgba(99,102,241,0.10)",
    panel: "rgba(255,255,255,0.10)",
    panelBorder: "rgba(255,255,255,0.18)",
  };
}

function difficultyFor(mood) {
  const m = (mood || "neutral").toLowerCase();
  // Angry & Sad = minimum choices, larger buttons
  if (m === "angry" || m === "sad") return "low";
  // Surprise = guided but not too limited
  if (m === "surprise") return "midlow";
  // Neutral = balanced
  if (m === "neutral") return "mid";
  // Happy = more options ok
  return "high";
}

export default function MoodLayout({
  mood = "neutral",
  title,
  subtitle,
  primaryActions = [],
  secondaryActions = [],
  children, // ✅ for central feedback toast overlays
}) {
  const navigate = useNavigate();
  const { stableEmotion } = useEmotion();

  const theme = useMemo(() => themeFor(mood), [mood]);
  const difficulty = useMemo(() => difficultyFor(mood), [mood]);

  const isLow = difficulty === "low";
  const isMidLow = difficulty === "midlow";

  // Buttons (touch target) ~20mm ≈ 76px height
  const BTN_H = isLow ? 84 : 76;
  // Spacing ~6mm ≈ 24px
  const GAP = 24;

  // Text sizing per your barrier rules
  const TITLE_PX = 30; // critical
  const SUB_PX = 19; // secondary
  const BODY_PX = 16; // body

  // Limit options to reduce overload
  const maxPrimary = 2;
  const maxSecondary = isLow ? 1 : isMidLow ? 2 : 2;
  const prim = primaryActions.slice(0, maxPrimary);
  const sec = secondaryActions.slice(0, maxSecondary);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    try {
      if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    } catch {}
    window.location.href = "/login";
  }

  const detectedLabel = (stableEmotion?.label || "neutral").toLowerCase();
  const detectedConf = Number(stableEmotion?.confidence ?? 0).toFixed(2);

  const root = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 14,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: theme.bg,
    overflow: "hidden",
    position: "relative",
    color: "white",
  };

  // Soft blobs (NOT behind text panels heavily)
  const blob = (style) => ({
    position: "absolute",
    width: style.size,
    height: style.size,
    borderRadius: 999,
    filter: "blur(32px)",
    opacity: 0.9,
    background: style.color,
    left: style.left,
    top: style.top,
    transform: "translate(-50%, -50%)",
    animation: `floaty ${isLow ? 13 : 10}s ease-in-out infinite`,
    zIndex: 0,
  });

  const card = {
    width: "min(1100px, 96vw)",
    height: "min(720px, 92vh)",
    borderRadius: 30,
    padding: 20,
    background: "rgba(255,255,255,0.10)",
    border: `1px solid ${theme.panelBorder}`,
    boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: 14,
    overflow: "hidden",
    position: "relative",
    zIndex: 2,
  };

  const navBtn = {
    height: 52,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  };

  const logo = {
    width: 62,
    height: 62,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${theme.main}, rgba(255,255,255,0.25))`,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    letterSpacing: 1,
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
    color: "#111827",
  };

  const panelGrid = {
    display: "grid",
    gridTemplateColumns: "1.25fr 0.75fr",
    gap: GAP,
    minHeight: 0,
  };

  const box = {
    borderRadius: 26,
    background: theme.panel,
    border: `1px solid ${theme.panelBorder}`,
    padding: 18,
    minHeight: 0,
    overflow: "hidden",
  };

  const actionGrid = {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: isLow ? "1fr" : "1fr 1fr",
    gap: 14,
    alignContent: "start",
  };

  const actionBtn = (variant = "primary") => ({
    height: BTN_H,
    padding: "0 16px",
    borderRadius: 22,
    border: variant === "primary" ? "none" : "1px solid rgba(255,255,255,0.22)",
    cursor: "pointer",
    fontWeight: 1000,
    fontSize: 22, // big readable
    color: variant === "primary" ? "#111827" : "white",
    background:
      variant === "primary"
        ? `linear-gradient(135deg, ${theme.main}, rgba(255,255,255,0.55))`
        : "rgba(255,255,255,0.10)",
    boxShadow: variant === "primary" ? "0 18px 55px rgba(0,0,0,0.35)" : "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    transition: "transform 120ms ease, filter 120ms ease",
  });

  return (
    <div style={root}>
      {/* Soft moving blobs (kept away from text panels visually) */}
      <div style={blob({ size: 520, color: theme.glow, left: "18%", top: "20%" })} />
      <div style={blob({ size: 460, color: theme.glow2, left: "84%", top: "30%" })} />
      <div style={blob({ size: 520, color: "rgba(255,255,255,0.06)", left: "45%", top: "90%" })} />

      <div style={card}>
        {/* TOP BAR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={logo}>EC</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 1000 }}>Elder Emotion Care</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
                Predictable navigation • Background detection running
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Detected */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              Detected: <b style={{ textTransform: "lowercase" }}>{detectedLabel}</b> 
            </div>

            {/* Mood UI label */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              Screen: {theme.name} 
            </div>

            <button style={navBtn} onClick={() => navigate("/")}>Home</button>
            <button style={navBtn} onClick={() => navigate("/first-detection")}>Re-check</button>
            <button style={navBtn} onClick={() => navigate("/profile")}>Profile</button>
            <button style={navBtn} onClick={logout}>Logout</button>
          </div>
        </div>

        {/* BODY */}
        <div style={panelGrid} className="moodGrid">
          {/* LEFT MAIN */}
          <div style={box}>
            <div style={{ fontSize: TITLE_PX, fontWeight: 1000, lineHeight: 1.15 }}>
              {title || `You feel ${theme.name} ${theme.emoji}`}
            </div>

            <div style={{ marginTop: 12, fontSize: SUB_PX, color: "rgba(255,255,255,0.90)", lineHeight: 1.5 }}>
              {subtitle || "We will help you with simple actions."}
            </div>

            {/* ACTIONS */}
            <div style={actionGrid} className="actionGrid">
              {prim.map((a) => (
                <button
                  key={a.label}
                  style={actionBtn("primary")}
                  onClick={a.onClick}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {a.label}
                </button>
              ))}
              {sec.map((a) => (
                <button
                  key={a.label}
                  style={actionBtn("secondary")}
                  onClick={a.onClick}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Guidance (awareness) */}
            <div
              style={{
                marginTop: 16,
                borderRadius: 22,
                padding: 14,
                background: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.90)",
                fontSize: BODY_PX,
                lineHeight: 1.55,
              }}
            >
              <b>Guidance:</b> Tap a button once. The app will show a message in the center for 1–2 seconds.
              <br />
              <b>Tip:</b> You can always use <b>Home</b> or <b>Re-check</b>.
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div style={box}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>Helpful Tips</div>
            <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 18, lineHeight: 1.6, color: "rgba(255,255,255,0.90)" }}>
              <li>Keep face centered and bright.</li>
              <li>Speak clearly for 2–3 seconds.</li>
              <li>The screen changes automatically when mood changes.</li>
              <li>If you feel unwell, call family/caregiver.</li>
            </ul>

            <div
              style={{
                marginTop: 14,
                borderRadius: 22,
                padding: 14,
                background: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 8 }}>Quick Support</div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.90)", lineHeight: 1.5 }}>
                Use <b>Breathing</b> or <b>Call</b> if you need help.
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
            Emocare
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
           
          </div>
        </div>

        {/* ✅ IMPORTANT: allow children overlays (central feedback toasts) */}
        {children}
      </div>

      <style>{`
        @keyframes floaty {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -52%) scale(1.06); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }

        @media (max-width: 980px) {
          .moodGrid { grid-template-columns: 1fr !important; }
          .actionGrid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}