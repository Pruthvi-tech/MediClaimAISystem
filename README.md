<p align="center">
  <img src="MediClaimLOGO.png" width="150"/>
</p>

<h1 align="center"> MediClaim AI System</h1>

<p align="center">
AI-powered system to automate medical insurance claim processing using OCR and FastAPI.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-Backend-green">
  <img src="https://img.shields.io/badge/Frontend-Vite-blue">
  <img src="https://img.shields.io/badge/AI-OCR-orange">
</p>

---

## 📌 Overview

In many small hospitals and clinics, medical insurance claims are still processed manually using handwritten documents. This leads to delays, errors, and claim rejections.

This project provides an AI-powered solution that automatically reads medical documents, extracts key information, and helps speed up the insurance claim process.

---

## 🎯 Objectives

- Extract key information from medical documents  
- Reduce manual work in insurance claim processing  
- Speed up claim approval time  
- Minimize human errors  

---

## 🚀 Features

- AI-based text extraction from documents  
- Automatic data processing and classification  
- Identification of patient details, diagnosis, and billing  
- Easy-to-use interface for small clinics  
- Supports scanned documents and images  
- OTP-based authentication (User & Admin)  

---

## 🛠️ Technologies Used

- Python  
- FastAPI  
- Machine Learning  
- Natural Language Processing (NLP)  
- OCR (Optical Character Recognition)  
- Vite (Frontend)  

---

## 📊 Weekly Reports

- [Week 1](Weekly-Reports/week-1.md)
- [Week 2](Weekly-Reports/week-2.md)
- [Week 3](Weekly-Reports/Week3_Report.md)
- [Week 4](Weekly-Reports/Week4_Report.md)
- [Week 5](Weekly-Reports/week-5.md)

## ⚙️ How to Run

### Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
