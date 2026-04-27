from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import auth, events, profiles, verification
from app.routers import settings as settings_router
from app.middleware.custom_domain import CustomDomainMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(title="CertFlow API", lifespan=lifespan)


def _allowed_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if raw:
        parsed = [origin.strip() for origin in raw.split(",") if origin.strip()]
        if parsed:
            return parsed
    return ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(CustomDomainMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

app.include_router(auth.router)
app.include_router(events.router)
app.include_router(profiles.router)
app.include_router(verification.router)
app.include_router(settings_router.router)
from app.routers import analytics, admin

app.include_router(analytics.router)
app.include_router(admin.router)
# Mount uploads directory for previewing AI backgrounds
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
async def root():
    return {"message": "Welcome to CertFlow API"}
# trigger reload again
