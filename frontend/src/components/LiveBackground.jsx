export default function LiveBackground() {
  return (
    <>
      <div className="live-bg" />
      <div className="live-blob blob1" />
      <div className="live-blob blob2" />
      <div className="live-blob blob3" />

      <style>{css}</style>
    </>
  );
}

const css = `
.live-bg {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #0ea5e9, #6366f1, #22c55e);
  background-size: 300% 300%;
  animation: gradientMove 18s ease infinite;
  z-index: -3;
}

@keyframes gradientMove {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Floating blobs */
.live-blob {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.5;
  z-index: -2;
  animation: floatMove 20s ease-in-out infinite;
}

.blob1 {
  background: #f97316;
  top: -100px;
  left: -100px;
}

.blob2 {
  background: #ec4899;
  bottom: -120px;
  right: -120px;
  animation-delay: 5s;
}

.blob3 {
  background: #22c55e;
  top: 40%;
  left: 50%;
  animation-delay: 10s;
}

@keyframes floatMove {
  0% { transform: translate(0px, 0px) scale(1); }
  50% { transform: translate(40px, -40px) scale(1.1); }
  100% { transform: translate(0px, 0px) scale(1); }
}

/* Respect reduced motion (very important for elders) */
@media (prefers-reduced-motion: reduce) {
  .live-bg, .live-blob {
    animation: none !important;
  }
}
`;