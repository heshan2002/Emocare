import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EmotionProvider } from "./context/EmotionContext";


import Home from "./pages/Home";
import LoginGoogle from "./pages/LoginGoogle";
import Profile from "./pages/Profile";
import FirstDetection from "./pages/FirstDetection";

import EmotionRouter from "./pages/EmotionRouter";

import Happy from "./pages/mood/Happy";
import Sad from "./pages/mood/Sad";
import Angry from "./pages/mood/Angry";
import Neutral from "./pages/mood/Neutral";
import Surprise from "./pages/mood/Surprise";

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <EmotionProvider>
        <EmotionRouter />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginGoogle />} />

          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/first-detection" element={<RequireAuth><FirstDetection /></RequireAuth>} />
      
          <Route path="/mood" element={<RequireAuth><div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#0b1220",color:"#fff"}}>Loading mood…</div></RequireAuth>} />

          <Route path="/mood/happy" element={<RequireAuth><Happy /></RequireAuth>} />
          <Route path="/mood/sad" element={<RequireAuth><Sad /></RequireAuth>} />
          <Route path="/mood/angry" element={<RequireAuth><Angry /></RequireAuth>} />
          <Route path="/mood/neutral" element={<RequireAuth><Neutral /></RequireAuth>} />
          <Route path="/mood/surprise" element={<RequireAuth><Surprise /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </EmotionProvider>
    </BrowserRouter>
  );
}