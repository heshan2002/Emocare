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
  writeString(20, "");
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

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/**
 * ✅ Reusable engine:
 * - starts cam+mic automatically
 * - optional text input
 * - returns stableEmotion + videoRef for preview
 */
export function useEmotionEngine({ enableText = true } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [text, setText] = useState("");
  const [micLevel, setMicLevel] = useState(0);

  const [faceStatus, setFaceStatus] = useState("starting…");
  const [voiceStatus, setVoiceStatus] = useState("starting…");

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

  const [fused, setFused] = useState({ label: "—", confidence: "—", weights: null });

  const [stableEmotion, setStableEmotion] = useState({ label: "neutral", confidence: "1.00" });
  const fusedHistoryRef = useRef([]);
  const candidateRef = useRef({ label: null, count: 0 });
  const lastSwitchRef = useRef(0);

  const faceTimerRef = useRef(null);

  // mic internals
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const samplesRef = useRef([]);

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

    startCamAuto();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ---------------- Send face frame 1/sec ----------------
  useEffect(() => {
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
  }, []);

  // ---------------- Text emotion (optional) ----------------
  useEffect(() => {
    if (!enableText) return;

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
  }, [text, enableText]);

  // ---------------- Auto-start Microphone (3s chunks + silence gate) ----------------
  useEffect(() => {
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
  }, []);

  // ---------------- FUSION + smoothing + stable switching ----------------
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const textAvail = enableText && text.trim().length > 0;

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

        setFused({
          label: best.label,
          confidence: best.confidence.toFixed(2),
          weights: j.weights ?? null,
        });

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
  }, [faceOut, voiceOut, textOut, text, enableText, stableEmotion.label]);

  return {
    API,
    TARGET5,
    videoRef,
    canvasRef,
    text,
    setText,
    micLevel,
    faceStatus,
    voiceStatus,
    faceOut,
    voiceOut,
    textOut,
    fused,
    stableEmotion,
  };
}