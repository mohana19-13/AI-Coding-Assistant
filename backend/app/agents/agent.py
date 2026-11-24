from app.llm.llm_client import ask_llm
from app.rag.vector_store import search_chunks_with_sources


# STEP 1: DECIDE WHICH TOOL TO USE
def select_tool(question: str) -> str:

    question_lower = question.lower()

    document_keywords = [
        "uploaded document",
        "in the document",
        "from the document",
        "uploaded pdf",
        "this pdf",
        "according to the pdf",
        "in this file",
        "document says",
        "pdf says"
    ]

    for keyword in document_keywords:
        if keyword in question_lower:
            return "document_search"

    return "coding_assistant"


# STEP 2: EXECUTE THE SELECTED TOOL
def run_agent(question: str):

    selected_tool = select_tool(question)

    # TOOL 1: DOCUMENT SEARCH
    if selected_tool == "document_search":

        results = search_chunks_with_sources(
            question,
            top_k=3
        )

        if not results:
            return {
                "success": True,
                "selected_tool": selected_tool,
                "answer": "I could not find relevant information in the uploaded documents.",
                "sources": []
            }

        context = "\n\n".join(
            [
                f"Source: {item['source']}, "
                f"Page: {item['page_number']}\n"
                f"{item['text']}"
                for item in results
            ]
        )

        prompt = f"""
Answer the question using the document context below.

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

Rules:
1. Answer using the provided document context.
2. Do not invent information.
3. Explain in simple English.
4. If the answer is not available, say so.
"""

        answer = ask_llm(prompt)

        sources = [
            {
                "filename": item["source"],
                "page_number": item["page_number"]
            }
            for item in results
        ]

        return {
            "success": True,
            "selected_tool": selected_tool,
            "answer": answer,
            "sources": sources
        }

    # TOOL 2: CODING ASSISTANT
    answer = ask_llm(question)

    return {
        "success": True,
        "selected_tool": selected_tool,
        "answer": answer,
        "sources": []
    }