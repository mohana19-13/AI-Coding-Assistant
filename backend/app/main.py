
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.agent import router as agent_router
from .api import users, chat
from app.api.documents import router as documents_router

app = FastAPI(title="AI Coding Assistant")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(users.router)
app.include_router(chat.router)
app.include_router(documents_router)
app.include_router(agent_router)


@app.get("/")
def home():
    return {"message": "AI Coding Assistant is running"}
