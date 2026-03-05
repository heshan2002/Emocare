import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const EmotionContext = createContext(null);
export const useEmotion = () => useContext(EmotionContext);

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

/** ---------------- helpers ---------------- */
const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
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

export function EmotionProvider({ children }) {
  const location = useLocation();

  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const [ready, setReady] = useState(false);

  // statuses + mic level (like your old test)
  const [faceStatus, setFaceStatus] = useState("not started");
  const [voiceStatus, setVoiceStatus] = useState("not started");
  const [micLevel, setMicLevel] = useState(0);

  // ✅ hidden always-mounted elements (keep detection alive)
  const hiddenVideoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  // ✅ visible preview video (FirstDetection uses this)
  const previewVideoRef = useRef(null);

  // streams
  const camStreamRef = useRef(null);

  // mic internals
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const samplesRef = useRef([]);

  // typing input
  const [text, setText] = useState("");

  const [faceOut, setFaceOut] = useState({
    label: "neutral",
    confidence: 0,
    probs: emptyProbsNeutral(),
    quality_score: 0,
    usable: false,
    face_present: false,
    warning: null,
  });

  const [voiceOut, setVoiceOut] = useState({
    label: "neutral",
    confidence: 0,
    probs: emptyProbsNeutral(),
    quality_score: 0,
    usable: false,
    speech_present: false,
    warning: null,
    snr_est: null,
    clip_ratio: null,
  });

  const [textOut, setTextOut] = useState({
    label: "neutral",
    confidence: 1,
    probs: emptyProbsNeutral(),
  });

  const [fused, setFused] = useState({ label: "neutral", confidence: 0, weights: null });
  const [stableEmotion, setStableEmotion] = useState({ label: "neutral", confidence: 1 });

  const fusedHistoryRef = useRef([]);
  const candidateRef = useRef({ label: null, count: 0 });
  const lastSwitchRef = useRef(0);

  const startPromiseRef = useRef(null);

  // ---------- AUDIO UNLOCK (fix voice not sending) ----------
  useEffect(() => {
    const unlock = async () => {
      try {
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") await ctx.resume();
      } catch {}
    };
    window.addEventListener("click", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // ---------- START ONCE ----------
  const start = async () => {
    if (runningRef.current) return;
    if (startPromiseRef.current) return startPromiseRef.current;

    startPromiseRef.current = (async () => {
      runningRef.current = true;
      setRunning(true);
      setReady(false);

      setFaceStatus("starting…");
      setVoiceStatus("starting…");

      // CAMERA
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        camStreamRef.current = camStream;

        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = camStream;
          await hiddenVideoRef.current.play().catch(() => {});
        }
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = camStream;
          await previewVideoRef.current.play().catch(() => {});
        }

        setFaceStatus("camera ✅");
      } catch (e) {
        console.error("Camera error:", e);
        setFaceStatus("camera denied ❌");
      }

      // MIC (voice chunks → backend)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        // ✅ critical: resume to avoid suspended (voice not sending)
        try {
          await audioCtx.resume();
        } catch {}

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        samplesRef.current = [];
        let lastSendTime = performance.now();

        setVoiceStatus("mic ✅ (listening…)");

        processor.onaudioprocess = async (e) => {
          if (!runningRef.current) return;

          const input = e.inputBuffer.getChannelData(0);
          samplesRef.current.push(new Float32Array(input));

          // mic level
          let sum = 0;
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
          const rms = Math.sqrt(sum / input.length);
          const level = Math.min(1, rms * 3);
          setMicLevel(level);

          const now = performance.now();
          if (now - lastSendTime >= 3000) {
            lastSendTime = now;

            // silence gate
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
            const fd = new FormData();
            fd.append("file", wavBlob, "chunk.wav");

            try {
              const r = await fetch(`${API}/emotion/voice`, { method: "POST", body: fd });
              if (!r.ok) return;
              const j = await r.json();

              setVoiceOut({
                label: j.label ?? "neutral",
                confidence: Number(j.confidence ?? 0),
                probs: j.probs ?? emptyProbsNeutral(),
                quality_score: clamp01(j.quality_score ?? 0),
                usable: Boolean(j.usable ?? false),
                speech_present: Boolean(j.speech_present ?? false),
                warning: j.warning ?? null,
                snr_est: j.snr_est ?? null,
                clip_ratio: j.clip_ratio ?? null,
              });

              setVoiceStatus("mic ✅ (sending chunks)");
            } catch (err) {
              console.error("Voice error:", err);
              setVoiceStatus("mic backend error ❌");
            }
          }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      } catch (e) {
        console.error("Mic error:", e);
        setVoiceStatus("mic denied ❌");
      }
    })();

    try {
      await startPromiseRef.current;
    } finally {
      startPromiseRef.current = null;
    }
  };

  // stop on logout only
  const stop = () => {
    runningRef.current = false;
    setRunning(false);
    setReady(false);
    setMicLevel(0);

    setFaceStatus("not started");
    setVoiceStatus("not started");

    // stop camera
    try {
      const s = camStreamRef.current;
      if (s?.getTracks) s.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;

      if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    } catch {}

    // stop mic
    try {
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

  // ✅ Start detection automatically in first-detection AND mood pages (continues during navigation)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const inDetectArea =
      location.pathname === "/first-detection" ||
      location.pathname === "/mood" ||
      location.pathname.startsWith("/mood/");

    if (token && inDetectArea && !runningRef.current) start();
    if (!token && runningRef.current) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ✅ ensure preview always shows stream when you come back
  useEffect(() => {
    const stream = camStreamRef.current;
    if (stream && previewVideoRef.current && !previewVideoRef.current.srcObject) {
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [location.pathname]);

  // ---------- FACE LOOP (always uses hidden video) ----------
  useEffect(() => {
    if (!running) return;

    const timer = setInterval(async () => {
      try {
        const video = hiddenVideoRef.current;
        const canvas = hiddenCanvasRef.current;
        if (!video || !canvas) return;

        // if video paused, try to play again
        if (video.paused) video.play().catch(() => {});
        if (!video.videoWidth || !video.videoHeight) return;

        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, 320, 240);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
        if (!blob) return;

        const fd = new FormData();
        fd.append("file", blob, "frame.jpg");

        const r = await fetch(`${API}/emotion/face`, { method: "POST", body: fd });
        if (!r.ok) return;
        const j = await r.json();

        setFaceOut({
          label: j.label ?? "neutral",
          confidence: Number(j.confidence ?? 0),
          probs: j.probs ?? emptyProbsNeutral(),
          quality_score: clamp01(j.quality_score ?? 0),
          usable: Boolean(j.usable ?? false),
          face_present: Boolean(j.face_present ?? false),
          warning: j.warning ?? null,
        });
      } catch (err) {
        console.error("Face loop error:", err);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [running]);

  // ---------- TEXT LOOP ----------
  useEffect(() => {
    if (!running) return;

    const t = setTimeout(async () => {
      const content = text.trim();
      if (!content) {
        setTextOut({ label: "neutral", confidence: 1, probs: emptyProbsNeutral() });
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
          label: j.label ?? "neutral",
          confidence: Number(j.confidence ?? 0),
          probs: j.probs ?? emptyProbsNeutral(),
        });
      } catch (err) {
        console.error("Text error:", err);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [text, running]);

  // ---------- FUSION LOOP ----------
  useEffect(() => {
    if (!running) return;

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

        const hist = fusedHistoryRef.current;
        hist.push(probs);
        while (hist.length > 5) hist.shift();

        const avg = { happy: 0, sad: 0, surprise: 0, neutral: 0, angry: 0 };
        for (const p of hist) for (const k of TARGET5) avg[k] += Number(p?.[k] ?? 0);
        for (const k of TARGET5) avg[k] /= hist.length;

        const best = argmaxProb(avg);

        setFused({ label: best.label, confidence: best.confidence, weights: j.weights ?? null });

        // stable switching
        const HOLD_MS = 900;
        const NEED_COUNT = 2;
        const BASE_CONF = 0.52;

        let requiredConf = BASE_CONF;
        if (best.label === "angry" || best.label === "sad") requiredConf = 0.62;
        if (best.label === "neutral") requiredConf = 0.42;

        const now = Date.now();

        if (candidateRef.current.label !== best.label) candidateRef.current = { label: best.label, count: 1 };
        else candidateRef.current.count += 1;

        const canSwitch =
          candidateRef.current.count >= NEED_COUNT &&
          best.confidence >= requiredConf &&
          now - lastSwitchRef.current >= HOLD_MS &&
          best.label !== stableEmotion.label;

        if (canSwitch) {
          setStableEmotion({ label: best.label, confidence: best.confidence });
          lastSwitchRef.current = now;
        }

        setReady(true);
      } catch (err) {
        console.error("Fusion error:", err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [running, faceOut, voiceOut, textOut, text, stableEmotion.label]);

  const value = useMemo(
    () => ({
      API,
      TARGET5,
      running,
      ready,
      start,
      stop,

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

      // ✅ preview for FirstDetection
      videoRef: previewVideoRef,
      canvasRef: hiddenCanvasRef,
    }),
    [
      running,
      ready,
      faceStatus,
      voiceStatus,
      micLevel,
      stableEmotion,
      fused,
      faceOut,
      voiceOut,
      textOut,
      text,
    ]
  );

  return (
    <EmotionContext.Provider value={value}>
      {/* always mounted */}
      <video
        ref={hiddenVideoRef}
        playsInline
        muted
        autoPlay
        style={{ position: "fixed", left: -9999, top: -9999, width: 1, height: 1 }}
      />
      <canvas ref={hiddenCanvasRef} style={{ position: "fixed", left: -9999, top: -9999, width: 1, height: 1 }} />
      {children}
    </EmotionContext.Provider>
  );
}