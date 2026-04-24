"""
ocr_service.py
──────────────
Text extraction (Tesseract + PyMuPDF) and NLP field parsing.
Returns structured JSON with per-field confidence scores.
"""

import re
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_file(file_path: str) -> str:
    """Return raw OCR text from a PDF or image file."""
    ext = Path(file_path).suffix.lower()
    try:
        if ext == ".pdf":
            return _pdf_to_text(file_path)
        elif ext in {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}:
            return _image_to_text(file_path)
        else:
            raise ValueError(f"Unsupported extension: {ext}")
    except Exception as exc:
        logger.error("OCR failed for %s: %s", file_path, exc)
        return ""


def extract_fields(raw_text: str) -> dict:
    """
    Parse raw OCR text into structured fields.

    Returns a dict with:
      - one key per field (str | None)
      - 'confidence'  dict[field -> 0-100]
      - 'ocr_quality' overall quality estimate (0-100)
      - 'raw_text'    first 4 000 chars of source text
    """
    text = _clean(raw_text)
    lines = text.splitlines()

    fields = {
        "patient_name":    _patient_name(text, lines),
        "hospital_name":   _hospital_name(text, lines),
        "admission_date":  _date(text, "admission"),
        "discharge_date":  _date(text, "discharge"),
        "total_amount":    _amount(text),
        "diagnosis":       _diagnosis(text, lines),
        "doctor_name":     _doctor_name(text, lines),
        "policy_number":   _policy_number(text),
    }

    confidence = {k: _confidence(k, v, text) for k, v in fields.items()}
    filled     = sum(1 for v in fields.values() if v)
    ocr_quality = _ocr_quality(raw_text, filled)

    return {
        **fields,
        "confidence":   confidence,
        "ocr_quality":  ocr_quality,
        "raw_text":     raw_text[:4000],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Text extraction helpers
# ─────────────────────────────────────────────────────────────────────────────

def _pdf_to_text(path: str) -> str:
    import fitz  # PyMuPDF
    doc   = fitz.open(path)
    parts = []
    for page in doc:
        native = page.get_text().strip()
        if native:
            parts.append(native)
        else:
            # Scanned page → rasterise → Tesseract
            tmp = path + f"_p{page.number}.png"
            page.get_pixmap(dpi=250).save(tmp)
            parts.append(_image_to_text(tmp))
            os.remove(tmp)
    doc.close()
    return "\n".join(parts)


def _image_to_text(path: str) -> str:
    import pytesseract
    from PIL import Image, ImageFilter, ImageEnhance

    img = Image.open(path).convert("RGB")

    # Light pre-processing: sharpen + mild contrast boost
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.3)

    # Try two Tesseract page-seg modes; pick the longer result
    cfg_a = "--psm 6 --oem 3"   # uniform block
    cfg_b = "--psm 4 --oem 3"   # single column

    text_a = pytesseract.image_to_string(img, config=cfg_a)
    text_b = pytesseract.image_to_string(img, config=cfg_b)
    return text_a if len(text_a) >= len(text_b) else text_b


# ─────────────────────────────────────────────────────────────────────────────
# Text cleaning
# ─────────────────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    """Normalise whitespace; keep meaningful punctuation."""
    text = re.sub(r"[ \t]+", " ", text)          # collapse horizontal ws
    text = re.sub(r"\n{3,}", "\n\n", text)        # max 2 blank lines
    text = text.replace("\r", "\n")
    return text.strip()


# ─────────────────────────────────────────────────────────────────────────────
# Field extractors
# ─────────────────────────────────────────────────────────────────────────────

# ── Patient name ──────────────────────────────────────────────────────────────
def _patient_name(text: str, lines: list[str]) -> str | None:
    patterns = [
        r"(?:patient(?:'?s)?\s*(?:full\s*)?name|name\s+of\s+patient)\s*[:\-]\s*([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){0,4})",
        r"(?:patient|pt\.?)\s*[:\-]\s*([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){1,4})",
        r"(?:^|\n)\s*Name\s*[:\-]\s*([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){1,4})",
        r"(?:insured|member|beneficiary)\s*[:\-]\s*([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){1,4})",
        # "Mr./Ms./Mrs. Firstname Lastname"
        r"(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,4})",
    ]
    val = _first(patterns, text, flags=re.IGNORECASE | re.MULTILINE)
    return _title(val)


