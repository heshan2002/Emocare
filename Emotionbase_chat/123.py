# medi.py — EMOCARE FINAL (Working perfectly with sidebar history)

import os
import streamlit as st
from dotenv import load_dotenv
import base64
import datetime

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA

load_dotenv()

# ============================= PAGE CONFIG =============================
st.set_page_config(page_title="Emocare", page_icon="emocare_logo.png", layout="centered")

# ============================= LOGO =============================
def get_base64_image(image_path):
    try:
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    except:
        return None

logo = get_base64_image("emocare_logo.png")

if logo:
    st.markdown(f"""
        <div style="text-align: center; margin: 30px 0;">
            <img src="data:image/png;base64,{logo}" width="200">
            <p style="color:#555; font-size:22px; margin-top:15px;">
                Your caring companion for emotional well-being
            </p>
        </div>
    """, unsafe_allow_html=True)
else:
    st.error("Logo not found! Place 'emocare_logo.png' in the same folder")

st.markdown("---")

# ============================= VECTOR STORE =============================
@st.cache_resource
def get_vectorstore():
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.load_local("vectorstore/db_faiss", embeddings, allow_dangerous_deserialization=True)
    return db

# ============================= PROMPT (emotion inside the prompt) =============================
def get_prompt(emotion_name):
    return PromptTemplate.from_template(f"""
You are Emocare – a very kind elderly-care counsellor.

The elder is feeling: "{emotion_name}"

Using ONLY the research PDFs below, give warm, practical, and hopeful advice in short bullet points.
Speak in simple Sinhala or English. Be loving.

Context:
{{context}}

Answer with care:
""")

# ============================= SIDEBAR HISTORY =============================
with st.sidebar:
    if logo:
        st.image("emocare_logo.png", width=70)
    st.title("Chat History")
    
    if "history" not in st.session_state:
        st.session_state.history = []

    for i, chat in enumerate(reversed(st.session_state.history)):
        if st.button(f"{chat['emotion']} – {chat['time']}", key=f"hist_{i}", use_container_width=True):
            st.session_state.messages = chat["messages"]
            st.rerun()
    
    if st.button("New Chat", type="primary", use_container_width=True):
        st.session_state.messages = [{"role": "assistant", "content": "Hello! How are you feeling today?"}]
        st.rerun()

# ============================= MAIN CHAT =============================
if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": "Hello! How are you feeling today? Click a feeling or type it — I am here to help you with love"}]

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ============================= EMOTION BUTTONS =============================
st.markdown("<h3 style='text-align: center; margin: 40px 0 20px;'>How are you feeling today?</h3>", unsafe_allow_html=True)

emotions = ["Sad","Lonely","Angry","Surprice","Calm","Happy","Depress"]
cols = st.columns(len(emotions))
selected = None
for col, emo in zip(cols, emotions):
    if col.button(emo, use_container_width=True):
        selected = emo.lower()

user_input = st.chat_input("Or type your feeling here...")

emotion = selected or (user_input.strip().lower() if user_input else None)

# ============================= WHEN USER SENDS FEELING =============================
if emotion:
    user_msg = f"I am feeling **{emotion.capitalize()}**"
    st.session_state.messages.append({"role": "user", "content": user_msg})
    with st.chat_message("user"):
        st.markdown(user_msg)

    with st.spinner("Searching caring advice from research papers..."):
        db = get_vectorstore()

        # Create prompt with emotion already filled in
        prompt = get_prompt(emotion.capitalize())

        qa_chain = RetrievalQA.from_chain_type(
            llm=ChatGroq(model="llama-3.1-8b-instant", temperature=0.6, groq_api_key=os.environ["GROQ_API_KEY"]),
            chain_type="stuff",
            retriever=db.as_retriever(search_kwargs={"k": 5}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": prompt}
        )

        # Only ONE input key: "query"
        result = qa_chain.invoke({"query": emotion})

        answer = result["result"]

        st.session_state.messages.append({"role": "assistant", "content": answer})
        with st.chat_message("assistant"):
            st.markdown(answer)
            with st.expander("Research Sources"):
                for i, doc in enumerate(result["source_documents"], 1):
                    page = doc.metadata.get("page", "?")
                    filename = os.path.basename(doc.metadata.get("source", "Unknown.pdf"))
                    st.markdown(f"**Source {i}** – {filename} (Page {page})")

    # Save to history
    time_str = datetime.datetime.now().strftime("%I:%M %p")
    new_entry = {
        "emotion": emotion.capitalize(),
        "time": time_str,
        "messages": st.session_state.messages.copy()
    }
    if not st.session_state.history or st.session_state.history[-1]["messages"] != new_entry["messages"]:
        st.session_state.history.append(new_entry)

# ============================= FOOTER =============================
#st.markdown("---")
#st.caption("© 2025 Emocare – Final Year Project")