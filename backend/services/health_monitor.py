"""
Mentova Health Monitor — Automated alerting system.
Runs a deep health check every 5 minutes.
Sends alerts via TWO channels: Brevo (email) + Telegram (backup).
Anti-spam: only sends on state transitions (ok -> error, error -> ok).
Stores full alert history in MongoDB.
"""
import os
import asyncio
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict

logger = logging.getLogger("health_monitor")

ALERT_EMAIL = "jcuradeau.7@hotmail.com"
CHECK_INTERVAL_SECONDS = 5 * 60  # 5 minutes

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

# In-memory state tracker: service_name -> "ok" | "error"
_service_states: Dict[str, str] = {}

# Reference to the MongoDB database (set during startup)
_db = None


def init_monitor(db):
    """Initialize the monitor with a database reference."""
    global _db, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
    _db = db
    TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
    tg_status = "OK" if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID else "NOT CONFIGURED"
    logger.info(f"Health monitor initialized — every {CHECK_INTERVAL_SECONDS}s | email: {ALERT_EMAIL} | telegram: {tg_status}")


# ─── Telegram ───────────────────────────────────────────

async def _send_telegram(text: str):
    """Send a message via Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured — skipping")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                logger.info("Telegram alert sent")
            else:
                logger.error(f"Telegram API error {resp.status_code}: {resp.text[:120]}")
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")


def _tg_alert_down(service: str, detail: str, timestamp: str) -> str:
    return (
        f"<b>ALERTE — Service en panne</b>\n\n"
        f"<b>Service:</b> {service}\n"
        f"<b>Statut:</b> HORS LIGNE\n"
        f"<b>Erreur:</b> {detail}\n"
        f"<b>Heure:</b> {timestamp}\n\n"
        f"<i>Mentova Health Monitor</i>"
    )


def _tg_alert_recovery(service: str, downtime_min: int, timestamp: str) -> str:
    return (
        f"<b>OK — Service retabli</b>\n\n"
        f"<b>Service:</b> {service}\n"
        f"<b>Statut:</b> EN LIGNE\n"
        f"<b>Duree panne:</b> ~{downtime_min} min\n"
        f"<b>Heure:</b> {timestamp}\n\n"
        f"<i>Mentova Health Monitor</i>"
    )


def _tg_test(timestamp: str, checks: Dict[str, dict]) -> str:
    lines = ["<b>TEST — Monitoring Actif</b>\n"]
    for svc, info in checks.items():
        status = info.get("status", "unknown")
        icon = "\u2705" if status == "ok" else "\u274c"
        lines.append(f"{icon} <b>{svc}</b>: {status.upper()}")
    lines.append(f"\n<b>Heure:</b> {timestamp}")
    lines.append(f"<b>Frequence:</b> 5 min")
    lines.append(f"<b>Email:</b> {ALERT_EMAIL}")
    lines.append(f"\n<i>Mentova Health Monitor — 24/7</i>")
    return "\n".join(lines)


# ─── Health checks ──────────────────────────────────────

async def _run_checks(skip_ai: bool = False) -> Dict[str, dict]:
    """Run the same checks as /api/health/deep and return results dict."""
    checks = {}

    # 1. MongoDB
    try:
        await _db.command("ping")
        checks["mongodb"] = {"status": "ok"}
    except Exception as e:
        checks["mongodb"] = {"status": "error", "detail": str(e)[:120]}

    # 2. AI (Emergent LLM) — checked less frequently to save credits
    if not skip_ai:
        try:
            from routes.atlas_v3 import client as ai_client
            await ai_client.chat.completions.create(
                model="gpt-5.6-terra",
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
            )
            checks["ai_llm"] = {"status": "ok"}
        except Exception as e:
            checks["ai_llm"] = {"status": "error", "detail": str(e)[:120]}

    # 3. Stripe — only check that the API key is present (no API calls to avoid fake transactions)
    stripe_key = os.environ.get("STRIPE_SK", "")
    if stripe_key:
        checks["stripe"] = {"status": "ok"}
    else:
        checks["stripe"] = {"status": "error", "detail": "STRIPE_SK not set"}

    # 4. Brevo (Email) — only verify key is present (avoid false-positive 401)
    brevo_key = os.environ.get("BREVO_API_KEY", "")
    if brevo_key:
        checks["brevo_email"] = {"status": "ok"}
    else:
        checks["brevo_email"] = {"status": "error", "detail": "BREVO_API_KEY not set"}

    return checks


# ─── Email templates ────────────────────────────────────

def _build_alert_html(service: str, detail: str, timestamp: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#DC2626,#991B1B);padding:28px 32px;text-align:center;">
            <div style="font-size:32px;margin-bottom:6px;">&#9888;</div>
            <h1 style="color:#fff;font-size:22px;margin:0;">Service en panne</h1>
        </div>
        <div style="padding:28px 32px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Service</td>
                    <td style="padding:10px 0;color:#f87171;font-weight:700;font-size:15px;text-align:right;">{service}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Statut</td>
                    <td style="padding:10px 0;color:#f87171;font-weight:700;font-size:15px;text-align:right;">HORS LIGNE</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Erreur</td>
                    <td style="padding:10px 0;color:#fbbf24;font-size:13px;text-align:right;word-break:break-all;">{detail}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Heure</td>
                    <td style="padding:10px 0;color:#e4e4e7;font-size:13px;text-align:right;">{timestamp}</td>
                </tr>
            </table>
            <p style="font-size:13px;color:#71717a;margin-top:20px;text-align:center;">Mentova Health Monitor — Surveillance 24/7</p>
        </div>
    </div>"""


