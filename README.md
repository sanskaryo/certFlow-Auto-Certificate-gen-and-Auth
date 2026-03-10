# CertFlow - AI Certificate Generator

CertFlow is a full-stack certificate generation and verification platform with secure issuance, QR-based public verification, and support for both manual and bulk workflows.

## Features

- Authentication with JWT-based protected APIs
- Event management dashboard
- 10+ built-in certificate templates
- Manual single certificate generation
- Manual bulk certificate generation (without CSV)
- CSV participant upload flow (optional)
- Certificate ZIP download
- Public certificate verification via ID/QR
- PDF certificate preview endpoint
- Integrity checks using verification hash metadata
- Email dispatch system for sending certificates directly to users

## Tech Stack

- Backend: FastAPI, Motor (MongoDB), Pydantic v2, Passlib, PyJWT
- Certificate Engine: ReportLab, PyPDF2, qrcode, Pillow
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Database: MongoDB

## Project Structure

```text
certgen/
  backend/
    app/
      core/
      models/
      routers/
      services/
  frontend/
    src/
      pages/
```

## Quick Start

## 1) Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=certflow
SECRET_KEY=change-this-to-a-strong-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# IMPORTANT: must be publicly reachable when QR is scanned from another device
FRONTEND_VERIFY_BASE_URL=http://localhost:5173/verify/

# Optional Email Configuration for certificate dispatcher
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
```

Run backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 2) Frontend setup

```bash
cd frontend
npm install
npm run dev -- --host
```

Frontend default URL: `http://localhost:5173`
Backend default URL: `http://localhost:8000`

## Core API Endpoints

- `POST /auth/register` - Register user
- `POST /auth/login` - Login and receive JWT
- `GET /events/templates` - List built-in template presets
- `POST /events/{event_id}/generate/manual` - Generate single certificate
- `POST /events/{event_id}/generate/manual-bulk` - Generate many certificates via names list
- `POST /events/{event_id}/participants` - Upload CSV participants
- `GET /events/{event_id}/download` - Download event certificates ZIP (authenticated)
- `GET /verify/{cert_id}` - Public verification endpoint
- `GET /verify/{cert_id}/preview` - Public PDF preview endpoint

## Security Notes

- Keep `.env` out of version control
- Rotate any exposed credentials immediately
- Use a strong `SECRET_KEY` in production
- Set `FRONTEND_VERIFY_BASE_URL` to your public domain for QR verification to work externally
- Serve app behind HTTPS in production

## Current Status

Implemented and validated:

- Build succeeds for frontend (`npm run build`)
- Backend modules compile (`python -m compileall app`)
- Public verification flow with hash integrity checks
- Manual role field support (winner/volunteer/participant/etc.)

## License

Add your preferred license (MIT/Apache-2.0/etc.) here.
