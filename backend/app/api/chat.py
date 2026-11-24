
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database.connection import get_db
from ..database.models import ChatHistory, User, Conversation
from ..database.schemas import (
    ChatCreate,
    ChatResponse,
    ConversationCreate,
    ConversationResponse
)
from ..llm.llm_client import ask_llm


router = APIRouter(prefix="/chat", tags=["Chat History"])


class ChatAskRequest(BaseModel):
    user_id: int
    conversation_id: int
    question: str


# CREATE NEW CONVERSATION
@router.post("/conversations", response_model=ConversationResponse)
def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == request.user_id
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    conversation = Conversation(
        user_id=request.user_id,
        title=request.title
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


# GET ALL CONVERSATIONS OF A USER
@router.get(
    "/conversations/user/{user_id}",
    response_model=list[ConversationResponse]
)
def get_conversations(
    user_id: int,
    db: Session = Depends(get_db)
):
    return (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.id.desc())
        .all()
    )


# GET MESSAGES FROM ONE CONVERSATION
@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[ChatResponse]
)
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return (
        db.query(ChatHistory)
        .filter(ChatHistory.conversation_id == conversation_id)
        .order_by(ChatHistory.id.asc())
        .all()
    )


# SAVE CHAT MANUALLY
@router.post("/", response_model=ChatResponse)
def create_chat(
    chat: ChatCreate,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == chat.user_id
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if chat.conversation_id is not None:
        conversation = db.query(Conversation).filter(
            Conversation.id == chat.conversation_id,
            Conversation.user_id == chat.user_id
        ).first()

        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )

    new_chat = ChatHistory(
        user_id=chat.user_id,
        conversation_id=chat.conversation_id,
        question=chat.question,
        answer=chat.answer
    )

    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    return new_chat


# GET ALL CHATS (LEGACY API)
@router.get("/", response_model=list[ChatResponse])
def get_chats(db: Session = Depends(get_db)):
    return db.query(ChatHistory).all()


# GET ALL CHATS OF ONE USER (LEGACY API)
@router.get("/user/{user_id}", response_model=list[ChatResponse])
def get_user_chats(
    user_id: int,
    db: Session = Depends(get_db)
):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.id.desc())
        .all()
    )


# ASK AI WITH SEPARATE CONVERSATION MEMORY
@router.post("/ask", response_model=ChatResponse)
def ask_ai(
    request: ChatAskRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == request.user_id
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    conversation = db.query(Conversation).filter(
        Conversation.id == request.conversation_id,
        Conversation.user_id == request.user_id
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    previous_chats = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.conversation_id == request.conversation_id
        )
        .order_by(ChatHistory.id.desc())
        .limit(5)
        .all()
    )

    conversation_history = []

    for chat in reversed(previous_chats):
        conversation_history.append({
            "question": chat.question,
            "answer": chat.answer or ""
        })

    try:
        answer = ask_llm(
            request.question,
            conversation_history
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {str(e)}"
        )

    new_chat = ChatHistory(
        user_id=request.user_id,
        conversation_id=request.conversation_id,
        question=request.question,
        answer=answer
    )

    db.add(new_chat)

    # Use the first question as the conversation title
    if not conversation_history:
        conversation.title = request.question[:45]

    db.commit()
    db.refresh(new_chat)

    return new_chat
