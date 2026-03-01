import asyncio
import logging
import uuid
from datetime import datetime

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Content, From, Mail, To

from app.config import get_settings

logger = logging.getLogger(__name__)


def _build_complaint_email_html(
    business_name: str,
    complaint_summary: str,
    customer_name: str | None,
    customer_phone: str | None,
    customer_email: str | None,
    complaint_id: uuid.UUID,
    session_created_at: datetime,
) -> str:
    settings = get_settings()
    dashboard_link = f"{settings.base_url}/dashboard/complaints/{complaint_id}"
    date_str = session_created_at.strftime("%B %d, %Y at %I:%M %p")

    contact_rows = ""
    if customer_name:
        contact_rows += f"<tr><td style='padding:8px;font-weight:bold;'>Name</td><td style='padding:8px;'>{customer_name}</td></tr>"
    if customer_phone:
        contact_rows += f"<tr><td style='padding:8px;font-weight:bold;'>Phone</td><td style='padding:8px;'>{customer_phone}</td></tr>"
    if customer_email:
        contact_rows += f"<tr><td style='padding:8px;font-weight:bold;'>Email</td><td style='padding:8px;'>{customer_email}</td></tr>"

    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #DC2626; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">New Customer Complaint</h1>
            <p style="color: #FEE2E2; margin: 4px 0 0;">{business_name}</p>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E5E7EB; border-top: none;">
            <p style="color: #6B7280; margin: 0 0 4px;">Date & Time</p>
            <p style="color: #111827; margin: 0 0 20px; font-weight: 500;">{date_str}</p>

            <p style="color: #6B7280; margin: 0 0 4px;">Summary</p>
            <p style="color: #111827; margin: 0 0 20px; line-height: 1.5;">{complaint_summary}</p>

            {f'''<p style="color: #6B7280; margin: 0 0 8px;">Customer Contact</p>
            <table style="border-collapse: collapse; margin-bottom: 20px;">
                {contact_rows}
            </table>''' if contact_rows else '<p style="color: #9CA3AF; margin: 0 0 20px;">No contact information provided.</p>'}

            <a href="{dashboard_link}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                View in Dashboard
            </a>
        </div>
        <div style="padding: 16px; text-align: center;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Sent by Scan & Speak Reviews</p>
        </div>
    </div>
    """


async def send_complaint_notification(
    business_email: str,
    business_name: str,
    complaint_summary: str,
    customer_name: str | None,
    customer_phone: str | None,
    customer_email: str | None,
    complaint_id: uuid.UUID,
    session_created_at: datetime,
) -> bool:
    settings = get_settings()

    html_content = _build_complaint_email_html(
        business_name=business_name,
        complaint_summary=complaint_summary,
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_email=customer_email,
        complaint_id=complaint_id,
        session_created_at=session_created_at,
    )

    message = Mail(
        from_email=From(settings.sendgrid_from_email, "Scan & Speak Reviews"),
        to_emails=To(business_email),
        subject=f"New Customer Complaint - {business_name}",
        html_content=Content("text/html", html_content),
    )

    def _send():
        try:
            sg = SendGridAPIClient(settings.sendgrid_api_key)
            sg.send(message)
            return True
        except Exception as e:
            logger.error(f"SendGrid error: {e}")
            return False

    return await asyncio.to_thread(_send)
