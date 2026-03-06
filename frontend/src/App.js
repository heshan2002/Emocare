import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Chat from './components/Chat';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // Check if token exists in localStorage
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Login page - නැතිනම් chat එකට */}
          <Route 
            path="/login" 
            element={
              token ? 
              <Navigate to="/chat" /> : 
              <Login onLogin={handleLogin} />
            } 
          />
          
          {/* Signup page */}
          <Route 
            path="/signup" 
            element={
              token ? 
              <Navigate to="/chat" /> : 
              <Signup />
            } 
          />
          
          {/* Chat page - token තියෙනවා නම් විතරයි */}
          <Route 
            path="/chat" 
            element={
              token ? 
              <Chat 
                user={user} 
                token={token} 
                onLogout={handleLogout} 
              /> : 
              <Navigate to="/login" />
            } 
          />
          
          {/* Default route - login එකට */}
          <Route 
            path="/" 
            element={<Navigate to="/login" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;