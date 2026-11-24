
from pathlib import Path
import shutil

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.rag.document_processor import process_document
from app.rag.vector_store import search_chunks_with_sources
from app.llm.llm_client import ask_llm


router = APIRouter(
    prefix="/documents",
    tags=["RAG Documents"]
)

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):

    allowed_extensions = [".pdf", ".txt"]
    extension = Path(file.filename or "").suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported"
        )

    file_path = UPLOAD_DIR / Path(file.filename).name

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = process_document(str(file_path))

        return {
            "success": True,
            "message": "Document uploaded successfully",
            **result
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        await file.close()


@router.post("/ask")
async def ask_document(question: str):

    try:
        retrieved_results = search_chunks_with_sources(
            question,
            top_k=3
        )

        if not retrieved_results:
            raise HTTPException(
                status_code=404,
                detail="No documents found. Upload a document first."
            )

        # Prepare context for the AI model
        context_parts = []

        for item in retrieved_results:
            source = item["source"]
            page_number = item["page_number"]

            if page_number is not None:
                source_info = f"Source: {source}, Page: {page_number}"
            else:
                source_info = f"Source: {source}"

            context_parts.append(
                f"{source_info}\n{item['text']}"
            )

        context = "\n\n".join(context_parts)

        prompt = f"""
You are a helpful document assistant.

Answer the question using only the provided document context.

If the answer is not present in the context,
say "This information is not available in the uploaded documents."

DOCUMENT CONTEXT:
{context}

QUESTION:
{question}

ANSWER:
"""

        answer = ask_llm(prompt)

        # Prepare source details for the frontend
        sources = []
        seen_sources = set()

        for item in retrieved_results:
            source_key = (
                item["source"],
                item["page_number"]
            )

            if source_key not in seen_sources:
                seen_sources.add(source_key)

                sources.append({
                    "filename": item["source"],
                    "page_number": item["page_number"]
                })

        return {
            "success": True,
            "question": question,
            "retrieved_chunks": len(retrieved_results),
            "answer": answer,
            "sources": sources
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
