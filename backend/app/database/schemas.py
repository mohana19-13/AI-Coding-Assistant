
from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    user_id: int
    title: str = "New Chat"


class ConversationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatCreate(BaseModel):
    user_id: int
    question: str
    answer: str
    conversation_id: int | None = None


class ChatResponse(BaseModel):
    id: int
    user_id: int
    conversation_id: int | None
    question: str
    answer: str | None
    created_at: datetime

    class Config:
        from_attributes = True
