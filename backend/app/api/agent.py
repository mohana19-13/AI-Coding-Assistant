from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.agent import run_agent


router = APIRouter(
    prefix="/agent",
    tags=["AI Agent"]
)


class AgentRequest(BaseModel):
    question: str


@router.post("/ask")
def ask_agent(request: AgentRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    try:
        result = run_agent(request.question)

        return result

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Agent error: {str(error)}"
        )