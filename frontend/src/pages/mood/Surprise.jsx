import { useMemo, useState } from "react";
import MoodLayout from "../../components/MoodLayout";
import { useEmotion } from "../../context/EmotionContext";
import { softBeep } from "../../components/ui/feedback";

export default function Surprise() {
  const { stableEmotion } = useEmotion();
  const [toast, setToast] = useState("");

  const conf = useMemo(() => Number(stableEmotion?.confidence ?? 0).toFixed(2), [stableEmotion]);

  function show(msg) {
    setToast(msg);
    softBeep();
    setTimeout(() => setToast(""), 1500);
  }

  return (
    <MoodLayout
      mood="surprise"
      title="You look Surprised"
      subtitle={`Let’s check and stay safe`}
      primaryActions={[
        { label: "🎮 Simple Game", onClick: () => show("Opening a simple game…") },
        { label: "💬 Chat with Bot", onClick: () => show("Opening chat…") },
      ]}
      secondaryActions={[
        { label: "📞 Call Family", onClick: () => show("Calling family…") },
        { label: "💧 Drink Water", onClick: () => show("Water reminder…") },
      ]}
    >
      {toast && (
        <div style={toastStyle("#F59E0B")}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{toast}</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Done ✅</div>
        </div>
      )}
    </MoodLayout>
  );
}

function toastStyle(color) {
  return {
    position: "fixed",
    left: "50%",
    top: "16%",
    transform: "translateX(-50%)",
    padding: "14px 18px",
    borderRadius: 18,
    background: "rgba(17,24,39,0.92)",
    border: `2px solid ${color}`,
    color: "white",
    zIndex: 9999,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    textAlign: "center",
    minWidth: "min(520px, 92vw)",
    animation: "pulse 1.3s ease",
  };
}