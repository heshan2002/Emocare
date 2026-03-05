import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function useSamsungBackground() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 5000), 45);
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

async function readError(res) {
  const txt = await res.text().catch(() => "");
  try {
    const j = JSON.parse(txt);
    return j?.detail || j?.message || txt || "Request failed";
  } catch {
    return txt || "Request failed";
  }
}

function uniqNonEmpty(arr) {
  return Array.from(new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean)));
}

export default function Profile() {
  const navigate = useNavigate();
  const bg = useSamsungBackground();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [age, setAge] = useState(user?.age || 50);
  const [family, setFamily] = useState(user?.family || "");

  const [medical, setMedical] = useState(uniqNonEmpty(user?.medical) || []);
  const [habits, setHabits] = useState(uniqNonEmpty(user?.habits) || []);
  const [hobbies, setHobbies] = useState(uniqNonEmpty(user?.hobbies) || []);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login", { replace: true });
  }, [navigate]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  function toggle(setter, list, item) {
    setter((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  }

  const chip = (active) => ({
    padding: "14px 16px",
    borderRadius: 999,
    border: active ? "2px solid #111827" : "1px solid rgba(0,0,0,0.20)",
    background: active ? "rgba(17,24,39,0.10)" : "rgba(255,255,255,0.92)",
    fontWeight: 1000,
    fontSize: 16,
    cursor: "pointer",
    userSelect: "none",
    boxShadow: active ? "0 12px 28px rgba(0,0,0,0.12)" : "none",
  });

  async function saveProfile() {
    try {
      setMsg("");
      setSaving(true);

      const token = localStorage.getItem("token");
      if (!token) {
        setSaving(false);
        navigate("/login", { replace: true });
        return;
      }

      const payload = {
        age: Number(age) || 50,
        family: String(family || "").trim(),
        medical: uniqNonEmpty(medical),
        habits: uniqNonEmpty(habits),
        hobbies: uniqNonEmpty(hobbies),
      };

      // Backend route is PUT in your last code
      let r = await fetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const e = await readError(r);
        setMsg(e);
        setSaving(false);
        return;
      }

      const j = await r.json();
      localStorage.setItem("user", JSON.stringify(j.user || {}));

      setSaving(false);
      navigate("/first-detect", { replace: true });
    } catch (e) {
      console.error(e);
      setMsg("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 14, ...bg }}>
      <div
        style={{
          width: "min(1100px, 96vw)",
          height: "min(760px, 92vh)",
          borderRadius: 34,
          padding: 18,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 30px 120px rgba(0,0,0,0.45)",
          backdropFilter: "blur(16px)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 38, fontWeight: 1000, color: "white" }}>Profile Setup</div>
            <div style={{ marginTop: 6, fontSize: 18, color: "rgba(255,255,255,0.85)", lineHeight: 1.35 }}>
              Hello <b>{user?.name || user?.email || "Friend"}</b> 👋
              <br />
              Tap selections (easy for elders).
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              padding: "14px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.18)",
              color: "white",
              fontWeight: 1000,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            Logout
          </button>
        </div>

        {/* BODY */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 28,
            background: "rgba(255,255,255,0.92)",
            padding: 16,
            overflow: "auto",
          }}
        >
          {/* Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 1000 }}>Age</div>
              <input
                type="number"
                min={50}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "16px 18px",
                  borderRadius: 18,
                  border: "1px solid rgba(0,0,0,0.20)",
                  fontSize: 20,
                  fontWeight: 900,
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 1000 }}>Family</div>
              <select
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "16px 18px",
                  borderRadius: 18,
                  border: "1px solid rgba(0,0,0,0.20)",
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                <option value="">Select…</option>
                <option value="Live alone">Live alone</option>
                <option value="With spouse">With spouse</option>
                <option value="With children">With children</option>
                <option value="With caregiver">With caregiver</option>
              </select>
            </div>
          </div>

          {/* Medical */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>Medical Conditions</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["Diabetes", "Blood Pressure", "Arthritis", "Sleep Issues", "Depression", "Heart Issues"].map((m) => (
                <div key={m} onClick={() => toggle(setMedical, medical, m)} style={chip(medical.includes(m))}>
                  {m}
                </div>
              ))}
              <div onClick={() => setMedical([])} style={chip(medical.length === 0)}>
                None
              </div>
            </div>
          </div>

          {/* Habits */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>Daily Habits</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["Walk", "Yoga", "Meditation", "Read books", "Watch TV", "Gardening"].map((h) => (
                <div key={h} onClick={() => toggle(setHabits, habits, h)} style={chip(habits.includes(h))}>
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* Hobbies */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>Hobbies</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["Music", "Cooking", "Movies", "Travel", "Religious activities", "Talking with family"].map((hb) => (
                <div key={hb} onClick={() => toggle(setHobbies, hobbies, hb)} style={chip(hobbies.includes(hb))}>
                  {hb}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER (always visible) */}
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={saveProfile}
            disabled={saving}
            style={{
              flex: "1 1 340px",
              padding: "18px 20px",
              borderRadius: 18,
              border: "none",
              background: "linear-gradient(135deg,#111827,#374151)",
              color: "white",
              fontWeight: 1000,
              fontSize: 22,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 18px 44px rgba(0,0,0,0.25)",
            }}
          >
            {saving ? "Saving…" : "Continue → Start Detection"}
          </button>

          {msg && (
            <div
              style={{
                flex: "1 1 340px",
                padding: 12,
                borderRadius: 16,
                background: "#fff3cd",
                border: "1px solid #ffe69c",
                color: "#664d03",
                fontSize: 14,
              }}
            >
              {msg}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .grid2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}