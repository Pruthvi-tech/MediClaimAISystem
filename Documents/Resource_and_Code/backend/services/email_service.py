import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings
import logging

logger = logging.getLogger(__name__)

def send_email(to: str, subject: str, body_html: str):
    """Send an email. Fails silently with a log if SMTP not configured."""
    if not settings.MAIL_USERNAME:
        logger.warning(f"[EMAIL SKIPPED] To: {to} | Subject: {subject}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
            server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, to, msg.as_string())
        logger.info(f"Email sent to {to}")
    except Exception as e:
        logger.error(f"Email failed: {e}")

# ── Templates ─────────────────────────────────────────────────────────────────

def otp_email(otp: str, expiry_minutes: int) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
      <h2 style="color:#1e40af">MediClaim – Your OTP</h2>
      <p>Use the code below to log in. It expires in <b>{expiry_minutes} minutes</b>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e40af;margin:24px 0">{otp}</div>
      <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email.</p>
    </div>"""

def claim_submitted_email(claim_id: str, insurance: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
      <h2 style="color:#1e40af">Claim Submitted ✅</h2>
      <p>Your claim has been successfully submitted to <b>{insurance}</b>.</p>
      <p><b>Claim ID:</b> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">{claim_id}</code></p>
      <p>You can track your claim status from your dashboard.</p>
    </div>"""

def claim_status_email(claim_id: str, status: str, remarks: str = "") -> str:
    color = "#16a34a" if status == "approved" else "#dc2626"
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
      <h2 style="color:{color}">Claim {status.upper()}</h2>
      <p><b>Claim ID:</b> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">{claim_id}</code></p>
      {"<p><b>Remarks:</b> " + remarks + "</p>" if remarks else ""}
    </div>"""