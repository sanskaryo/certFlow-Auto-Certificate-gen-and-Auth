import hashlib
import os
import uuid
from datetime import datetime
from typing import Any

import qrcode
from bson import ObjectId
from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.database import get_database

CERT_DIR = "generated_certs"
os.makedirs(CERT_DIR, exist_ok=True)
QR_DIR = "temp_qr"
os.makedirs(QR_DIR, exist_ok=True)

def _verify_base_url() -> str:
    base = settings.FRONTEND_VERIFY_BASE_URL.strip()
    if not base:
        base = "http://localhost:5173/verify/"
    if not base.endswith("/"):
        base += "/"
    return base

TEMPLATE_PRESETS: dict[str, dict[str, str]] = {
    "classic-blue": {"bg": "#e8f1ff", "title": "#1d4ed8"},
    "emerald-clean": {"bg": "#ecfdf5", "title": "#047857"},
    "sunset-gold": {"bg": "#fff7ed", "title": "#b45309"},
    "royal-purple": {"bg": "#f5f3ff", "title": "#6d28d9"},
    "minimal-gray": {"bg": "#f9fafb", "title": "#374151"},
    "modern-cyan": {"bg": "#ecfeff", "title": "#0e7490"},
    "rose-premium": {"bg": "#fff1f2", "title": "#be123c"},
    "mint-pro": {"bg": "#f0fdfa", "title": "#0f766e"},
    "slate-pro": {"bg": "#f8fafc", "title": "#334155"},
    "noir-luxe": {"bg": "#111827", "title": "#f9fafb"},
}


def template_catalog() -> list[dict[str, str]]:
    return [{"id": k, "name": k.replace("-", " ").title(), **v} for k, v in TEMPLATE_PRESETS.items()]


def _compute_verification_hash(
    participant_name: str,
    event_name: str,
    cert_id: str,
    organization: str = "",
    date_text: str = "",
    role: str = "",
) -> str:
    hash_input = f"{participant_name}|{event_name}|{organization}|{date_text}|{role}|{cert_id}|{settings.SECRET_KEY}"
    return hashlib.sha256(hash_input.encode()).hexdigest()


def generate_qr_code(data: str, filename: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    path = os.path.join(QR_DIR, filename)
    img.save(path)
    return path


def _render_overlay_pdf(participant: dict, event: dict, cert_id: str, qr_path: str) -> str:
    overlay_path = os.path.join(QR_DIR, f"overlay_{cert_id}.pdf")
    c = canvas.Canvas(overlay_path, pagesize=landscape(A4))
    width, height = landscape(A4)

    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2.0, height / 2.0 + 20, participant["name"])

    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2.0, height / 2.0 - 40, f"For successfully completing {event['name']}")

    c.setFont("Helvetica", 14)
    c.drawString(width - 260, 50, f"Date: {event.get('date_text', datetime.utcnow().strftime('%Y-%m-%d'))}")
    c.drawString(50, 50, f"ID: {cert_id}")
    c.drawImage(qr_path, 50, 70, width=1 * inch, height=1 * inch)
    c.save()
    return overlay_path


def _merge_with_template(template_path: str, overlay_path: str, output_path: str):
    template = PdfReader(template_path)
    overlay = PdfReader(overlay_path)
    writer = PdfWriter()
    page = template.pages[0]
    page.merge_page(overlay.pages[0])
    writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)


def _generate_standalone_pdf(
    participant_name: str,
    event_name: str,
    organization: str,
    date_text: str,
    role: str,
    cert_id: str,
    template_id: str,
    qr_path: str,
    output_path: str,
):
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    width, height = landscape(A4)
    style = TEMPLATE_PRESETS.get(template_id, TEMPLATE_PRESETS["classic-blue"])
    c.setFillColor(style["bg"])
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setFillColor(style["title"])
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(width / 2, height - 110, "Certificate of Achievement")

    c.setFillColor("#111827" if template_id != "noir-luxe" else "#f3f4f6")
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2, height - 170, "This certifies that")
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(width / 2, height - 230, participant_name)
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2, height - 280, f"has successfully completed {event_name}")
    c.drawCentredString(width / 2, height - 315, f"organized by {organization}")
    if role:
        c.drawCentredString(width / 2, height - 350, f"Role: {role}")

    c.setFont("Helvetica", 13)
    c.drawString(60, 60, f"Certificate ID: {cert_id}")
    c.drawString(width - 240, 60, f"Issued on: {date_text}")
    c.drawImage(qr_path, 60, 85, width=0.9 * inch, height=0.9 * inch)
    c.save()


