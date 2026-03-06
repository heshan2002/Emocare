import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    email: '',
    password: '',
    medical: '',
    family: '',
    habits: '',
    hobbies: ''
  });
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) return 'Name is required';
    if (!formData.age || formData.age < 0 || formData.age > 120) return 'Valid age is required';
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'Valid email is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Prepare data for backend
      const userData = {
        ...formData,
        age: parseInt(formData.age),
        medical: formData.medical ? formData.medical.split(',').map(m => m.trim()).filter(m => m) : [],
        habits: formData.habits ? formData.habits.split(',').map(h => h.trim()).filter(h => h) : [],
        hobbies: formData.hobbies ? formData.hobbies.split(',').map(h => h.trim()).filter(h => h) : [],
        family: formData.family.trim()
      };

      await axios.post('http://localhost:8000/signup', userData);
      
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error creating account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '500px', 
      margin: '50px auto', 
      padding: '20px',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      borderRadius: '8px'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Create Account</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          name="name"
          placeholder="Full Name *"
          value={formData.name}
          onChange={handleChange}
          required
          style={inputStyle}
        />
        
        <input
          name="age"
          type="number"
          min="0"
          max="120"
          placeholder="Age *"
          value={formData.age}
          onChange={handleChange}
          required
          style={inputStyle}
        />
        
        <input
          name="email"
          type="email"
          placeholder="Email *"
          value={formData.email}
          onChange={handleChange}
          required
          style={inputStyle}
        />
        
        <input
          name="password"
          type="password"
          placeholder="Password (min 6 characters) *"
          value={formData.password}
          onChange={handleChange}
          required
          minLength="6"
          style={inputStyle}
        />
        
        <textarea
          name="medical"
          placeholder="Medical Conditions (comma separated)"
          value={formData.medical}
          onChange={handleChange}
          rows="3"
          style={inputStyle}
        />
        
        <textarea
          name="family"
          placeholder="Family Details"
          value={formData.family}
          onChange={handleChange}
          rows="3"
          style={inputStyle}
        />
        
        <textarea
          name="habits"
          placeholder="Daily Habits (comma separated)"
          value={formData.habits}
          onChange={handleChange}
          rows="3"
          style={inputStyle}
        />
        
        <textarea
          name="hobbies"
          placeholder="Hobbies (comma separated)"
          value={formData.hobbies}
          onChange={handleChange}
          rows="3"
          style={inputStyle}
        />
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
      
      {success && <p style={{ color: 'green', textAlign: 'center', marginTop: '15px' }}>{success}</p>}
      {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '15px' }}>{error}</p>}
      
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

const inputStyle = {
  padding: '12px',
  border: '1px solid #ccc',
  borderRadius: '5px',
  fontSize: '16px',
  fontFamily: 'inherit'
};

const buttonStyle = {
  padding: '12px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer'
};

export default Signup;