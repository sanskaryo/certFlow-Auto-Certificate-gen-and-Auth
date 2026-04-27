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
    # Academic
    "academic-classic":    {"bg": "#f8f9fa", "title": "#1e3a8a", "text": "#1e293b", "accent": "#3b82f6"},
    "academic-navy":       {"bg": "#f0f4ff", "title": "#1e3a8a", "text": "#1e293b", "accent": "#3b82f6"},
    "university-prestige": {"bg": "#fffdfa", "title": "#581c87", "text": "#1e293b", "accent": "#7e22ce"},
    
    # Corporate
    "corporate-silver":    {"bg": "#f8fafc", "title": "#334155", "text": "#1e293b", "accent": "#94a3b8"},
    "executive-gold":      {"bg": "#fffdf5", "title": "#854d0e", "text": "#334155", "accent": "#ca8a04"},
    "business-clean":      {"bg": "#ffffff", "title": "#0f172a", "text": "#334155", "accent": "#3b82f6"},

    # Hackathon
    "hackathon-neon":      {"bg": "#0f172a", "title": "#22d3ee", "text": "#f8fafc",  "accent": "#e879f9"},
    "tech-dark":           {"bg": "#020617", "title": "#38bdf8", "text": "#e2e8f0", "accent": "#818cf8"},
    "cyber-matrix":        {"bg": "#000000", "title": "#4ade80", "text": "#f1f5f9", "accent": "#22c55e"},

    # Workshop & Bootcamp
    "workshop-modern":     {"bg": "#fdf4ff", "title": "#9d174d", "text": "#374151", "accent": "#f472b6"},
    "bootcamp-bold":       {"bg": "#fef2f2", "title": "#991b1b", "text": "#1f2937", "accent": "#ef4444"},

    # Sports
    "sports-champion":     {"bg": "#fff1f2", "title": "#be123c", "text": "#1c1917", "accent": "#f43f5e"},
    "athletics-dynamic":   {"bg": "#fdf8f6", "title": "#c2410c", "text": "#1c1917", "accent": "#f97316"},

    # Participation & Appreciations
    "volunteer-teal":      {"bg": "#f0fdfa", "title": "#0f766e", "text": "#134e4a", "accent": "#2dd4bf"},
    "warm-appreciation":   {"bg": "#fffbeb", "title": "#92400e", "text": "#451a03", "accent": "#f59e0b"},
    "cultural-fest":       {"bg": "#fdf4ff", "title": "#7e22ce", "text": "#3b0764", "accent": "#d946ef"},

    # Achievement
    "achievement-gold":    {"bg": "#fffcf0", "title": "#b45309", "text": "#1c1917", "accent": "#fbbf24"},
    "excellence-blue":     {"bg": "#eff6ff", "title": "#1d4ed8", "text": "#1e293b", "accent": "#60a5fa"},

    # Premium / Luxury
    "noir-luxe":           {"bg": "#111827", "title": "#f9fafb", "text": "#f3f4f6", "accent": "#4b5563"},
    "traditional-elegant": {"bg": "#fefce8", "title": "#713f12", "text": "#451a03", "accent": "#ca8a04"},
    "royal-purple":        {"bg": "#f5f3ff", "title": "#6d28d9", "text": "#374151", "accent": "#a78bfa"},

    # Minimalist
    "minimalist-white":    {"bg": "#ffffff", "title": "#171717", "text": "#404040", "accent": "#a3a3a3"},
    "emerald-clean":       {"bg": "#ecfdf5", "title": "#047857", "text": "#374151", "accent": "#34d399"},

    # Modern
    "modern-colorful":     {"bg": "#ffffff", "title": "#ec4899", "text": "#111827", "accent": "#8b5cf6"},
    "modern-cyan":         {"bg": "#ecfeff", "title": "#0e7490", "text": "#374151", "accent": "#22d3ee"},
}


def template_catalog() -> list[dict[str, str]]:
    return [{"id": k, "name": k.replace("-", " ").title(), **v} for k, v in TEMPLATE_PRESETS.items()]


