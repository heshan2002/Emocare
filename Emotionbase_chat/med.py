# medi.py — FINAL EMOCARE (Logo + Everything Perfect)

import os
import streamlit as st
from dotenv import load_dotenv

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA

load_dotenv()

# ============================= PAGE CONFIG + LOGO =============================
st.set_page_config(
    page_title="Emocare – Elderly Emotion Support",
    page_icon="emocare_logo.png",
    layout="centered"
)

import base64

def get_base64_image(image_path):
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode()

# Load image as Base64
logo_base64 = get_base64_image("emocare_logo.png")

st.markdown(f"""
    <div style="text-align: center; margin-top: 20px;">
        <img src="data:image/png;base64,{logo_base64}" width="220">
        <p style="color:#555; font-size:22px; margin-top:10px;">
            Your caring companion for emotional well-being
        </p>
    </div>
""", unsafe_allow_html=True)

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
You are Emocare – a very kind, gentle, and experienced elderly-care counsellor.

The elder is feeling: "{emotion}"

Using ONLY the information from the research PDFs, give warm, practical, and hopeful advice in short bullet points.
Speak in simple Sinhala or English.
Always be encouraging and caring.

Context:
{context}

Answer with love:
"""
    return PromptTemplate.from_template(template)

# ============================= FORMAT SOURCES =============================
def format_sources(docs):
    sources = []
    for i, doc in enumerate(docs, 1):
        page = doc.metadata.get("page", "N/A")
        filename = os.path.basename(doc.metadata.get("source", "Unknown.pdf"))
        preview = doc.page_content.strip().replace("\n", " ")[:320]
        sources.append(f"**Source {i}** – {filename} (Page {page})\n{preview}...")
    return sources

# ============================= EMOTION BUTTONS =============================
st.markdown("<h3 style='text-align: center; margin-bottom:30px;'>How are you feeling today?</h3>", unsafe_allow_html=True)

emotions = [
    ("sad", "Sad"), ("lonely", "Lonely"), ("anxious", "Anxious"),
    ("angry", "Angry"), ("tired", "Tired"), ("depressed", "Depressed"),
    ("hopeless", "Hopeless"), ("happy", "Happy"), ("calm", "Calm")
]

cols = st.columns(len(emotions))
selected_emotion = None

for col, (key, label) in zip(cols, emotions):
    if col.button(label, use_container_width=True):
        selected_emotion = key

text_input = st.chat_input("Or type your feeling here...")

emotion = selected_emotion or (text_input.strip().lower() if text_input else None)

# ============================= MAIN LOGIC =============================
if emotion:
    with st.chat_message("user"):
        st.markdown(f"**I am feeling {emotion.capitalize()}**")

    with st.spinner("Searching the best advice from research papers..."):
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

        with st.chat_message("assistant"):
            st.markdown(answer)

            if sources:
                with st.expander("Research Sources (from your PDFs)", expanded=False):
                    for s in sources:
                        st.markdown(s)
else:
    st.info("Click any feeling above or type how you feel — I am here to help you with love")

# Footer
#st.markdown("---")
#st.markdown("<p style='text-align: center; color:#888; font-size:14px;'>© 2025 Emocare – Final Year Project by [Your Name]</p>", unsafe_allow_html=True)