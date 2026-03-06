import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post('http://localhost:8000/login', {
        email,
        password
      });

      if (res.data.token && res.data.user) {
        onLogin(res.data.token, res.data.user);
        navigate('/chat');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.detail || 
        'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Styles
  const containerStyle = {
    maxWidth: '400px',
    margin: '50px auto',
    padding: '30px',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
    borderRadius: '10px',
    backgroundColor: 'white'
  };

  const titleStyle = {
    textAlign: 'center',
    color: '#333',
    marginBottom: '30px',
    fontSize: '28px'
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const inputStyle = {
    padding: '12px 15px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '16px',
    transition: 'border-color 0.3s'
  };

  const buttonStyle = {
    padding: '12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    transition: 'background-color 0.3s'
  };

  const errorStyle = {
    color: '#f44336',
    textAlign: 'center',
    margin: '10px 0',
    padding: '10px',
    backgroundColor: '#ffebee',
    borderRadius: '5px'
  };

  const linkStyle = {
    textAlign: 'center',
    marginTop: '20px',
    color: '#666'
  };

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Welcome Back! 👋</h2>
      
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
          disabled={loading}
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
          disabled={loading}
        />
        
        <button 
          type="submit" 
          disabled={loading}
          style={buttonStyle}
          onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#45a049')}
          onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#4CAF50')}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      {error && <div style={errorStyle}>{error}</div>}
      
      <div style={linkStyle}>
        Don't have an account? <Link to="/signup" style={{ color: '#4CAF50' }}>Sign Up</Link>
      </div>
    </div>
  );
};

export default Login;