import os
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from dotenv import load_dotenv

load_dotenv()

# Configuration
DATA_PATH = "data/"
DB_FAISS_PATH = "vectorstore/db_faiss"

def load_pdf_files(data_path):
    """Load all PDF files from directory"""
    try:
        loader = DirectoryLoader(
            data_path, 
            glob='*.pdf', 
            loader_cls=PyPDFLoader
        )
        documents = loader.load()
        print(f"✅ Loaded {len(documents)} PDF pages")
        return documents
    except Exception as e:
        print(f"❌ Error loading PDFs: {e}")
        return []

def create_chunks(extracted_data):
    """Split documents into chunks"""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    text_chunks = text_splitter.split_documents(extracted_data)
    print(f"✅ Created {len(text_chunks)} text chunks")
    return text_chunks

def get_embedding_model():
    """Initialize embedding model"""
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

def create_vector_store():
    """Main function to create vector store from PDFs"""
    
    print("\n🚀 Starting PDF processing...\n")
    
    # Check if data directory exists
    if not os.path.exists(DATA_PATH):
        print(f"❌ Data directory '{DATA_PATH}' not found!")
        print("Please create a 'data' folder and add PDF files to it.")
        return False
    
    # Check if there are PDF files
    pdf_files = [f for f in os.listdir(DATA_PATH) if f.endswith('.pdf')]
    if not pdf_files:
        print(f"❌ No PDF files found in '{DATA_PATH}'")
        print("Please add PDF files to the data folder.")
        return False
    
    print(f"📚 Found PDF files: {', '.join(pdf_files)}")
    
    # Step 1: Load PDFs
    documents = load_pdf_files(DATA_PATH)
    if not documents:
        return False
    
    # Step 2: Create chunks
    text_chunks = create_chunks(documents)
    
    # Step 3: Create embeddings and vector store
    print("\n🔄 Creating embeddings (this may take a while)...")
    embedding_model = get_embedding_model()
    
    # Create vector store
    db = FAISS.from_documents(text_chunks, embedding_model)
    
    # Save locally
    os.makedirs(os.path.dirname(DB_FAISS_PATH), exist_ok=True)
    db.save_local(DB_FAISS_PATH)
    
    print(f"\n✅ Vector store created successfully at: {DB_FAISS_PATH}")
    print(f"   Total chunks: {len(text_chunks)}")
    print("   You can now start the chatbot!")
    
    return True

if __name__ == "__main__":
    create_vector_store()