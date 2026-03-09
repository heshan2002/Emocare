# backend/analysis.py
from datetime import datetime
from collections import Counter

def analyze_user_data(user, chat_history):
    """
    Analyze user's chat history and profile to generate professional insights
    Only includes emotion check-ins (from emotion buttons) and personalized recommendations
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
    
    # Track ONLY emotion-related chats (when user selects emotions from buttons)
    emotion_log = []
    
    # Personalized recommendations based on user profile
    personalized_recommendations = []
    
    # Generate recommendations based on hobbies and habits
    if profile['hobbies']:
        for hobby in profile['hobbies']:
            hobby_lower = hobby.lower()
            if 'garden' in hobby_lower:
                personalized_recommendations.append({
                    'category': 'hobby',
                    'text': f"Based on your love for {hobby}, spending 15-20 minutes in your garden can significantly improve your mood. The combination of sunlight, fresh air, and nurturing plants is naturally therapeutic."
                })
            elif 'read' in hobby_lower:
                personalized_recommendations.append({
                    'category': 'hobby',
                    'text': f"Since you enjoy {hobby}, consider joining a local library or book club. Reading for 30 minutes daily can reduce stress by up to 68%."
                })
            elif 'music' in hobby_lower:
                personalized_recommendations.append({
                    'category': 'hobby',
                    'text': f"Your interest in {hobby} is wonderful! Listening to your favorite music for 20 minutes can release dopamine and improve emotional well-being."
                })
            elif 'walk' in hobby_lower or 'exercise' in hobby_lower:
                personalized_recommendations.append({
                    'category': 'habit',
                    'text': f"Continuing your {hobby} routine is excellent. A gentle 15-minute walk daily can boost mood and improve cardiovascular health."
                })
    
    if profile['habits']:
        for habit in profile['habits']:
            habit_lower = habit.lower()
            if 'tea' in habit_lower:
                personalized_recommendations.append({
                    'category': 'habit',
                    'text': f"Your habit of {habit} can be a mindful moment. Try having your tea without distractions, focusing on the warmth and aroma for relaxation."
                })
            elif 'morning' in habit_lower:
                personalized_recommendations.append({
                    'category': 'habit',
                    'text': f"Your {habit} routine is valuable. Morning sunlight exposure helps regulate circadian rhythm and vitamin D levels."
                })
    
    # Add general health recommendations based on medical conditions
    medical_str = str(profile['medical']).lower()
    if 'diabetes' in medical_str:
        personalized_recommendations.append({
            'category': 'health',
            'text': "For diabetes management, maintaining regular meal times and monitoring blood sugar levels is crucial. Your morning walks are particularly beneficial."
        })
    if 'bp' in medical_str or 'blood pressure' in medical_str:
        personalized_recommendations.append({
            'category': 'health',
            'text': "To help manage blood pressure, reducing salt intake and practicing deep breathing for 5 minutes daily can make a significant difference."
        })
    
    # EMOTION KEYWORDS ONLY - No general queries
    emotion_keywords = ["sad", "lonely", "anxious", "angry", "tired", "depressed", "hopeless", "happy", "calm", "neutral", "surprise"]
    
    print(f"\n📊 Analyzing {len(chat_history)} chat history items")
    emotion_count = 0
    
    for chat in chat_history:
        emotion = chat.get('emotion', '').lower()
        timestamp = chat.get('timestamp', '')
        
        # Only include if it's a valid emotion (from buttons)
        if emotion in emotion_keywords:
            emotion_count += 1
            print(f"  ✓ Emotion found: {emotion} at {timestamp}")
            
            # Format date nicely
            if timestamp:
                try:
                    # Try to parse the timestamp
                    if isinstance(timestamp, str):
                        # Handle ISO format
                        date_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        formatted_date = date_obj.strftime("%b %d, %Y")
                        # For last active, we'll use this format
                        last_active_raw = date_obj
                    else:
                        # Handle datetime object
                        formatted_date = timestamp.strftime("%b %d, %Y")
                        last_active_raw = timestamp
                except Exception as e:
                    print(f"Date parsing error: {e}")
                    formatted_date = str(timestamp)[:10]
                    last_active_raw = datetime.now()
            else:
                formatted_date = datetime.now().strftime("%b %d, %Y")
                last_active_raw = datetime.now()
            
            emotion_log.append({
                'emotion': emotion.capitalize(),
                'date': formatted_date,
                'raw_timestamp': last_active_raw
            })
    
    print(f"✅ Total valid emotions found: {emotion_count}")
    
    # Sort by timestamp (most recent first)
    emotion_log.sort(key=lambda x: x.get('raw_timestamp', datetime.now()), reverse=True)
    
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
        'Calm': '#66BB6A',
        'Neutral': '#9E9E9E',
        'Surprise': '#FFB74D'
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
    
    # Calculate emotional wellness (percentage of positive emotions)
    positive_emotions = ['Happy', 'Calm']
    positive_count = sum([emotion_counts.get(e, 0) for e in positive_emotions])
    wellness_percentage = round((positive_count / total_emotions) * 100) if total_emotions > 0 else 0
    
    # Calculate engagement level
    if total_emotions > 20:
        engagement = "High"
    elif total_emotions > 10:
        engagement = "Medium"
    else:
        engagement = "Moderate"
    
    # Get last active date (most recent emotion)
    if emotion_log:
        last_active_obj = emotion_log[0].get('raw_timestamp')
        if isinstance(last_active_obj, datetime):
            last_active = last_active_obj.strftime("%b %d, %Y")
        else:
            last_active = emotion_log[0]['date']
    else:
        last_active = "No data"
    
    # Create clinical observations text
    clinical_observations = f"Patient {profile['name']} has completed {total_emotions} emotional wellness sessions. "
    if profile['medical']:
        clinical_observations += f"Medical history includes {', '.join(profile['medical'])}. "
    if profile['habits']:
        clinical_observations += f"Daily routine includes {', '.join(profile['habits'])}. "
    if profile['hobbies']:
        clinical_observations += f"Shows interest in {', '.join(profile['hobbies'])}."
    
    # Generate professional summary
    summary = f"""
╔══════════════════════════════════════════════════════════════╗
║                    EMOCARE HEALTH SUMMARY                     ║
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
            "recent_checkins": emotion_log[:10],  # Last 10 check-ins
            "wellness_percentage": wellness_percentage,
            "engagement_level": engagement,
            "last_active": last_active
        },
        "clinical_observations": clinical_observations,
        "personalized_recommendations": personalized_recommendations[:5],
        "summary": summary
    }