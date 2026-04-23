from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.models.user import UserCreate, UserOut, Token, ChangePasswordRequest, ApiKeyCreate
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.database import get_database
from app.core.ratelimit import limiter
import jwt
from typing import Any
import re
import secrets
from datetime import datetime, timezone
import hashlib
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def _slugify_username(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "", value.lower().replace(" ", "_"))
    return cleaned[:24] or "user"

async def _unique_username(db, base: str) -> str:
    candidate = _slugify_username(base)
    i = 0
    while await db.users.find_one({"username": candidate}):
        i += 1
        candidate = f"{_slugify_username(base)}{i}"
    return candidate

def _validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not any(char.isdigit() for char in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit")
    if not any(char.isupper() for char in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    user = await db.users.find_one({"email": email})
    if not user:
        raise credentials_exception
        
    if user.get("disabled"):
        raise HTTPException(status_code=403, detail="Account is disabled. Please contact support.")

    user["id"] = str(user["_id"])
    return user

@router.get("/me", response_model=UserOut)
async def get_me(current_user: Any = Depends(get_current_user)) -> Any:
    return current_user

@router.post("/register", response_model=UserOut)
@limiter.limit("10/hour")
async def register(request: Request, user_in: UserCreate) -> Any:
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    _validate_password_strength(user_in.password)

    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    hashed_password = get_password_hash(user_in.password)
    user_dict = user_in.model_dump()
    user_dict["hashed_password"] = hashed_password
    user_dict["created_at"] = datetime.now(timezone.utc)
    user_dict["role"] = "user"
    user_dict["disabled"] = False
    
    del user_dict["password"]

    if not user_dict.get("username"):
        local = str(user_dict["email"]).split("@")[0]
        user_dict["username"] = await _unique_username(db, local)

    result = await db.users.insert_one(user_dict)
    user_dict["id"] = str(result.inserted_id)
    return user_dict

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    db = get_database()
    user_dict = await db.users.find_one({"email": form_data.username})
    if not user_dict:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if user_dict.get("disabled"):
        raise HTTPException(status_code=403, detail="Account is disabled")

    if not verify_password(form_data.password, user_dict["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": user_dict["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(request: Request, req: ChangePasswordRequest, current_user: Any = Depends(get_current_user)):
    db = get_database()
    if not verify_password(req.current_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    
    _validate_password_strength(req.new_password)
    
    hashed = get_password_hash(req.new_password)
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": {"hashed_password": hashed}})
    return {"message": "Password updated successfully"}

@router.post("/api-keys")
@limiter.limit("10/hour")
async def create_api_key(request: Request, req: ApiKeyCreate, current_user: Any = Depends(get_current_user)):
    db = get_database()
    raw_key = "sk-" + secrets.token_hex(24)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    key_doc = {
        "user_id": str(current_user["_id"]),
        "name": req.name,
        "key_hash": key_hash,
        "key_prefix": raw_key[:12],
        "created_at": datetime.now(timezone.utc),
        "last_used_at": None
    }
    res = await db.api_keys.insert_one(key_doc)
    return {
        "id": str(res.inserted_id), 
        "name": req.name, 
        "key": raw_key,
        "created_at": key_doc["created_at"]
    }

@router.get("/api-keys")
async def get_api_keys(current_user: Any = Depends(get_current_user)):
    db = get_database()
    keys = await db.api_keys.find({"user_id": str(current_user["_id"])}).to_list(length=None)
    result = []
    for k in keys:
        prefix = k.get("key_prefix", "sk-••••••••")
        result.append({
            "id": str(k["_id"]),
            "name": k.get("name"),
            "key_masked": f"{prefix}••••••••",
            "created_at": k.get("created_at"),
            "last_used_at": k.get("last_used_at")
        })
    return result

@router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str, current_user: Any = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(key_id):
        raise HTTPException(status_code=400, detail="Invalid API key ID")
    res = await db.api_keys.delete_one({"_id": ObjectId(key_id), "user_id": str(current_user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key revoked"}
