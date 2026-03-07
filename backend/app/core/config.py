from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CertFlow API"
    MONGODB_URL: str = Field(default="mongodb+srv://sankhuzzy:VvksMgQY2mUN77nZ@cluster0.4dob0.mongodb.net/my-courses-app", alias="MONGO_URL")
    FRONTEND_VERIFY_BASE_URL: str = "http://localhost:5173/verify/"
    DATABASE_NAME: str = "certflow"
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    gemini_api_key: str | None = None
    openai_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

settings = Settings()