def _build_recovery_html(service: str, downtime_minutes: int, timestamp: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#16A34A,#15803D);padding:28px 32px;text-align:center;">
            <div style="font-size:32px;margin-bottom:6px;">&#10003;</div>
            <h1 style="color:#fff;font-size:22px;margin:0;">Service r&eacute;tabli</h1>
        </div>
        <div style="padding:28px 32px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Service</td>
                    <td style="padding:10px 0;color:#4ade80;font-weight:700;font-size:15px;text-align:right;">{service}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Statut</td>
                    <td style="padding:10px 0;color:#4ade80;font-weight:700;font-size:15px;text-align:right;">EN LIGNE</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Dur&eacute;e panne</td>
                    <td style="padding:10px 0;color:#fbbf24;font-size:13px;text-align:right;">~{downtime_minutes} min</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Heure</td>
                    <td style="padding:10px 0;color:#e4e4e7;font-size:13px;text-align:right;">{timestamp}</td>
                </tr>
            </table>
            <p style="font-size:13px;color:#71717a;margin-top:20px;text-align:center;">Mentova Health Monitor — Surveillance 24/7</p>
        </div>
    </div>"""


def _build_test_html(timestamp: str, checks: Dict[str, dict]) -> str:
    rows = ""
    for svc, info in checks.items():
        status = info.get("status", "unknown")
        color = "#4ade80" if status == "ok" else "#f87171"
        label = "EN LIGNE" if status == "ok" else "HORS LIGNE"
        rows += f"""
        <tr>
            <td style="padding:8px 0;color:#e4e4e7;font-size:14px;">{svc}</td>
            <td style="padding:8px 0;color:{color};font-weight:700;font-size:14px;text-align:right;">{label}</td>
        </tr>"""
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7C3AED,#4F46E5);padding:28px 32px;text-align:center;">
            <div style="font-size:32px;margin-bottom:6px;">&#128737;</div>
            <h1 style="color:#fff;font-size:22px;margin:0;">Alerte Test — Monitoring Actif</h1>
        </div>
        <div style="padding:28px 32px;">
            <p style="font-size:14px;color:#a1a1aa;margin-bottom:16px;">
                Le syst&egrave;me d'alerte Mentova fonctionne. Vous recevrez une alerte par <b>email + Telegram</b> si un service tombe.
            </p>
            <div style="background:#18181b;border-radius:10px;padding:16px;margin-bottom:16px;">
                <p style="color:#a1a1aa;font-size:12px;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1px;">&Eacute;tat actuel</p>
                <table style="width:100%;border-collapse:collapse;">{rows}</table>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#a1a1aa;font-size:13px;">Fr&eacute;quence</td><td style="padding:6px 0;color:#e4e4e7;font-size:13px;text-align:right;">Toutes les 5 minutes</td></tr>
                <tr><td style="padding:6px 0;color:#a1a1aa;font-size:13px;">Email</td><td style="padding:6px 0;color:#e4e4e7;font-size:13px;text-align:right;">{ALERT_EMAIL}</td></tr>
                <tr><td style="padding:6px 0;color:#a1a1aa;font-size:13px;">Telegram</td><td style="padding:6px 0;color:#e4e4e7;font-size:13px;text-align:right;">@MentovaAlerts_bot</td></tr>
            </table>
            <p style="font-size:13px;color:#71717a;margin-top:20px;text-align:center;">Mentova Health Monitor — Surveillance 24/7</p>
        </div>
    </div>"""


# ─── Alert dispatch (both channels) ────────────────────

async def _send_alert(subject: str, html: str, telegram_text: str):
    """Send alert via BOTH Brevo email and Telegram."""
    # Email
    try:
        from services.email_service import send_mentova_email
        send_mentova_email(to_email=ALERT_EMAIL, subject=subject, html_content=html)
        logger.info(f"Alert email sent: {subject}")
    except Exception as e:
        logger.error(f"Email alert failed: {e}")

    # Telegram (backup — works even if Brevo is down)
    await _send_telegram(telegram_text)


async def _store_alert(event_type: str, service: str, detail: str = ""):
    """Store an alert event in MongoDB for history."""
    try:
        await _db.health_alerts.insert_one({
            "event_type": event_type,
            "service": service,
            "detail": detail,
            "channels": ["email", "telegram"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error(f"Failed to store alert: {e}")


# Track when each service went down for downtime calculation
_down_since: Dict[str, datetime] = {}


async def _check_and_alert(skip_ai: bool = False):
    """Run health checks and send alerts on state transitions."""
    global _service_states, _down_since

    checks = await _run_checks(skip_ai=skip_ai)
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y-%m-%d %H:%M UTC")

    for service, info in checks.items():
        current = info.get("status", "unknown")
        previous = _service_states.get(service, "ok")

        if previous == "ok" and current == "error":
            detail = info.get("detail", "Unknown error")
            _down_since[service] = now
            logger.warning(f"SERVICE DOWN: {service} — {detail}")

            await _send_alert(
                subject=f"[ALERTE] Mentova — {service} est HORS LIGNE",
                html=_build_alert_html(service, detail, ts),
                telegram_text=_tg_alert_down(service, detail, ts),
            )
            await _store_alert("down", service, detail)

        elif previous == "error" and current == "ok":
            down_start = _down_since.pop(service, now)
            downtime_min = max(1, int((now - down_start).total_seconds() / 60))
            logger.info(f"SERVICE RECOVERED: {service} after ~{downtime_min} min")

            await _send_alert(
                subject=f"[OK] Mentova — {service} est de retour EN LIGNE",
                html=_build_recovery_html(service, downtime_min, ts),
                telegram_text=_tg_alert_recovery(service, downtime_min, ts),
            )
            await _store_alert("recovered", service, f"downtime ~{downtime_min} min")

        _service_states[service] = current


async def send_test_alert():
    """Send a test alert via both email and Telegram."""
    checks = await _run_checks()
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y-%m-%d %H:%M UTC")

    await _send_alert(
        subject="[TEST] Mentova Health Monitor — Systeme d'alerte actif",
        html=_build_test_html(ts, checks),
        telegram_text=_tg_test(ts, checks),
    )
    await _store_alert("test", "all", "Test alert sent (email + telegram)")
    return checks


async def get_alert_history(limit: int = 50) -> list:
    """Retrieve alert history from MongoDB."""
    cursor = _db.health_alerts.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def health_monitor_loop():
    """Main background loop — runs every 5 minutes forever.
    AI check runs only every 3rd cycle (~15 min) to save LLM credits.
    """
    logger.info("Health monitor loop started")
    await asyncio.sleep(30)

    cycle = 0
    while True:
        try:
            cycle += 1
            skip_ai = (cycle % 6 != 0)  # AI checked every 6th cycle = every 30 min
            await _check_and_alert(skip_ai=skip_ai)
            logger.info(f"Health check #{cycle} completed (ai={'skipped' if skip_ai else 'checked'}) — states: { {k: v for k, v in _service_states.items()} }")
        except Exception as e:
            logger.error(f"Health monitor error: {e}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
