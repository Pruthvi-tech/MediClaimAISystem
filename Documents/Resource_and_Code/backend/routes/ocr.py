"""
routes/ocr.py
─────────────
Standalone OCR endpoints:
  POST /ocr/extract   – upload any document, get structured JSON back
  GET  /ocr/sample    – returns a fake result for frontend development
"""
print("OCR FILE LOADED ✅")
import os, shutil, uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from datetime import datetime

from services.ocr_service import extract_text_from_file, extract_fields
from utils.dependencies import get_current_user
from config import settings

router = APIRouter(prefix="/ocr", tags=["OCR"])

ALLOWED = {".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
MAX_MB  = 10

# ── POST /ocr/extract ─────────────────────────────────────────────────────────

@router.post("/extract")
async def ocr_extract(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """
    Upload a PDF or image; receive structured extracted fields + confidence.

    Response shape:
    {
      "filename":       "bill.pdf",
      "file_size_kb":   142.3,
      "ocr_quality":    87,          # 0-100
      "fields": {
        "patient_name":   "Ravi Kumar",
        "hospital_name":  "Apollo Hospitals",
        "admission_date": "10/06/2024",
        "discharge_date": "14/06/2024",
        "total_amount":   "45,200",
        "diagnosis":      "Appendicitis",
        "doctor_name":    "Dr. Anita Sharma",
        "policy_number":  "SH2024001234"
      },
      "confidence": {
        "patient_name": 85, ...
      },
      "raw_text":  "..."   // first 4 000 chars
    }
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type '{ext}'.")

    data = await file.read()
    if len(data) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_MB} MB limit.")

    # Save to temp location
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    tmp_name = f"ocr_test_{uuid.uuid4().hex[:8]}{ext}"
    tmp_path = os.path.join(settings.UPLOAD_DIR, tmp_name)
    with open(tmp_path, "wb") as f:
        f.write(data)

    try:
        raw_text  = extract_text_from_file(tmp_path)
        extracted = extract_fields(raw_text)
    except Exception as exc:
        raise HTTPException(500, f"OCR failed: {exc}")
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    # Separate top-level fields from metadata keys
    meta_keys = {"confidence", "ocr_quality", "raw_text"}
    fields = {k: v for k, v in extracted.items() if k not in meta_keys}

    return {
        "filename":     file.filename,
        "file_size_kb": round(len(data) / 1024, 1),
        "ocr_quality":  extracted.get("ocr_quality", 0),
        "fields":       fields,
        "confidence":   extracted.get("confidence", {}),
        "raw_text":     extracted.get("raw_text", ""),
        "extracted_at": datetime.utcnow().isoformat() + "Z",
    }


# ── GET /ocr/sample ───────────────────────────────────────────────────────────

@router.get("/sample")
async def ocr_sample():
    """
    Returns a realistic sample extraction result.
    Useful for frontend development without a real document.
    """
    return {
        "filename":     "apollo_discharge_summary.pdf",
        "file_size_kb": 218.4,
        "ocr_quality":  91,
        "fields": {
            "patient_name":    "Ravi Kumar Sharma",
            "hospital_name":   "Apollo Hospitals",
            "admission_date":  "10/06/2024",
            "discharge_date":  "14/06/2024",
            "total_amount":    "45,200",
            "diagnosis":       "Acute Appendicitis",
            "doctor_name":     "Dr. Anita Mehra",
            "policy_number":   "SH20240012345",
        },
        "confidence": {
            "patient_name":    85,
            "hospital_name":   90,
            "admission_date":  80,
            "discharge_date":  80,
            "total_amount":    95,
            "diagnosis":       75,
            "doctor_name":     70,
            "policy_number":   88,
        },
        "raw_text": (
            "APOLLO HOSPITALS\n"
            "Discharge Summary\n\n"
            "Patient Name : Ravi Kumar Sharma\n"
            "Date of Admission : 10/06/2024\n"
            "Date of Discharge : 14/06/2024\n"
            "Treating Doctor : Dr. Anita Mehra\n"
            "Diagnosis : Acute Appendicitis\n"
            "Policy No. : SH20240012345\n\n"
            "Grand Total : ₹45,200\n"
        ),
        "extracted_at": datetime.utcnow().isoformat() + "Z",
        "note": "This is sample data for development purposes.",
    }