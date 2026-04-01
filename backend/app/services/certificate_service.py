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
from app.routers.profiles import ensure_profile_for_recipient

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
    "classic-blue":        {"bg": "#e8f1ff", "title": "#1d4ed8", "text": "#374151", "accent": "#60a5fa"},
    "emerald-clean":       {"bg": "#ecfdf5", "title": "#047857", "text": "#374151", "accent": "#34d399"},
    "sunset-gold":         {"bg": "#fff7ed", "title": "#b45309", "text": "#374151", "accent": "#fbbf24"},
    "royal-purple":        {"bg": "#f5f3ff", "title": "#6d28d9", "text": "#374151", "accent": "#a78bfa"},
    "modern-cyan":         {"bg": "#ecfeff", "title": "#0e7490", "text": "#374151", "accent": "#22d3ee"},
    "noir-luxe":           {"bg": "#111827", "title": "#f9fafb", "text": "#f3f4f6", "accent": "#4b5563"},
    "hackathon-neon":      {"bg": "#0f172a", "title": "#22d3ee", "text": "#f8fafc",  "accent": "#e879f9"},
    "traditional-elegant": {"bg": "#fefce8", "title": "#713f12", "text": "#451a03", "accent": "#ca8a04"},
    "modern-colorful":     {"bg": "#ffffff", "title": "#ec4899", "text": "#111827", "accent": "#8b5cf6"},
    # New event-suited templates
    "sports-champion":     {"bg": "#fff1f2", "title": "#be123c", "text": "#1c1917", "accent": "#f43f5e"},
    "academic-navy":       {"bg": "#f0f4ff", "title": "#1e3a8a", "text": "#1e293b", "accent": "#3b82f6"},
    "cultural-fest":       {"bg": "#fdf4ff", "title": "#7e22ce", "text": "#3b0764", "accent": "#d946ef"},
    "corporate-silver":    {"bg": "#f8fafc", "title": "#334155", "text": "#1e293b", "accent": "#94a3b8"},
    "nature-green":        {"bg": "#f0fdf4", "title": "#15803d", "text": "#14532d", "accent": "#4ade80"},
    "warm-appreciation":   {"bg": "#fffbeb", "title": "#92400e", "text": "#451a03", "accent": "#f59e0b"},
    "tech-dark":           {"bg": "#020617", "title": "#38bdf8", "text": "#e2e8f0", "accent": "#818cf8"},
    "volunteer-teal":      {"bg": "#f0fdfa", "title": "#0f766e", "text": "#134e4a", "accent": "#2dd4bf"},
}


def template_catalog() -> list[dict[str, str]]:
    return [{"id": k, "name": k.replace("-", " ").title(), **v} for k, v in TEMPLATE_PRESETS.items()]


DEFAULT_CERTIFICATE_LAYOUT: dict[str, dict[str, float]] = {
    "signature": {"x": 0.66, "y": 0.66, "w": 0.24, "h": 0.12},
    "authorityName": {"x": 0.78, "y": 0.8, "scale": 1.0},
    "designation": {"x": 0.78, "y": 0.87, "scale": 0.95},
    "recipientName": {"x": 0.5, "y": 0.4, "scale": 1.0},
    "bodyBlock": {"x": 0.5, "y": 0.52, "scale": 1.0},
    "qr": {"x": 0.82, "y": 0.7, "size": 0.12},
}


def _merge_certificate_layout(raw: dict | None) -> dict[str, dict[str, float]]:
    base = {k: dict(v) for k, v in DEFAULT_CERTIFICATE_LAYOUT.items()}
    if not raw:
        return base
    for k, v in raw.items():
        if isinstance(v, dict) and k in base:
            base[k].update(v)
        elif isinstance(v, dict):
            base[k] = v
    return base


def _baseline_from_top(cy: float, height: float, font_size: float) -> float:
    """cy = fraction from top (0 top, 1 bottom). ReportLab baseline from bottom."""
    return height * (1.0 - cy) - 0.35 * font_size


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


