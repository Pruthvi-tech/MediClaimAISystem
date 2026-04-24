from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db
from utils.auth import decode_token

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db=Depends(get_db),
):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await db.users.find_one({"email": payload.get("email")})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

async def require_insurer(user=Depends(get_current_user)):
    if user.get("role") not in ("insurer", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insurer access required")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user