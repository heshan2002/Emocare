import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const HOME_GREEN = "#049A24";

const EMO_BUBBLES = [
  { label: "HAPPY", emoji: "🙂", color: "#FFD93D", left: "18%", top: "22%", size: 260, speed: 10 },
  { label: "SAD", emoji: "😟", color: "#FF8A65", left: "85%", top: "26%", size: 250, speed: 11 },
  { label: "NEUTRAL", emoji: "😌", color: "#11B6F2", left: "22%", top: "80%", size: 280, speed: 12 },
  { label: "ANGRY", emoji: "😠", color: "#81C784", left: "78%", top: "78%", size: 265, speed: 13 },
  { label: "SURPRISE", emoji: "😲", color: "#F59E0B", left: "52%", top: "55%", size: 300, speed: 14 },
];

function GoogleIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.04 1.53 7.43 2.8l5.43-5.43C33.56 3.9 29.25 2 24 2 14.73 2 6.92 7.42 3.69 15.2l6.64 5.15C12 14.3 17.56 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46 24.5c0-1.52-.14-2.98-.39-4.39H24v8.31h12.4c-.53 2.85-2.18 5.27-4.62 6.9l7.08 5.49C43.02 36.86 46 31.22 46 24.5z" />
      <path fill="#FBBC05" d="M10.33 28.35c-.5-1.48-.78-3.07-.78-4.7s.28-3.22.78-4.7L3.69 13.8C2.6 16.08 2 18.62 2 21.35s.6 5.27 1.69 7.55l6.64-5.15z" />
      <path fill="#34A853" d="M24 46c5.25 0 9.66-1.73 12.88-4.69l-7.08-5.49c-1.97 1.32-4.48 2.1-5.8 2.1-6.44 0-11.99-4.8-13.67-10.85l-6.64 5.15C6.92 40.58 14.73 46 24 46z" />
    </svg>
  );
}

function useLiveBg() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 5000), 40);
    return () => clearInterval(id);
  }, []);
  const a = (t / 5000) * 360;
  return {
    background: `
      radial-gradient(900px 700px at 20% 20%,
        hsla(${(a + 40) % 360}, 92%, 70%, 0.22), transparent 60%),
      radial-gradient(900px 700px at 80% 30%,
        hsla(${(a + 160) % 360}, 92%, 70%, 0.20), transparent 60%),
      radial-gradient(900px 900px at 50% 90%,
        hsla(${(a + 260) % 360}, 92%, 70%, 0.18), transparent 60%),
      linear-gradient(135deg, #0b1220, #121a2e, #091023)
    `,
  };
}

