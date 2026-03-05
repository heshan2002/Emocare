import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function useSamsungBackground() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 4000), 40);
    return () => clearInterval(id);
  }, []);
  const a = (t / 4000) * 360;

  return {
    background: `
      radial-gradient(900px 700px at 20% 20%,
        hsla(${(a + 40) % 360}, 95%, 78%, 0.55), transparent 60%),
      radial-gradient(900px 700px at 80% 35%,
        hsla(${(a + 160) % 360}, 95%, 78%, 0.55), transparent 60%),
      radial-gradient(900px 900px at 55% 85%,
        hsla(${(a + 260) % 360}, 95%, 78%, 0.55), transparent 60%),
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

function ensureGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(true);

    const existing = document.querySelector('script[data-google="gsi"]');
    if (existing) {
      let tries = 0;
      const id = setInterval(() => {
        tries++;
        if (window.google?.accounts?.id) {
          clearInterval(id);
          resolve(true);
        }
        if (tries > 80) {
          clearInterval(id);
          reject(new Error("Google script loaded but API not available."));
        }
      }, 200);
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.google = "gsi";
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("Failed to load Google script."));
    document.body.appendChild(s);
  });
}

export default function LoginGoogle() {
  const navigate = useNavigate();
  const bg = useSamsungBackground();

  const [status, setStatus] = useState("Preparing Google sign-in…");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ If a broken token/user exists, clear it
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token && token.length < 20) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, []);

  // ✅ If already logged in → go to first-detection
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) navigate("/first-detection", { replace: true });
  }, [navigate]);

  const cardStyle = useMemo(
    () => ({
      width: "min(820px, 96vw)",
      height: "min(620px, 92vh)",
      borderRadius: 34,
      padding: 24,
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: "0 30px 120px rgba(0,0,0,0.45)",
      backdropFilter: "blur(16px)",
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
      overflow: "hidden",
    }),
    []
  );

  const inner = {
    borderRadius: 28,
    background: "rgba(255,255,255,0.90)",
    padding: 22,
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      setErr("");

      if (!GOOGLE_CLIENT_ID) {
        setStatus("Missing Google Client ID (VITE_GOOGLE_CLIENT_ID).");
        return;
      }

      try {
        setStatus("Loading Google…");
        await ensureGoogleScript();
        if (!mounted) return;

        // ✅ Reset stuck state in old browsers
        if (window.google?.accounts?.id) {
          window.google.accounts.id.disableAutoSelect();
          window.google.accounts.id.cancel();
        }

        const el = document.getElementById("gbtn");
        if (!el) return;

        // ✅ Important: clear previous button html so re-render always works
        el.innerHTML = "";
        el.dataset.rendered = "0";

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            try {
              setLoading(true);
              setErr("");
              setStatus("Signing in…");

              const r = await fetch(`${API}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_token: response.credential }),
              });

              if (!r.ok) {
                const e = await readError(r);
                setErr(e);
                setStatus("Sign-in failed ❌");
                setLoading(false);
                return;
              }

              const j = await r.json();

              localStorage.setItem("token", j.token);
              localStorage.setItem("user", JSON.stringify(j.user || {}));

              setLoading(false);
              setStatus("Done ✅");

              // ✅ Correct routing after login
              if (j.user?.is_profile_complete) navigate("/first-detection", { replace: true });
              else navigate("/profile", { replace: true });
            } catch (e) {
              console.error(e);
              setErr("Login failed. Please try again.");
              setStatus("Sign-in failed ❌");
              setLoading(false);
            }
          },
        });

        window.google.accounts.id.renderButton(el, {
          theme: "filled_blue",
          size: "large",
          width: 420,
          text: "continue_with",
          shape: "pill",
        });

        el.dataset.rendered = "1";
        setStatus("Ready ✅");
      } catch (e) {
        console.error(e);
        setStatus("Google did not load ❌");
        setErr("Check internet / AdBlock / firewall. Then press Refresh.");
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, ...bg }}>
      <div style={cardStyle}>
        {/* TOP */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 6px 0 6px" }}>
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 26,
              background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 1000,
              fontSize: 26,
              letterSpacing: 1,
              boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
            }}
          >
            EC
          </div>
          <div>
            <div style={{ fontSize: 38, fontWeight: 1000, color: "white" }}>Emocare</div>
            <div style={{ marginTop: 6, fontSize: 18, color: "rgba(255,255,255,0.85)", lineHeight: 1.35 }}>
               <b></b>
            </div>
          </div>
        </div>

        {/* MIDDLE */}
        <div style={{ display: "grid", placeItems: "center", padding: 14 }}>
          <div style={{ ...inner, width: "min(620px, 96%)" }}>
            <div style={{ fontSize: 18, color: "#111", marginBottom: 10 }}>
              Status: <b>{status}</b>
            </div>

            <div id="gbtn" style={{ display: "flex", justifyContent: "center" }} />

            {loading && <div style={{ marginTop: 14, fontSize: 18, color: "#111" }}>Please wait… 🔄</div>}

            {err && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 18,
                  background: "#fff3cd",
                  border: "1px solid #ffe69c",
                  color: "#664d03",
                  fontSize: 16,
                  lineHeight: 1.35,
                }}
              >
                {err}
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "16px 18px",
                borderRadius: 18,
                border: "none",
                background: "linear-gradient(135deg,#111827,#374151)",
                color: "white",
                fontWeight: 1000,
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            <div style={{ marginTop: 10, fontSize: 14, color: "#333" }}>
              If button not showing: press <b>Refresh</b>.
            </div>
          </div>
        </div>

        {/* BOTTOM */}
        <div style={{ padding: 10, textAlign: "center", color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
          Safe login • Elder friendly • Simple steps
        </div>
      </div>
    </div>
  );
}