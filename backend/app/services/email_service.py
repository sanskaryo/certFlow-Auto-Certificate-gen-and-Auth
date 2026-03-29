import logging
import asyncio
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import aiosmtplib
from app.core.config import settings

logger = logging.getLogger(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{ margin:0; padding:0; background:#f4f7f6; font-family: 'Segoe UI', Arial, sans-serif; }}
  .wrapper {{ max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#0d9488,#0891b2); padding:40px 32px; text-align:center; }}
  .header h1 {{ color:#ffffff; margin:0; font-size:26px; font-weight:700; letter-spacing:-0.5px; }}
  .header p {{ color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px; }}
  .body {{ padding:36px 32px; }}
  .greeting {{ font-size:18px; font-weight:600; color:#111827; margin-bottom:12px; }}
  .message {{ font-size:15px; color:#4b5563; line-height:1.7; margin-bottom:24px; }}
  .cert-card {{ background:linear-gradient(135deg,#f0fdfa,#ecfeff); border:1px solid #99f6e4; border-radius:12px; padding:20px 24px; margin-bottom:28px; }}
  .cert-card .label {{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#0d9488; margin-bottom:4px; }}
  .cert-card .value {{ font-size:16px; font-weight:600; color:#111827; }}
  .cert-card .meta {{ font-size:13px; color:#6b7280; margin-top:4px; }}
  .btn {{ display:inline-block; background:linear-gradient(135deg,#0d9488,#0891b2); color:#ffffff !important; text-decoration:none; padding:14px 32px; border-radius:10px; font-weight:700; font-size:15px; margin:8px 4px; }}
  .btn-outline {{ display:inline-block; border:2px solid #0d9488; color:#0d9488 !important; text-decoration:none; padding:12px 28px; border-radius:10px; font-weight:600; font-size:14px; margin:8px 4px; }}
  .actions {{ text-align:center; margin:24px 0; }}
  .footer {{ background:#f9fafb; padding:24px 32px; text-align:center; border-top:1px solid #f3f4f6; }}
  .footer p {{ font-size:12px; color:#9ca3af; margin:4px 0; }}
  .divider {{ height:1px; background:#f3f4f6; margin:24px 0; }}
  .badge {{ display:inline-block; background:#ecfdf5; color:#047857; font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; margin-bottom:16px; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>🎓 CertFlow</h1>
    <p>Your Certificate is Ready</p>
  </div>
  <div class="body">
    <div class="badge">✓ Verified Certificate</div>
    <div class="greeting">Congratulations, {participant_name}!</div>
    <div class="message">
      We're pleased to present your official certificate for <strong>{event_name}</strong>.
      Your achievement has been recorded and is now verifiable online.
    </div>
    <div class="cert-card">
      <div class="label">Certificate For</div>
      <div class="value">{event_name}</div>
      <div class="meta">Issued by {organization} &nbsp;·&nbsp; {date_text}</div>
      {role_line}
    </div>
    <div class="actions">
      <a href="{verify_url}" class="btn">View &amp; Verify Certificate</a>
      <a href="{linkedin_url}" class="btn-outline">Add to LinkedIn</a>
    </div>
    <div class="divider"></div>
    <div class="message" style="font-size:13px;color:#9ca3af;">
      Your certificate PDF is attached to this email. Keep it safe — it contains a QR code
      that anyone can scan to verify its authenticity.
    </div>
  </div>
  <div class="footer">
    <p>Powered by <strong>CertFlow</strong> · Secure Certificate Management</p>
    <p>This certificate was issued to {participant_name} · {date_text}</p>
  </div>
</div>
</body>
</html>
"""

async def _try_send(message: EmailMessage, retries: int = 3) -> bool:
    for attempt in range(retries):
        try:
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                use_tls=settings.SMTP_PORT == 465,
                start_tls=settings.SMTP_PORT == 587,
            )
            return True
        except Exception as e:
            logger.warning(f"Email attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt)  # exponential backoff: 1s, 2s
    return False


async def send_certificate_email(
    to_email: str,
    subject: str,
    body: str,
    pdf_path: str,
    participant_name: str = "",
    event_name: str = "",
    organization: str = "",
    date_text: str = "",
    role: str = "",
    verify_url: str = "",
) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(f"SMTP not configured. Skipping email to {to_email}")
        return False

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    message["To"] = to_email
    message["Subject"] = subject

    # Plain text fallback
    message.set_content(body)

    # HTML body
    role_line = f'<div class="meta">Role: <strong>{role}</strong></div>' if role else ""
    linkedin_url = (
        f"https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME"
        f"&name={event_name}&organizationName={organization}"
    )
    html_body = HTML_TEMPLATE.format(
        participant_name=participant_name or to_email.split("@")[0],
        event_name=event_name or "Event",
        organization=organization or "Organization",
        date_text=date_text or "",
        role_line=role_line,
        verify_url=verify_url or "#",
        linkedin_url=linkedin_url,
    )
    message.add_alternative(html_body, subtype="html")

    try:
        with open(pdf_path, "rb") as f:
            pdf_data = f.read()
        message.add_attachment(pdf_data, maintype="application", subtype="pdf", filename="Certificate.pdf")
    except Exception as e:
        logger.error(f"Could not attach PDF {pdf_path}: {e}")

    success = await _try_send(message)
    if not success:
        logger.error(f"All email attempts failed for {to_email}")
    return success

