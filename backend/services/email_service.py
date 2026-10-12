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



def send_caufid_reengagement_email(to_email: str, user_name: str, lang: str = "fr") -> dict:
    """Send re-engagement email from Caufid to new users with little/no interaction."""
    tr = {
        "fr": {
            "subject": "Votre parcours Mentova n\u2019attend que vous",
            "greeting": f"Bonjour {user_name},",
            "intro": "Je suis Caufid, votre mentor sur Mentova. J\u2019ai remarqu\u00e9 que vous avez cr\u00e9\u00e9 votre compte r\u00e9cemment, mais que nous n\u2019avons pas encore eu l\u2019occasion d\u2019\u00e9changer vraiment.",
            "intro2": "Je voulais prendre un moment pour vous expliquer comment je fonctionne, parce que Mentova n\u2019est pas un simple chatbot.",
            "how_title": "Comment \u00e7a fonctionne\u00a0?",
            "steps": [
                ("On discute ensemble", "Dites-moi ce que vous connaissez d\u00e9j\u00e0, ce qui vous int\u00e9resse, vos objectifs. Plus on \u00e9change, mieux je comprends votre niveau."),
                ("Je cr\u00e9e votre profil d\u2019apprentissage", "Je note vos connaissances, vos lacunes et vos centres d\u2019int\u00e9r\u00eat pour construire un parcours qui vous correspond."),
                ("Je cr\u00e9e des modules sur mesure", "Des le\u00e7ons et des quiz adapt\u00e9s \u00e0 votre niveau, pas un programme g\u00e9n\u00e9rique identique pour tout le monde."),
                ("Votre progression est suivie", "XP, niveaux, badges, comp\u00e9tences \u2014 tout est mesur\u00e9 pour que vous puissiez voir le chemin parcouru."),
            ],
            "closing": "Tout commence par une simple conversation. Dites-moi ce que vous aimeriez apprendre, et je m\u2019occupe du reste.",
            "cta": "Discuter avec Caufid",
            "signoff": "\u00c0 bient\u00f4t,",
            "sender_name": "Caufid",
            "sender_role": "Votre mentor IA \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 \u00c9ducation financi\u00e8re personnalis\u00e9e",
        },
        "en": {
            "subject": "Your Mentova journey is waiting for you",
            "greeting": f"Hello {user_name},",
            "intro": "I\u2019m Caufid, your mentor on Mentova. I noticed you recently created your account, but we haven\u2019t had the chance to really talk yet.",
            "intro2": "I wanted to take a moment to explain how I work, because Mentova isn\u2019t just a simple chatbot.",
            "how_title": "How does it work?",
            "steps": [
                ("We chat together", "Tell me what you already know, what interests you, your goals. The more we exchange, the better I understand your level."),
                ("I build your learning profile", "I note your knowledge, gaps and interests to build a path that fits you."),
                ("I create tailored modules", "Lessons and quizzes adapted to your level, not a generic program identical for everyone."),
                ("Your progress is tracked", "XP, levels, badges, skills \u2014 everything is measured so you can see how far you\u2019ve come."),
            ],
            "closing": "It all starts with a simple conversation. Tell me what you\u2019d like to learn, and I\u2019ll take care of the rest.",
            "cta": "Chat with Caufid",
            "signoff": "See you soon,",
            "sender_name": "Caufid",
            "sender_role": "Your AI mentor \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 Personalized financial education",
        },
        "es": {
            "subject": "Tu camino en Mentova te est\u00e1 esperando",
            "greeting": f"Hola {user_name},",
            "intro": "Soy Caufid, tu mentor en Mentova. Not\u00e9 que creaste tu cuenta recientemente, pero a\u00fan no hemos tenido la oportunidad de conversar realmente.",
            "intro2": "Quer\u00eda tomarme un momento para explicarte c\u00f3mo funciono, porque Mentova no es un simple chatbot.",
            "how_title": "\u00bfC\u00f3mo funciona?",
            "steps": [
                ("Conversamos juntos", "Cu\u00e9ntame lo que ya sabes, lo que te interesa, tus objetivos. Cuanto m\u00e1s hablemos, mejor entender\u00e9 tu nivel."),
                ("Creo tu perfil de aprendizaje", "Anoto tus conocimientos, tus lagunas y tus intereses para construir un camino que te corresponda."),
                ("Creo m\u00f3dulos a tu medida", "Lecciones y quiz adaptados a tu nivel, no un programa gen\u00e9rico id\u00e9ntico para todos."),
                ("Tu progreso se mide", "XP, niveles, insignias, competencias \u2014 todo se mide para que puedas ver el camino recorrido."),
            ],
            "closing": "Todo empieza con una simple conversaci\u00f3n. Dime qu\u00e9 te gustar\u00eda aprender, y yo me encargo del resto.",
            "cta": "Hablar con Caufid",
            "signoff": "Hasta pronto,",
            "sender_name": "Caufid",
            "sender_role": "Tu mentor IA \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 Educaci\u00f3n financiera personalizada",
        },
    }
    t = tr.get(lang, tr["en"])
    step_colors = [("#a78bfa", "rgba(167,139,250,0.15)"), ("#3B82F6", "rgba(59,130,246,0.15)"), ("#10B981", "rgba(16,185,129,0.15)"), ("#F59E0B", "rgba(245,158,11,0.15)")]
    steps_html = ""
    for i, (title, desc) in enumerate(t["steps"]):
        color, bg = step_colors[i]
        mb = "margin-bottom:16px;" if i < len(t["steps"]) - 1 else ""
        steps_html += f'''<div style="{mb}"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:top;padding-right:12px;"><div style="width:24px;height:24px;border-radius:6px;background:{bg};text-align:center;line-height:24px;"><span style="color:{color};font-size:12px;font-weight:700;">{i+1}</span></div></td><td><div style="font-size:14px;font-weight:500;color:#e4e4e7;">{title}</div><div style="font-size:13px;color:#71717a;line-height:1.6;margin-top:2px;">{desc}</div></td></tr></table></div>'''

    html = f'''<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="padding:32px 32px 24px;border-bottom:1px solid #27272a;">
        <div style="font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px;">Mentova<span style="color:#a78bfa;">.</span></div>
    </div>
    <div style="padding:32px;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr>
            <td style="vertical-align:middle;padding-right:14px;"><div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7C3AED,#a78bfa);text-align:center;line-height:40px;"><span style="color:#fff;font-weight:700;font-size:16px;">C</span></div></td>
            <td style="vertical-align:middle;"><div style="font-size:15px;font-weight:600;color:#fafafa;">{t["sender_name"]}</div><div style="font-size:12px;color:#71717a;">{t["sender_role"]}</div></td>
        </tr></table>
        <p style="font-size:15px;color:#e4e4e7;line-height:1.7;margin:0 0 16px;">{t["greeting"]}</p>
        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">{t["intro"]}</p>
        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 24px;">{t["intro2"]}</p>
        <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px;">
            <div style="font-size:14px;font-weight:600;color:#fafafa;margin-bottom:16px;">{t["how_title"]}</div>
            {steps_html}
        </div>
        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 24px;">{t["closing"]}</p>
        <div style="text-align:center;margin:28px 0;">
            <a href="https://app.mentova-academy.com" style="background:#7C3AED;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">{t["cta"]}</a>
        </div>
        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:24px 0 4px;">{t["signoff"]}</p>
        <p style="font-size:14px;font-weight:600;color:#a78bfa;margin:0;">{t["sender_name"]}</p>
        <p style="font-size:12px;color:#71717a;margin:4px 0 0;">{t["sender_role"]}</p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #27272a;text-align:center;">
        <p style="font-size:11px;color:#52525b;margin:0;">{t["footer"]}</p>
    </div>
</div>'''
    return send_mentova_email(to_email=to_email, subject=t["subject"], html_content=html)
