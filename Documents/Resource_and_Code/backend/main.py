from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from database import connect_db, close_db
from routes import auth, claims, analytics, ocr
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    await close_db()

app = FastAPI(
    title="MediClaim API",
    version="1.0.0",
    description="AI-Based Medical Claims Processing System",
    lifespan=lifespan,
)

# CORS – allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router)
app.include_router(claims.router)
app.include_router(analytics.router)
app.include_router(ocr.router)

# Serve uploaded files (for document preview)
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
async def root():
    return {"message": "MediClaim API is running 🏥", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}