# 🏥 Electronic Health Record (EHR) System

A web-based EHR system built using Django and React that helps healthcare professionals manage patient records, appointments, and reports efficiently.

---

## ✨ Features

- 🔐 User login & registration for secure access
- 👨‍⚕️ Manage patients, appointments, diagnoses, and medications
- 🗓️ Calendar view for appointments
- 📂 Search, filter, and edit patient records
- 📊 Generate analytics and reports from medical data

---

## 🛠 Tech Stack

- Backend: **Django** (Python)
- Frontend: **ReactJS**, HTML/CSS
- Database: **PostgreSQL**
- API: **RESTful APIs**

---

## Setup Guide

### 📦 Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

### 💻 Frontend Setup
```bash
cd frontend
npm install
```

### 🛢️ PostgreSQL Setup
- Create a database
- Update DB config in `backend/settings.py`

### Run Migrations
```bash
cd backend
python manage.py migrate
```

### Start Servers
- Backend:
```bash
python manage.py runserver  # http://localhost:8000/
```
- Frontend:
```bash
npm start                  # http://localhost:3000/
```

---

## Conclusion

This EHR system provides a clean, scalable interface for medical professionals to manage records digitally. It combines Django’s backend strength with React’s dynamic frontend for an efficient healthcare workflow.

---
> Created by Harsh Verma
