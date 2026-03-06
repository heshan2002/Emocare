# backend/analysis.py
from datetime import datetime, timedelta
from collections import Counter
import re

def analyze_user_data(user, chat_history):
    """
    Analyze user's chat history and profile to generate professional insights
    Only includes emotion check-ins and personalized recommendations
    """
    
    # Extract user profile
    profile = {
        "name": user.get('name', 'User'),
        "age": user.get('age', 'Unknown'),
        "medical": user.get('medical', []),
        "habits": user.get('habits', []),
        "hobbies": user.get('hobbies', []),
        "family": user.get('family', 'Not specified'),
        "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    
    # Track ONLY emotion-related chats (when user selects emotions)
    emotion_log = []
    emotion_dates = []
    
    # Personalized recommendations based on user profile
    personalized_recommendations = []
    
    # Generate recommendations based on hobbies and habits
    if profile['hobbies']:
        for hobby in profile['hobbies']:
            if 'garden' in hobby.lower():
                personalized_recommendations.append({
                    'category': 'hobby',
                    'text': f"Based on your love for {hobby}, spending 15-20 minutes in your garden can significantly improve your mood. The combination of sunlight, fresh air, and nurturing plants is naturally therapeutic."
                })
            elif 'read' in hobby.lower():
                personalized_recommendations.append({
                    'category': 'hobby',
                    'text': f"Since you enjoy {hobby}, consider joining a local library or book club. Reading for 30 minutes daily can reduce stress by up to 68%."
                })
            elif 'music' in hobby.lower():
                personalized_recommendations.append({
                    'category': 'hobby',
                    'text': f"Your interest in {hobby} is wonderful! Listening to your favorite music for 20 minutes can release dopamine and improve emotional well-being."
                })
            elif 'walk' in hobby.lower() or 'exercise' in hobby.lower():
                personalized_recommendations.append({
                    'category': 'habit',
                    'text': f"Continuing your {hobby} routine is excellent. A gentle 15-minute walk daily can boost mood and improve cardiovascular health."
                })
    
    if profile['habits']:
        for habit in profile['habits']:
            if 'tea' in habit.lower():
                personalized_recommendations.append({
                    'category': 'habit',
                    'text': f"Your habit of {habit} can be a mindful moment. Try having your tea without distractions, focusing on the warmth and aroma for relaxation."
                })
            elif 'morning' in habit.lower():
                personalized_recommendations.append({
                    'category': 'habit',
                    'text': f"Your {habit} routine is valuable. Morning sunlight exposure helps regulate circadian rhythm and vitamin D levels."
                })
    
    # Add general health recommendations based on medical conditions
    if 'diabetes' in str(profile['medical']).lower():
        personalized_recommendations.append({
            'category': 'health',
            'text': "For diabetes management, maintaining regular meal times and monitoring blood sugar levels is crucial. Your morning walks are particularly beneficial."
        })
    if 'bp' in str(profile['medical']).lower() or 'blood pressure' in str(profile['medical']).lower():
        personalized_recommendations.append({
            'category': 'health',
            'text': "To help manage blood pressure, reducing salt intake and practicing deep breathing for 5 minutes daily can make a significant difference."
        })
    
    # Collect emotion check-ins from chat history
    emotion_keywords = ["sad", "lonely", "anxious", "angry", "tired", "depressed", "hopeless", "happy", "calm"]
    
    for chat in chat_history:
        emotion = chat.get('emotion', '').lower()
        timestamp = chat.get('timestamp', '')
        
        if emotion in emotion_keywords:
            # Format date nicely
            if timestamp:
                try:
                    date_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    formatted_date = date_obj.strftime("%b %d, %Y")
                except:
                    formatted_date = str(timestamp)[:10]
            else:
                formatted_date = "Unknown"
            
            emotion_log.append({
                'emotion': emotion.capitalize(),
                'date': formatted_date
            })
            emotion_dates.append(formatted_date)
    
    # Count emotions
    emotion_counts = Counter([e['emotion'] for e in emotion_log])
    total_emotions = len(emotion_log)
    
    # Calculate percentages for chart
    chart_data = {}
    colors = {
        'Sad': '#64B5F6',
        'Lonely': '#7986CB',
        'Anxious': '#4FC3F7',
        'Angry': '#E57373',
        'Tired': '#BA68C8',
        'Depressed': '#9575CD',
        'Hopeless': '#F06292',
        'Happy': '#4CAF50',
        'Calm': '#66BB6A'
    }
    
    for emotion, count in emotion_counts.items():
        percentage = round((count / total_emotions) * 100) if total_emotions > 0 else 0
        chart_data[emotion] = {
            'count': count,
            'percentage': percentage,
            'color': colors.get(emotion, '#3498db')
        }
    
    # Sort chart data by percentage
    sorted_chart = dict(sorted(chart_data.items(), key=lambda x: x[1]['percentage'], reverse=True))
    
    # Generate professional summary
    summary = f"""
╔══════════════════════════════════════════════════════════════╗
║                    EMOCARE ANALYSIS REPORT                    ║
║                    Generated: {profile['analysis_date']}                  ║
╠══════════════════════════════════════════════════════════════╣
║ PATIENT: {profile['name'][:20]:<20} AGE: {profile['age']:<3}                         ║
║ MEDICAL: {', '.join(profile['medical'])[:40]:<40} ║
║ HOBBIES : {', '.join(profile['hobbies'])[:40]:<40} ║
║ HABITS  : {', '.join(profile['habits'])[:40]:<40} ║
╚══════════════════════════════════════════════════════════════╝

📊 EMOTIONAL DISTRIBUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Check-ins: {total_emotions}

{chr(10).join([f"{e}: {'█' * (d['percentage']//5)} {d['percentage']}% ({d['count']} times)" for e, d in sorted_chart.items()]) if sorted_chart else 'No emotional data recorded yet'}

💡 PERSONALIZED RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join([f"• {r['text']}" for r in personalized_recommendations[:5]]) if personalized_recommendations else 'No recommendations available'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Report generated for healthcare provider reference only.
"""
    
    # Return structured data for frontend
    return {
        "generated_at": profile['analysis_date'],
        "patient_info": {
            "name": profile['name'],
            "age": profile['age'],
            "medical": profile['medical'],
            "habits": profile['habits'],
            "hobbies": profile['hobbies']
        },
        "emotional_stats": {
            "total_checkins": total_emotions,
            "chart_data": sorted_chart,
            "recent_checkins": emotion_log[-10:]  # Last 10 check-ins
        },
        "personalized_recommendations": personalized_recommendations[:5],  # Top 5 recommendations
        "summary": summary
    }