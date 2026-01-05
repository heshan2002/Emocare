import React, { useEffect } from "react";
import "./loading.css";

export default function LoadingPage({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 3000); // Show for 3 seconds

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="loading-wrapper">
      <div className="candy-title">Candy Crush RL</div>

      <div className="candy-loader">
        <div className="candy candy-1">🍬</div>
        <div className="candy candy-2">🍭</div>
        <div className="candy candy-3">🧁</div>
      </div>

      <div className="loading-text">Preparing Your Game...</div>
    </div>
  );
}
