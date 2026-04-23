import sys
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "CertFlow API"
    ENVIRONMENT: str = Field(default="development")
    
    # Required in production
    MONGODB_URL: str = Field(default="mongodb://localhost:27017/certflow")
    DATABASE_NAME: str = "certflow"
    
    FRONTEND_VERIFY_BASE_URL: str = "http://localhost:5173/verify/"
    
    # Security
    SECRET_KEY: str = Field(default="placeholder-for-dev-only")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"]

    # AI Keys
    gemini_api_key: str | None = None
    openai_api_key: str | None = None
    
    # SMTP
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info):
        # We check both value and tags to ensure it was changed
        if info.data.get("ENVIRONMENT") == "production":
            if not v or v == "placeholder-for-dev-only" or "change-in-production" in v:
                print("\n[CRITICAL ERROR] PRODUCTION ENVIRONMENT DETECTED BUT NO SECURE SECRET_KEY PROVIDED.")
                print("Please set a long random string as SECRET_KEY in your environment variables.\n")
                sys.exit(1)
        return v

    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore", 
        populate_by_name=True,
        env_prefix=""
    )

settings = Settings()
