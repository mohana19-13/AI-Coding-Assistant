
from pathlib import Path
from pypdf import PdfReader

from app.rag.vector_store import add_chunks


def split_text(text: str, chunk_size: int = 800, overlap: int = 100):
    """Split text into smaller chunks with overlap."""

    text = " ".join(text.split())

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = end - overlap

    return chunks


def extract_pdf_pages(file_path: str):
    """Extract text separately from each PDF page."""

    reader = PdfReader(file_path)
    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()

        if page_text and page_text.strip():
            pages.append({
                "page_number": page_number,
                "text": page_text
            })

    return pages


def process_document(file_path: str):
    """Read PDF or TXT, create page-aware chunks and store them."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError("Document not found")

    extension = path.suffix.lower()

    chunks = []
    page_numbers = []

    if extension == ".pdf":

        pages = extract_pdf_pages(str(path))

        for page in pages:
            page_chunks = split_text(page["text"])

            for chunk in page_chunks:
                chunks.append(chunk)
                page_numbers.append(page["page_number"])

    elif extension == ".txt":

        text = path.read_text(encoding="utf-8")
        chunks = split_text(text)
        page_numbers = [None] * len(chunks)

    else:
        raise ValueError("Only PDF and TXT files are supported")

    if not chunks:
        raise ValueError("No readable text found in document")

    result = add_chunks(
        chunks=chunks,
        source_name=path.name,
        pages=page_numbers
    )

    return {
        "filename": path.name,
        "total_chunks": len(chunks),
        "message": result["message"]
    }