async def _save_certificate_record(
    cert_id: str,
    event_id: str,
    participant_name: str,
    output_path: str,
    verification_hash: str,
    issued_at: datetime,
    metadata: dict[str, Any],
):
    db = get_database()
    cert_record = {
        "id": cert_id,
        "event_id": event_id,
        "participant_name": participant_name,
        "file_path": output_path,
        "verification_hash": verification_hash,
        "issued_at": issued_at,
        "metadata": metadata,
    }
    await db.certificates.insert_one(cert_record)


async def generate_single_manual_certificate(
    event_id: str,
    participant_name: str,
    event_name: str,
    organization: str,
    date_text: str,
    template_id: str,
    role: str = "",
) -> dict[str, str]:
    cert_id = str(uuid.uuid4())
    verify_url = _verify_base_url() + cert_id
    verification_hash = _compute_verification_hash(
        participant_name=participant_name,
        event_name=event_name,
        cert_id=cert_id,
        organization=organization,
        date_text=date_text,
        role=role,
    )
    qr_path = generate_qr_code(verify_url, f"{cert_id}.png")
    output_filename = f"{participant_name.replace(' ', '_')}_{cert_id}.pdf"
    output_path = os.path.join(CERT_DIR, output_filename)

    try:
        _generate_standalone_pdf(participant_name, event_name, organization, date_text, role, cert_id, template_id, qr_path, output_path)
        issued_at = datetime.utcnow()
        await _save_certificate_record(
            cert_id=cert_id,
            event_id=event_id,
            participant_name=participant_name,
            output_path=output_path,
            verification_hash=verification_hash,
            issued_at=issued_at,
            metadata={
                "template_id": template_id,
                "event_name": event_name,
                "organization": organization,
                "date_text": date_text,
                "role": role,
            },
        )
    finally:
        if os.path.exists(qr_path):
            os.remove(qr_path)

    return {"certificate_id": cert_id, "verification_link": verify_url, "file_path": output_path}


async def process_certificate_generation(event_id: str):
    db = get_database()
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event or "template_path" not in event:
        return

    cursor = db.participants.find({"event_id": event_id, "status": "pending"})
    participants = await cursor.to_list(length=None)

    for participant in participants:
        cert_id = str(uuid.uuid4())
        verify_url = _verify_base_url() + cert_id
        role = str(participant.get("position", "")).strip()
        event_date_text = event.get("date_text", "")
        verification_hash = _compute_verification_hash(
            participant_name=participant["name"],
            event_name=event["name"],
            cert_id=cert_id,
            organization=str(event.get("organization_id", "")),
            date_text=event_date_text,
            role=role,
        )
        qr_path = generate_qr_code(verify_url, f"{cert_id}.png")
        overlay_path = ""
        try:
            overlay_path = _render_overlay_pdf(participant, event, cert_id, qr_path)
            output_filename = f"{participant['name'].replace(' ', '_')}_{cert_id}.pdf"
            output_path = os.path.join(CERT_DIR, output_filename)
            _merge_with_template(event["template_path"], overlay_path, output_path)

            await _save_certificate_record(
                cert_id=cert_id,
                event_id=event_id,
                participant_name=participant["name"],
                output_path=output_path,
                verification_hash=verification_hash,
                issued_at=datetime.utcnow(),
                metadata={
                    "template_id": "uploaded-template",
                    "event_name": event["name"],
                    "organization": str(event.get("organization_id", "")),
                    "date_text": event_date_text,
                    "role": role,
                },
            )
            await db.participants.update_one(
                {"_id": participant["_id"]},
                {"$set": {"status": "generated", "certificate_id": cert_id}},
            )
        except Exception:
            await db.participants.update_one(
                {"_id": participant["_id"]},
                {"$set": {"status": "failed"}},
            )
        finally:
            if os.path.exists(qr_path):
                os.remove(qr_path)
            if overlay_path and os.path.exists(overlay_path):
                os.remove(overlay_path)