def _merge_certificate_layout(layout_dict: dict | None) -> dict[str, Any]:
    base = {
        "signature": {"x": 0.66, "y": 0.66, "w": 0.24, "h": 0.12},
        "authorityName": {"x": 0.78, "y": 0.8, "scale": 1.0},
        "designation": {"x": 0.78, "y": 0.87, "scale": 0.95},
        "signature2": {"x": 0.1, "y": 0.66, "w": 0.24, "h": 0.12},
        "authorityName2": {"x": 0.22, "y": 0.8, "scale": 1.0},
        "designation2": {"x": 0.22, "y": 0.87, "scale": 0.95},
        "recipientName": {"x": 0.5, "y": 0.4, "scale": 1.0},
        "bodyBlock": {"x": 0.5, "y": 0.52, "scale": 1.0},
        "qr": {"x": 0.82, "y": 0.7, "size": 0.12},
        "logo2": {"x": 0.82, "y": 0.05, "size": 0.12},
        "logo3": {"x": 0.05, "y": 0.82, "size": 0.12},
        "watermark": {"x": 0.35, "y": 0.35, "size": 0.3, "opacity": 0.15},
    }
    if not layout_dict:
        return base
        
    for k, v in layout_dict.items():
        if isinstance(v, dict) and k in base:
            base[k].update(v)
        elif isinstance(v, dict):
            base[k] = v
            
    if "theme" in layout_dict:
        base["theme"] = layout_dict["theme"]
        
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
    r = role.lower().strip()
    if not r:
        return [f"has successfully completed", event_name]
    elif any(w in r for w in ("1st", "first", "winner", "champion", "gold")):
        return [f"has excelled and secured the position of", f"{role.title()} at {event_name}"]
    elif any(w in r for w in ("2nd", "second", "runner", "silver")):
        return [f"has achieved the distinction of", f"{role.title()} at {event_name}"]
    elif any(w in r for w in ("3rd", "third", "bronze")):
        return [f"has been awarded the position of", f"{role.title()} at {event_name}"]
    elif "volunteer" in r:
        return [f"has served selflessly as a {role.title()}", f"contributing to the success of {event_name}"]
    elif "speaker" in r:
        return [f"has delivered an insightful presentation as a {role.title()}", f"at {event_name}"]
    elif "organizer" in r or "coordinator" in r:
        return [f"has demonstrated exceptional leadership as {role.title()}", f"for {event_name}"]
    elif "mentor" in r or "judge" in r:
        return [f"has provided invaluable guidance as {role.title()}", f"at {event_name}"]
    elif any(w in r for w in ("participant", "attendee", "delegate")):
        return [f"has actively participated in", event_name]
    else:
        return [f"has successfully completed {event_name}", f"in the capacity of {role.title()}"]


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

def _map_font(font_val: str, bold: bool = False, italic: bool = False, weight: str = "normal") -> str | None:
    if not font_val or font_val == "inherit":
        return None
    f = font_val.lower()
    if weight in ["bold", "bold-italic"]: bold = True
    if weight in ["italic", "bold-italic"]: italic = True

    if "arial" in f or "helvetica" in f or "sans" in f:
        if bold and italic: return "Helvetica-BoldOblique"
        if bold: return "Helvetica-Bold"
        if italic: return "Helvetica-Oblique"
        return "Helvetica"
    elif "times" in f or "serif" in f:
        if bold and italic: return "Times-BoldItalic"
        if bold: return "Times-Bold"
        if italic: return "Times-Italic"
        return "Times-Roman"
    elif "courier" in f or "mono" in f:
        if bold and italic: return "Courier-BoldOblique"
        if bold: return "Courier-Bold"
        if italic: return "Courier-Oblique"
        return "Courier"
    if bold: return "Helvetica-Bold"
    return "Helvetica"


