import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import EmotionRouter from "./EmotionRouter";

export default function MoodEntry() {
  const location = useLocation();

  useEffect(() => {
    // ✅ only reload once per entry from FirstDetection
    const shouldReload = Boolean(location.state?.reloadOnce);

    if (!shouldReload) return;

    const key = "mood_reload_done";
    const already = sessionStorage.getItem(key);

    if (already === "1") {
      // cleanup so next time it can reload again if needed
      sessionStorage.removeItem(key);
      return;
    }

    sessionStorage.setItem(key, "1");

    // ✅ hard reload once (this is what you want)
    window.location.replace("/mood");
  }, [location.state]);

  // After reload (or if no reload needed) -> route by emotion
  return <EmotionRouter />;
}