# ── Hospital name ─────────────────────────────────────────────────────────────
def _hospital_name(text: str, lines: list[str]) -> str | None:
    patterns = [
        r"(?:hospital|clinic|medical\s+cent(?:re|er)|health\s*care|nursing\s+home)\s*[:\-]\s*([A-Za-z][A-Za-z\s\.&,\-']{2,60})",
        r"([A-Z][A-Za-z\s\.&'\-]{2,50}(?:Hospital|Clinic|Medical\s+Cent(?:re|er)|Healthcare|Nursing\s+Home|Health\s+Centre))",
        r"(?:name\s+of\s+hospital|facility\s+name)\s*[:\-]\s*([A-Za-z][A-Za-z\s\.&,\-']{2,60})",
    ]
    val = _first(patterns, text, flags=re.IGNORECASE)
    return _title(val) if val else _hospital_from_header(lines)


def _hospital_from_header(lines: list[str]) -> str | None:
    """First non-empty line that looks like an institution name."""
    HOSP_WORDS = re.compile(
        r"\b(hospital|clinic|health|medical|care|centre|center|nursing)\b", re.I
    )
    for line in lines[:8]:
        clean = line.strip()
        if len(clean) > 5 and HOSP_WORDS.search(clean):
            return _title(clean)
    return None


# ── Dates ─────────────────────────────────────────────────────────────────────
_DATE_PAT = (
    r"(?:"
    r"\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}"     # 12/03/2024
    r"|(?:\d{1,2}\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|"
    r"May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|"
    r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"[\s,\.]*\d{0,2}[\s,\.]*\d{4}"               # 12 March 2024
    r")"
)

def _date(text: str, kind: str) -> str | None:
    if kind == "admission":
        anchors = [
            r"(?:date\s+of\s+admission|admission\s+date|admitted(?:\s+on)?|d\.?o\.?a\.?|from(?:\s+date)?)",
            r"(?:check[\s\-]?in|in[\s\-]?date|ward\s+entry)",
        ]
    else:
        anchors = [
            r"(?:date\s+of\s+discharge|discharge\s+date|discharged(?:\s+on)?|d\.?o\.?d\.?|to(?:\s+date)?)",
            r"(?:check[\s\-]?out|out[\s\-]?date|ward\s+exit|released)",
        ]

    for anchor in anchors:
        m = re.search(rf"{anchor}\s*[:\-]?\s*({_DATE_PAT})", text, re.IGNORECASE)
        if m:
            return m.group(1).strip()

    # Fallback: pick first / second bare date in document
    all_dates = re.findall(_DATE_PAT, text, re.IGNORECASE)
    if all_dates:
        return all_dates[0] if kind == "admission" else (all_dates[1] if len(all_dates) > 1 else all_dates[0])
    return None


# ── Amount ────────────────────────────────────────────────────────────────────
def _amount(text: str) -> str | None:
    # Prefer explicit "total" labels; fallback to largest ₹ figure
    primary = [
        r"(?:grand\s+total|total\s+amount|total\s+bill(?:ed)?|net\s+(?:amount\s+)?payable|amount\s+(?:due|payable|charged))\s*[:\-]?\s*[₹$Rs\.]*\s*(\d[\d,\.]+)",
        r"(?:total)\s*[:\-]?\s*[₹$Rs\.]*\s*(\d[\d,\.]+)",
    ]
    val = _first(primary, text, flags=re.IGNORECASE)
    if val:
        return _normalise_amount(val)

    # Fallback: find all currency amounts, return largest
    hits = re.findall(r"[₹$]\s*(\d[\d,\.]+)", text)
    if hits:
        nums = [_normalise_amount(h) for h in hits]
        nums_float = []
        for n in nums:
            try:
                nums_float.append((float(n.replace(",", "")), n))
            except ValueError:
                pass
        if nums_float:
            return max(nums_float, key=lambda x: x[0])[1]
    return None


def _normalise_amount(val: str) -> str:
    """Strip stray chars; keep digits, commas, single dot."""
    val = re.sub(r"[^\d,\.]", "", val).strip(".,")
    # If multiple dots, keep only last (likely decimal separator)
    parts = val.split(".")
    if len(parts) > 2:
        val = "".join(parts[:-1]) + "." + parts[-1]
    return val


# ── Diagnosis ─────────────────────────────────────────────────────────────────
def _diagnosis(text: str, lines: list[str]) -> str | None:
    patterns = [
        r"(?:primary\s+)?diagnosis\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s,\.\-\/\(\)]{3,100})",
        r"(?:diagnosed\s+with|presenting\s+complaint|chief\s+complaint|indication)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s,\.\-\/\(\)]{3,100})",
        r"(?:condition|disease|ailment|illness|icd[\s\-]?(?:code)?)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s,\.\-\/\(\)]{3,100})",
        r"(?:procedure|surgery|operation)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s,\.\-\/\(\)]{3,100})",
    ]
    val = _first(patterns, text, flags=re.IGNORECASE)
    return _truncate(val, 100)


