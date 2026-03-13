import asyncio
import hashlib
import os
import uuid
from datetime import datetime
from typing import Any
import logging

logger = logging.getLogger(__name__)

import qrcode
from bson import ObjectId
from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.database import get_database
from app.services.email_service import send_certificate_email

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
    "classic-blue": {"bg": "#e8f1ff", "title": "#1d4ed8", "text": "#374151", "accent": "#60a5fa"},
    "emerald-clean": {"bg": "#ecfdf5", "title": "#047857", "text": "#374151", "accent": "#34d399"},
    "sunset-gold": {"bg": "#fff7ed", "title": "#b45309", "text": "#374151", "accent": "#fbbf24"},
    "royal-purple": {"bg": "#f5f3ff", "title": "#6d28d9", "text": "#374151", "accent": "#a78bfa"},
    "modern-cyan": {"bg": "#ecfeff", "title": "#0e7490", "text": "#374151", "accent": "#22d3ee"},
    "noir-luxe": {"bg": "#111827", "title": "#f9fafb", "text": "#f3f4f6", "accent": "#4b5563"},
    "hackathon-neon": {"bg": "#0f172a", "title": "#22d3ee", "text": "#f8fafc", "accent": "#e879f9"}, # Neon cyber look
    "traditional-elegant": {"bg": "#fefce8", "title": "#713f12", "text": "#451a03", "accent": "#ca8a04"}, # Golden calligraphy style
    "modern-colorful": {"bg": "#ffffff", "title": "#ec4899", "text": "#111827", "accent": "#8b5cf6"}, # Vibrant overlapping shapes
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


