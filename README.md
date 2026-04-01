# CertFlow — AI Certificate Generator

CertFlow is a full-stack certificate generation and verification platform with secure issuance, QR-based public verification, AI-generated backgrounds, drag-and-drop logo positioning, and support for both manual and bulk workflows.

---

## Features

### Certificate Generation
- Manual single certificate generation with role-aware wording
- Manual bulk entry (paste Name, Email, Role — one per line)
- CSV participant upload with background processing
- Auto-fit participant names — long names never overflow the certificate
- ZIP download of all certificates for an event

### Templates
- 18 built-in certificate templates suited for different event types:
  - `classic-blue`, `emerald-clean`, `sunset-gold`, `royal-purple`, `modern-cyan`
  - `noir-luxe`, `hackathon-neon`, `tech-dark`, `traditional-elegant`
  - `sports-champion`, `academic-navy`, `cultural-fest`, `corporate-silver`
  - `nature-green`, `warm-appreciation`, `volunteer-teal`, `modern-colorful`
- AI-generated certificate backgrounds via OpenAI DALL-E 3
- Custom template upload (PDF/image)

### Branding & Layout
- Logo upload with **drag-and-drop position editor** — place the logo anywhere on the certificate canvas
- Logo size slider (5%–40% of certificate width)
- Preset positions: Top Left, Top Center, Top Right, Bottom Left
- Signature upload (2.4 inch wide, clearly visible)
- Authority name (14pt bold) and position (12pt) with divider line
- All branding persisted per event

### QR & Verification
- QR code embedded on every certificate (1.4 inch, with "Scan to verify" label)
- Public verification via `/verify/{cert_id}` or `/verify/hash/{hash}`
- Hash integrity check (SHA-256, supports v1 and v2 formats)
- Track open, share, and verify events per certificate

### Email
- HTML email with branded layout, certificate preview card, and LinkedIn button
- PDF attached automatically
- Exponential backoff retry (3 attempts: 1s, 2s delay)
- Falls back gracefully if SMTP is not configured

### Bulk Progress Tracking
- Background bulk generation updates a `bulk_progress` field on the event in real time
- Tracks: total, done, failed, status (`running` / `done`)

### Recipient Profiles
- Public profile page at `/@username`
- Shows all certificates with role badges (color-coded)
- Search/filter by event, role, or organization
- Copy link, Verify, and Add to LinkedIn buttons per certificate

### Team & Access Control
- Role-based access: `admin`, `issuer`, `viewer`
- Add/remove team members per event
- API key generation (hashed) for external integrations

### Analytics
- Per-event: issued, opened, shared, verified, emailed counts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Motor (async MongoDB), Pydantic v2, PyJWT, Passlib |
| Certificate Engine | ReportLab, PyPDF2, qrcode, Pillow |
| AI | OpenAI DALL-E 3 |
| Email | aiosmtplib (HTML + PDF attachment) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Database | MongoDB |

---

## Project Structure

```
certflow/
├── backend/
│   ├── app/
│   │   ├── core/           # config, security (JWT, hashing)
│   │   ├── models/         # Pydantic models (event, user)
│   │   ├── routers/        # auth, events, profiles, verification
│   │   └── services/       # certificate_service, email_service, ai_service
│   ├── generated_certs/    # output PDFs
│   ├── uploads/            # logos, signatures, AI backgrounds
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/     # LogoPositioner (drag-and-drop)
        └── pages/          # Dashboard, EventDetail, Verify, RecipientProfile, Landing
```

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=certflow
SECRET_KEY=change-this-to-a-strong-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Must be publicly reachable for QR codes to work on other devices
FRONTEND_VERIFY_BASE_URL=http://localhost:5173/verify/

# OpenAI — required for AI template generation
OPENAI_API_KEY=sk-...

# Optional SMTP for email dispatch
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
```

Run the server (must be run from inside `backend/`):

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev -- --host
```

Frontend: `http://localhost:5173`

---

## Core API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user |

### Events
| Method | Endpoint | Description |
|---|---|---|
| GET | `/events/` | List all events for current user |
| POST | `/events/` | Create event (optionally generates AI template) |
| DELETE | `/events/{id}` | Delete event and all certificates |
| GET | `/events/templates` | List all template presets |
| POST | `/events/{id}/logo` | Upload logo |
| PATCH | `/events/{id}/logo-position` | Save logo position `{x, y, size}` |
| POST | `/events/{id}/signature` | Upload signature |
| PATCH | `/events/{id}/authority` | Set authority name and position |
| POST | `/events/{id}/ai-template` | Generate AI background via DALL-E 3 |
| POST | `/events/{id}/generate/manual` | Generate single certificate |
| POST | `/events/{id}/generate/manual-bulk` | Generate bulk from list |
| POST | `/events/{id}/participants` | Upload CSV participants |
| POST | `/events/{id}/generate` | Start background bulk generation |
| GET | `/events/{id}/download` | Download ZIP of all certificates |
| GET | `/events/{id}/analytics` | Get issued/verified/opened/shared/emailed counts |
| POST | `/events/{id}/certificates/{cert_id}/send-email` | Send certificate email |

### Verification (public)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/verify/{cert_id}` | Verify certificate by ID |
| GET | `/verify/hash/{hash}` | Verify by verification hash |
| GET | `/verify/{cert_id}/preview` | Inline PDF preview |
| POST | `/verify/{cert_id}/track/open` | Track open event |
| POST | `/verify/{cert_id}/track/share` | Track share event |
| GET | `/verify/public-stats` | Total orgs and certs issued |

### Profiles (public)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/profiles/{username}` | Public credential profile |
| GET | `/profiles/me` | Current user's profile |
| PATCH | `/profiles/me` | Update display name, bio, username |
| PATCH | `/profiles/me/privacy` | Show/hide individual certificates |

---

## Logo Position API

The logo position is stored as fractions of the certificate dimensions:

```json
{
  "x": 0.03,
  "y": 0.82,
  "size": 0.18
}
```

- `x` — horizontal position (0 = left edge, 1 = right edge)
- `y` — vertical position (0 = bottom, 1 = top)
- `size` — logo width as a fraction of certificate width (0.05–0.50)

The frontend `LogoPositioner` component renders a scaled A4 landscape canvas where you drag the logo to the desired position, then hit "Save Logo Position" to persist it.

---

## Security Notes

- Never commit `.env` to version control
- Rotate any exposed credentials immediately
- Use a strong random `SECRET_KEY` in production (32+ chars)
- Set `FRONTEND_VERIFY_BASE_URL` to your public domain so QR codes work externally
- Serve behind HTTPS in production
- API keys are stored as SHA-256 hashes — never in plaintext

---

## License

Add your preferred license (MIT / Apache-2.0 / etc.) here.
