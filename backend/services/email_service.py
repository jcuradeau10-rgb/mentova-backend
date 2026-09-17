"""
Mentova Email Service — Brevo (formerly Sendinblue)
Centralized email sending. Drop-in replacement for Resend.
"""
import os
import logging
import sib_api_v3_sdk

logger = logging.getLogger("email_service")

BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")

_api_instance = None

def _get_api():
    global _api_instance
    if _api_instance is None:
        if not BREVO_API_KEY:
            raise Exception("BREVO_API_KEY not configured")
        config = sib_api_v3_sdk.Configuration()
        config.api_key['api-key'] = BREVO_API_KEY
        _api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(config))
    return _api_instance


def send_email(from_email: str, from_name: str, to_email: str, subject: str, html_content: str) -> dict:
    """Send a transactional email via Brevo."""
    api = _get_api()
    email = sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": from_email, "name": from_name},
        to=[{"email": to_email}],
        subject=subject,
        html_content=html_content,
    )
    try:
        result = api.send_transac_email(email)
        logger.info(f"Email sent to {to_email} | message_id={result.message_id}")
        return {"success": True, "message_id": result.message_id}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        raise


def send_mentova_email(to_email: str, subject: str, html_content: str) -> dict:
    """Shortcut: send from Mentova Academy default sender."""
    return send_email(
        from_email="noreply@mentova-academy.com",
        from_name="Mentova Academy",
        to_email=to_email,
        subject=subject,
        html_content=html_content,
    )
