import random, string
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from config import settings

# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))

def otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

# ── JWT ───────────────────────────────────────────────────────────────────────

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

# ── Claim ID ──────────────────────────────────────────────────────────────────

def generate_claim_id() -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CLM-{ts}-{rand}"