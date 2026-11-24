
from pathlib import Path
import uuid
import chromadb

from app.rag.embeddings import generate_embedding


# Store ChromaDB data inside the backend folder
DB_PATH = Path(__file__).resolve().parents[2] / "chroma_db"

client = chromadb.PersistentClient(path=str(DB_PATH))

# Create or connect to an existing collection
collection = client.get_or_create_collection(
    name="coding_assistant_documents"
)


def add_chunks(
    chunks: list[str],
    source_name: str,
    pages: list[int | None] | None = None
):
    """
    Generate embeddings and store document chunks
    with source filename and page number.
    """

    if not chunks:
        raise ValueError("No document chunks provided")

    if pages is not None and len(pages) != len(chunks):
        raise ValueError("Pages count must match chunks count")

    embeddings = [
        generate_embedding(chunk)
        for chunk in chunks
    ]

    ids = [
        str(uuid.uuid4())
        for _ in chunks
    ]

    metadatas = []

    for index in range(len(chunks)):
        metadata = {"source": source_name}

        if pages is not None and pages[index] is not None:
            metadata["page_number"] = pages[index]

        metadatas.append(metadata)

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas
    )

    return {
        "message": "Document chunks stored successfully",
        "total_chunks": len(chunks)
    }


def search_chunks_with_sources(question: str, top_k: int = 3):
    """
    Search relevant chunks and return their source details.
    """

    if not question.strip():
        raise ValueError("Question cannot be empty")

    total_chunks = collection.count()

    if total_chunks == 0:
        return []

    query_embedding = generate_embedding(question)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, total_chunks)
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    retrieved_results = []

    for document, metadata in zip(documents, metadatas):
        retrieved_results.append({
            "text": document,
            "source": metadata.get("source", "Unknown"),
            "page_number": metadata.get("page_number")
        })

    return retrieved_results


def search_chunks(question: str, top_k: int = 3):
    """
    Keep the existing search function compatible
    with the current application.
    """

    results = search_chunks_with_sources(question, top_k)

    return [
        item["text"]
        for item in results
    ]
