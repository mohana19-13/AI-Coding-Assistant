from app.llm.llm_client import ask_llm


question = "Explain Python lists in very simple terms."

answer = ask_llm(question)

print("\nAI ANSWER:")
print(answer)