/** ✅ Blurred color circle + clear text on top */
function EmotionBubble({ label, emoji, color, left, top, size, speed }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        transform: "translate(-50%, -50%)",
        width: size,
        height: size,
        borderRadius: 999,
        zIndex: 0,
        animation: `floaty ${speed}s ease-in-out infinite`,
      }}
    >
      {/* Blurred blob */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.65), ${color} 55%, rgba(0,0,0,0.06))`,
          filter: "blur(18px)",
          opacity: 0.95,
          boxShadow: "0 26px 90px rgba(0,0,0,0.35)",
        }}
      />

      {/* Clear text overlay (NOT blurred) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 12,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.70)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            color: "#111827",
            fontWeight: 1000,
            fontSize: 26, // elder-friendly
            letterSpacing: 1,
            lineHeight: 1.1,
            minWidth: "70%",
          }}
        >
          {emoji} {label}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const bg = useLiveBg();

  const token = useMemo(() => localStorage.getItem("token"), []);
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isLoggedIn = Boolean(token);

  const card = {
    width: "min(980px, 96vw)", // simpler for elders
    minHeight: "min(680px, 90vh)",
    borderRadius: 34,
    padding: 22,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 30px 120px rgba(0,0,0,0.45)",
    backdropFilter: "blur(16px)",
    overflow: "hidden",
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: 14,
  };

  const logo = {
    width: 78,
    height: 78,
    borderRadius: 26,
    background: `linear-gradient(135deg, ${HOME_GREEN}, rgba(255,255,255,0.35))`,
    display: "grid",
    placeItems: "center",
    color: "white",
    fontWeight: 1000,
    fontSize: 26,
    letterSpacing: 1,
    boxShadow: "0 18px 55px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.20)",
  };

  const topBtn = {
    height: 54,
    padding: "0 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
  };

  // ~20mm touch target
  const bigBtn = (variant) => ({
    height: 80,
    borderRadius: 24,
    border: variant === "primary" ? "none" : "1px solid rgba(0,0,0,0.16)",
    background:
      variant === "primary"
        ? `linear-gradient( #000000)`
        : "rgba(255,255,255,0.92)",
    color: variant === "primary" ? "white" : "#111827",
    fontWeight: 1000,
    fontSize: 24,
    cursor: "pointer",
    boxShadow: variant === "primary" ? "0 18px 55px rgba(0,0,0,0.20)" : "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  });

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    try {
      if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    } catch {}
    window.location.href = "/login";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 14,
        ...bg,
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ✅ Background blurred circles WITH clear text */}
      {EMO_BUBBLES.map((b) => (
        <EmotionBubble key={b.label} {...b} />
      ))}

      <div style={card}>
        {/* TOP */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={logo}>EC</div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 1000, color: "white" }}>Emocare</div>
              <div style={{ marginTop: 6, fontSize: 18, color: "rgba(255,255,255,0.84)", lineHeight: 1.4 }}>
              
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {isLoggedIn ? (
              <>
                <button style={topBtn} onClick={() => navigate("/first-detection")}>Start</button>
                <button style={topBtn} onClick={() => navigate("/profile")}>Profile</button>
                <button style={topBtn} onClick={logout}>Logout</button>
              </>
            ) : (
              <button style={topBtn} onClick={() => navigate("/login")}>Login</button>
            )}
          </div>
        </div>

        {/* CENTER CONTENT */}
        <div
          style={{
            borderRadius: 28,
            background: "rgba(255,255,255,0.92)",
            padding: 18,
            border: "1px solid rgba(0,0,0,0.06)",
            display: "grid",
            gap: 16,
            alignContent: "start",
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 1000, color: "#111827", lineHeight: 1.15 }}>
            The screen changes based on your emotion.
          </div>

          <div style={{ fontSize: 20, color: "#111827", lineHeight: 1.55, fontWeight: 700 }}>
            
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="ctaGrid">
            {isLoggedIn ? (
              <>
                <button style={bigBtn("primary")} onClick={() => navigate("/first-detection")}>
                  ✅ Start Emotion Check
                </button>
                <button style={bigBtn("secondary")} onClick={() => navigate("/profile")}>
                  👤 Open Profile
                </button>
              </>
            ) : (
              <>
                <button style={bigBtn("primary")} onClick={() => navigate("/login")}>
                  <GoogleIcon />
                  Continue with Google
                </button>
                <button
                  style={bigBtn("secondary")}
                  onClick={() => alert("Press ‘Continue with Google’ to login. No typing needed.")}
                >
                  ℹ️ Help
                </button>
              </>
            )}
          </div>

          <div
            style={{
              borderRadius: 22,
              padding: 14,
              background: "rgba(255,255,255,0.90)",
              border: "1px solid rgba(0,0,0,0.08)",
              color: "#111827",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 1000 }}>Quick Guide</div>
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 18, lineHeight: 1.55 }}>
              <li>Login using Google (no typing).</li>
              <li>Answer “How do you feel?” by speaking or typing.</li>
              <li>The UI changes automatically if your mood changes.</li>
              <li>Use Home and Re-check buttons anytime.</li>
            </ul>
          </div>

          {isLoggedIn && (
            <div style={{ fontSize: 16, color: "#111827", fontWeight: 900 }}>
              Logged in as: <span style={{ fontWeight: 1000 }}>{user?.name || user?.email || "User"}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
           
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
           
          </div>
        </div>

        <style>{`
          @keyframes floaty {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -52%) scale(1.06); }
            100% { transform: translate(-50%, -50%) scale(1); }
          }
          @media (max-width: 980px) {
            .ctaGrid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}