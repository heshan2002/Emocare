import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEmotion } from "../context/EmotionContext";

/** Samsung-call-style live background */
function useSamsungBackground() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 5000), 40);
    return () => clearInterval(id);
  }, []);
  const a = (t / 5000) * 360;
  return {
    background: `
      radial-gradient(950px 750px at 15% 20%,
        hsla(${(a + 40) % 360}, 90%, 75%, 0.55), transparent 60%),
      radial-gradient(900px 700px at 85% 25%,
        hsla(${(a + 160) % 360}, 90%, 75%, 0.55), transparent 60%),
      radial-gradient(900px 900px at 50% 85%,
        hsla(${(a + 260) % 360}, 90%, 75%, 0.55), transparent 60%),
      linear-gradient(135deg, #0b1220, #121a2e, #091023)
    `,
  };
}

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export default function FirstDetection() {
  const navigate = useNavigate();
  const bg = useSamsungBackground();

  const {
    running,
    ready,
    start,
    faceStatus,
    voiceStatus,
    micLevel,
    stableEmotion,
    fused,
    faceOut,
    voiceOut,
    textOut,
    text,
    setText,
    videoRef,
    canvasRef,
  } = useEmotion();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login", { replace: true });
  }, [navigate]);

  // ensure detection running
  useEffect(() => {
    if (!running) start();
  }, [running, start]);

  const readyToContinue = useMemo(() => {
    const typed = (text || "").trim().length > 0;
    const faceOk = Boolean(faceOut?.face_present) && Boolean(faceOut?.usable);
    const voiceOk = Boolean(voiceOut?.speech_present) && Boolean(voiceOut?.usable);
    return typed || faceOk || voiceOk || Boolean(ready);
  }, [text, ready, faceOut, voiceOut]);

  const H = 320;

  function onContinue() {
    navigate("/mood");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 14, ...bg }}>
      <div
        style={{
          width: "min(1200px, 96vw)",
          height: "min(820px, 92vh)",
          borderRadius: 34,
          padding: 18,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 30px 120px rgba(0,0,0,0.45)",
          backdropFilter: "blur(16px)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: 12,
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 1000, color: "white" }}>How do you feel today?</div>
            <div style={{ marginTop: 6, fontSize: 16, color: "rgba(255,255,255,0.85)" }}>
              Camera: {faceStatus} &nbsp;|&nbsp; Mic: {voiceStatus} &nbsp;|&nbsp; Text: {(text || "").trim() ? "✅" : "waiting"}
            </div>
          </div>

          <button
            onClick={() => {
              const ok = speak("How do you feel today? You can speak or type your answer.");
              if (!ok) alert("Your browser cannot play voice. Please type your answer.");
            }}
            style={{
              padding: "16px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.18)",
              color: "white",
              fontWeight: 1000,
              cursor: "pointer",
              fontSize: 18,
              minWidth: 220,
            }}
          >
            🔊 Listen
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* BODY */}
        <div
          style={{
            borderRadius: 28,
            background: "rgba(255,255,255,0.92)",
            padding: 14,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 12,
            minHeight: 0,
          }}
          className="detectGrid"
        >
          {/* LEFT: Face + Text */}
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12, minHeight: 0 }}>
            <div style={{ borderRadius: 22, border: "1px solid rgba(0,0,0,0.10)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                <div>Face</div>
                <div>
                  {faceOut?.label || "—"} ({Number(faceOut?.confidence || 0).toFixed(2)})
                </div>
              </div>

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: H,
                  objectFit: "cover",
                  borderRadius: 18,
                  background: "#000",
                  marginTop: 10,
                }}
              />
            </div>

            <div style={{ borderRadius: 22, border: "1px solid rgba(0,0,0,0.10)", padding: 12, minHeight: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                <div>Type Answer (optional)</div>
                <div>
                  {textOut?.label || "—"} ({Number(textOut?.confidence || 0).toFixed(2)})
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Example: I feel happy today…"
                style={{
                  width: "100%",
                  height: "calc(100% - 34px)",
                  marginTop: 10,
                  resize: "none",
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.20)",
                  fontSize: 20,
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* RIGHT: Voice + Final */}
          <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12, minHeight: 0 }}>
            <div style={{ borderRadius: 22, border: "1px solid rgba(0,0,0,0.10)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                <div>Voice</div>
                <div>
                  {voiceOut?.label || "—"} ({Number(voiceOut?.confidence || 0).toFixed(2)})
                </div>
              </div>

              <div style={{ height: 14, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
                <div style={{ width: `${Math.round(micLevel * 100)}%`, height: "100%", background: "#111827" }} />
              </div>

              <div style={{ marginTop: 8, fontSize: 14, color: "#333" }}>
                Mic level: <b>{Math.round(micLevel * 100)}%</b> | Speech: <b>{voiceOut?.speech_present ? "Yes ✅" : "No"}</b>
              </div>

              <div style={{ marginTop: 6, fontSize: 14, color: "#333" }}>
                Usable: <b>{voiceOut?.usable ? "Yes ✅" : "No"}</b> | SNR:{" "}
                {voiceOut?.snr_est == null ? "—" : Number(voiceOut.snr_est).toFixed(1)} dB
              </div>
            </div>

            <div style={{ borderRadius: 22, padding: 14, background: "linear-gradient(135deg,#111827,#374151)", color: "white" }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Detected emotion (Final)</div>
              <div style={{ fontSize: 38, fontWeight: 1000, textTransform: "lowercase" }}>
                {ready ? stableEmotion.label : "detecting..."}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>
                confidence: <b>{ready ? Number(stableEmotion.confidence).toFixed(2) : "—"}</b>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                raw fused: {fused?.label || "—"} ({Number(fused?.confidence || 0).toFixed(2)})
              </div>
            </div>

            <div style={{ borderRadius: 22, border: "1px solid rgba(0,0,0,0.10)", padding: 12, overflow: "hidden" }}>
              <div style={{ fontWeight: 900 }}>Tips</div>
              <ul style={{ margin: "10px 0 0 18px", fontSize: 16, color: "#333", lineHeight: 1.4 }}>
                <li>Speak clearly for 2–3 seconds.</li>
                <li>Keep face centered & bright.</li>
                <li>Typing is optional.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onContinue}
            disabled={!readyToContinue}
            style={{
              flex: "1 1 360px",
              padding: "20px 22px",
              borderRadius: 18,
              border: "none",
              background: readyToContinue
                ? "linear-gradient(135deg,#16a34a,#22c55e)"
                : "linear-gradient(135deg,#9ca3af,#6b7280)",
              color: "white",
              fontWeight: 1000,
              fontSize: 24,
              cursor: readyToContinue ? "pointer" : "not-allowed",
              boxShadow: "0 18px 44px rgba(0,0,0,0.25)",
            }}
          >
            Continue →
          </button>

          <div style={{ flex: "1 1 360px", color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
            After Continue, mood screens will switch automatically when emotion changes.
          </div>
        </div>

        <style>{`
          @media (max-width: 980px) {
            .detectGrid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}