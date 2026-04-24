import os, shutil, uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from datetime import datetime, timezone
from database import get_db
from models.schemas import ClaimCreate, ClaimUpdate, ClaimReview, ClaimStatus
from utils.auth import generate_claim_id
from utils.dependencies import get_current_user, require_insurer
from services.ocr_service import extract_text_from_file, extract_fields
from services.email_service import send_email, claim_submitted_email, claim_status_email
from config import settings

router = APIRouter(prefix="/claims", tags=["Claims"])

MAX_FILE_MB = 10
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

INSURANCE_COMPANIES = [
    {"id": "star_health",    "name": "Star Health Insurance",      "email": "claims@starhealth.in"},
    {"id": "hdfc_ergo",      "name": "HDFC ERGO Health",           "email": "claims@hdfcergo.com"},
    {"id": "bajaj_allianz",  "name": "Bajaj Allianz Health",       "email": "claims@bajajallianz.co.in"},
    {"id": "icici_lombard",  "name": "ICICI Lombard Health",       "email": "claims@icicilombard.com"},
    {"id": "new_india",      "name": "New India Assurance",        "email": "claims@newindia.co.in"},
]

# ── List insurance companies ──────────────────────────────────────────────────

@router.get("/insurers")
async def list_insurers():
    return INSURANCE_COMPANIES

# ── Upload document → OCR extract (does NOT save claim yet) ──────────────────

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    insurance_company: str = Form(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # Validate extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: PDF, JPG, PNG, BMP, TIFF.")

    # Validate insurer
    valid_names = [c["name"] for c in INSURANCE_COMPANIES]
    if insurance_company not in valid_names:
        raise HTTPException(status_code=400, detail="Invalid insurance company.")

    # Validate file size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        raise HTTPException(status_code=413, detail=f"File too large ({size_mb:.1f} MB). Max {MAX_FILE_MB} MB.")

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_email = user["email"].replace("@", "_at_").replace(".", "_")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    uid = str(uuid.uuid4())[:8]
    filename = f"{safe_email}_{ts}_{uid}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    # Save upload record in DB (draft — not yet a submitted claim)
    upload_record = {
        "type": "upload_draft",
        "user_email": user["email"],
        "file_path": file_path,
        "original_filename": file.filename,
        "file_size_kb": round(len(contents) / 1024, 1),
        "insurance_company": insurance_company,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.uploads.insert_one(upload_record)
    upload_id = str(result.inserted_id)

    # OCR + NLP extraction
    extracted = {}
    ocr_error = None
    try:
        raw_text = extract_text_from_file(file_path)
        extracted = extract_fields(raw_text)
    except Exception as e:
        ocr_error = str(e)
        extracted = {k: None for k in [
            "patient_name","hospital_name","admission_date","discharge_date",
            "total_amount","diagnosis","doctor_name","policy_number","raw_text"
        ]}

    return {
        "upload_id": upload_id,
        "file_path": file_path,
        "original_filename": file.filename,
        "file_size_kb": round(len(contents) / 1024, 1),
        "insurance_company": insurance_company,
        "extracted_data": extracted,
        "ocr_warning": ocr_error,
    }

# ── Submit claim (after user reviews extracted fields) ────────────────────────

@router.post("/submit")
async def submit_claim(
    body: ClaimCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    claim_id = generate_claim_id()
    now = datetime.now(timezone.utc)

    claim = {
        "claim_id": claim_id,
        "user_email": user["email"],
        "user_name": user["name"],
        "insurance_company": body.insurance_company,
        "status": ClaimStatus.PENDING,
        "extracted_data": body.extracted_data.model_dump(exclude={"raw_text"}),
        "raw_text": body.extracted_data.raw_text,
        "document_path": body.document_path,
        "notes": body.notes,
        "remarks": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.claims.insert_one(claim)

    send_email(
        user["email"],
        f"Claim Submitted – {claim_id}",
        claim_submitted_email(claim_id, body.insurance_company),
    )

    return {"message": "Claim submitted successfully", "claim_id": claim_id}

# ── User: list own claims ─────────────────────────────────────────────────────

@router.get("/my")
async def my_claims(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = db.claims.find({"user_email": user["email"]}).sort("created_at", -1)
    claims = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        claims.append(c)
    return claims

# ── User: single claim ────────────────────────────────────────────────────────

@router.get("/{claim_id}")
async def get_claim(claim_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    c = await db.claims.find_one({"claim_id": claim_id})
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    if user["role"] == "user" and c["user_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")
    c["_id"] = str(c["_id"])
    return c

# ── Insurer: list routed claims ───────────────────────────────────────────────

@router.get("/insurer/all")
async def insurer_claims(user=Depends(require_insurer), db=Depends(get_db)):
    cursor = db.claims.find({"insurance_company": user["company_name"]}).sort("created_at", -1)
    claims = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        claims.append(c)
    return claims

# ── Insurer: approve / reject ─────────────────────────────────────────────────

@router.patch("/{claim_id}/review")
async def review_claim(
    claim_id: str,
    body: ClaimReview,
    user=Depends(require_insurer),
    db=Depends(get_db),
):
    c = await db.claims.find_one({"claim_id": claim_id})
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    if c["insurance_company"] != user["company_name"]:
        raise HTTPException(status_code=403, detail="Claim not routed to your company")

    await db.claims.update_one(
        {"claim_id": claim_id},
        {"$set": {"status": body.status, "remarks": body.remarks, "updated_at": datetime.now(timezone.utc)}},
    )
    send_email(
        c["user_email"],
        f"Claim {body.status.upper()} – {claim_id}",
        claim_status_email(claim_id, body.status, body.remarks or ""),
    )
    return {"message": f"Claim marked as {body.status}"}

# ── User: edit extracted fields ───────────────────────────────────────────────

@router.patch("/{claim_id}/edit")
async def edit_claim(
    claim_id: str,
    body: ClaimUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    c = await db.claims.find_one({"claim_id": claim_id})
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    if c["user_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if c["status"] != ClaimStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending claims can be edited")

    updates = {f"extracted_data.{k}": v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.claims.update_one({"claim_id": claim_id}, {"$set": updates})
    return {"message": "Claim updated"}