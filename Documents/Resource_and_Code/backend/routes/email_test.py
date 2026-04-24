"""
routes/email_test.py
────────────────────
Test endpoint to verify SMTP config without submitting real claims.

  POST /email/test  { "to": "you@example.com", "type": "otp|submitted|approved|rejected" }
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from services.email_service import (
    send_email, otp_email, claim_submitted_email, claim_status_email
)
from utils.dependencies import get_current_user
from config import settings

router = APIRouter(prefix="/email", tags=["Email"])

class TestRequest(BaseModel):
    to:    EmailStr
    type:  str = "otp"   # otp | submitted | approved | rejected | under_review

SAMPLE_FIELDS = {
    "patient_name":   "Ravi Kumar Sharma",
    "hospital_name":  "Apollo Hospitals",
    "diagnosis":      "Acute Appendicitis",
    "total_amount":   "45,200",
    "admission_date": "10/06/2024",
}
SAMPLE_CLAIM_ID = "CLM2026001ABC"

@router.post("/test")
async def test_email(body: TestRequest, user=Depends(get_current_user)):
    if not settings.MAIL_USERNAME:
        raise HTTPException(
            status_code=503,
            detail="Email not configured. Set MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM in .env"
        )

    t = body.type.lower()

    if t == "otp":
        subject = "MediClaim – Test OTP Email"
        html    = otp_email("123456", 5)

    elif t == "submitted":
        subject = f"{SAMPLE_CLAIM_ID} Submitted – MediClaim"
        html    = claim_submitted_email(
            SAMPLE_CLAIM_ID, "Star Health Insurance", fields=SAMPLE_FIELDS
        )

    elif t in ("approved", "rejected", "under_review"):
        subject = f"{SAMPLE_CLAIM_ID} {t.replace('_',' ').title()} – MediClaim"
        html    = claim_status_email(
            SAMPLE_CLAIM_ID, t,
            remarks="Claim verified and approved as per policy terms." if t == "approved"
                    else ("Documents are incomplete. Please resubmit with discharge summary." if t == "rejected" else ""),
            fields=SAMPLE_FIELDS,
        )

    else:
        raise HTTPException(400, "type must be: otp, submitted, approved, rejected, under_review")

    send_email(body.to, subject, html)
    return {
        "message": f"Test '{t}' email queued → {body.to}",
        "smtp_server": f"{settings.MAIL_SERVER}:{settings.MAIL_PORT}",
        "from": settings.MAIL_FROM,
    }


@router.get("/status")
async def email_status(user=Depends(get_current_user)):
    """Check whether SMTP is configured."""
    configured = bool(settings.MAIL_USERNAME)
    return {
        "configured": configured,
        "server":     settings.MAIL_SERVER if configured else None,
        "port":       settings.MAIL_PORT   if configured else None,
        "from":       settings.MAIL_FROM   if configured else None,
        "hint":       None if configured else "Set MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM in backend/.env",
    }