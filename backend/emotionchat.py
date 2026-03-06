import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA

def get_vectorstore():
    """Load the FAISS vector store"""
    try:
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vectorstore = FAISS.load_local(
            "vectorstore/db_faiss", 
            embeddings, 
            allow_dangerous_deserialization=True
        )
        return vectorstore
    except Exception as e:
        print(f"Error loading vectorstore: {e}")
        return None

# Pre-defined emotions list (for reference)
valid_emotions = ["sad", "lonely", "anxious", "angry", "tired", "depressed", "hopeless", "happy", "calm"]

def detect_query_type(query, user_profile):
    """
    Detect what type of query this is:
    - emotion: User is expressing an emotion
    - health: User is asking about health/medical topic
    - general: General question (will check if answerable)
    """
    query_lower = query.lower()
    
    # Emotion-related keywords
    emotion_keywords = [
        "feel", "feeling", "felt", "emotion", "sad", "happy", "angry", 
        "depressed", "anxious", "lonely", "tired", "hopeless", "calm",
        "stressed", "worried", "scared", "frustrated", "bored", "confused",
        "down", "upset", "hurt", "pain", "grateful", "thankful", "excited",
        "neutral", "okay", "fine", "good", "bad", "terrible", "great"
    ]
    
    # Health-related keywords
    health_keywords = [
        "diabetes", "blood pressure", "bp", "sugar", "heart", "exercise",
        "diet", "food", "eat", "sleep", "medicine", "medication", "doctor",
        "hospital", "clinic", "pain", "ache", "sick", "illness", "disease",
        "health", "medical", "treatment", "therapy", "cure", "prevent",
        "vitamin", "supplement", "prescription", "pharmacy", "wellness",
        "fitness", "nutrition", "weight", "blood", "pressure", "health"
    ]
    
    # Check if it's an emotion expression
    is_emotion = False
    for word in emotion_keywords:
        if word in query_lower:
            is_emotion = True
            break
    
    # Check if it's a health question
    is_health = False
    for word in health_keywords:
        if word in query_lower:
            is_health = True
            break
    
    # Check if it's a question
    question_words = ["what", "why", "how", "when", "where", "can", "should", "is", "are", "who", "which"]
    is_question = any(query_lower.startswith(word) for word in question_words)
    
    if is_emotion and not is_question:
        return "emotion"
    elif is_health or (is_question and any(word in query_lower for word in health_keywords)):
        return "health"
    else:
        return "general"

def get_prompt(user, query):
    """Create personalized prompt based on user profile and query type"""
    
    # Format user profile safely
    medical = ', '.join(user.get('medical', [])) if user.get('medical') else 'None reported'
    habits = ', '.join(user.get('habits', [])) if user.get('habits') else 'None reported'
    hobbies = ', '.join(user.get('hobbies', [])) if user.get('hobbies') else 'None reported'
    family = user.get('family', 'Not specified')
    name = user.get('name', 'User')
    age = user.get('age', 'Not specified')
    
    profile = f"""=== USER PROFILE ===
Name: {name}
Age: {age}
Medical Conditions: {medical}
Family Situation: {family}
Daily Habits: {habits}
Hobbies: {hobbies}
=================="""

    # Detect query type
    query_type = detect_query_type(query, user)
    
    if query_type == "emotion":
        # PARAGRAPH + BULLET POINTS FORMAT FOR EMOTIONS
        template = f"""You are Emocare – a warm, caring emotional support assistant for elderly users.

{profile}

The user is feeling: "{query}"

IMPORTANT RESPONSE FORMAT INSTRUCTIONS:
1. Start with a short, warm paragraph (2-3 sentences) acknowledging their feeling
2. Then provide 2-3 simple, practical suggestions as bullet points (use • for bullets)
3. End with a short, encouraging closing sentence
4. Use the user's name ({name})
5. Keep language simple and warm for elderly users
6. Connect suggestions to their hobbies/habits if possible

FORMAT EXAMPLE:
Dear {name},

[Short paragraph acknowledging their feeling and connecting to their situation]

• [Simple suggestion 1 related to their hobbies/habits]
• [Simple suggestion 2 they can try right now]
• [Simple suggestion 3 if relevant]

[Short encouraging closing sentence]

Based on the user's profile and the research information below, create a response in this format.

Research Context:
{{context}}

Your response in the specified format:"""
    
    elif query_type == "health":
        # PARAGRAPH + BULLET POINTS FOR HEALTH QUESTIONS
        template = f"""You are Emocare – a warm, knowledgeable health assistant for elderly users.

{profile}

The user is asking about: "{query}"

IMPORTANT RESPONSE FORMAT INSTRUCTIONS:
1. Start with a short, warm paragraph acknowledging their question (2-3 sentences)
2. Then provide 2-3 key points as bullet points (use • for bullets)
3. End with a suggestion to consult their doctor if needed
4. Use the user's name ({name})
5. Keep it simple and clear for elderly users

FORMAT EXAMPLE:
Dear {name},

[Short paragraph about their question]

• [Key point 1 - simple explanation]
• [Key point 2 - practical tip]
• [Key point 3 - important reminder]

Always remember to talk to your doctor about this.

Based on the user's profile and the research information below, create a response in this format.

Research Context:
{{context}}

Your response in the specified format:"""
    
    else:
        # GENERAL QUESTIONS
        template = f"""You are Emocare – a warm, friendly assistant for elderly users.

{profile}

The user is asking: "{query}"

IMPORTANT INSTRUCTIONS:
1. First, check if the information to answer this question is available in the Research Context below
2. If the information IS available, provide a helpful answer with 1-2 bullet points
3. If the information is NOT available, politely say so and suggest talking about emotions/health instead
4. Use the user's name ({name})
5. Keep it warm and simple for elderly users

FORMAT FOR AVAILABLE INFORMATION:
Dear {name},

[Short paragraph answering their question]

• [Key point 1]
• [Key point 2 if relevant]

[Short closing]

FORMAT FOR UNAVAILABLE INFORMATION:
Dear {name},

I'm sorry, but I don't have information about that. I'm here to help with emotions and health questions. How are you feeling today?

Research Context:
{{context}}

Your response in the appropriate format:"""

    return PromptTemplate.from_template(template)

def get_advice(user, query):
    """Get personalized advice for user's query"""
    
    print(f"\n🔍 Processing query: '{query}'")
    print(f"👤 User: {user.get('name')}")
    
    # Detect what type of query it is
    query_type = detect_query_type(query, user)
    print(f"📊 Detected as: {query_type.upper()} query")
    
    # Load vector store
    db = get_vectorstore()
    if db is None:
        return {"error": "Knowledge base not available. Please ensure PDFs are loaded."}, []
    
    try:
        # Initialize LLM
        llm = ChatGroq(
            model="llama-3.1-8b-instant", 
            temperature=0.7,
            groq_api_key=os.getenv("GROQ_API_KEY")
        )
        
        # Create retrieval QA chain
        qa = RetrievalQA.from_chain_type(
            llm=llm,
            retriever=db.as_retriever(search_kwargs={"k": 5}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": get_prompt(user, query)}
        )
        
        # Get response
        result = qa.invoke({"query": query})
        
        # Return sources ONLY for emotion/health queries
        if query_type in ["emotion", "health"]:
            return {"answer": result["result"]}, result.get("source_documents", [])
        else:
            return {"answer": result["result"]}, []
    
    except Exception as e:
        print(f"❌ Error getting advice: {e}")
        return {"error": "Failed to generate advice. Please try again."}, []