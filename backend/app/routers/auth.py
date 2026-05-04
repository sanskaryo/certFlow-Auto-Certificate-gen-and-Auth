from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.models.user import UserCreate, UserOut, Token
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.database import get_database
import jwt
from typing import Any
import re

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
    user["id"] = str(user["_id"])
    return user


@router.get("/me", response_model=UserOut)
async def get_me(current_user: Any = Depends(get_current_user)) -> Any:
    return current_user

@router.get("/my-organization")
async def get_my_organization(current_user: Any = Depends(get_current_user)) -> Any:
    db = get_database()
    org_id = current_user.get("organization_id")
    if not org_id or not ObjectId.is_valid(org_id):
        return None
    org = await db.organizations.find_one({"_id": ObjectId(org_id)})
    if org:
        org["id"] = str(org["_id"])
        return org
    return None

@router.post("/register", response_model=UserOut)
async def register(user_in: UserCreate) -> Any:
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    hashed_password = get_password_hash(user_in.password)
    user_dict = user_in.model_dump()
    user_dict["hashed_password"] = hashed_password
    del user_dict["password"]

    if not user_dict.get("username"):
        local = str(user_dict["email"]).split("@")[0]
        user_dict["username"] = await _unique_username(db, local)

    # Automatically create a default free organization for the new user
    import datetime
    org_doc = {
        "name": f"{user_dict.get('name', 'User')}'s Organization",
        "plan": "free",
        "max_certs": 100,
        "certs_issued": 0,
        "owner_user_id": None, # Will set after user creation
        "created_at": datetime.datetime.utcnow()
    }
    org_res = await db.organizations.insert_one(org_doc)
    org_id = str(org_res.inserted_id)

    user_dict["organization_id"] = org_id
    if user_dict.get("role") == "admin":
        user_dict["role"] = "user" # Ensure default role is user unless specified by superadmin later

    result = await db.users.insert_one(user_dict)
    user_id = str(result.inserted_id)
    user_dict["id"] = user_id
    
    # Update org with owner id
    await db.organizations.update_one({"_id": org_res.inserted_id}, {"$set": {"owner_user_id": user_id}})

    return user_dict

async def get_superadmin_user(current_user: Any = Depends(get_current_user)) -> Any:
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return current_user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    db = get_database()
    user_dict = await db.users.find_one({"email": form_data.username})
    if not user_dict:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not verify_password(form_data.password, user_dict["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": user_dict["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

from pydantic import BaseModel
import secrets
import datetime
from bson import ObjectId

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, current_user: Any = Depends(get_current_user)):
    db = get_database()
    if not verify_password(req.current_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    
    hashed = get_password_hash(req.new_password)
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": {"hashed_password": hashed}})
    return {"message": "Password updated successfully"}

class ApiKeyCreate(BaseModel):
    name: str

@router.post("/api-keys")
async def create_api_key(req: ApiKeyCreate, current_user: Any = Depends(get_current_user)):
    db = get_database()
    raw_key = "sk-" + secrets.token_hex(24)
    key_doc = {
        "user_id": str(current_user["_id"]),
        "name": req.name,
        "key": raw_key, # we store raw for simplicity, ideally hashed but user needs it masked
        "created_at": datetime.datetime.utcnow(),
        "last_used_at": None
    }
    res = await db.api_keys.insert_one(key_doc)
    return {"id": str(res.inserted_id), "name": req.name, "key": raw_key, "created_at": key_doc["created_at"]}

@router.get("/api-keys")
async def get_api_keys(current_user: Any = Depends(get_current_user)):
    db = get_database()
    keys = await db.api_keys.find({"user_id": str(current_user["_id"])}).to_list(length=None)
    result = []
    for k in keys:
        raw = k.get("key", "")
        masked = f"sk-••••••••{raw[-4:]}" if len(raw) > 4 else "sk-••••••••"
        result.append({
            "id": str(k["_id"]),
            "name": k.get("name"),
            "key_masked": masked,
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
