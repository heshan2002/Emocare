import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEmotion } from "../context/EmotionContext";

const mapEmotionToRoute = (e) => {
  const x = (e || "neutral").toLowerCase();
  if (x === "happy") return "/mood/happy";
  if (x === "sad") return "/mood/sad";
  if (x === "angry") return "/mood/angry";
  if (x === "surprise") return "/mood/surprise";
  return "/mood/neutral";
};

export default function EmotionRouter() {
  const { stableEmotion } = useEmotion();
  const navigate = useNavigate();
  const location = useLocation();

  const target = useMemo(() => mapEmotionToRoute(stableEmotion?.label), [stableEmotion?.label]);

  const lastNavRef = useRef(0);
  const lastTargetRef = useRef("");

  useEffect(() => {
    const inMoodArea = location.pathname === "/mood" || location.pathname.startsWith("/mood/");
    if (!inMoodArea) return;

    if (location.pathname === target) return;

    const now = Date.now();
    if (now - lastNavRef.current < 700) return;
    if (lastTargetRef.current === target) return;

    lastTargetRef.current = target;
    lastNavRef.current = now;

    navigate(target, { replace: true });
  }, [target, location.pathname, navigate]);

  return null;
}