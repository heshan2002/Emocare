import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import LoadingPage from './LoadingPage';
import InstructionsPage from './InstructionsPage';

function Root() {
  const [phase, setPhase] = useState('loading'); // loading | instructions | game

  if (phase === 'loading') return <LoadingPage onFinish={() => setPhase('instructions')} />;
  if (phase === 'instructions') return <InstructionsPage onPlay={() => setPhase('game')} />;
  return <App onLogout={() => setPhase('loading')} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);