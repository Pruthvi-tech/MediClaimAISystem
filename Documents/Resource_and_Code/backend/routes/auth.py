from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from database import get_db
from models.schemas import OTPRequest, OTPVerify, UserCreate, TokenResponse
from utils.auth import generate_otp, create_access_token
from services.email_service import send_email, otp_email

router = APIRouter(prefix="/auth", tags=["Auth"])

OTP_EXPIRY_MINUTES   = 5
RESEND_COOLDOWN_SECONDS = 60
MAX_VERIFY_ATTEMPTS  = 5

# ── Send OTP ──────────────────────────────────────────────────────────────────

@router.post("/send-otp")
async def send_otp(body: OTPRequest, db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    existing = await db.otps.find_one({"email": body.email})

    if existing:
        last_sent = existing.get("sent_at")
        if last_sent:
            if last_sent.tzinfo is None:
                last_sent = last_sent.replace(tzinfo=timezone.utc)
            elapsed = (now - last_sent).total_seconds()
            if elapsed < RESEND_COOLDOWN_SECONDS:
                wait = int(RESEND_COOLDOWN_SECONDS - elapsed)
                raise HTTPException(429, f"Please wait {wait}s before requesting another OTP.")

    otp      = generate_otp()
    expires  = now + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.otps.update_one(
        {"email": body.email},
        {"$set": {"otp": otp, "expires_at": expires, "sent_at": now, "attempts": 0}},
        upsert=True,
    )
    send_email(body.email, "Your MediClaim OTP", otp_email(otp, OTP_EXPIRY_MINUTES))
    return {"message": "OTP sent successfully", "expires_in_seconds": OTP_EXPIRY_MINUTES * 60, "dev_otp": otp}


# ── Verify OTP ────────────────────────────────────────────────────────────────

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: OTPVerify, db=Depends(get_db)):
    now    = datetime.now(timezone.utc)
    record = await db.otps.find_one({"email": body.email})

    if not record:
        raise HTTPException(400, "No OTP found. Request a new one.")

    if record.get("attempts", 0) >= MAX_VERIFY_ATTEMPTS:
        await db.otps.delete_one({"email": body.email})
        raise HTTPException(429, "Too many attempts. Request a new OTP.")

    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        await db.otps.delete_one({"email": body.email})
        raise HTTPException(400, "OTP expired. Request a new one.")

    if record["otp"] != body.otp.strip():
        await db.otps.update_one({"email": body.email}, {"$inc": {"attempts": 1}})
        remaining = MAX_VERIFY_ATTEMPTS - record.get("attempts", 0) - 1
        raise HTTPException(400, f"Invalid OTP. {remaining} attempt(s) remaining.")

    await db.otps.delete_one({"email": body.email})

    user = await db.users.find_one({"email": body.email})

    if not user:
        # ── NEW EMAIL: only auto-create as regular user ───────────────────────
        # Insurer accounts must be pre-registered via POST /auth/register
        if body.intended_role == "insurer":
            raise HTTPException(
                403,
                "No provider account found for this email. "
                "Ask your admin to register you via POST /auth/register with role=insurer."
            )
        new_user = {
            "email":      body.email,
            "name":       body.email.split("@")[0],
            "role":       "user",
            "created_at": now,
        }
        await db.users.insert_one(new_user)
        user = await db.users.find_one({"email": body.email})

    else:
        # ── EXISTING USER: validate role matches the tab they chose ───────────
        if body.intended_role == "insurer" and user["role"] not in ("insurer", "admin"):
            raise HTTPException(
                403,
                "This account is not registered as an insurance provider. "
                "Please use the Patient / User tab to sign in."
            )
        if body.intended_role == "user" and user["role"] == "insurer":
            raise HTTPException(
                403,
                "This is a provider account. Please use the Insurance Provider tab to sign in."
            )

    token = create_access_token({"email": user["email"], "role": user["role"]})
    return {
        "access_token": token,
        "user": {
            "email":        user["email"],
            "name":         user["name"],
            "role":         user["role"],
            "company_name": user.get("company_name"),
        },
    }


# ── OTP status ────────────────────────────────────────────────────────────────

@router.get("/otp-status")
async def otp_status(email: str, db=Depends(get_db)):
    now    = datetime.now(timezone.utc)
    record = await db.otps.find_one({"email": email})
    if not record:
        return {"active": False}
    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    remaining = int((expires_at - now).total_seconds())
    if remaining <= 0:
        return {"active": False}
    sent_at = record.get("sent_at", now)
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    resend_in = max(0, int(RESEND_COOLDOWN_SECONDS - (now - sent_at).total_seconds()))
    return {
        "active":            True,
        "expires_in_seconds": remaining,
        "resend_in_seconds":  resend_in,
        "attempts_remaining": MAX_VERIFY_ATTEMPTS - record.get("attempts", 0),
    }


# ── Register insurer / admin account (admin-only in production) ───────────────

@router.post("/register")
async def register(body: UserCreate, db=Depends(get_db)):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(409, "Email already registered.")
    if body.role == "insurer" and not body.company_name:
        raise HTTPException(400, "company_name is required for insurer accounts.")
    user = {**body.model_dump(), "created_at": datetime.now(timezone.utc)}
    await db.users.insert_one(user)
    return {"message": f"Account created. Role: {body.role}. Use OTP login to access."}