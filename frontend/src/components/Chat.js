import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import emocareLogo from '../emocare_logo.png';

// Helper function to capitalize first letter
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Helper function to group history by date
const groupHistoryByDate = (history) => {
  const groups = {
    today: [],
    yesterday: [],
    earlier: []
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  history.forEach(entry => {
    const entryDate = new Date(entry.timestamp);
    entryDate.setHours(0, 0, 0, 0);

    if (entryDate.getTime() === today.getTime()) {
      groups.today.push(entry);
    } else if (entryDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(entry);
    } else {
      groups.earlier.push(entry);
    }
  });

  return groups;
};

// Format date for display
const formatGroupDate = (date) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(date).toLocaleDateString(undefined, options);
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
  const [isDarkMode, setIsDarkMode] = useState(true); // Default dark mode
  
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

  // Theme colors
  const theme = {
    dark: {
      background: 'linear-gradient(135deg, #1E1E1E 0%, #121212 100%)',
      sidebarBg: 'linear-gradient(180deg, #1A1A1A 0%, #121212 100%)',
      cardBg: '#2D2D2D',
      border: '#404040',
      text: '#FFFFFF',
      textSecondary: '#E0E0E0',
      textMuted: '#9E9E9E',
      accent: '#BB86FC',
      accentHover: '#9D6FCC',
      userMessage: 'linear-gradient(135deg, #BB86FC 0%, #9D6FCC 100%)',
      userMessageText: '#121212',
      assistantMessage: '#2D2D2D',
      inputBg: '#2D2D2D',
      inputBorder: '#404040',
      inputFocusBorder: '#BB86FC',
      buttonNewChat: 'linear-gradient(135deg, #BB86FC 0%, #9D6FCC 100%)',
      buttonLogout: 'linear-gradient(135deg, #CF6679 0%, #B0003A 100%)',
      buttonAnalysis: 'linear-gradient(135deg, #03DAC6 0%, #018786 100%)',
      shadow: '0 4px 15px rgba(0,0,0,0.5)',
      hoverBg: '#3D3D3D'
    },
    light: {
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e9edf5 100%)',
      sidebarBg: '#f8f9fa',
      cardBg: '#ffffff',
      border: '#e0e0e0',
      text: '#2d3436',
      textSecondary: '#2c3e50',
      textMuted: '#7f8c8d',
      accent: '#6C5CE7',
      accentHover: '#5b4bc4',
      userMessage: 'linear-gradient(135deg, #6C5CE7 0%, #a55eea 100%)',
      userMessageText: '#ffffff',
      assistantMessage: '#ffffff',
      inputBg: '#ffffff',
      inputBorder: '#e0e0e0',
      inputFocusBorder: '#6C5CE7',
      buttonNewChat: 'linear-gradient(135deg, #6C5CE7 0%, #a55eea 100%)',
      buttonLogout: 'linear-gradient(135deg, #f44336 0%, #e74c3c 100%)',
      buttonAnalysis: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
      shadow: '0 4px 15px rgba(0,0,0,0.1)',
      hoverBg: '#f1f8e9'
    }
  };

  const currentTheme = isDarkMode ? theme.dark : theme.light;

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

  // Toggle theme function
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
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
                  color: currentTheme.accent,
                  fontSize: '20px',
                  marginRight: '12px',
                  lineHeight: '1.4',
                  fontWeight: 'bold'
                }}>•</span>
                <span style={{
                  flex: 1,
                  fontSize: '15px',
                  lineHeight: '1.5',
                  color: isDarkMode ? '#E0E0E0' : '#2d3436'
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
                color: isDarkMode ? '#FFFFFF' : '#2d3436',
                marginBottom: '15px',
                paddingBottom: '5px',
                borderBottom: `1px dashed ${currentTheme.accent}`
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
                color: currentTheme.textMuted,
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
                color: isDarkMode ? '#E0E0E0' : '#2d3436'
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
        return <p style={{ textAlign: 'center', color: currentTheme.textMuted }}>No emotional data recorded yet</p>;
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
                  boxShadow: isDarkMode ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
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
                    color: isDarkMode ? '#FFFFFF' : '#2d3436',
                    backgroundColor: isDarkMode ? '#2D2D2D' : 'white',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {data.percentage}%
                  </span>
                </div>
                <span style={{ 
                  marginTop: '12px', 
                  fontSize: '13px', 
                  fontWeight: 'bold',
                  color: isDarkMode ? '#FFFFFF' : '#2d3436',
                  textAlign: 'center'
                }}>
                  {emotion}
                </span>
                <span style={{ fontSize: '11px', color: currentTheme.textMuted, marginTop: '4px' }}>
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
            boxShadow: isDarkMode ? '0 4px 15px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.2)',
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
                  boxShadow: isDarkMode ? '0 2px 3px rgba(0,0,0,0.3)' : '0 2px 3px rgba(0,0,0,0.1)'
                }} />
                <span style={{ fontSize: '14px', color: isDarkMode ? '#FFFFFF' : '#2d3436', flex: 1 }}>
                  {emotion}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: isDarkMode ? '#FFFFFF' : '#2d3436', marginRight: '10px' }}>
                  {percentage}%
                </span>
                <span style={{ fontSize: '12px', color: currentTheme.textMuted }}>
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
          <h4 style={{ color: isDarkMode ? '#FFFFFF' : '#2d3436', marginBottom: '15px', fontSize: '16px', borderBottom: `2px solid ${currentTheme.accent}`, paddingBottom: '8px' }}>
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
                  backgroundColor: isDarkMode ? '#2D2D2D' : '#f8f9fa',
                  borderRadius: '25px',
                  border: `2px solid ${emotionColors[item.emotion] || (isDarkMode ? '#404040' : '#e0e0e0')}`,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: currentTheme.textMuted }}>{item.date}:</span>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: emotionColors[item.emotion] || (isDarkMode ? '#FFFFFF' : '#2d3436')
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
          <h4 style={{ color: isDarkMode ? '#FFFFFF' : '#2d3436', marginBottom: '15px', fontSize: '16px', borderBottom: `2px solid ${currentTheme.accent}`, paddingBottom: '8px' }}>
            💡 Personalized Recommendations Based on Your Profile
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                padding: '18px',
                backgroundColor: isDarkMode 
                  ? (rec.category === 'health' ? '#3D2E1C' : '#2D2D2D')
                  : (rec.category === 'health' ? '#fff8e7' : '#f8f9fa'),
                borderRadius: '12px',
                borderLeft: `6px solid ${rec.category === 'health' ? '#f39c12' : currentTheme.accent}`,
                boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{
                    padding: '4px 12px',
                    backgroundColor: rec.category === 'health' ? '#f39c12' : currentTheme.accent,
                    color: isDarkMode ? '#121212' : 'white',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {rec.category === 'health' ? '🏥 Health Tip' : '🎯 Activity Suggestion'}
                  </span>
                </div>
                <p style={{ margin: 0, color: isDarkMode ? '#E0E0E0' : '#2d3436', lineHeight: '1.6', fontSize: '14px' }}>
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
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: isDarkMode ? '#1E1E1E' : 'white',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '1000px',
          width: '95%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: isDarkMode ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease-out',
          border: isDarkMode ? '1px solid #333333' : 'none'
        }}>
          {/* Medical Report Header with Logo */}
          <div style={{ 
            borderBottom: `2px solid ${currentTheme.accent}`,
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
                  borderRadius: '10px',
                  filter: isDarkMode ? 'brightness(1.2)' : 'none'
                }} 
              />
              <div>
                <h1 style={{ color: isDarkMode ? '#FFFFFF' : '#2d3436', margin: 0, fontSize: '24px', fontWeight: '600' }}>
                  EMOCARE HEALTH SUMMARY
                </h1>
                <p style={{ margin: '5px 0 0', color: currentTheme.textMuted, fontSize: '12px' }}>
                  Report ID: EM-{Math.floor(Math.random() * 10000)} • Generated: {data.generated_at}
                </p>
              </div>
            </div>
            <div style={{
              backgroundColor: isDarkMode ? '#2D2D2D' : '#f8f9fa',
              color: currentTheme.accent,
              padding: '5px 15px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              border: `1px solid ${currentTheme.accent}`
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
            backgroundColor: isDarkMode ? '#2D2D2D' : '#f8f9fa',
            padding: '20px',
            borderRadius: '10px',
            border: isDarkMode ? '1px solid #404040' : 'none'
          }}>
            {/* Left Column */}
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: currentTheme.textMuted, display: 'block', marginBottom: '3px' }}>
                  PATIENT NAME
                </label>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#FFFFFF' : '#2d3436' }}>
                  {data.patient_info.name}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: currentTheme.textMuted, display: 'block', marginBottom: '3px' }}>
                  AGE
                </label>
                <div style={{ fontSize: '16px', color: isDarkMode ? '#FFFFFF' : '#2d3436' }}>
                  {data.patient_info.age} years
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: currentTheme.textMuted, display: 'block', marginBottom: '3px' }}>
                  MEDICAL HISTORY
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {data.patient_info.medical.map((condition, i) => (
                    <span key={i} style={{
                      backgroundColor: isDarkMode ? '#4A2C2C' : '#ffebee',
                      color: isDarkMode ? '#FF8A80' : '#c62828',
                      padding: '4px 10px',
                      borderRadius: '15px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      {condition}
                    </span>
                  ))}
                  {data.patient_info.medical.length === 0 && (
                    <span style={{ color: currentTheme.textMuted }}>No reported conditions</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: currentTheme.textMuted, display: 'block', marginBottom: '3px' }}>
                  LIFESTYLE & HABITS
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {data.patient_info.habits.map((habit, i) => (
                    <span key={i} style={{
                      backgroundColor: isDarkMode ? '#1E3A5F' : '#e3f2fd',
                      color: isDarkMode ? '#82B1FF' : '#1565c0',
                      padding: '4px 10px',
                      borderRadius: '15px',
                      fontSize: '13px'
                    }}>
                      {habit}
                    </span>
                  ))}
                  {data.patient_info.habits.length === 0 && (
                    <span style={{ color: currentTheme.textMuted }}>No habits reported</span>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: currentTheme.textMuted, display: 'block', marginBottom: '3px' }}>
                  HOBBIES & INTERESTS
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {data.patient_info.hobbies.map((hobby, i) => (
                    <span key={i} style={{
                      backgroundColor: isDarkMode ? '#1E3A2C' : '#e8f5e9',
                      color: isDarkMode ? '#81C784' : '#2e7d32',
                      padding: '4px 10px',
                      borderRadius: '15px',
                      fontSize: '13px'
                    }}>
                      {hobby}
                    </span>
                  ))}
                  {data.patient_info.hobbies.length === 0 && (
                    <span style={{ color: currentTheme.textMuted }}>No hobbies reported</span>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: currentTheme.textMuted, display: 'block', marginBottom: '3px' }}>
                  TOTAL SESSIONS
                </label>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#FFFFFF' : '#2d3436' }}>
                  {data.emotional_stats.total_checkins} emotional check-ins
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section with Toggle */}
          <div style={{
            backgroundColor: isDarkMode ? '#2D2D2D' : 'white',
            borderRadius: '15px',
            padding: '25px',
            marginBottom: '25px',
            border: isDarkMode ? '1px solid #404040' : '1px solid #e0e0e0',
            boxShadow: isDarkMode ? '0 5px 15px rgba(0,0,0,0.3)' : '0 5px 15px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ color: isDarkMode ? '#FFFFFF' : '#2d3436', margin: 0, fontSize: '18px' }}>
                📊 EMOTIONAL DISTRIBUTION
              </h3>
              
              {/* Chart Type Selector */}
              <div style={{ display: 'flex', gap: '8px', backgroundColor: isDarkMode ? '#1E1E1E' : '#f0f0f0', padding: '4px', borderRadius: '30px' }}>
                <button 
                  onClick={() => setChartType('bar')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: chartType === 'bar' ? currentTheme.accent : 'transparent',
                    color: chartType === 'bar' ? (isDarkMode ? '#121212' : 'white') : (isDarkMode ? '#FFFFFF' : '#2d3436'),
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
                    backgroundColor: chartType === 'pie' ? currentTheme.accent : 'transparent',
                    color: chartType === 'pie' ? (isDarkMode ? '#121212' : 'white') : (isDarkMode ? '#FFFFFF' : '#2d3436'),
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
                  backgroundColor: isDarkMode ? '#2D2D2D' : 'white',
                  border: isDarkMode ? '1px solid #404040' : '1px solid #e0e0e0',
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
                  <div style={{ fontSize: '12px', color: currentTheme.textMuted }}>
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
            backgroundColor: isDarkMode ? '#2D2D2D' : '#f8f9fa',
            borderLeft: `4px solid ${currentTheme.accent}`,
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: isDarkMode ? '1px solid #404040' : 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>👨‍⚕️</span>
              <h4 style={{ margin: 0, color: currentTheme.accent }}>Clinical Observations</h4>
            </div>
            <p style={{ margin: 0, color: isDarkMode ? '#E0E0E0' : '#2d3436', lineHeight: '1.6', fontSize: '14px' }}>
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
              <div style={{ fontSize: '12px', color: currentTheme.textMuted, marginBottom: '5px' }}>EMOTIONAL WELLNESS</div>
              <div style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: Object.keys(data.emotional_stats.chart_data || {}).length > 0 ? 
                  (Object.entries(data.emotional_stats.chart_data).some(([e]) => e === 'Happy') ? '#4CAF50' : '#f39c12') 
                  : currentTheme.textMuted
              }}>
                {Object.keys(data.emotional_stats.chart_data || {}).length > 0 ? 
                  Math.round(Object.values(data.emotional_stats.chart_data).reduce((acc, curr) => {
                    if (curr.emotion === 'Happy') return acc + curr.percentage;
                    return acc;
                  }, 0)) : 0}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: currentTheme.textMuted, marginBottom: '5px' }}>ENGAGEMENT LEVEL</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#64B5F6' }}>
                {data.emotional_stats.total_checkins > 10 ? 'High' : 
                 data.emotional_stats.total_checkins > 5 ? 'Medium' : 'Moderate'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: currentTheme.textMuted, marginBottom: '5px' }}>LAST ACTIVE</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#CE93D8' }}>
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
            borderTop: isDarkMode ? '1px dashed #404040' : '1px dashed #e0e0e0',
            paddingTop: '20px',
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '12px', color: currentTheme.textMuted }}>
              <span style={{ fontWeight: 'bold' }}>Electronically Generated Report</span> • For medical use only
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '12px', color: currentTheme.textMuted }}>
                Attending: Dr. EmoCare AI
              </div>
              <div style={{
                width: '100px',
                height: '30px',
                background: `repeating-linear-gradient(45deg, ${currentTheme.accent}, ${currentTheme.accent} 10px, ${currentTheme.accentHover} 10px, ${currentTheme.accentHover} 20px)`,
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
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
            >
              📋 Copy Report
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '12px 30px',
                backgroundColor: currentTheme.accent,
                color: isDarkMode ? '#121212' : 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = currentTheme.accentHover}
              onMouseLeave={(e) => e.target.style.backgroundColor = currentTheme.accent}
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
      {/* Sidebar History - Theme based */}
      <div style={{ 
        width: '300px', 
        borderRight: `1px solid ${currentTheme.border}`, 
        padding: '20px',
        background: isDarkMode ? currentTheme.sidebarBg : currentTheme.sidebarBg,
        overflowY: 'auto',
        boxShadow: currentTheme.shadow
      }}>
        {/* Emocare Logo - Image */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '30px',
          padding: '20px',
          //backgroundColor: currentTheme.cardBg,
          //borderRadius: '15px',
          //border: `1px solid ${currentTheme.border}`
        }}>
          <img 
            src={emocareLogo} 
            alt="Emocare Logo" 
            style={{ 
              maxWidth: '250px', 
              maxHeight: '150px',
              objectFit: 'contain',
              filter: isDarkMode ? 'brightness(1.2)' : 'none'
            }} 
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme}
            style={{
              width: '100%',
              padding: '14px',
              background: isDarkMode ? '#2D2D2D' : '#e0e0e0',
              color: isDarkMode ? '#BB86FC' : '#2d3436',
              border: `2px solid ${currentTheme.accent}`,
              borderRadius: '10px',
              cursor: 'pointer',
              marginBottom: '12px',
              fontSize: '15px',
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = currentTheme.accent;
              e.target.style.color = isDarkMode ? '#121212' : 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = isDarkMode ? '#2D2D2D' : '#e0e0e0';
              e.target.style.color = isDarkMode ? '#BB86FC' : '#2d3436';
            }}
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          <button 
            onClick={startNewChat}
            style={{
              width: '100%',
              padding: '14px',
              background: currentTheme.buttonNewChat,
              color: isDarkMode ? '#121212' : 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              marginBottom: '12px',
              fontSize: '15px',
              fontWeight: 'bold',
              boxShadow: currentTheme.shadow,
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = isDarkMode ? '0 6px 20px rgba(187, 134, 252, 0.5)' : '0 6px 20px rgba(108, 92, 231, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = currentTheme.shadow;
            }}
          >
            ✨ New Chat
          </button>
          
          <button 
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '14px',
              background: currentTheme.buttonLogout,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 'bold',
              boxShadow: currentTheme.shadow,
              transition: 'all 0.3s',
              marginBottom: '12px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = isDarkMode ? '0 6px 20px rgba(207, 102, 121, 0.5)' : '0 6px 20px rgba(244, 67, 54, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = currentTheme.shadow;
            }}
          >
            🚪 Logout
          </button>

          {/* Analysis Button */}
          <button
            onClick={fetchAnalysis}
            disabled={loadingAnalysis}
            style={{
              width: '100%',
              padding: '14px',
              background: currentTheme.buttonAnalysis,
              color: isDarkMode ? '#121212' : 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: loadingAnalysis ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: 'bold',
              opacity: loadingAnalysis ? 0.6 : 1,
              boxShadow: currentTheme.shadow,
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!loadingAnalysis) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = isDarkMode ? '0 6px 20px rgba(3, 218, 198, 0.5)' : '0 6px 20px rgba(155, 89, 182, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingAnalysis) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = currentTheme.shadow;
              }
            }}
          >
            {loadingAnalysis ? '📊 Loading...' : '📊 View Analysis Report'}
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: currentTheme.textMuted,
            padding: '20px',
            backgroundColor: currentTheme.cardBg,
            borderRadius: '10px',
            border: `1px solid ${currentTheme.border}`
          }}>
            No chat history yet
          </div>
        ) : (
          <>
            {(() => {
              const groupedHistory = groupHistoryByDate(history);
              
              return (
                <>
                  {/* Today */}
                  {groupedHistory.today.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: currentTheme.accent,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '10px',
                        paddingLeft: '5px'
                      }}>
                        📅 Today
                      </div>
                      {groupedHistory.today.map((entry, i) => (
                        <button 
                          key={`today-${i}`} 
                          onClick={() => loadChatFromHistory(entry.messages)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '14px',
                            margin: '8px 0',
                            backgroundColor: currentTheme.cardBg,
                            border: `1px solid ${currentTheme.border}`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.3s',
                            color: currentTheme.text
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = currentTheme.hoverBg;
                            e.target.style.borderColor = currentTheme.accent;
                            e.target.style.transform = 'translateX(5px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = currentTheme.cardBg;
                            e.target.style.borderColor = currentTheme.border;
                            e.target.style.transform = 'translateX(0)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>
                              {entry.emotion?.toLowerCase() === 'happy' ? '😊' : 
                               entry.emotion?.toLowerCase() === 'sad' ? '😢' :
                               entry.emotion?.toLowerCase() === 'angry' ? '😠' :
                               entry.emotion?.toLowerCase() === 'surprise' ? '😲' : '😐'}
                            </span>
                            <strong style={{ color: currentTheme.text, flex: 1 }}>
                              {entry.emotion ? capitalize(entry.emotion) : 'Chat'}
                            </strong>
                          </div>
                          <small style={{ color: currentTheme.textMuted, display: 'block', marginTop: '5px' }}>
                            {formatTimestamp(entry.timestamp)}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Yesterday */}
                  {groupedHistory.yesterday.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: currentTheme.accent,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '10px',
                        paddingLeft: '5px'
                      }}>
                        📅 Yesterday
                      </div>
                      {groupedHistory.yesterday.map((entry, i) => (
                        <button 
                          key={`yesterday-${i}`} 
                          onClick={() => loadChatFromHistory(entry.messages)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '14px',
                            margin: '8px 0',
                            backgroundColor: currentTheme.cardBg,
                            border: `1px solid ${currentTheme.border}`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.3s',
                            color: currentTheme.text
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = currentTheme.hoverBg;
                            e.target.style.borderColor = currentTheme.accent;
                            e.target.style.transform = 'translateX(5px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = currentTheme.cardBg;
                            e.target.style.borderColor = currentTheme.border;
                            e.target.style.transform = 'translateX(0)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>
                              {entry.emotion?.toLowerCase() === 'happy' ? '😊' : 
                               entry.emotion?.toLowerCase() === 'sad' ? '😢' :
                               entry.emotion?.toLowerCase() === 'angry' ? '😠' :
                               entry.emotion?.toLowerCase() === 'surprise' ? '😲' : '😐'}
                            </span>
                            <strong style={{ color: currentTheme.text, flex: 1 }}>
                              {entry.emotion ? capitalize(entry.emotion) : 'Chat'}
                            </strong>
                          </div>
                          <small style={{ color: currentTheme.textMuted, display: 'block', marginTop: '5px' }}>
                            {formatTimestamp(entry.timestamp)}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Earlier */}
                  {groupedHistory.earlier.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: currentTheme.accent,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '10px',
                        paddingLeft: '5px'
                      }}>
                        📅 Earlier
                      </div>
                      {groupedHistory.earlier.map((entry, i) => {
                        const entryDate = new Date(entry.timestamp);
                        return (
                          <button 
                            key={`earlier-${i}`} 
                            onClick={() => loadChatFromHistory(entry.messages)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '14px',
                              margin: '8px 0',
                              backgroundColor: currentTheme.cardBg,
                              border: `1px solid ${currentTheme.border}`,
                              borderRadius: '10px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.3s',
                              color: currentTheme.text
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = currentTheme.hoverBg;
                              e.target.style.borderColor = currentTheme.accent;
                              e.target.style.transform = 'translateX(5px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = currentTheme.cardBg;
                              e.target.style.borderColor = currentTheme.border;
                              e.target.style.transform = 'translateX(0)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '16px' }}>
                                {entry.emotion?.toLowerCase() === 'happy' ? '😊' : 
                                 entry.emotion?.toLowerCase() === 'sad' ? '😢' :
                                 entry.emotion?.toLowerCase() === 'angry' ? '😠' :
                                 entry.emotion?.toLowerCase() === 'surprise' ? '😲' : '😐'}
                              </span>
                              <strong style={{ color: currentTheme.text, flex: 1 }}>
                                {entry.emotion ? capitalize(entry.emotion) : 'Chat'}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                              <small style={{ color: currentTheme.textMuted }}>
                                {formatGroupDate(entryDate)}
                              </small>
                              <small style={{ color: currentTheme.textMuted }}>
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* Main Chat Area - Theme based */}
      <div style={{ 
        flex: 1, 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column',
        background: currentTheme.background
      }}>
        {/* Header with Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          borderBottom: `2px solid ${currentTheme.accent}`,
          paddingBottom: '15px',
          background: currentTheme.cardBg,
          padding: '15px 25px',
          borderRadius: '15px',
          boxShadow: currentTheme.shadow,
          border: `1px solid ${currentTheme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img 
              src={emocareLogo} 
              alt="Emocare Logo" 
              style={{ 
                width: '45px', 
                height: '45px',
                objectFit: 'contain',
                filter: isDarkMode ? 'brightness(1.2)' : 'none'
              }} 
            />
            <span style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: currentTheme.accent
            }}>
               Hello {user?.name} 💙
            </span>
          </div>
          <h2 style={{ 
            color: currentTheme.text,
            fontSize: '1.5rem',
            margin: 0
          }}>
           
          </h2>
        </div>
        
        {/* Messages Container - Theme based */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto', 
          padding: '25px',
          marginBottom: '20px',
          background: currentTheme.cardBg,
          borderRadius: '15px',
          border: `1px solid ${currentTheme.border}`,
          boxShadow: currentTheme.shadow
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
                background: msg.role === 'user' 
                  ? currentTheme.userMessage
                  : currentTheme.assistantMessage,
                color: msg.role === 'user' ? currentTheme.userMessageText : currentTheme.text,
                boxShadow: msg.role === 'user' 
                  ? `0 4px 15px ${isDarkMode ? 'rgba(187, 134, 252, 0.3)' : 'rgba(108, 92, 231, 0.3)'}` 
                  : currentTheme.shadow,
                border: msg.role === 'user' ? 'none' : `1px solid ${currentTheme.border}`,
                width: msg.role === 'assistant' ? '100%' : 'auto'
              }}>
                {/* Sender Name with Avatar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: msg.role === 'assistant' ? `1px solid ${currentTheme.border}` : 'none'
                }}>
                  <span style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: msg.role === 'user' ? 'rgba(18,18,18,0.2)' : (isDarkMode ? '#404040' : '#f0f3ff'),
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
                    color: msg.role === 'user' ? currentTheme.userMessageText : currentTheme.accent
                  }}>
                    {msg.role === 'user' ? 'You' : 'Emocare'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    marginLeft: 'auto',
                    opacity: 0.6,
                    color: msg.role === 'user' ? currentTheme.userMessageText : currentTheme.textMuted
                  }}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {/* Message Content with Beautiful Formatting */}
                <div style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: msg.role === 'user' ? currentTheme.userMessageText : (isDarkMode ? '#E0E0E0' : '#2d3436')
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
              color: currentTheme.accent,
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
          color: currentTheme.text,
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
                background: selectedEmotion === emo.name.toLowerCase() 
                  ? `linear-gradient(135deg, ${emo.color} 0%, ${emo.color}dd 100%)`
                  : currentTheme.cardBg,
                border: selectedEmotion === emo.name.toLowerCase() 
                  ? 'none' 
                  : `2px solid ${currentTheme.border}`,
                borderRadius: '40px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: selectedEmotion === emo.name.toLowerCase() ? 'bold' : '500',
                transition: 'all 0.3s',
                boxShadow: selectedEmotion === emo.name.toLowerCase() 
                  ? `0 4px 15px ${emo.color}80` 
                  : currentTheme.shadow,
                color: selectedEmotion === emo.name.toLowerCase() ? '#121212' : currentTheme.text,
                minWidth: '100px',
                transform: selectedEmotion === emo.name.toLowerCase() ? 'scale(1.05)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (selectedEmotion !== emo.name.toLowerCase()) {
                  e.target.style.background = currentTheme.hoverBg;
                  e.target.style.borderColor = emo.color;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedEmotion !== emo.name.toLowerCase()) {
                  e.target.style.background = currentTheme.cardBg;
                  e.target.style.borderColor = currentTheme.border;
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
            <p style={{ color: currentTheme.textMuted, fontSize: '13px', marginBottom: '8px' }}>
              You might also want to know:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '10px 16px',
                    background: currentTheme.cardBg,
                    border: `2px solid ${currentTheme.accent}`,
                    borderRadius: '25px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: currentTheme.text,
                    fontWeight: '500',
                    transition: 'all 0.3s',
                    boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(187, 134, 252, 0.2)' : 'rgba(108, 92, 231, 0.2)'}`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = currentTheme.accent;
                    e.target.style.color = isDarkMode ? '#121212' : 'white';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = currentTheme.cardBg;
                    e.target.style.color = currentTheme.text;
                    e.target.style.transform = 'translateY(0)';
                  }}
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
              padding: '16px 20px',
              border: `2px solid ${currentTheme.inputBorder}`,
              borderRadius: '30px',
              fontSize: '15px',
              outline: 'none',
              transition: 'all 0.3s',
              background: currentTheme.inputBg,
              color: currentTheme.text,
              boxShadow: currentTheme.shadow
            }}
            onFocus={(e) => {
              e.target.style.borderColor = currentTheme.inputFocusBorder;
              e.target.style.boxShadow = `0 4px 15px ${isDarkMode ? 'rgba(187, 134, 252, 0.2)' : 'rgba(108, 92, 231, 0.2)'}`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = currentTheme.inputBorder;
              e.target.style.boxShadow = currentTheme.shadow;
            }}
          />
          <button
            type="submit"
            disabled={loading || !userInput.trim()}
            style={{
              padding: '16px 35px',
              background: loading || !userInput.trim() 
                ? currentTheme.border
                : currentTheme.buttonNewChat,
              color: loading || !userInput.trim() ? currentTheme.textMuted : (isDarkMode ? '#121212' : 'white'),
              border: 'none',
              borderRadius: '30px',
              cursor: loading || !userInput.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !userInput.trim() ? 0.6 : 1,
              fontSize: '15px',
              fontWeight: 'bold',
              boxShadow: loading || !userInput.trim() 
                ? 'none' 
                : currentTheme.shadow,
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!loading && userInput.trim()) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = isDarkMode ? '0 6px 20px rgba(187, 134, 252, 0.5)' : '0 6px 20px rgba(108, 92, 231, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && userInput.trim()) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = currentTheme.shadow;
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
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${currentTheme.accent};
          margin: 0 3px;
          animation: typing 1.4s infinite;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 60%, 100% { 
            transform: translateY(0);
            opacity: 0.6;
          }
          30% { 
            transform: translateY(-12px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Chat;