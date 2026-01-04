# medi.py — EMOCARE FINAL VERSION (With Chat History + Perfect Logo)

import os
import streamlit as st
from dotenv import load_dotenv
import base64

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA

load_dotenv()

# ============================= PAGE CONFIG =============================
st.set_page_config(
    page_title="Emocare – Elderly Emotion Support",
    page_icon="emocare_logo.png",
    layout="centered"
)

# ============================= LOGO WITH BASE64 (Never breaks!) =============================
def get_base64_image(image_path):
    try:
        with open(image_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode()
    except:
        return None

logo_base64 = get_base64_image("emocare_logo.png")

if logo_base64:
    st.markdown(f"""
        <div style="text-align: center; margin: 30px 0;">
            <img src="data:image/png;base64,{logo_base64}" width="200">
            <p style="color:#555; font-size:22px; margin-top:15px;">
                Your caring companion for emotional well-being
            </p>
        </div>
    """, unsafe_allow_html=True)
else:
    st.error("Logo not found! Make sure 'emocare_logo.png' is in the same folder as medi.py")

st.markdown("---")

# ============================= VECTOR STORE =============================
@st.cache_resource
def get_vectorstore():
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.load_local("vectorstore/db_faiss", embeddings, allow_dangerous_deserialization=True)
    return db

# ============================= PROMPT =============================
def get_emotion_prompt():
    template = """
You are Emocare – a very kind and caring elderly-care counsellor.

The elder is feeling: "{emotion}"

Using ONLY the research PDFs below, give warm, practical, and hopeful advice in short bullet points.
Speak in simple Sinhala or English.
Be loving and encouraging.

Context:
{context}

Answer with care:
"""
    return PromptTemplate.from_template(template)

# ============================= FORMAT SOURCES =============================
def format_sources(docs):
    sources = []
    for i, doc in enumerate(docs, 1):
        page = doc.metadata.get("page", "N/A")
        filename = os.path.basename(doc.metadata.get("source", "Unknown.pdf"))
        preview = doc.page_content.strip().replace("\n", " ")[:300]
        sources.append(f"**Source {i}** – {filename} (Page {page})\n{preview}...")
    return sources

# ============================= CHAT HISTORY (MEMORY) =============================
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Hello! How are you feeling today? Click a feeling or type it — I am here to help you with love"}
    ]

# Display all previous messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# ============================= EMOTION BUTTONS =============================
st.markdown("<h3 style='text-align: center; margin: 30px 0;'>How are you feeling today?</h3>", unsafe_allow_html=True)

emotions = ["Sad","Lonely","Anxious","Angry","Tired","Depressed","Hopeless","Happy","Calm"]
cols = st.columns(len(emotions))

selected_emotion = None
for col, emo in zip(cols, emotions):
    if col.button(emo, use_container_width=True, type="primary" if selected_emotion == emo.lower() else "secondary"):
        selected_emotion = emo.lower()

# Text input
user_input = st.chat_input("Or type your feeling here...")

emotion = selected_emotion or (user_input.strip().lower() if user_input else None)

# ============================= MAIN LOGIC =============================
if emotion:
    # Add user message to history
    user_msg = f"I am feeling **{emotion.capitalize()}**"
    st.session_state.messages.append({"role": "user", "content": user_msg})
    with st.chat_message("user"):
        st.markdown(user_msg)

    with st.spinner("Finding caring advice from research..."):
        vectorstore = get_vectorstore()

        full_prompt = get_emotion_prompt().format(emotion=emotion.capitalize(), context="{context}")

        qa_chain = RetrievalQA.from_chain_type(
            llm=ChatGroq(
                model_name="llama-3.1-8b-instant",
                temperature=0.6,
                groq_api_key=os.environ["GROQ_API_KEY"]
            ),
            chain_type="stuff",
            retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": PromptTemplate.from_template(full_prompt)}
        )

        result = qa_chain.invoke({"query": emotion})

        answer = result["result"]
        sources = format_sources(result["source_documents"])

        # Add bot reply
        st.session_state.messages.append({"role": "assistant", "content": answer})
        with st.chat_message("assistant"):
            st.markdown(answer)
            with st.expander("Research Sources"):
                for s in sources:
                    st.markdown(s)

# ============================= FOOTER =============================
#st.markdown("---")
#st.markdown("<p style='text-align: center; color:#888; font-size:14px;'>© 2025 Emocare – Final Year Project</p>", unsafe_allow_html=True)