def _fit_text(c_obj, text: str, max_width: float, max_font_size: int, font: str) -> int:
    """Return the largest font size <= max_font_size where text fits within max_width."""
    size = max_font_size
    while size > 10:
        c_obj.setFont(font, size)
        if c_obj.stringWidth(text, font, size) <= max_width:
            return size
        size -= 2
    return size


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
            logo_size = 2.2 * inch
            c.drawImage(logo_path, 30, height - logo_size - 20, width=logo_size, height=logo_size, preserveAspectRatio=True, mask='auto')
            logger.info(f"Successfully drew overlay logo from {logo_path}")
        except Exception as e:
            logger.error(f"Failed to draw overlay logo from {logo_path}: {e}")

    # Optional Signature & Authority (bottom right)
    sig_path = event.get("signature_path")
    if sig_path and not os.path.exists(sig_path):
        sig_path = os.path.abspath(os.path.join("uploads", os.path.basename(sig_path)))
        
    auth_name = event.get("authority_name")
    auth_pos = event.get("authority_position")

    if (sig_path and os.path.exists(sig_path)) or auth_name or auth_pos:
        sig_block_w = 2.4 * inch
        sig_x = width - sig_block_w - 40
        sig_y = 130
        if sig_path and os.path.exists(sig_path):
            try:
                c.drawImage(sig_path, sig_x, sig_y, width=sig_block_w, height=0.9 * inch, preserveAspectRatio=True, mask='auto')
                sig_y -= 8
                logger.info(f"Successfully drew overlay signature from {sig_path}")
            except Exception as e:
                logger.error(f"Failed to draw overlay signature from {sig_path}: {e}")

        c.setStrokeColor("#9ca3af")
        c.setLineWidth(1)
        c.line(sig_x, sig_y, sig_x + sig_block_w, sig_y)
        sig_y -= 16

        c.setFont("Helvetica-Bold", 14)
        if auth_name:
            c.drawCentredString(sig_x + sig_block_w / 2, sig_y, auth_name)
            sig_y -= 16
        if auth_pos:
            c.setFont("Helvetica", 12)
            c.drawCentredString(sig_x + sig_block_w / 2, sig_y, auth_pos)

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
    logo_position: dict = None,
    certificate_layout: dict | None = None,
):
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    width, height = landscape(A4)
    L = _merge_certificate_layout(certificate_layout)
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
    if template_id == "hackathon-neon" or template_id == "tech-dark":
        c.setStrokeColor(style["accent"])
        c.setLineWidth(4)
        c.rect(20, 20, width - 40, height - 40, fill=0, stroke=1)
        c.setStrokeColor(style["title"])
        c.setLineWidth(2)
        c.rect(25, 25, width - 50, height - 50, fill=0, stroke=1)
        c.setFillColor(style["accent"])
        c.setFont("Courier-Bold", 14)
        label = "<HACKATHON_CERTIFICATE/>" if template_id == "hackathon-neon" else "// CERTIFICATE OF EXCELLENCE"
        c.drawString(40, height - 50, label)

    elif template_id in ("traditional-elegant", "academic-navy", "warm-appreciation"):
        c.setStrokeColor(style["accent"])
        c.setLineWidth(6)
        c.rect(30, 30, width - 60, height - 60, fill=0, stroke=1)
        c.setLineWidth(1)
        c.rect(38, 38, width - 76, height - 76, fill=0, stroke=1)
        c.setFillColor(style["accent"])
        for cx, cy in [(45, 45), (width - 45, 45), (45, height - 45), (width - 45, height - 45)]:
            c.circle(cx, cy, 12, fill=1, stroke=0)

    elif template_id in ("modern-colorful", "cultural-fest"):
        c.setFillColor(style["accent"])
        c.circle(0, height, 160, fill=1, stroke=0)
        c.setFillColor(style["title"])
        c.circle(width, 0, 200, fill=1, stroke=0)
        c.setFillColor("#fcd34d")
        c.circle(width - 50, height - 50, 60, fill=1, stroke=0)

    elif template_id == "sports-champion":
        # Bold diagonal ribbon top-right
        c.setFillColor(style["accent"])
        c.setStrokeColor(style["title"])
        c.setLineWidth(8)
        c.line(0, height - 8, width, height - 8)
        c.line(0, height - 18, width, height - 18)
        c.setLineWidth(3)
        c.rect(20, 20, width - 40, height - 40, fill=0, stroke=1)
        c.setFillColor(style["title"])
        c.setFont("Helvetica-Bold", 11)
        c.drawString(30, height - 50, "🏆  CERTIFICATE OF ACHIEVEMENT")

    elif template_id == "corporate-silver":
        # Minimal top bar + thin border
        c.setFillColor(style["accent"])
        c.rect(0, height - 12, width, 12, fill=1, stroke=0)
        c.setStrokeColor(style["accent"])
        c.setLineWidth(1)
        c.rect(20, 20, width - 40, height - 40, fill=0, stroke=1)

    elif template_id in ("nature-green", "volunteer-teal", "emerald-clean"):
        # Leaf-like arcs in corners
        c.setStrokeColor(style["accent"])
        c.setLineWidth(3)
        c.rect(20, 20, width - 40, height - 40, fill=0, stroke=1)
        c.setFillColor(style["accent"])
        c.setLineWidth(1)
        for cx, cy in [(20, 20), (width - 20, 20), (20, height - 20), (width - 20, height - 20)]:
            c.circle(cx, cy, 18, fill=1, stroke=0)

    else:
        # Default simple border
        c.setStrokeColor(style.get("accent", "#9ca3af"))
        c.setLineWidth(2)
        c.rect(15, 15, width - 30, height - 30, fill=0, stroke=1)

    c.setFillColor(style["title"])
    if template_id in ("traditional-elegant", "academic-navy", "warm-appreciation"):
        c.setFont("Times-BoldItalic", 46)
        c.drawCentredString(width / 2, height - 120, "Certificate of Achievement")
    elif template_id in ("hackathon-neon", "tech-dark"):
        c.setFont("Courier-Bold", 42)
        label = "> CERTIFICATE OF ACHIEVEMENT" if template_id == "hackathon-neon" else "// CERTIFICATE OF EXCELLENCE"
        c.drawCentredString(width / 2, height - 120, label)
    elif template_id == "sports-champion":
        c.setFont("Helvetica-Bold", 48)
        c.drawCentredString(width / 2, height - 120, "Certificate of Championship")
    elif template_id == "corporate-silver":
        c.setFont("Helvetica-Bold", 42)
        c.drawCentredString(width / 2, height - 120, "Certificate of Excellence")
    elif template_id == "cultural-fest":
        c.setFont("Times-BoldItalic", 46)
        c.drawCentredString(width / 2, height - 120, "Certificate of Participation")
    elif template_id == "volunteer-teal":
        c.setFont("Helvetica-Bold", 44)
        c.drawCentredString(width / 2, height - 120, "Certificate of Appreciation")
    else:
        c.setFont("Helvetica-Bold", 44)
        c.drawCentredString(width / 2, height - 120, "Certificate of Achievement")

    c.setFillColor(style.get("text", "#374151"))
    
    font_main = "Courier" if template_id in ("hackathon-neon", "tech-dark") else (
        "Times-Italic" if template_id in ("traditional-elegant", "academic-navy", "warm-appreciation", "cultural-fest") else "Helvetica"
    )
    font_bold = "Courier-Bold" if template_id in ("hackathon-neon", "tech-dark") else (
        "Times-Bold" if template_id in ("traditional-elegant", "academic-navy", "warm-appreciation", "cultural-fest") else "Helvetica-Bold"
    )
    
    c.setFont(font_main, 18)
    c.drawCentredString(width / 2, height - 180, "This certifies that")

    rec = L["recipientName"]
    rx = float(rec["x"]) * width
    rec_scale = float(rec.get("scale", 1.0))
    name_font_size = int(_fit_text(c, participant_name, width - 120, 36, font_bold) * rec_scale)
    name_font_size = max(10, min(48, name_font_size))
    c.setFont(font_bold, name_font_size)
    c.drawCentredString(rx, _baseline_from_top(float(rec["y"]), height, name_font_size), participant_name)

    lines = _get_intelligent_wording(role, event_name)

    bb = L["bodyBlock"]
    bb_scale = float(bb.get("scale", 1.0))
    bx = float(bb["x"]) * width
    body_font = max(10, int(18 * bb_scale))
    c.setFont(font_main, body_font)
    y0 = _baseline_from_top(float(bb["y"]), height, body_font)
    c.drawCentredString(bx, y0, lines[0])

    line_gap = 40 * bb_scale
    y_ptr = y0 - line_gap
    if lines[1] and "Role: " not in lines[1]:
        c.drawCentredString(bx, y_ptr, lines[1])
        y_ptr -= line_gap

    c.drawCentredString(bx, y_ptr, f"organized by {organization}")

    if lines[1] and "Role: " in lines[1]:
        y_ptr -= line_gap
        c.setFont(font_bold, max(10, int(16 * bb_scale)))
        c.drawCentredString(bx, y_ptr, lines[1])

    c.setFont(font_main, 12)
    c.drawString(width - 240, 60, f"Issued on: {date_text}")

    qr_l = L["qr"]
    qr_w = float(qr_l["size"]) * width
    qr_x = float(qr_l["x"]) * width
    qr_top = float(qr_l["y"])
    qr_y_pdf = height * (1.0 - qr_top) - qr_w
    c.drawImage(qr_path, qr_x, qr_y_pdf, width=qr_w, height=qr_w)
    c.setFont(font_main, 8)
    c.drawCentredString(qr_x + qr_w / 2, max(36, qr_y_pdf - 8), "Scan to verify")
    c.drawString(qr_x, max(28, qr_y_pdf - 22), f"Certificate ID: {cert_id}")
    
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

    # Logo — position driven by logo_position dict, default top-left
    if logo_path and os.path.exists(logo_path):
        try:
            pos = logo_position or {}
            size_frac = float(pos.get("size", 0.18))   # fraction of cert width
            logo_w = width * size_frac
            logo_h = logo_w                              # square bounding box, preserveAspectRatio handles the rest
            # x/y are fractions (0-1). x=0 → left edge, y=1 → top edge (PDF coords: y=0 is bottom)
            x_frac = float(pos.get("x", 0.03))
            y_frac = float(pos.get("y", 0.82))
            logo_x = width * x_frac
            logo_y = height * y_frac - logo_h           # anchor top of logo at y_frac
            c.drawImage(logo_path, logo_x, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')
            logger.info(f"Drew logo at ({logo_x:.0f},{logo_y:.0f}) size={logo_w:.0f}")
        except Exception as e:
            logger.error(f"Failed to draw logo from {logo_path}: {e}")

    # Signature + Authority — bottom right, larger and clearly readable
    if signature_path:
        if not os.path.exists(signature_path):
            signature_path = os.path.abspath(os.path.join("uploads", os.path.basename(signature_path)))

    has_sig   = signature_path and os.path.exists(signature_path)
    has_auth  = bool(authority_name or authority_position)

    sig_l = L["signature"]
    sig_w = float(sig_l["w"]) * width
    sig_h = float(sig_l["h"]) * height
    sig_x = float(sig_l["x"]) * width
    sig_y_top = float(sig_l["y"])
    sig_img_y = height * (1.0 - sig_y_top) - sig_h

    if has_sig or has_auth:
        if has_sig:
            try:
                c.drawImage(signature_path, sig_x, sig_img_y, width=sig_w, height=sig_h, preserveAspectRatio=True, mask='auto')
                logger.info(f"Successfully drew signature from {signature_path}")
            except Exception as e:
                logger.error(f"Failed to draw signature from {signature_path}: {e}")

            line_y = sig_img_y - 4
            c.setStrokeColor(style.get("accent", "#9ca3af"))
            c.setLineWidth(1)
            c.line(sig_x, line_y, sig_x + sig_w, line_y)

        an = L["authorityName"]
        ap = L["designation"]
        c.setFillColor(style.get("text", "#374151"))
        if authority_name:
            fs = max(8, int(14 * float(an.get("scale", 1.0))))
            c.setFont(font_bold, fs)
            c.drawCentredString(
                width * float(an["x"]),
                _baseline_from_top(float(an["y"]), height, fs),
                authority_name,
            )
        if authority_position:
            fs2 = max(8, int(12 * float(ap.get("scale", 1.0))))
            c.setFont(font_main, fs2)
            c.drawCentredString(
                width * float(ap["x"]),
                _baseline_from_top(float(ap["y"]), height, fs2),
                authority_position,
            )

    c.save()


async def _save_certificate_record(
    cert_id: str,
    event_id: str,
    participant_name: str,
    output_path: str,
    verification_hash: str,
    issued_at: datetime,
    metadata: dict[str, Any],
    recipient_email: str = "",
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
        "recipient_email": recipient_email,
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
    logo_pos = event.get("logo_position") if event else None
    cert_layout = event.get("certificate_layout") if event else None

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
            template_path=pass_template_path,
            logo_position=logo_pos,
            certificate_layout=cert_layout,
        )
        issued_at = datetime.utcnow()
        if email:
            await ensure_profile_for_recipient(email, participant_name)
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
            recipient_email=email,
        )
        if email:
            subject = f"Your Certificate for {event_name}"
            body = f"Hello {participant_name},\n\nCongratulations on receiving your certificate for {event_name}. Please find it attached.\n\nVerify it here: {verify_url}\n\nBest regards,\n{organization}"
            asyncio.create_task(send_certificate_email(
                email, subject, body, output_path,
                participant_name=participant_name,
                event_name=event_name,
                organization=organization,
                date_text=date_text,
                role=role,
                verify_url=verify_url,
            ))
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
    total = len(participants)

    # Initialize progress
    await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"bulk_progress": {"total": total, "done": 0, "failed": 0, "status": "running"}}},
    )

    done = 0
    failed = 0
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
            part_email = participant.get("email", "").strip()
            if part_email:
                await ensure_profile_for_recipient(part_email, participant["name"])

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
                recipient_email=part_email,
            )
            await db.participants.update_one(
                {"_id": participant["_id"]},
                {"$set": {"status": "generated", "certificate_id": cert_id}},
            )

            if part_email:
                subject = f"Your Certificate for {event['name']}"
                org = str(event.get("organization", event.get("organization_id", "")))
                body = f"Hello {participant['name']},\n\nCongratulations! Your certificate for {event['name']} is attached.\n\nVerify: {verify_url}\n\nBest,\n{org}"
                asyncio.create_task(send_certificate_email(
                    part_email, subject, body, output_path,
                    participant_name=participant["name"],
                    event_name=event["name"],
                    organization=org,
                    date_text=event_date_text,
                    role=role,
                    verify_url=verify_url,
                ))
            done += 1
        except Exception as exc:
            logger.error(f"Failed cert for {participant.get('name')}: {exc}")
            failed += 1
            await db.participants.update_one(
                {"_id": participant["_id"]},
                {"$set": {"status": "failed"}},
            )
        finally:
            if os.path.exists(qr_path):
                os.remove(qr_path)
            if overlay_path and os.path.exists(overlay_path):
                os.remove(overlay_path)
            # Update progress after each cert
            await db.events.update_one(
                {"_id": ObjectId(event_id)},
                {"$set": {"bulk_progress": {"total": total, "done": done, "failed": failed, "status": "running"}}},
            )

    await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"bulk_progress": {"total": total, "done": done, "failed": failed, "status": "done"}}},
    )
