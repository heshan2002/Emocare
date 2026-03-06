import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import emocareLogo from '../emocare_logo.png';

// Helper function to capitalize first letter
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const Chat = ({ user, token, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedEmotion, setSelectedEmotion] = useState('');
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [chartType, setChartType] = useState('bar');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Common questions/concerns for elderly
  const commonQuestions = [
    "What is diabetes?",
    "How to control blood pressure?",
    "Tips for better sleep",
    "Exercise for seniors",
    "Healthy diet tips",
    "Memory improvement",
    "Joint pain relief",
    "Medication reminders"
  ];

  useEffect(() => {
    if (user) {
      setMessages([{ 
        role: 'assistant', 
        content: `Hello ${user.name}! 👋 How are you feeling today? You can tell me about your emotions or ask me any health-related questions.` 
      }]);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/history', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setHistory(res.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const res = await axios.get('http://localhost:8000/analysis', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalysisData(res.data);
      setShowAnalysis(true);
    } catch (err) {
      console.error('Error fetching analysis:', err);
      alert('Failed to load analysis report. Please try again.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleEmotionClick = async (emotion) => {
    setSelectedEmotion(emotion);
    await submitQuery(emotion, 'emotion');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (userInput.trim()) {
      await submitQuery(userInput.trim(), 'text');
      setUserInput('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setUserInput(suggestion);
    inputRef.current.focus();
  };

  const submitQuery = async (input, type) => {
    let userMessage = '';
    if (type === 'emotion') {
      userMessage = `I am feeling ${capitalize(input)}`;
    } else {
      userMessage = input;
    }
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage 
    }]);
    
    setLoading(true);
    
    try {
      const res = await axios.post('http://localhost:8000/advice', 
        { emotion: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: res.data.answer 
      }]);
      
      const isUnanswerable = res.data.answer.toLowerCase().includes("don't have information") || 
                            res.data.answer.toLowerCase().includes("cannot answer") ||
                            res.data.answer.toLowerCase().includes("not sure");
      
      if (res.data.sources && res.data.sources.length > 0 && !isUnanswerable) {
        const sourcesMsg = '📚 **This advice is based on:**\n' + 
          res.data.sources.map(s => `• ${s.filename} (Page ${s.page})`).join('\n');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: sourcesMsg,
          isSource: true 
        }]);
      }
      
      generateSuggestions(input, res.data.answer);
      fetchHistory();
    } catch (err) {
      console.error('Error getting advice:', err);
      
      let errorMessage = '';
      if (err.response?.status === 400) {
        errorMessage = "I'm here to help with emotions and health questions. Could you please tell me how you're feeling or ask me about health concerns? 😊";
      } else {
        errorMessage = "I'm having trouble connecting right now. Please try again in a moment.";
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = (lastQuery, answer) => {
    const query = lastQuery.toLowerCase();
    let newSuggestions = [];
    
    if (answer && answer.toLowerCase().includes("don't have information")) {
      newSuggestions = [
        "I am feeling sad",
        "I am feeling happy",
        "Tips for better sleep",
        "What is diabetes?"
      ];
    } else if (query.includes('sad') || query.includes('depressed')) {
      newSuggestions = [
        "What activities make you happy?",
        "Would you like to talk about it?",
        "Tips for lifting your mood"
      ];
    } else if (query.includes('diabetes')) {
      newSuggestions = [
        "Foods to avoid with diabetes",
        "Exercise tips for diabetes",
        "Blood sugar monitoring"
      ];
    } else if (query.includes('bp') || query.includes('blood pressure')) {
      newSuggestions = [
        "Foods that lower blood pressure",
        "Relaxation techniques",
        "When to check blood pressure"
      ];
    } else {
      newSuggestions = commonQuestions.slice(0, 4);
    }
    
    setSuggestions(newSuggestions);
    setShowSuggestions(true);
  };

  const loadChatFromHistory = (chatMessages) => {
    setMessages(chatMessages);
  };

  const startNewChat = () => {
    setMessages([{ 
      role: 'assistant', 
      content: `Hello ${user.name}! 👋 How are you feeling today? You can tell me about your emotions or ask me any health-related questions.` 
    }]);
    setShowSuggestions(false);
    setSelectedEmotion('');
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // UPDATED: New emotions list with only Sad, Angry, Neutral, Happy, Surprise
  const emotionsList = [
    { emoji: '😢', name: 'Sad', color: '#64B5F6' },
    { emoji: '😠', name: 'Angry', color: '#E57373' },
    { emoji: '😐', name: 'Neutral', color: '#9E9E9E' },
    { emoji: '😊', name: 'Happy', color: '#4CAF50' },
    { emoji: '😲', name: 'Surprise', color: '#FFB74D' }
  ];

  // Function to format message content with beautiful styling
  const formatMessageContent = (content, isAssistant) => {
    if (!isAssistant) return content;

    const lines = content.split('\n');
    
    return (
      <div style={{ width: '100%' }}>
        {lines.map((line, index) => {
          // Check for bullet points (• or -)
          if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
            return (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '12px',
                marginLeft: '5px'
              }}>
                <span style={{
                  color: '#4CAF50',
                  fontSize: '20px',
                  marginRight: '12px',
                  lineHeight: '1.4',
                  fontWeight: 'bold'
                }}>•</span>
                <span style={{
                  flex: 1,
                  fontSize: '15px',
                  lineHeight: '1.5',
                  color: '#2c3e50'
                }}>
                  {formatBoldText(line.replace('•', '').replace('-', '').trim())}
                </span>
              </div>
            );
          }
          
          // Check for Dear [Name] line
          else if (line.trim().toLowerCase().startsWith('dear')) {
            return (
              <div key={index} style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#2c3e50',
                marginBottom: '15px',
                paddingBottom: '5px',
                borderBottom: '1px dashed #4CAF50'
              }}>
                {formatBoldText(line)}
              </div>
            );
          }
          
          // Check for sign off (Best regards, etc.)
          else if (line.trim().toLowerCase().includes('best regards') || 
                   line.trim().toLowerCase().includes('warm regards') ||
                   line.trim().toLowerCase().includes('take care')) {
            return (
              <div key={index} style={{
                marginTop: '15px',
                marginBottom: '5px',
                fontStyle: 'italic',
                color: '#7f8c8d',
                fontSize: '14px'
              }}>
                {line}
              </div>
            );
          }
          
          // Check for empty lines
          else if (line.trim() === '') {
            return <div key={index} style={{ height: '10px' }} />;
          }
          
          // Regular paragraph
          else {
            return (
              <p key={index} style={{
                margin: '10px 0',
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#2c3e50'
              }}>
                {formatBoldText(line)}
              </p>
            );
          }
        })}
      </div>
    );
  };

  // Function to format bold text (**text**)
  const formatBoldText = (text) => {
    if (!text.includes('**')) return text;
    
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Professional Analysis Modal with Medical Report Style
  const AnalysisModal = ({ show, onClose, data }) => {
    if (!show || !data) return null;

    // Render Bar Chart
    const renderBarChart = () => {
      const chartData = data.emotional_stats.chart_data || {};
      if (Object.keys(chartData).length === 0) {
        return <p style={{ textAlign: 'center', color: '#95a5a6' }}>No emotional data recorded yet</p>;
      }

      const maxPercentage = Math.max(...Object.values(chartData).map(d => d.percentage));

      return (
        <div style={{ marginTop: '30px', overflowX: 'auto', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '250px', gap: '20px', justifyContent: 'center', minWidth: '500px' }}>
            {Object.entries(chartData).map(([emotion, data]) => (
              <div key={emotion} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '70px' }}>
                <div style={{ 
                  height: `${(data.percentage / maxPercentage) * 180}px`, 
                  width: '50px',
                  backgroundColor: data.color,
                  borderRadius: '8px 8px 0 0',
                  transition: 'height 0.5s ease-in-out',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    position: 'absolute',
                    top: '-25px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    backgroundColor: 'white',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {data.percentage}%
                  </span>
                </div>
                <span style={{ 
                  marginTop: '12px', 
                  fontSize: '13px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  textAlign: 'center'
                }}>
                  {emotion}
                </span>
                <span style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '4px' }}>
                  {data.count} {data.count === 1 ? 'time' : 'times'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    // Render Pie Chart
    const renderPieChart = () => {
      const chartData = data.emotional_stats.chart_data || {};
      if (Object.keys(chartData).length === 0) return null;

      let cumulativePercent = 0;
      const pieSlices = Object.entries(chartData).map(([emotion, d]) => {
        const start = cumulativePercent;
        cumulativePercent += d.percentage;
        return { emotion, ...d, start, end: cumulativePercent };
      });

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '20px', flexWrap: 'wrap' }}>
          <div style={{ 
            width: '200px', 
            height: '200px', 
            borderRadius: '50%',
            background: `conic-gradient(${pieSlices.map(s => 
              `${s.color} ${s.start}% ${s.end}%`
            ).join(', ')})`,
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            margin: '20px auto'
          }} />
          <div style={{ minWidth: '200px' }}>
            {pieSlices.map(({ emotion, color, percentage, count }) => (
              <div key={emotion} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: color,
                  borderRadius: '4px',
                  marginRight: '12px',
                  boxShadow: '0 2px 3px rgba(0,0,0,0.1)'
                }} />
                <span style={{ fontSize: '14px', color: '#2c3e50', flex: 1 }}>
                  {emotion}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginRight: '10px' }}>
                  {percentage}%
                </span>
                <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                  ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    // Render Recent Check-ins
    const renderRecentCheckins = () => {
      const recent = data.emotional_stats.recent_checkins || [];
      if (recent.length === 0) return null;

      return (
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ color: '#2c3e50', marginBottom: '15px', fontSize: '16px', borderBottom: '2px solid #4CAF50', paddingBottom: '8px' }}>
            📋 Recent Check-ins
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {recent.slice(-7).reverse().map((item, i) => {
              const emotionColors = {
                'Sad': '#64B5F6',
                'Angry': '#E57373',
                'Neutral': '#9E9E9E',
                'Happy': '#4CAF50',
                'Surprise': '#FFB74D'
              };
              
              return (
                <div key={i} style={{
                  padding: '8px 15px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '25px',
                  border: `2px solid ${emotionColors[item.emotion] || '#e0e0e0'}`,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: '#7f8c8d' }}>{item.date}:</span>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: emotionColors[item.emotion] || '#2c3e50'
                  }}>
                    {item.emotion}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // Render Personalized Recommendations
    const renderRecommendations = () => {
      const recommendations = data.personalized_recommendations || [];
      if (recommendations.length === 0) return null;

      return (
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ color: '#2c3e50', marginBottom: '15px', fontSize: '16px', borderBottom: '2px solid #4CAF50', paddingBottom: '8px' }}>
            💡 Personalized Recommendations Based on Your Profile
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                padding: '18px',
                backgroundColor: rec.category === 'health' ? '#fff8e7' : '#f0f9f0',
                borderRadius: '12px',
                borderLeft: `6px solid ${rec.category === 'health' ? '#f39c12' : '#4CAF50'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{
                    padding: '4px 12px',
                    backgroundColor: rec.category === 'health' ? '#f39c12' : '#4CAF50',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {rec.category === 'health' ? '🏥 Health Tip' : '🎯 Activity Suggestion'}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#2c3e50', lineHeight: '1.6', fontSize: '14px' }}>
                  {rec.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '1000px',
          width: '95%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {/* Medical Report Header with Logo */}
          <div style={{ 
            borderBottom: '2px solid #4CAF50',
            paddingBottom: '15px',
            marginBottom: '25px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={emocareLogo} 
                alt="Emocare Logo" 
                style={{ 
                  width: '50px', 
                  height: '50px',
                  borderRadius: '10px'
                }} 
              />
              <div>
                <h1 style={{ color: '#2c3e50', margin: 0, fontSize: '24px', fontWeight: '600' }}>
                  EMOCARE HEALTH SUMMARY
                </h1>
                <p style={{ margin: '5px 0 0', color: '#7f8c8d', fontSize: '12px' }}>
                  Report ID: EM-{Math.floor(Math.random() * 10000)} • Generated: {data.generated_at}
                </p>
              </div>
            </div>
            <div style={{
              backgroundColor: '#e8f5e9',
              color: '#4CAF50',
              padding: '5px 15px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              border: '1px solid #4CAF50'
            }}>
              ⚕️ CONFIDENTIAL
            </div>
          </div>

          {/* Patient Details Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '25px',
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '10px'
          }}>
            {/* Left Column */}
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '3px' }}>
                  PATIENT NAME
                </label>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
                  {data.patient_info.name}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '3px' }}>
                  AGE
                </label>
                <div style={{ fontSize: '16px', color: '#2c3e50' }}>
                  {data.patient_info.age} years
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '3px' }}>
                  MEDICAL HISTORY
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {data.patient_info.medical.map((condition, i) => (
                    <span key={i} style={{
                      backgroundColor: '#ffebee',
                      color: '#c62828',
                      padding: '4px 10px',
                      borderRadius: '15px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      {condition}
                    </span>
                  ))}
                  {data.patient_info.medical.length === 0 && (
                    <span style={{ color: '#7f8c8d' }}>No reported conditions</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '3px' }}>
                  LIFESTYLE & HABITS
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {data.patient_info.habits.map((habit, i) => (
                    <span key={i} style={{
                      backgroundColor: '#e3f2fd',
                      color: '#1565c0',
                      padding: '4px 10px',
                      borderRadius: '15px',
                      fontSize: '13px'
                    }}>
                      {habit}
                    </span>
                  ))}
                  {data.patient_info.habits.length === 0 && (
                    <span style={{ color: '#7f8c8d' }}>No habits reported</span>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '3px' }}>
                  HOBBIES & INTERESTS
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {data.patient_info.hobbies.map((hobby, i) => (
                    <span key={i} style={{
                      backgroundColor: '#e8f5e9',
                      color: '#2e7d32',
                      padding: '4px 10px',
                      borderRadius: '15px',
                      fontSize: '13px'
                    }}>
                      {hobby}
                    </span>
                  ))}
                  {data.patient_info.hobbies.length === 0 && (
                    <span style={{ color: '#7f8c8d' }}>No hobbies reported</span>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '3px' }}>
                  TOTAL SESSIONS
                </label>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                  {data.emotional_stats.total_checkins} emotional check-ins
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section with Toggle */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '15px',
            padding: '25px',
            marginBottom: '25px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 5px 15px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ color: '#2c3e50', margin: 0, fontSize: '18px' }}>
                📊 EMOTIONAL DISTRIBUTION
              </h3>
              
              {/* Chart Type Selector */}
              <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f0f0f0', padding: '4px', borderRadius: '30px' }}>
                <button 
                  onClick={() => setChartType('bar')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: chartType === 'bar' ? '#4CAF50' : 'transparent',
                    color: chartType === 'bar' ? 'white' : '#2c3e50',
                    border: 'none',
                    borderRadius: '25px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s'
                  }}
                >
                  📊 Bar Chart
                </button>
                <button 
                  onClick={() => setChartType('pie')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: chartType === 'pie' ? '#4CAF50' : 'transparent',
                    color: chartType === 'pie' ? 'white' : '#2c3e50',
                    border: 'none',
                    borderRadius: '25px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s'
                  }}
                >
                  🥧 Pie Chart
                </button>
              </div>
            </div>
            
            {chartType === 'bar' ? renderBarChart() : renderPieChart()}
          </div>

          {/* Emotional Health Indicators */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '15px',
            marginBottom: '25px'
          }}>
            {Object.entries(data.emotional_stats.chart_data || {}).slice(0, 4).map(([emotion, d]) => {
              const emojiMap = {
                'Sad': '😢',
                'Happy': '😊',
                'Angry': '😠',
                'Neutral': '😐',
                'Surprise': '😲'
              };
              
              return (
                <div key={emotion} style={{
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  padding: '15px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>
                    {emojiMap[emotion] || '😐'}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: d.color }}>
                    {d.percentage}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    {emotion}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Check-ins */}
          {renderRecentCheckins()}

          {/* Doctor's Notes */}
          <div style={{
            backgroundColor: '#fff3e0',
            borderLeft: '4px solid #f39c12',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>👨‍⚕️</span>
              <h4 style={{ margin: 0, color: '#e67e22' }}>Clinical Observations</h4>
            </div>
            <p style={{ margin: 0, color: '#2c3e50', lineHeight: '1.6', fontSize: '14px' }}>
              Patient {data.patient_info.name} has completed {data.emotional_stats.total_checkins} emotional wellness sessions.
              {data.patient_info.medical.length > 0 && ` Medical history includes ${data.patient_info.medical.join(' and ')}.`}
              {data.patient_info.habits.length > 0 && ` Daily routine includes ${data.patient_info.habits.join(' and ')}.`}
              {data.patient_info.hobbies.length > 0 && ` Shows interest in ${data.patient_info.hobbies.join(' and ')}.`}
            </p>
          </div>

          {/* Vital Signs Style Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>EMOTIONAL WELLNESS</div>
              <div style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: Object.keys(data.emotional_stats.chart_data || {}).length > 0 ? 
                  (Object.entries(data.emotional_stats.chart_data).some(([e]) => e === 'Happy') ? '#4CAF50' : '#f39c12') 
                  : '#7f8c8d'
              }}>
                {Object.keys(data.emotional_stats.chart_data || {}).length > 0 ? 
                  Math.round(Object.values(data.emotional_stats.chart_data).reduce((acc, curr) => {
                    if (curr.emotion === 'Happy') return acc + curr.percentage;
                    return acc;
                  }, 0)) : 0}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>ENGAGEMENT LEVEL</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3498db' }}>
                {data.emotional_stats.total_checkins > 10 ? 'High' : 
                 data.emotional_stats.total_checkins > 5 ? 'Medium' : 'Moderate'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>LAST ACTIVE</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#9b59b6' }}>
                {data.emotional_stats.recent_checkins && data.emotional_stats.recent_checkins.length > 0 
                  ? data.emotional_stats.recent_checkins[data.emotional_stats.recent_checkins.length - 1].date 
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* Personalized Recommendations */}
          {renderRecommendations()}

          {/* Footer with Signature */}
          <div style={{
            borderTop: '1px dashed #e0e0e0',
            paddingTop: '20px',
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#95a5a6' }}>
              <span style={{ fontWeight: 'bold' }}>Electronically Generated Report</span> • For medical use only
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                Attending: Dr. EmoCare AI
              </div>
              <div style={{
                width: '100px',
                height: '30px',
                background: 'repeating-linear-gradient(45deg, #4CAF50, #4CAF50 10px, #45a049 10px, #45a049 20px)',
                borderRadius: '5px',
                opacity: 0.3
              }} />
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button
              onClick={() => {
                const reportText = `
EMOCARE HEALTH SUMMARY
Generated: ${data.generated_at}

PATIENT: ${data.patient_info.name} (Age: ${data.patient_info.age})
Medical: ${data.patient_info.medical.join(', ')}
Habits: ${data.patient_info.habits.join(', ')}
Hobbies: ${data.patient_info.hobbies.join(', ')}

EMOTIONAL DISTRIBUTION:
${Object.entries(data.emotional_stats.chart_data).map(([e, d]) => `${e}: ${d.percentage}% (${d.count} times)`).join('\n')}

PERSONALIZED RECOMMENDATIONS:
${data.personalized_recommendations.map(r => `• ${r.text}`).join('\n')}
                `;
                navigator.clipboard.writeText(reportText);
                alert('📋 Report copied to clipboard!');
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
            >
              📋 Copy Report
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '12px 30px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar History */}
      <div style={{ 
        width: '300px', 
        borderRight: '1px solid #e0e0e0', 
        padding: '20px',
        backgroundColor: '#f8f9fa',
        overflowY: 'auto',
        boxShadow: '2px 0 5px rgba(0,0,0,0.05)'
      }}>
        {/* Emocare Logo - Image */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '30px',
          padding: '15px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          <img 
            src={emocareLogo} 
            alt="Emocare Logo" 
            style={{ 
              maxWidth: '180px', 
              maxHeight: '80px',
              objectFit: 'contain'
            }} 
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={startNewChat}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
          >
            ✨ New Chat
          </button>
          
          <button 
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.3s',
              marginBottom: '10px'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#d32f2f'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#f44336'}
          >
            🚪 Logout
          </button>

          {/* Analysis Button */}
          <button
            onClick={fetchAnalysis}
            disabled={loadingAnalysis}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#9b59b6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loadingAnalysis ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: loadingAnalysis ? 0.6 : 1,
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!loadingAnalysis) {
                e.target.style.backgroundColor = '#8e44ad';
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingAnalysis) {
                e.target.style.backgroundColor = '#9b59b6';
              }
            }}
          >
            {loadingAnalysis ? '📊 Loading...' : '📊 View Analysis Report'}
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#95a5a6',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px'
          }}>
            No chat history yet
          </div>
        ) : (
          history.map((entry, i) => (
            <button 
              key={i} 
              onClick={() => loadChatFromHistory(entry.messages)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                margin: '8px 0',
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f1f8e9';
                e.target.style.borderColor = '#4CAF50';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = '#e0e0e0';
              }}
            >
              <strong style={{ color: '#2c3e50' }}>{entry.emotion}</strong>
              <br />
              <small style={{ color: '#7f8c8d' }}>{formatTimestamp(entry.timestamp)}</small>
            </button>
          ))
        )}
      </div>

      {/* Main Chat Area */}
      <div style={{ 
        flex: 1, 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#ffffff'
      }}>
        {/* Header with Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          borderBottom: '2px solid #4CAF50',
          paddingBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img 
              src={emocareLogo} 
              alt="Emocare Logo" 
              style={{ 
                width: '40px', 
                height: '40px',
                objectFit: 'contain'
              }} 
            />
            <span style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#4CAF50'
            }}>
              Emocare
            </span>
          </div>
          <h2 style={{ 
            color: '#2c3e50',
            fontSize: '1.5rem',
            margin: 0
          }}>
            Hello {user?.name} 💙
          </h2>
        </div>
        
        {/* Messages Container */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto', 
          padding: '20px',
          marginBottom: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '10px',
          border: '1px solid #e0e0e0'
        }}>
          {messages.map((msg, i) => (
            <div 
              key={i} 
              style={{
                marginBottom: '20px',
                textAlign: msg.role === 'user' ? 'right' : 'left',
                animation: 'fadeIn 0.3s'
              }}
            >
              {/* Message Bubble */}
              <div style={{
                display: 'inline-block',
                maxWidth: '80%',
                padding: msg.role === 'user' ? '12px 18px' : '20px 25px',
                borderRadius: msg.role === 'user' ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                backgroundColor: msg.role === 'user' ? '#4CAF50' : '#ffffff',
                color: msg.role === 'user' ? 'white' : '#2c3e50',
                boxShadow: msg.role === 'user' 
                  ? '0 2px 5px rgba(76, 175, 80, 0.3)' 
                  : '0 3px 10px rgba(0,0,0,0.1)',
                border: msg.role === 'user' ? 'none' : '1px solid #e0e0e0',
                width: msg.role === 'assistant' ? '100%' : 'auto'
              }}>
                {/* Sender Name with Avatar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none'
                }}>
                  <span style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : '#e8f5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </span>
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: msg.role === 'user' ? 'white' : '#4CAF50'
                  }}>
                    {msg.role === 'user' ? 'You' : 'Emocare'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    marginLeft: 'auto',
                    opacity: 0.6,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#95a5a6'
                  }}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {/* Message Content with Beautiful Formatting */}
                <div style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: msg.role === 'user' ? 'white' : '#2c3e50'
                }}>
                  {msg.role === 'assistant' ? (
                    formatMessageContent(msg.content, true)
                  ) : (
                    <div style={{ fontWeight: '500' }}>{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              color: '#7f8c8d',
              padding: '20px'
            }}>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              Emocare is thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Emotion Buttons */}
        <h4 style={{ 
          marginBottom: '10px', 
          color: '#2c3e50',
          fontSize: '1rem'
        }}>
          How are you feeling today?
        </h4>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '10px',
          marginBottom: '15px',
          justifyContent: 'center'
        }}>
          {emotionsList.map((emo, i) => (
            <button
              key={i}
              onClick={() => handleEmotionClick(emo.name.toLowerCase())}
              style={{
                padding: '12px 20px',
                backgroundColor: selectedEmotion === emo.name.toLowerCase() ? emo.color : '#f0f0f0',
                border: 'none',
                borderRadius: '30px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: selectedEmotion === emo.name.toLowerCase() ? 'bold' : '500',
                transition: 'all 0.3s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                color: selectedEmotion === emo.name.toLowerCase() ? 'white' : '#2c3e50',
                minWidth: '100px'
              }}
              onMouseEnter={(e) => {
                if (selectedEmotion !== emo.name.toLowerCase()) {
                  e.target.style.backgroundColor = '#e0e0e0';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedEmotion !== emo.name.toLowerCase()) {
                  e.target.style.backgroundColor = '#f0f0f0';
                }
              }}
            >
              <span style={{ marginRight: '8px', fontSize: '18px' }}>{emo.emoji}</span>
              {emo.name}
            </button>
          ))}
        </div>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <p style={{ color: '#7f8c8d', fontSize: '13px', marginBottom: '8px' }}>
              You might also want to know:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4CAF50',
                    borderRadius: '15px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#2c3e50',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#c8e6c9'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#e8f5e9'}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message here... (e.g., I feel sad, What is diabetes?)"
            style={{
              flex: 1,
              padding: '15px',
              border: '2px solid #e0e0e0',
              borderRadius: '25px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#4CAF50'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
          <button
            type="submit"
            disabled={loading || !userInput.trim()}
            style={{
              padding: '15px 30px',
              backgroundColor: loading || !userInput.trim() ? '#b0bec5' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: loading || !userInput.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !userInput.trim() ? 0.6 : 1,
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!loading && userInput.trim()) {
                e.target.style.backgroundColor = '#45a049';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && userInput.trim()) {
                e.target.style.backgroundColor = '#4CAF50';
              }
            }}
          >
            Send 📤
          </button>
        </form>
      </div>

      {/* Analysis Modal */}
      <AnalysisModal 
        show={showAnalysis} 
        onClose={() => setShowAnalysis(false)} 
        data={analysisData} 
      />

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .typing-indicator {
          display: inline-block;
          margin-right: 5px;
        }
        
        .typing-indicator span {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #4CAF50;
          margin: 0 2px;
          animation: typing 1s infinite;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default Chat;