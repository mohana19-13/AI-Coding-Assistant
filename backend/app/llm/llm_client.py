
import requests

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:1.5b"


TUTOR_INSTRUCTIONS = """
You are a friendly programming tutor for beginners.

TEACHING RULES:

1. Explain concepts in simple English.
2. Give complete explanations.
3. Never stop in the middle of a sentence or example.
4. Explain one concept at a time.
5. Use small examples.
6. Do not give the complete program immediately.
7. Give hints and guide the learner step by step.
8. Ask one simple practice question at the end.
9. Wait for the learner's attempt before giving the next hint.
10. Give the complete solution only when the learner
    explicitly requests it.
11. Keep answers clear and beginner-friendly.

IMPORTANT:
Finish every explanation properly.
Never leave a heading or sentence incomplete.
"""


def ask_llm(question: str, conversation_history=None) -> str:

    history_text = ""

    if conversation_history:
        for chat in conversation_history:
            history_text += f"""
Previous question: {chat['question']}
Previous answer: {chat['answer']}
"""

    prompt = f"""
{TUTOR_INSTRUCTIONS}

CONVERSATION HISTORY:
{history_text}

CURRENT QUESTION:
{question}

Remember:
Teach step by step.
Do not reveal the complete solution unless the learner
explicitly asks for it.
Finish your explanation properly.
"""

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "5m",
        "options": {
            "num_predict": 1500,
            "temperature": 0.3
        }
    }

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=(10, 300)
        )

        response.raise_for_status()

        result = response.json()

        return result["response"].strip()

    except requests.exceptions.Timeout:
        return "Ollama is taking too long. Please try again."

    except requests.exceptions.RequestException as e:
        raise Exception(f"Ollama connection failed: {e}")
