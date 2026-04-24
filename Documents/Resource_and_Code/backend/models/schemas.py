from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    USER = "user"
    INSURER = "insurer"
    ADMIN = "admin"

class ClaimStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"

class OTPRequest(BaseModel):
    email: EmailStr

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str
    intended_role: str = "user"   # "user" | "insurer" — sent by frontend tab selection

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.USER
    company_name: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class ExtractedData(BaseModel):
    patient_name: Optional[str] = None
    hospital_name: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    total_amount: Optional[str] = None
    diagnosis: Optional[str] = None
    doctor_name: Optional[str] = None
    policy_number: Optional[str] = None
    raw_text: Optional[str] = None

class ClaimCreate(BaseModel):
    insurance_company: str
    extracted_data: ExtractedData
    document_path: Optional[str] = None
    notes: Optional[str] = None

class ClaimUpdate(BaseModel):
    patient_name: Optional[str] = None
    hospital_name: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    total_amount: Optional[str] = None
    diagnosis: Optional[str] = None
    doctor_name: Optional[str] = None
    policy_number: Optional[str] = None
    notes: Optional[str] = None

class ClaimReview(BaseModel):
    status: ClaimStatus
    remarks: Optional[str] = None