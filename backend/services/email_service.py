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


def _email_shell(t: dict, body_html: str) -> str:
    """Shared email shell with Mentova branding."""
    return f'''<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="padding:32px 32px 24px;border-bottom:1px solid #27272a;">
        <div style="font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px;">Mentova<span style="color:#a78bfa;">.</span></div>
    </div>
    <div style="padding:32px;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr>
            <td style="vertical-align:middle;padding-right:14px;"><div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7C3AED,#a78bfa);text-align:center;line-height:40px;"><span style="color:#fff;font-weight:700;font-size:16px;">C</span></div></td>
            <td style="vertical-align:middle;"><div style="font-size:15px;font-weight:600;color:#fafafa;">Caufid</div><div style="font-size:12px;color:#71717a;">{t["sender_role"]}</div></td>
        </tr></table>
        {body_html}
    </div>
    <div style="padding:20px 32px;border-top:1px solid #27272a;text-align:center;">
        <p style="font-size:11px;color:#52525b;margin:0;">{t["footer"]}</p>
    </div>
</div>'''


def send_welcome_guide_email(to_email: str, user_name: str, lang: str = "fr") -> dict:
    """Send welcome guide email from Caufid."""
    tr = {
        "fr": {
            "subject": "Bienvenue sur Mentova \u2014 Par o\u00f9 commencer",
            "sender_role": "Votre mentor IA \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 \u00c9ducation financi\u00e8re personnalis\u00e9e",
            "greeting": f"Bienvenue {user_name},",
            "intro": "Je suis Caufid, votre mentor sur Mentova. Je suis l\u00e0 pour vous aider \u00e0 comprendre la finance et la crypto \u00e0 votre rythme.",
            "title_start": "Par o\u00f9 commencer\u00a0?",
            "features": [
                ("\u2728 Discutez avec moi", "Posez-moi n\u2019importe quelle question sur la finance, la crypto ou l\u2019investissement. Je m\u2019adapte \u00e0 votre niveau."),
                ("\U0001f4da Modules d\u2019apprentissage", "Je cr\u00e9e des le\u00e7ons personnalis\u00e9es avec des quiz pour v\u00e9rifier votre compr\u00e9hension."),
                ("\U0001f4ca Suivez votre progression", "XP, niveaux, badges et comp\u00e9tences \u2014 voyez votre \u00e9volution au fil du temps."),
            ],
            "cta": "Commencer maintenant",
            "signoff": "\u00c0 tr\u00e8s bient\u00f4t,",
        },
        "en": {
            "subject": "Welcome to Mentova \u2014 Where to start",
            "sender_role": "Your AI mentor \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 Personalized financial education",
            "greeting": f"Welcome {user_name},",
            "intro": "I\u2019m Caufid, your mentor on Mentova. I\u2019m here to help you understand finance and crypto at your own pace.",
            "title_start": "Where to start?",
            "features": [
                ("\u2728 Chat with me", "Ask me anything about finance, crypto or investing. I adapt to your level."),
                ("\U0001f4da Learning modules", "I create personalized lessons with quizzes to check your understanding."),
                ("\U0001f4ca Track your progress", "XP, levels, badges and skills \u2014 see your evolution over time."),
            ],
            "cta": "Get started",
            "signoff": "See you soon,",
        },
        "es": {
            "subject": "Bienvenido a Mentova \u2014 Por d\u00f3nde empezar",
            "sender_role": "Tu mentor IA \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 Educaci\u00f3n financiera personalizada",
            "greeting": f"Bienvenido {user_name},",
            "intro": "Soy Caufid, tu mentor en Mentova. Estoy aqu\u00ed para ayudarte a entender las finanzas y la crypto a tu ritmo.",
            "title_start": "\u00bfPor d\u00f3nde empezar?",
            "features": [
                ("\u2728 Conversa conmigo", "Preg\u00fantame lo que quieras sobre finanzas, crypto o inversi\u00f3n. Me adapto a tu nivel."),
                ("\U0001f4da M\u00f3dulos de aprendizaje", "Creo lecciones personalizadas con quiz para verificar tu comprensi\u00f3n."),
                ("\U0001f4ca Sigue tu progreso", "XP, niveles, insignias y competencias \u2014 ve tu evoluci\u00f3n con el tiempo."),
            ],
            "cta": "Empezar ahora",
            "signoff": "Hasta pronto,",
        },
    }
    t = tr.get(lang, tr["en"])
    features_html = ""
    for title, desc in t["features"]:
        features_html += f'<div style="margin-bottom:14px;padding:14px;background:#18181b;border:1px solid #27272a;border-radius:10px;"><div style="font-size:14px;font-weight:600;color:#e4e4e7;margin-bottom:4px;">{title}</div><div style="font-size:13px;color:#71717a;line-height:1.6;">{desc}</div></div>'
    body = f'''<p style="font-size:15px;color:#e4e4e7;line-height:1.7;margin:0 0 16px;">{t["greeting"]}</p>
        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 24px;">{t["intro"]}</p>
        <div style="font-size:14px;font-weight:600;color:#fafafa;margin-bottom:14px;">{t["title_start"]}</div>
        {features_html}
        <div style="text-align:center;margin:28px 0;"><a href="https://app.mentova-academy.com" style="background:#7C3AED;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">{t["cta"]}</a></div>
        <p style="font-size:14px;color:#a1a1aa;margin:24px 0 4px;">{t["signoff"]}</p>
        <p style="font-size:14px;font-weight:600;color:#a78bfa;margin:0;">Caufid</p>'''
    return send_mentova_email(to_email=to_email, subject=t["subject"], html_content=_email_shell(t, body))


