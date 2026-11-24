
import requests

OLLAMA_EMBED_URL = "http://127.0.0.1:11434/api/embed"

EMBEDDING_MODEL = "nomic-embed-text"


def generate_embedding(text: str):

    if not text.strip():
        raise ValueError("Text cannot be empty")

    payload = {
        "model": EMBEDDING_MODEL,
        "input": text
    }

    try:
        response = requests.post(
            OLLAMA_EMBED_URL,
            json=payload,
            timeout=(10, 120)
        )

        response.raise_for_status()

        result = response.json()

        return result["embeddings"][0]

    except requests.exceptions.RequestException as error:
        raise Exception(f"Embedding generation failed: {error}")
