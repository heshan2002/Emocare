import { useEffect, useRef, useState } from "react";

/** ---------------- WAV encode helpers ---------------- */
function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
function writeWavHeader(view, sampleRate, numChannels, numFrames) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
}
function pcmToWavBlob(float32Mono, sampleRate) {
  const pcm16 = floatTo16BitPCM(float32Mono);
  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);
  writeWavHeader(view, sampleRate, 1, pcm16.length);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

const TARGET5 = ["happy", "sad", "surprise", "neutral", "angry"];
function emptyProbsNeutral() {
  return { happy: 0, sad: 0, surprise: 0, neutral: 1, angry: 0 };
}
function argmaxProb(probs) {
  let best = "neutral";
  let bestV = -1;
  for (const k of TARGET5) {
    const v = Number(probs?.[k] ?? 0);
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return { label: best, confidence: bestV < 0 ? 0 : bestV };
}
function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const API = "http://127.0.0.1:8000";

/** Emotion badge colors (simple + not flashy) */
function emotionBadgeStyle(emotion) {
  const e = (emotion || "neutral").toLowerCase();
  if (e === "happy") return { border: "2px solid #0f5132", background: "#d1e7dd", color: "#0f5132" };
  if (e === "sad") return { border: "2px solid #084298", background: "#cfe2ff", color: "#084298" };
  if (e === "angry") return { border: "2px solid #842029", background: "#f8d7da", color: "#842029" };
  if (e === "surprise") return { border: "2px solid #664d03", background: "#fff3cd", color: "#664d03" };
  return { border: "2px solid #111827", background: "#eef2ff", color: "#111827" };
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Auto on
  const [camOn] = useState(true);
  const [micOn] = useState(true);

  // Elder mode UI scaling
  const [elderMode, setElderMode] = useState(true);

  // microphone internals
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const samplesRef = useRef([]);
  const [micLevel, setMicLevel] = useState(0);

  // UI input
  const [text, setText] = useState("");

  // status
  const [faceStatus, setFaceStatus] = useState("starting…");
  const [voiceStatus, setVoiceStatus] = useState("starting…");
  const [textStatus, setTextStatus] = useState("waiting");

  // outputs
  const [faceOut, setFaceOut] = useState({
    label: "—",
    confidence: "—",
    probs: emptyProbsNeutral(),
    quality_score: 0,
    usable: false,
    face_present: false,
    warning: null,
  });

  const [voiceOut, setVoiceOut] = useState({
    label: "—",
    confidence: "—",
    probs: emptyProbsNeutral(),
    quality_score: 0,
    usable: false,
    speech_present: false,
    warning: null,
    snr_est: null,
    clip_ratio: null,
  });

  const [textOut, setTextOut] = useState({ label: "—", confidence: "—", probs: emptyProbsNeutral() });

  // fused
  const [fused, setFused] = useState({ label: "—", confidence: "—", weights: null });
  const fusedHistoryRef = useRef([]);

  // stable output (prevents UI swapping)
  const [stableEmotion, setStableEmotion] = useState({ label: "neutral", confidence: "1.00" });
  const candidateRef = useRef({ label: null, count: 0 });
  const lastSwitchRef = useRef(0);

  const faceTimerRef = useRef(null);

  // UI sizes
  const H = elderMode ? 290 : 250;
  const titleSize = elderMode ? 26 : 22;
  const boxPad = elderMode ? 14 : 12;
  const labelSize = elderMode ? 14 : 12;
  const valueSize = elderMode ? 14 : 12;

  // ---------------- Auto-start Camera ----------------
  useEffect(() => {
    let stream;

    async function startCamAuto() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setFaceStatus("camera ✅");
      } catch (e) {
        setFaceStatus("camera denied ❌");
        console.error(e);
      }
    }

    if (camOn) startCamAuto();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [camOn]);

  // ---------------- Send face frame 1/sec ----------------
  useEffect(() => {
    if (!camOn) return;

    async function sendFrame() {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        if (!video.videoWidth || !video.videoHeight) return;

        const w = 320;
        const h = 240;
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, w, h);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
        if (!blob) return;

        const fd = new FormData();
        fd.append("file", blob, "frame.jpg");

        const r = await fetch(`${API}/emotion/face`, { method: "POST", body: fd });
        if (!r.ok) return;
        const j = await r.json();

        setFaceOut({
          label: j.label ?? "—",
          confidence: (j.confidence ?? 0).toFixed(2),
          probs: j.probs ?? emptyProbsNeutral(),
          quality_score: clamp01(j.quality_score ?? 0),
          usable: Boolean(j.usable ?? false),
          face_present: Boolean(j.face_present ?? false),
          warning: j.warning ?? null,
        });
      } catch {}
    }

    sendFrame();
    faceTimerRef.current = setInterval(sendFrame, 1000);

    return () => {
      if (faceTimerRef.current) clearInterval(faceTimerRef.current);
      faceTimerRef.current = null;
    };
  }, [camOn]);

  // ---------------- Text status + debounced emotion ----------------
  useEffect(() => {
    if (text.trim().length === 0) setTextStatus("waiting");
    else setTextStatus("text ✅");
  }, [text]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const content = text.trim();
      if (!content) {
        setTextOut({ label: "neutral", confidence: "1.00", probs: emptyProbsNeutral() });
        return;
      }
      try {
        const r = await fetch(`${API}/emotion/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content }),
        });
        if (!r.ok) return;
        const j = await r.json();
        setTextOut({
          label: j.label ?? "—",
          confidence: (j.confidence ?? 0).toFixed(2),
          probs: j.probs ?? emptyProbsNeutral(),
        });
      } catch {}
    }, 250);

    return () => clearTimeout(timer);
  }, [text]);

  // ---------------- Auto-start Microphone (3s chunks + silence gate) ----------------
  useEffect(() => {
    if (!micOn) return;

    let stopped = false;

    async function startMicAuto() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        micStreamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        samplesRef.current = [];
        let lastSendTime = performance.now();

        setVoiceStatus("mic ✅");

        processor.onaudioprocess = async (e) => {
          const input = e.inputBuffer.getChannelData(0);
          samplesRef.current.push(new Float32Array(input));

          let sum = 0;
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
          const rms = Math.sqrt(sum / input.length);
          const level = Math.min(1, rms * 3);
          setMicLevel(level);

          const now = performance.now();
          if (now - lastSendTime >= 3000) {
            lastSendTime = now;

            // ✅ silence / low speech gate
            if (level < 0.06) {
              samplesRef.current = [];
              return;
            }

            const chunks = samplesRef.current;
            samplesRef.current = [];

            let totalLen = 0;
            chunks.forEach((c) => (totalLen += c.length));
            if (totalLen < 12000) return;

            const mono = new Float32Array(totalLen);
            let off = 0;
            chunks.forEach((c) => {
              mono.set(c, off);
              off += c.length;
            });

            const wavBlob = pcmToWavBlob(mono, audioCtx.sampleRate);

            try {
              const fd = new FormData();
              fd.append("file", wavBlob, "chunk.wav");

              const r = await fetch(`${API}/emotion/voice`, { method: "POST", body: fd });
              if (!r.ok) return;

              const j = await r.json();

              setVoiceOut({
                label: j.label ?? "—",
                confidence: (j.confidence ?? 0).toFixed(2),
                probs: j.probs ?? emptyProbsNeutral(),
                quality_score: clamp01(j.quality_score ?? 0),
                usable: Boolean(j.usable ?? false),
                speech_present: Boolean(j.speech_present ?? false),
                warning: j.warning ?? null,
                snr_est: j.snr_est ?? null,
                clip_ratio: j.clip_ratio ?? null,
              });
            } catch {}
          }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      } catch (e) {
        console.error(e);
        setVoiceStatus("mic denied ❌");
      }
    }

    startMicAuto();

    return () => {
      stopped = true;
      try {
        setMicLevel(0);
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current.onaudioprocess = null;
          processorRef.current = null;
        }
        if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
      } catch {}
    };
  }, [micOn]);

  // ---------------- FUSION + smoothing + stable switching ----------------
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const textAvail = text.trim().length > 0;

        const payload = {
          face: {
            confidence: Number(faceOut.confidence) || 0,
            probs: faceOut.probs,
            quality_score: faceOut.quality_score ?? 1.0,
            usable: faceOut.usable ?? true,
            face_present: faceOut.face_present ?? true,
          },
          voice: {
            confidence: Number(voiceOut.confidence) || 0,
            probs: voiceOut.probs,
            quality_score: voiceOut.quality_score ?? 1.0,
          },
          text: {
            confidence: Number(textOut.confidence) || 0,
            probs: textOut.probs,
          },
          text_available: textAvail,
        };

        const r = await fetch(`${API}/emotion/fuse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) return;

        const j = await r.json();
        const probs = j.probs ?? emptyProbsNeutral();

        // fast smoothing (5)
        const hist = fusedHistoryRef.current;
        hist.push(probs);
        while (hist.length > 5) hist.shift();

        const avg = { happy: 0, sad: 0, surprise: 0, neutral: 0, angry: 0 };
        for (const p of hist) for (const k of TARGET5) avg[k] += Number(p?.[k] ?? 0);
        for (const k of TARGET5) avg[k] /= hist.length;

        const best = argmaxProb(avg);

        setFused({
          label: best.label,
          confidence: best.confidence.toFixed(2),
          weights: j.weights ?? null,
        });

        // stable output (prevents UI swapping)
        const HOLD_MS = 900;
        const NEED_COUNT = 2;
        const BASE_CONF = 0.52;

        let requiredConf = BASE_CONF;
        if (best.label === "angry" || best.label === "sad") requiredConf = 0.62;
        if (best.label === "neutral") requiredConf = 0.42;

        const now = Date.now();

        if (candidateRef.current.label !== best.label) {
          candidateRef.current = { label: best.label, count: 1 };
        } else {
          candidateRef.current.count += 1;
        }

        const canSwitch =
          candidateRef.current.count >= NEED_COUNT &&
          best.confidence >= requiredConf &&
          now - lastSwitchRef.current >= HOLD_MS &&
          best.label !== stableEmotion.label;

        if (canSwitch) {
          setStableEmotion({ label: best.label, confidence: best.confidence.toFixed(2) });
          lastSwitchRef.current = now;
        }
      } catch {}
    }, 100);

    return () => clearTimeout(timer);
  }, [faceOut, voiceOut, textOut, text, stableEmotion.label]);

  // UI helpers
  const faceQ = clamp01(faceOut.quality_score ?? 0);
  const voiceQ = clamp01(voiceOut.quality_score ?? 0);

  const faceText = !faceOut.face_present ? "No face" : !faceOut.usable ? `Low (${faceOut.warning || "bad"})` : "Good";
  const voiceText = !voiceOut.speech_present ? "No speech" : !voiceOut.usable ? `Low (${voiceOut.warning || "bad"})` : "Good";

  const badge = emotionBadgeStyle(stableEmotion.label);

  return (
    <div style={{ height: "100vh", padding: 12, boxSizing: "border-box", fontFamily: "Arial", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: titleSize, fontWeight: 800 }}>Elder Emotion Care — Test UI</div>
          <div style={{ fontSize: 12, color: "#444" }}>
            Cam: {faceStatus} | Mic: {voiceStatus} | Text: {textStatus}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 13, color: "#111" }}>
            <input
              type="checkbox"
              checked={elderMode}
              onChange={(e) => setElderMode(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Elder Mode (Large UI)
          </label>

          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontWeight: 800,
              textTransform: "lowercase",
              ...badge,
            }}
          >
            {stableEmotion.label} <span style={{ fontWeight: 600, fontSize: 12 }}>({stableEmotion.confidence})</span>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div
        style={{
          height: "calc(100vh - 70px)",
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {/* LEFT COLUMN */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 10, minHeight: 0 }}>
          {/* CAMERA */}
          <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: boxPad }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: labelSize }}>
              <b>Face</b>
              <span style={{ fontSize: valueSize }}>
                <b>{faceOut.label}</b> ({faceOut.confidence})
              </span>
            </div>

            <div style={{ marginTop: 8, fontSize: labelSize, color: "#444" }}>
              Face quality: {faceText} ({Math.round(faceQ * 100)}%)
            </div>
            <div style={{ height: 12, background: "#eee", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: `${Math.round(faceQ * 100)}%`, height: "100%", background: "#111" }} />
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
                borderRadius: 14,
                background: "#000",
                marginTop: 10,
              }}
            />
          </div>

          {/* TEXT */}
          <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: boxPad, minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: labelSize }}>
              <b>Text</b>
              <span style={{ fontSize: valueSize }}>
                <b>{textOut.label}</b> ({textOut.confidence})
              </span>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type message here..."
              style={{
                width: "100%",
                height: "100%",
                resize: "none",
                padding: elderMode ? 14 : 10,
                borderRadius: 12,
                border: "1px solid #ccc",
                marginTop: 10,
                boxSizing: "border-box",
                fontSize: elderMode ? 18 : 16,
                lineHeight: 1.35,
              }}
            />
          </div>

          {/* FINAL */}
          <div style={{ border: "2px solid #000", borderRadius: 14, padding: boxPad }}>
            <div style={{ fontSize: labelSize, color: "#444" }}>Final Emotion (Stable)</div>
            <div style={{ fontSize: elderMode ? 34 : 30, fontWeight: 900, textTransform: "lowercase" }}>
              {stableEmotion.label} <span style={{ fontSize: 14, fontWeight: 500 }}>(conf {stableEmotion.confidence})</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#444" }}>
              Raw fused: {fused.label} (conf {fused.confidence})
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 10, minHeight: 0 }}>
          {/* VOICE */}
          <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: boxPad }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: labelSize }}>
              <b>Voice</b>
              <span style={{ fontSize: valueSize }}>
                <b>{voiceOut.label}</b> ({voiceOut.confidence})
              </span>
            </div>

            <div style={{ height: 12, background: "#eee", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
              <div style={{ width: `${Math.round(micLevel * 100)}%`, height: "100%", background: "#111" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: labelSize, color: "#444" }}>
              Mic level: {Math.round(micLevel * 100)}%
            </div>

            <div style={{ marginTop: 12, fontSize: labelSize, color: "#444" }}>
              Voice quality: {voiceText} ({Math.round(voiceQ * 100)}%)
            </div>
            <div style={{ height: 12, background: "#eee", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: `${Math.round(voiceQ * 100)}%`, height: "100%", background: "#111" }} />
            </div>

            <div style={{ marginTop: 8, fontSize: labelSize, color: "#444" }}>
              SNR: {voiceOut.snr_est == null ? "—" : Number(voiceOut.snr_est).toFixed(1)} dB | Clip:{" "}
              {voiceOut.clip_ratio == null ? "—" : Math.round(Number(voiceOut.clip_ratio) * 100)}%
            </div>
          </div>

          {/* WEIGHTS */}
          <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: boxPad }}>
            <div style={{ fontSize: labelSize, color: "#444" }}>Fusion Weights</div>
            {fused.weights ? (
              <div style={{ fontSize: elderMode ? 16 : 13, marginTop: 8 }}>
                Face: <b>{Number(fused.weights.face).toFixed(2)}</b> | Voice:{" "}
                <b>{Number(fused.weights.voice).toFixed(2)}</b> | Text: <b>{Number(fused.weights.text).toFixed(2)}</b>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 13, color: "#777" }}>waiting…</div>
            )}
            <div style={{ marginTop: 8, fontSize: labelSize, color: "#444" }}>
              Face+Voice always. Text only when typed.
            </div>
          </div>

          {/* NOTES */}
          <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: boxPad, minHeight: 0, overflow: "hidden" }}>
            <div style={{ fontSize: labelSize, color: "#444" }}>Tips</div>
            <ul style={{ margin: "10px 0 0 18px", fontSize: elderMode ? 15 : 12, color: "#444" }}>
              <li>Speak clearly for 2–3 seconds for best voice emotion.</li>
              <li>Keep face centered & bright for better face accuracy.</li>
              <li>Stable emotion prevents UI swapping.</li>
              <li>If voice always neutral: check SNR and mic level.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}