def _get_intelligent_wording(role: str, event_name: str) -> list[str]:
    """Returns lines [line1, line2] based on the participant's role."""
    r = role.lower()
    if "winner" in r:
        return [f"has successfully won {event_name}", f"with the outstanding position of {role.capitalize()}"]
    elif "volunteer" in r:
        return [f"has contributed selflessly as a {role.capitalize()}", f"to the success of {event_name}"]
    elif "speaker" in r:
        return [f"has shared valuable insights as a {role.capitalize()}", f"during the {event_name} event"]
    elif "organizer" in r:
        return [f"has demonstrated exceptional leadership as an {role.capitalize()}", f"for {event_name}"]
    elif "participant" in r or "attendee" in r:
        return [f"has actively participated in", event_name]
    else:
        # Default fallback
        return [f"has successfully completed {event_name}", f"Role: {role}" if role else ""]


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

    lines = _get_intelligent_wording(str(participant.get("position", "")).strip(), event['name'])
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2.0, height / 2.0 - 40, lines[0])
    if lines[1] and "Role: " not in lines[1]:
        c.drawCentredString(width / 2.0, height / 2.0 - 70, lines[1])

    c.setFont("Helvetica", 14)
    c.drawString(width - 260, 50, f"Date: {event.get('date_text', datetime.utcnow().strftime('%Y-%m-%d'))}")
    c.drawString(50, 50, f"ID: {cert_id}")
    c.drawImage(qr_path, 50, 70, width=0.9 * inch, height=0.9 * inch)

    # Optional Logo (centered top)
    logo_path = event.get("logo_path")
    if logo_path:
        if not os.path.exists(logo_path): # Backup for relative paths
            logo_path = os.path.abspath(os.path.join("uploads", os.path.basename(logo_path)))
            
    if logo_path and os.path.exists(logo_path):
        try:
            # Top-left corner, inside border
            c.drawImage(logo_path, 30, height - 90, width=1.5*inch, height=1.5*inch, preserveAspectRatio=True)
            logger.info(f"Successfully drew overlay logo from {logo_path}")
        except Exception as e:
            logger.error(f"Failed to draw overlay logo from {logo_path}: {e}")
            pass

    # Optional Signature & Authority (bottom right)
    sig_path = event.get("signature_path")
    if sig_path and not os.path.exists(sig_path):
        sig_path = os.path.abspath(os.path.join("uploads", os.path.basename(sig_path)))
        
    auth_name = event.get("authority_name")
    auth_pos = event.get("authority_position")

    if (sig_path and os.path.exists(sig_path)) or auth_name or auth_pos:
        sig_y = 100
        sig_x = width - 200
        if sig_path and os.path.exists(sig_path):
            try:
                c.drawImage(sig_path, sig_x, sig_y, width=1.5*inch, height=0.6*inch, preserveAspectRatio=True)
                sig_y -= 15
                logger.info(f"Successfully drew overlay signature from {sig_path}")
            except Exception as e:
                logger.error(f"Failed to draw overlay signature from {sig_path}: {e}")
                pass
        
        c.setFont("Helvetica", 10)
        if auth_name:
            c.drawCentredString(sig_x + 0.75*inch, sig_y, auth_name)
            sig_y -= 12
        if auth_pos:
            c.setFont("Helvetica", 8)
            c.drawCentredString(sig_x + 0.75*inch, sig_y, auth_pos)

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
    logo_path: str = None,
    signature_path: str = None,
    authority_name: str = None,
    authority_position: str = None,
    template_path: str = None,
):
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    width, height = landscape(A4)
    style = TEMPLATE_PRESETS.get(template_id, TEMPLATE_PRESETS["classic-blue"])
    
    logger.info(f"Initializing PDF generation. template_id={template_id}, template_path={template_path}")

    # Background
    if template_path:
        if not os.path.exists(template_path):
            resolved_path = os.path.abspath(os.path.join("uploads", os.path.basename(template_path)))
            logger.info(f"Template path {template_path} not found. Resolved to {resolved_path}")
            template_path = resolved_path

    drawn_bg = False
    if template_path and os.path.exists(template_path):
        try:
            logger.info(f"Drawing template background from {template_path}")
            c.drawImage(template_path, 0, 0, width=width, height=height, preserveAspectRatio=False)
            drawn_bg = True
            logger.info("Successfully drew template background")
        except Exception as e:
            logger.error(f"Failed to draw template background from {template_path}: {e}")
            
    if not drawn_bg:
        logger.info(f"Falling back to standard template {template_id} since drawn_bg is False")
        c.setFillColor(style["bg"])
        c.rect(0, 0, width, height, fill=1, stroke=0)
    
    # Custom flourishes based on template type
    if template_id == "hackathon-neon":
        c.setStrokeColor(style["accent"])
        c.setLineWidth(4)
        c.rect(20, 20, width - 40, height - 40, fill=0, stroke=1)
        c.setStrokeColor(style["title"])
        c.setLineWidth(2)
        c.rect(25, 25, width - 50, height - 50, fill=0, stroke=1)
        
        c.setFillColor(style["accent"])
        c.setFont("Courier-Bold", 14)
        c.drawString(40, height - 50, "<HACKATHON_CERTIFICATE/>")
        
    elif template_id == "traditional-elegant":
        c.setStrokeColor(style["accent"])
        c.setLineWidth(6)
        c.rect(30, 30, width - 60, height - 60, fill=0, stroke=1)
        c.setLineWidth(1)
        c.rect(38, 38, width - 76, height - 76, fill=0, stroke=1)
        
        c.setFillColor(style["accent"])
        c.circle(45, 45, 15, fill=1, stroke=0)
        c.circle(width - 45, 45, 15, fill=1, stroke=0)
        c.circle(45, height - 45, 15, fill=1, stroke=0)
        c.circle(width - 45, height - 45, 15, fill=1, stroke=0)
        
    elif template_id == "modern-colorful":
        c.setFillColor(style["accent"])
        c.circle(0, height, 150, fill=1, stroke=0)
        c.setFillColor(style["title"])
        c.circle(width, 0, 200, fill=1, stroke=0)
        
        c.setFillColor("#fcd34d")
        c.circle(width - 50, height - 50, 60, fill=1, stroke=0)
    else:
        # Default simple border
        c.setStrokeColor(style.get("accent", "#9ca3af"))
        c.setLineWidth(2)
        c.rect(15, 15, width - 30, height - 30, fill=0, stroke=1)

    c.setFillColor(style["title"])
    if template_id == "traditional-elegant":
        c.setFont("Times-BoldItalic", 46)
        c.drawCentredString(width / 2, height - 120, "Certificate of Achievement")
    elif template_id == "hackathon-neon":
        c.setFont("Courier-Bold", 42)
        c.drawCentredString(width / 2, height - 120, "> CERTIFICATE OF ACHIEVEMENT")
    else:
        c.setFont("Helvetica-Bold", 44)
        c.drawCentredString(width / 2, height - 120, "Certificate of Achievement")

    c.setFillColor(style.get("text", "#374151"))
    
    font_main = "Courier" if template_id == "hackathon-neon" else ("Times-Roman" if template_id == "traditional-elegant" else "Helvetica")
    font_bold = f"{font_main}-Bold" if template_id != "traditional-elegant" else "Times-Bold"
    if template_id == "traditional-elegant":
        font_main = "Times-Italic"
    
    c.setFont(font_main, 18)
    c.drawCentredString(width / 2, height - 180, "This certifies that")
    
    c.setFont(font_bold, 36)
    c.drawCentredString(width / 2, height - 240, participant_name)
    
    # Intelligent Wording
    lines = _get_intelligent_wording(role, event_name)
    
    c.setFont(font_main, 18)
    # Give more room after name
    y_ptr = height - 300
    c.drawCentredString(width / 2, y_ptr, lines[0])
    
    y_ptr -= 40
    if lines[1] and "Role: " not in lines[1]:
        c.drawCentredString(width / 2, y_ptr, lines[1])
        y_ptr -= 40
    
    c.drawCentredString(width / 2, y_ptr, f"organized by {organization}")
    
    # If the second line was just a fallback role display
    if lines[1] and "Role: " in lines[1]:
        y_ptr -= 40
        c.setFont(font_bold, 16)
        c.drawCentredString(width / 2, y_ptr, lines[1])
    

    c.setFont(font_main, 12)
    c.drawString(60, 60, f"Certificate ID: {cert_id}")
    c.drawString(width - 240, 60, f"Issued on: {date_text}")
    c.drawImage(qr_path, 60, 85, width=0.9 * inch, height=0.9 * inch)
    
    if template_id == "traditional-elegant":
        # Draw fake signature lines
        c.setStrokeColor(style["text"])
        c.setLineWidth(1)
        c.line(width - 220, 110, width - 80, 110)
        c.drawCentredString(width - 150, 95, "Authorized Signature")

    # Optional Logo
    if logo_path:
        if not os.path.exists(logo_path):
             logo_path = os.path.abspath(os.path.join("uploads", os.path.basename(logo_path)))

    if logo_path and os.path.exists(logo_path):
        try:
            # Top-left corner, inside border
            c.drawImage(logo_path, 30, height - 90, width=1.5*inch, height=1.5*inch, preserveAspectRatio=True)
            logger.info(f"Successfully drew logo from {logo_path}")
        except Exception as e:
            logger.error(f"Failed to draw logo from {logo_path}: {e}")
            pass

    # Optional Signature & Authority
    if (signature_path and os.path.exists(signature_path)) or authority_name or authority_position:
        # Position at bottom right, above the date
        sig_y = 100
        sig_x = width - 200
        
        if signature_path:
            if not os.path.exists(signature_path):
                signature_path = os.path.abspath(os.path.join("uploads", os.path.basename(signature_path)))
        
        if signature_path and os.path.exists(signature_path):
            try:
                c.drawImage(signature_path, sig_x, sig_y, width=1.5*inch, height=0.6*inch, preserveAspectRatio=True)
                sig_y -= 15
                logger.info(f"Successfully drew signature from {signature_path}")
            except Exception as e:
                logger.error(f"Failed to draw signature from {signature_path}: {e}")
                pass
        
        c.setFont(font_main, 10)
        if authority_name:
            c.drawCentredString(sig_x + 0.75*inch, sig_y, authority_name)
            sig_y -= 12
        if authority_position:
            c.setFont(font_main, 8)
            c.drawCentredString(sig_x + 0.75*inch, sig_y, authority_position)

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
    email: str = "",
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

    db = get_database()
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    logo_path = event.get("logo_path") if event else None
    sig_path = event.get("signature_path") if event else None
    auth_name = event.get("authority_name") if event else None
    auth_pos = event.get("authority_position") if event else None
    template_path_db = event.get("template_path") if event else None
    
    # If using AI template, pass the DB template_path
    pass_template_path = template_path_db if template_id == "ai-generated" else None

    try:
        _generate_standalone_pdf(
            participant_name, 
            event_name, 
            organization, 
            date_text, 
            role, 
            cert_id, 
            template_id, 
            qr_path, 
            output_path,
            logo_path=logo_path,
            signature_path=sig_path,
            authority_name=auth_name,
            authority_position=auth_pos,
            template_path=pass_template_path
        )
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
                "email": email,
            },
        )
        if email:
            subject = f"Your Certificate for {event_name}"
            body = f"Hello {participant_name},\n\nCongratulations on receiving your certificate for {event_name}. Please find it attached.\n\nVerify it here: {verify_url}\n\nBest regards,\n{organization}"
            asyncio.create_task(send_certificate_email(email, subject, body, output_path))
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
            
            part_email = participant.get("email", "").strip()
            if part_email:
                subject = f"Your Certificate for {event['name']}"
                org = str(event.get("organization_id", ""))
                body = f"Hello {participant['name']},\n\nCongratulations on receiving your certificate for {event['name']}. Please find it attached.\n\nVerify it here: {verify_url}\n\nBest regards,\n{org}"
                asyncio.create_task(send_certificate_email(part_email, subject, body, output_path))
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
