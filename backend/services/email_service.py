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
    key = os.environ.get("BREVO_API_KEY", "")
    if _api_instance is None or not key:
        if not key:
            raise Exception("BREVO_API_KEY not configured")
        config = sib_api_v3_sdk.Configuration()
        config.api_key['api-key'] = key
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


def send_vip_welcome_email(to_email: str, user_name: str, lang: str = "fr") -> dict:
    """Send VIP welcome email with all premium features listed."""
    tr = {
        "fr": {
            "subject": "Bienvenue dans le VIP Mentova !",
            "title": "Bienvenue dans le VIP !",
            "greeting": f"Bonjour {user_name},",
            "intro": "Votre abonnement VIP Mentova est maintenant actif. Vous b\u00e9n\u00e9ficiez de toutes les fonctionnalit\u00e9s premium :",
            "features": [
                ("M\u00e9moire de Caufid", "Caufid retient vos pr\u00e9f\u00e9rences, votre niveau et vos objectifs."),
                ("Analyse de graphiques", "Envoyez une image de graphique pour une analyse technique adapt\u00e9e."),
                ("Intelligence de march\u00e9", "Donn\u00e9es et actualit\u00e9s en temps r\u00e9el pour contextualiser vos \u00e9changes."),
                ("Apprentissage personnalis\u00e9", "Caufid adapte ses explications \u00e0 votre niveau et \u00e9volue avec vous."),
                ("Briefing quotidien", "Chaque jour, un r\u00e9sum\u00e9 personnalis\u00e9 des \u00e9v\u00e9nements importants du march\u00e9."),
                ("Acc\u00e8s anticip\u00e9", "Soyez les premiers \u00e0 tester les nouvelles fonctionnalit\u00e9s."),
            ],
            "cta": "Ouvrir Mentova",
            "outro": "Merci pour votre confiance. Bonne exploration !",
            "team": "L'\u00e9quipe Mentova Academy",
        },
        "en": {
            "subject": "Welcome to Mentova VIP!",
            "title": "Welcome to VIP!",
            "greeting": f"Hello {user_name},",
            "intro": "Your Mentova VIP subscription is now active. You have access to all premium features:",
            "features": [
                ("Caufid Memory", "Caufid remembers your preferences, level and goals."),
                ("Chart Analysis", "Send a chart image for technical analysis adapted to your level."),
                ("Market Intelligence", "Real-time data and news to contextualize your conversations."),
                ("Personalized Learning", "Caufid adapts its explanations to your level and evolves with you."),
                ("Daily Briefing", "Every day, a personalized summary of important market events."),
                ("Early Access", "Be the first to test new features before everyone else."),
            ],
            "cta": "Open Mentova",
            "outro": "Thank you for your trust. Happy exploring!",
            "team": "The Mentova Academy team",
        },
        "es": {
            "subject": "\u00a1Bienvenido al VIP de Mentova!",
            "title": "\u00a1Bienvenido al VIP!",
            "greeting": f"Hola {user_name},",
            "intro": "Tu suscripci\u00f3n VIP de Mentova est\u00e1 activa. Tienes acceso a todas las funciones premium:",
            "features": [
                ("Memoria de Caufid", "Caufid recuerda tus preferencias, nivel y objetivos."),
                ("An\u00e1lisis de gr\u00e1ficos", "Env\u00eda una imagen de gr\u00e1fico para un an\u00e1lisis t\u00e9cnico adaptado."),
                ("Inteligencia de mercado", "Datos y noticias en tiempo real para contextualizar tus conversaciones."),
                ("Aprendizaje personalizado", "Caufid adapta sus explicaciones a tu nivel y evoluciona contigo."),
                ("Briefing diario", "Cada d\u00eda, un resumen personalizado de los eventos importantes del mercado."),
                ("Acceso anticipado", "S\u00e9 el primero en probar las nuevas funciones."),
            ],
            "cta": "Abrir Mentova",
            "outro": "\u00a1Gracias por tu confianza. Buena exploraci\u00f3n!",
            "team": "El equipo de Mentova Academy",
        },
    }
    t = tr.get(lang, tr["en"])

    features_html = ""
    colors = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"]
    for i, (name, desc) in enumerate(t["features"]):
        c = colors[i % len(colors)]
        features_html += f"""
        <tr><td style="padding:10px 0;">
            <div style="display:inline-block;width:8px;height:8px;border-radius:4px;background:{c};margin-right:10px;vertical-align:middle;"></div>
            <strong style="color:#fafafa;">{name}</strong>
            <div style="color:#a1a1aa;font-size:13px;margin-top:2px;padding-left:18px;">{desc}</div>
        </td></tr>"""

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7C3AED,#4F46E5);padding:32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">&#9670;</div>
            <h1 style="color:#FFD700;font-size:26px;margin:0;">{t["title"]}</h1>
        </div>
        <div style="padding:32px;">
            <p style="font-size:16px;color:#e4e4e7;margin-bottom:8px;">{t["greeting"]}</p>
            <p style="font-size:15px;color:#a1a1aa;line-height:1.6;margin-bottom:24px;">{t["intro"]}</p>
            <table style="width:100%;border-collapse:collapse;">{features_html}</table>
            <div style="text-align:center;margin:32px 0;">
                <a href="https://app.mentova-academy.com" style="background:#7C3AED;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">{t["cta"]}</a>
            </div>
            <p style="font-size:14px;color:#a1a1aa;margin-bottom:4px;">{t["outro"]}</p>
            <p style="font-size:13px;color:#71717a;">{t["team"]}</p>
        </div>
    </div>
    """
    return send_mentova_email(to_email=to_email, subject=t["subject"], html_content=html)