def _draw_custom_text(c_obj: canvas.Canvas, text: str, x: float, y: float, base_font: str, size: float, element: dict):
    # Determine font given element config
    weight = element.get("fontWeight", "normal")
    f_name = _map_font(element.get("fontFamily"), weight=weight) or _map_font(base_font, weight=weight) or base_font

    # Text transform
    transform = element.get("textTransform", "none")
    if transform == "uppercase": text = text.upper()
    elif transform == "lowercase": text = text.lower()
    elif transform == "capitalize": text = text.title()

    letter_spacing = float(element.get("letterSpacing", 0))

    if letter_spacing == 0:
        c_obj.setFont(f_name, size)
        c_obj.drawCentredString(x, y, text)
    else:
        # Calculate full width including tracking
        raw_width = c_obj.stringWidth(text, f_name, size)
        total_width = raw_width + max(0, len(text) - 1) * letter_spacing
        
        tx = c_obj.beginText()
        tx.setFont(f_name, size)
        tx.setCharSpace(letter_spacing)
        tx.setTextOrigin(x - total_width / 2.0, y)
        tx.textOut(text)
        c_obj.drawText(tx)


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
    event: dict | None = None,
):
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    width, height = landscape(A4)
    L = _merge_certificate_layout(certificate_layout)
    style = dict(TEMPLATE_PRESETS.get(template_id, TEMPLATE_PRESETS["academic-classic"]))

    theme = L.get("theme", {})
    if theme.get("bgTint"): style["bg"] = theme["bgTint"]
    if theme.get("titleColor"): style["title"] = theme["titleColor"]
    if theme.get("textColor"): style["text"] = theme["textColor"]
    if theme.get("accentColor"): style["accent"] = theme["accentColor"]

    # ── PDF Metadata ────────────────────────────────────────────────────────
    c.setTitle(f"Certificate — {participant_name.title()}")
    c.setAuthor(authority_name or organization or "CertFlow")
    c.setSubject(f"Certificate for {event_name}")
    c.setCreator("CertFlow Certificate Generator")
    c.setKeywords(["certificate", event_name, organization, participant_name])

    # Safe margin — all decorative elements stay inside this
    MARGIN = 48

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
        # Premium multi-layer border for remaining templates
        accent = style.get("accent", "#9ca3af")
        title_col = style.get("title", "#1d4ed8")
        # Outer thick border
        c.setStrokeColor(title_col)
        c.setLineWidth(4)
        c.rect(MARGIN - 18, MARGIN - 18, width - (MARGIN - 18) * 2, height - (MARGIN - 18) * 2, fill=0, stroke=1)
        # Inner thin border
        c.setStrokeColor(accent)
        c.setLineWidth(1)
        c.rect(MARGIN - 10, MARGIN - 10, width - (MARGIN - 10) * 2, height - (MARGIN - 10) * 2, fill=0, stroke=1)
        # Corner accent circles
        c.setFillColor(accent)
        r = 7
        m = MARGIN - 14
        for cx, cy in [(m, m), (width - m, m), (m, height - m), (width - m, height - m)]:
            c.circle(cx, cy, r, fill=1, stroke=0)

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

    t_font = _map_font(theme.get("fontFamily", "inherit"))
    t_font_bold = _map_font(theme.get("fontFamily", "inherit"), bold=True)
    if t_font:
        font_main = t_font
        font_bold = t_font_bold
    
    # ── "This certifies that" with decorative flanking lines ────────────────
    certifies_y = height - 175
    certifies_text = "This certifies that"
    c.setFont(font_main, 16)
    c.setFillColor(style.get("text", "#374151"))
    text_w = c.stringWidth(certifies_text, font_main, 16)
    cx = width / 2
    line_len = (width * 0.25)
    line_y = certifies_y + 6
    c.setStrokeColor(style.get("accent", "#9ca3af"))
    c.setLineWidth(0.75)
    c.line(cx - line_len - text_w / 2 - 12, line_y, cx - text_w / 2 - 10, line_y)
    c.line(cx + text_w / 2 + 10, line_y, cx + line_len + text_w / 2 + 12, line_y)
    c.drawCentredString(cx, certifies_y, certifies_text)

    rec = L["recipientName"]
    rx = float(rec["x"]) * width
    rec_scale = float(rec.get("scale", 1.0))
    display_name = participant_name.title()
    
    # Overrides for recipient name
    name_font = _map_font(rec.get("fontFamily")) or font_bold
    if rec.get("color"):
         c.setFillColor(rec["color"])
    elif theme.get("titleColor"):
         c.setFillColor(theme["titleColor"])
    else:
         c.setFillColor(style["title"])

    name_font_size = int(_fit_text(c, display_name, width - 120, 36, name_font) * rec_scale)
    name_font_size = max(10, min(48, name_font_size))
    name_y = _baseline_from_top(float(rec["y"]), height, name_font_size)
    _draw_custom_text(c, display_name, rx, name_y, font_bold, name_font_size, rec)

    # Accent underline beneath recipient name
    name_w = min(c.stringWidth(display_name, name_font, name_font_size), width * 0.7)
    ul_y = name_y - 6
    c.setStrokeColor(style.get("accent", "#60a5fa"))
    c.setLineWidth(2)
    c.line(rx - name_w / 2, ul_y, rx + name_w / 2, ul_y)

    lines = _get_intelligent_wording(role, event_name)

    bb = L["bodyBlock"]
    bb_scale = float(bb.get("scale", 1.0))
    bx = float(bb["x"]) * width
    
    body_font = max(10, int(18 * bb_scale))
    
    if bb.get("color"):
         c.setFillColor(bb["color"])
    else:
         c.setFillColor(style.get("text", "#374151"))
         
    y0 = _baseline_from_top(float(bb["y"]), height, body_font)
    _draw_custom_text(c, lines[0], bx, y0, font_main, body_font, bb)

    line_gap = 30 * bb_scale
    y_ptr = y0 - line_gap
    if lines[1]:
        _draw_custom_text(c, lines[1], bx, y_ptr, font_main, body_font, bb)
        y_ptr -= line_gap

    # "organized by Org" — slightly smaller and muted
    c.setFont(font_main, max(9, body_font - 2))
    c.setFillColor(style.get("text", "#374151"))
    c.drawCentredString(bx, y_ptr, f"organized by  {organization}")

    # ── QR code block — fixed bottom-left, clear of border decorations ─────
    qr_size = min(0.09 * width, 0.16 * height)    # ~70pt on A4-landscape
    qr_margin = 52                                  # increased to clear border corners
    qr_x = qr_margin + 8                           # a little extra right offset
    qr_y = qr_margin                               # QR sits on the margin line

    c.drawImage(qr_path, qr_x, qr_y, width=qr_size, height=qr_size)

    c.setFont(font_main, 7)
    c.setFillColor(style.get("text", "#6b7280"))
    # "Scan to verify" just above the QR
    c.drawCentredString(qr_x + qr_size / 2, qr_y + qr_size + 13, "Scan to verify")
    # cert ID in tiny monospace below label — truncated to fit
    cert_id_label = f"{cert_id[:28]}" if len(cert_id) > 28 else cert_id
    c.setFont("Courier", 6)
    c.drawString(qr_x, qr_y + qr_size + 4, cert_id_label)

    # Issued on — bottom-right, separate from signature block
    # Format date nicely if it is YYYY-MM-DD
    try:
        from datetime import datetime as _dt
        _d = _dt.strptime(date_text, "%Y-%m-%d")
        formatted_date = _d.strftime("%B %d, %Y")
    except Exception:
        formatted_date = date_text
    c.setFont(font_main, 10)
    c.setFillColor(style.get("text", "#374151"))
    c.drawRightString(width - MARGIN, qr_margin + 4, f"Issued on:  {formatted_date}")
    
    # (traditional-elegant signature line is now part of the unified sig block below)

    # Optional Logo
    if logo_path:
        if not os.path.exists(logo_path):
             logo_path = os.path.abspath(os.path.join("uploads", os.path.basename(logo_path)))

    def draw_logo_pos(l_path, pos_conf, is_watermark=False):
        if not l_path or not os.path.exists(l_path): return
        if pos_conf.get("hidden"): return
        try:
            size_frac = float(pos_conf.get("size", 0.25))   # fraction of cert width
            logo_w = width * size_frac
            try:
                from reportlab.lib.utils import ImageReader
                ir = ImageReader(l_path)
                act_w, act_h = ir.getSize()
                logo_h = logo_w * (act_h / act_w)
            except Exception:
                logo_h = logo_w

            x_frac = float(pos_conf.get("x", 0.03))
            y_frac = float(pos_conf.get("y", 0.82))
            shape = pos_conf.get("shape", "rectangle")
            opacity = float(pos_conf.get("opacity", 1.0))
            if is_watermark and "opacity" not in pos_conf: opacity = 0.15
            logo_x = width * x_frac
            logo_y = height * y_frac - logo_h

            c.saveState()
            if opacity < 1.0:
                # Need to use graphics state for alpha, not easily supported in base reportlab primitives without platypus or specialized pdfgen state. We'll simply ignore opacity unless we use fill stroke Alpha.
                # Since reportlab doesn't easily set alpha of an image via drawImage (unless embedded in drawing), we'll do a simple trick if possible.
                c.setFillAlpha(opacity)
                c.setStrokeAlpha(opacity)

            if shape in ("circle", "rounded", "oval"):
                p = c.beginPath()
                if shape == "circle":
                    radius = min(logo_w, logo_h) / 2
                    p.circle(logo_x + logo_w / 2, logo_y + logo_h / 2, radius)
                elif shape == "rounded":
                    radius = min(logo_w, logo_h) * 0.15
                    p.roundRect(logo_x, logo_y, logo_w, logo_h, radius)
                elif shape == "oval":
                    p.ellipse(logo_x, logo_y, logo_w, logo_h)
                c.clipPath(p, stroke=0, fill=0)

            c.drawImage(l_path, logo_x, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')
            c.restoreState()
        except Exception as e:
            logger.error(f"Failed to draw logo: {e}")

    draw_logo_pos(logo_path, logo_position or {})
    
    extra_logos = event.get("additional_logos", {}) if isinstance(event, dict) else {}
    if L.get("logo2") and extra_logos.get("logo2"): draw_logo_pos(extra_logos["logo2"], L["logo2"])
    if L.get("logo3") and extra_logos.get("logo3"): draw_logo_pos(extra_logos["logo3"], L["logo3"])
    if L.get("watermark") and extra_logos.get("watermark"): draw_logo_pos(extra_logos["watermark"], L["watermark"], is_watermark=True)

    # Signature + Authority — stacked cleanly: image → line → name → position
    if signature_path:
        if not os.path.exists(signature_path):
            signature_path = os.path.abspath(os.path.join("uploads", os.path.basename(signature_path)))

    def draw_signature_block(sig_image, a_name, a_pos, l_sig, l_auth_n, l_desig):
        if not l_sig or l_sig.get("hidden"): return
        
        sig_w  = float(l_sig.get("w", 0.24)) * width
        sig_h  = float(l_sig.get("h", 0.12)) * height
        sig_x  = float(l_sig.get("x", 0.66)) * width
        sig_top_pdf = height * (1.0 - float(l_sig.get("y", 0.66)))
        sig_img_y   = sig_top_pdf - sig_h

        if sig_image and os.path.exists(sig_image):
            try:
                c.drawImage(sig_image, sig_x, sig_img_y, width=sig_w, height=sig_h, preserveAspectRatio=True, mask="auto")
                block_bottom = sig_img_y
            except:
                block_bottom = sig_top_pdf
        else:
            block_bottom = sig_top_pdf

        line_y = block_bottom - 6
        c.setStrokeColor(style.get("accent", "#9ca3af"))
        c.setLineWidth(1)
        c.line(sig_x, line_y, sig_x + sig_w, line_y)

        text_cx = sig_x + sig_w / 2
        text_y  = line_y - 16

        if a_name and not l_auth_n.get("hidden"):
            c.setFillColor(l_auth_n.get("color") or theme.get("textColor") or style.get("text", "#374151"))
            fs = max(9, int(13 * float(l_auth_n.get("scale", 1.0))))
            _draw_custom_text(
                c, a_name.title(), text_cx, text_y, font_bold, fs, l_auth_n
            )
            text_y -= fs + 4

        if a_pos and not l_desig.get("hidden"):
            c.setFillColor(l_desig.get("color") or theme.get("textColor") or style.get("text", "#374151"))
            fs2 = max(8, int(11 * float(l_desig.get("scale", 1.0))))
            _draw_custom_text(
                c, a_pos.title(), text_cx, text_y, font_main, fs2, l_desig
            )

    has_sig1 = bool(signature_path and os.path.exists(signature_path))
    has_auth1 = bool(authority_name or authority_position)
    if has_sig1 or has_auth1:
        draw_signature_block(signature_path, authority_name, authority_position, L["signature"], L["authorityName"], L["designation"])

    extra_sigs = event.get("additional_signatures", {}) if isinstance(event, dict) else {}
    a2_name = extra_sigs.get("name2", "")
    a2_pos = extra_sigs.get("position2", "")
    a2_img = extra_sigs.get("signature_path2", "")
    if a2_img and not os.path.exists(a2_img): a2_img = os.path.abspath(os.path.join("uploads", os.path.basename(a2_img)))
    
    if (a2_name or a2_pos or a2_img) and L.get("signature2"):
        draw_signature_block(a2_img, a2_name, a2_pos, L["signature2"], L.get("authorityName2", {}), L.get("designation2", {}))

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
            event=event,
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
        # Email is NOT sent here — user must click 'Send Email' explicitly after generation
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
            # Email is NOT sent here — user must click 'Send Email' explicitly
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