async def send_progression_update_email(to_email: str, user_name: str, user_id: str, lang: str = "fr", db=None) -> dict:
    """Send progression summary email from Caufid."""
    # Get real progression data
    level, total_xp, badges_earned, modules_completed = 1, 0, 0, 0
    try:
        from services.progression_service import compute_metrics, get_level_for_xp
        metrics = await compute_metrics(user_id)
        total_xp = metrics["total_xp"]
        lvl = get_level_for_xp(total_xp)
        level = lvl["level"]
        badges_earned = len([b for b in metrics.get("badges_earned", [])]) if "badges_earned" in metrics else 0
        modules_completed = metrics.get("modules_completed", 0)
    except Exception:
        pass

    tr = {
        "fr": {
            "subject": f"Votre progression Mentova \u2014 Niveau {level}",
            "sender_role": "Votre mentor IA \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 \u00c9ducation financi\u00e8re personnalis\u00e9e",
            "greeting": f"Bonjour {user_name},",
            "intro": f"Voici un r\u00e9sum\u00e9 de votre progression sur Mentova.",
            "stats": [("Niveau", str(level)), ("XP Total", f"{total_xp}"), ("Modules", f"{modules_completed}")],
            "next": "Continuez votre parcours en discutant avec moi. Je peux cr\u00e9er de nouveaux modules adapt\u00e9s \u00e0 vos besoins.",
            "cta": "Continuer mon parcours",
            "signoff": "\u00c0 bient\u00f4t,",
        },
        "en": {
            "subject": f"Your Mentova progress \u2014 Level {level}",
            "sender_role": "Your AI mentor \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 Personalized financial education",
            "greeting": f"Hello {user_name},",
            "intro": "Here\u2019s a summary of your progress on Mentova.",
            "stats": [("Level", str(level)), ("Total XP", f"{total_xp}"), ("Modules", f"{modules_completed}")],
            "next": "Continue your journey by chatting with me. I can create new modules tailored to your needs.",
            "cta": "Continue my journey",
            "signoff": "See you soon,",
        },
        "es": {
            "subject": f"Tu progreso en Mentova \u2014 Nivel {level}",
            "sender_role": "Tu mentor IA \u2014 Mentova Academy",
            "footer": "Mentova Academy \u2014 Educaci\u00f3n financiera personalizada",
            "greeting": f"Hola {user_name},",
            "intro": "Aqu\u00ed tienes un resumen de tu progreso en Mentova.",
            "stats": [("Nivel", str(level)), ("XP Total", f"{total_xp}"), ("M\u00f3dulos", f"{modules_completed}")],
            "next": "Contin\u00faa tu camino conversando conmigo. Puedo crear nuevos m\u00f3dulos adaptados a tus necesidades.",
            "cta": "Continuar mi camino",
            "signoff": "Hasta pronto,",
        },
    }
    t = tr.get(lang, tr["en"])
    stats_html = '<div style="display:flex;gap:12px;margin-bottom:24px;">'
    for label, val in t["stats"]:
        stats_html += f'<div style="flex:1;background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#a78bfa;">{val}</div><div style="font-size:11px;color:#71717a;margin-top:4px;">{label}</div></div>'
    stats_html += '</div>'
    body = f'''<p style="font-size:15px;color:#e4e4e7;line-height:1.7;margin:0 0 16px;">{t["greeting"]}</p>
        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 24px;">{t["intro"]}</p>
        {stats_html}
        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 24px;">{t["next"]}</p>
        <div style="text-align:center;margin:28px 0;"><a href="https://app.mentova-academy.com" style="background:#7C3AED;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">{t["cta"]}</a></div>
        <p style="font-size:14px;color:#a1a1aa;margin:24px 0 4px;">{t["signoff"]}</p>
        <p style="font-size:14px;font-weight:600;color:#a78bfa;margin:0;">Caufid</p>'''
    return send_mentova_email(to_email=to_email, subject=t["subject"], html_content=_email_shell(t, body))