# ── Doctor name ───────────────────────────────────────────────────────────────
def _doctor_name(text: str, lines: list[str]) -> str | None:
    patterns = [
        r"(?:treating\s+(?:doctor|physician|surgeon)|attending\s+(?:doctor|physician)|consultant|referred\s+by)\s*[:\-]\s*(?:Dr\.?\s*)?([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){1,4})",
        r"(?:doctor|physician|surgeon|consultant)\s*(?:name)?\s*[:\-]\s*(?:Dr\.?\s*)?([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){1,4})",
        r"(?:Dr\.|Doctor)\s+([A-Z][A-Za-z'\-\.]+(?:\s+[A-Z][A-Za-z'\-\.]+){1,4})",
    ]
    val = _first(patterns, text, flags=re.IGNORECASE)
    return "Dr. " + _title(val) if val and not val.lower().startswith("dr") else _title(val)


# ── Policy number ─────────────────────────────────────────────────────────────
def _policy_number(text: str) -> str | None:
    patterns = [
        r"(?:policy\s*(?:no\.?|number|#|id)|policy)\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\-\/\.]{4,24})",
        r"(?:member\s*(?:id|no)|card\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{4,24})",
        r"(?:TPA|UIN|health\s+ID)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{4,24})",
    ]
    return _first(patterns, text, flags=re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────────
# Confidence scoring  (simple heuristic 0–100)
# ─────────────────────────────────────────────────────────────────────────────

_FIELD_KEYWORDS = {
    "patient_name":   ["patient", "name", "insured", "member"],
    "hospital_name":  ["hospital", "clinic", "medical", "health"],
    "admission_date": ["admission", "admitted", "doa", "from"],
    "discharge_date": ["discharge", "discharged", "dod", "to date"],
    "total_amount":   ["total", "amount", "payable", "bill", "grand"],
    "diagnosis":      ["diagnosis", "diagnosed", "condition", "disease"],
    "doctor_name":    ["doctor", "dr.", "physician", "consultant"],
    "policy_number":  ["policy", "member id", "uin", "card no"],
}

def _confidence(field: str, value: str | None, text: str) -> int:
    if not value:
        return 0
    # Base score for having a value
    score = 40
    tl = text.lower()
    # Bonus if a keyword anchor was found near the value
    for kw in _FIELD_KEYWORDS.get(field, []):
        if kw in tl:
            score += 15
            break
    # Bonus for value length / structure
    if field in ("patient_name", "doctor_name", "hospital_name"):
        words = value.split()
        if len(words) >= 2:
            score += 20
        if len(words) >= 3:
            score += 10
    elif field in ("admission_date", "discharge_date"):
        if re.search(r"\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}", value):
            score += 25
        elif re.search(r"\d{4}", value):
            score += 15
    elif field == "total_amount":
        clean = value.replace(",", "")
        try:
            n = float(clean)
            if n > 100:
                score += 20   # suspiciously small amounts get no bonus
        except ValueError:
            pass
    elif field == "policy_number":
        if len(value) >= 8:
            score += 20
    elif field == "diagnosis":
        if len(value) > 10:
            score += 20
    return min(score, 100)


def _ocr_quality(raw_text: str, filled_fields: int) -> int:
    """Estimate overall OCR quality 0–100."""
    if not raw_text:
        return 0
    words = raw_text.split()
    if len(words) < 20:
        return 15
    # Ratio of "real" words (alphanum, ≥ 2 chars)
    real = sum(1 for w in words if re.match(r"[A-Za-z0-9]{2,}", w))
    ratio = real / len(words)
    base = int(ratio * 60)          # max 60 from text quality
    field_bonus = filled_fields * 5  # up to 40 from extracted fields
    return min(base + field_bonus, 100)


# ─────────────────────────────────────────────────────────────────────────────
# Tiny utilities
# ─────────────────────────────────────────────────────────────────────────────

def _first(patterns: list, text: str, flags: int = 0) -> str | None:
    for pat in patterns:
        m = re.search(pat, text, flags)
        if m:
            return m.group(1).strip()
    return None

def _title(val: str | None) -> str | None:
    if not val:
        return None
    # Title-case but preserve all-caps abbreviations
    return " ".join(
        w if w.isupper() and len(w) > 1 else w.capitalize()
        for w in val.strip().split()
    ) or None

def _truncate(val: str | None, n: int) -> str | None:
    if not val:
        return None
    val = val.strip()
    # Cut at first newline
    val = val.split("\n")[0].strip()
    return val[:n] if len(val) > n else val