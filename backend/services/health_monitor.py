"""
Mentova Health Monitor — Automated alerting system.
Runs a deep health check every 5 minutes. Sends alert/recovery emails via Brevo.
Anti-spam: only sends on state transitions (ok -> error, error -> ok).
Stores full alert history in MongoDB.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger("health_monitor")

ALERT_EMAIL = "jcuradeau.7@gmail.com"
CHECK_INTERVAL_SECONDS = 5 * 60  # 5 minutes

# In-memory state tracker: service_name -> "ok" | "error"
_service_states: Dict[str, str] = {}

# Reference to the MongoDB database (set during startup)
_db = None


def init_monitor(db):
    """Initialize the monitor with a database reference."""
    global _db
    _db = db
    logger.info(f"Health monitor initialized — checking every {CHECK_INTERVAL_SECONDS}s, alerts to {ALERT_EMAIL}")


async def _run_checks() -> Dict[str, dict]:
    """Run the same checks as /api/health/deep and return results dict."""
    checks = {}

    # 1. MongoDB
    try:
        await _db.command("ping")
        checks["mongodb"] = {"status": "ok"}
    except Exception as e:
        checks["mongodb"] = {"status": "error", "detail": str(e)[:120]}

    # 2. AI (Emergent LLM)
    try:
        from routes.atlas_v3 import client as ai_client
        resp = await ai_client.chat.completions.create(
            model="gpt-5.6-terra",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        checks["ai_llm"] = {"status": "ok"}
    except Exception as e:
        checks["ai_llm"] = {"status": "error", "detail": str(e)[:120]}

    # 3. Stripe
    try:
        stripe_key = os.environ.get("STRIPE_SK", "")
        if not stripe_key:
            raise Exception("STRIPE_SK not set")
        import stripe as stripe_check
        stripe_check.api_key = stripe_key
        stripe_check.Product.list(limit=1)
        checks["stripe"] = {"status": "ok"}
    except Exception as e:
        checks["stripe"] = {"status": "error", "detail": str(e)[:120]}

    # 4. Brevo (Email)
    try:
        brevo_key = os.environ.get("BREVO_API_KEY", "")
        if not brevo_key:
            raise Exception("BREVO_API_KEY not set")
        import sib_api_v3_sdk
        config = sib_api_v3_sdk.Configuration()
        config.api_key['api-key'] = brevo_key
        api_client = sib_api_v3_sdk.ApiClient(config)
        txn_api = sib_api_v3_sdk.TransactionalEmailsApi(api_client)
        txn_api.get_smtp_report(days=1, limit=1)
        checks["brevo_email"] = {"status": "ok"}
    except Exception as e:
        checks["brevo_email"] = {"status": "error", "detail": str(e)[:120]}

    return checks


def _build_alert_html(service: str, detail: str, timestamp: str) -> str:
    """Build an HTML email for a service DOWN alert."""
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
            <p style="font-size:13px;color:#71717a;margin-top:20px;text-align:center;">
                Ce courriel est envoy&eacute; automatiquement par Mentova Health Monitor.
            </p>
        </div>
    </div>
    """


def _build_recovery_html(service: str, downtime_minutes: int, timestamp: str) -> str:
    """Build an HTML email for a service RECOVERY alert."""
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
            <p style="font-size:13px;color:#71717a;margin-top:20px;text-align:center;">
                Ce courriel est envoy&eacute; automatiquement par Mentova Health Monitor.
            </p>
        </div>
    </div>
    """


def _build_test_html(timestamp: str, checks: Dict[str, dict]) -> str:
    """Build an HTML email for a test alert."""
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
                Ce courriel confirme que le syst&egrave;me d'alerte automatique Mentova fonctionne correctement.
                Vous recevrez une alerte si un service tombe, et une notification de r&eacute;cup&eacute;ration quand il revient.
            </p>
            <div style="background:#18181b;border-radius:10px;padding:16px;margin-bottom:16px;">
                <p style="color:#a1a1aa;font-size:12px;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1px;">
                    &Eacute;tat actuel des services
                </p>
                <table style="width:100%;border-collapse:collapse;">{rows}</table>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:6px 0;color:#a1a1aa;font-size:13px;">Fr&eacute;quence</td>
                    <td style="padding:6px 0;color:#e4e4e7;font-size:13px;text-align:right;">Toutes les 5 minutes</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;color:#a1a1aa;font-size:13px;">Destination</td>
                    <td style="padding:6px 0;color:#e4e4e7;font-size:13px;text-align:right;">{ALERT_EMAIL}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;color:#a1a1aa;font-size:13px;">Heure du test</td>
                    <td style="padding:6px 0;color:#e4e4e7;font-size:13px;text-align:right;">{timestamp}</td>
                </tr>
            </table>
            <p style="font-size:13px;color:#71717a;margin-top:20px;text-align:center;">
                Mentova Health Monitor — Surveillance 24/7
            </p>
        </div>
    </div>
    """


async def _send_alert_email(subject: str, html: str):
    """Send an alert email via Brevo."""
    try:
        from services.email_service import send_mentova_email
        send_mentova_email(to_email=ALERT_EMAIL, subject=subject, html_content=html)
        logger.info(f"Alert email sent: {subject}")
    except Exception as e:
        logger.error(f"Failed to send alert email: {e}")


async def _store_alert(event_type: str, service: str, detail: str = ""):
    """Store an alert event in MongoDB for history."""
    try:
        await _db.health_alerts.insert_one({
            "event_type": event_type,  # "down", "recovered", "test"
            "service": service,
            "detail": detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error(f"Failed to store alert: {e}")


# Track when each service went down for downtime calculation
_down_since: Dict[str, datetime] = {}


async def _check_and_alert():
    """Run health checks and send alerts on state transitions."""
    global _service_states, _down_since

    checks = await _run_checks()
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y-%m-%d %H:%M UTC")

    for service, info in checks.items():
        current = info.get("status", "unknown")
        previous = _service_states.get(service, "ok")  # assume ok on first run

        if previous == "ok" and current == "error":
            # Service just went DOWN
            detail = info.get("detail", "Unknown error")
            _down_since[service] = now
            logger.warning(f"SERVICE DOWN: {service} — {detail}")

            html = _build_alert_html(service, detail, ts)
            await _send_alert_email(
                subject=f"[ALERTE] Mentova — {service} est HORS LIGNE",
                html=html,
            )
            await _store_alert("down", service, detail)

        elif previous == "error" and current == "ok":
            # Service just RECOVERED
            down_start = _down_since.pop(service, now)
            downtime_min = max(1, int((now - down_start).total_seconds() / 60))
            logger.info(f"SERVICE RECOVERED: {service} after ~{downtime_min} min")

            html = _build_recovery_html(service, downtime_min, ts)
            await _send_alert_email(
                subject=f"[OK] Mentova — {service} est de retour EN LIGNE",
                html=html,
            )
            await _store_alert("recovered", service, f"downtime ~{downtime_min} min")

        _service_states[service] = current


async def send_test_alert():
    """Send a test alert email with current status of all services."""
    checks = await _run_checks()
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y-%m-%d %H:%M UTC")

    html = _build_test_html(ts, checks)
    await _send_alert_email(
        subject="[TEST] Mentova Health Monitor — Systeme d'alerte actif",
        html=html,
    )
    await _store_alert("test", "all", "Test alert sent")
    return checks


async def get_alert_history(limit: int = 50) -> list:
    """Retrieve alert history from MongoDB."""
    cursor = _db.health_alerts.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def health_monitor_loop():
    """Main background loop — runs every 5 minutes forever."""
    logger.info("Health monitor loop started")
    # Wait 30s on first startup to let services initialize
    await asyncio.sleep(30)

    while True:
        try:
            await _check_and_alert()
            logger.info(f"Health check completed — states: { {k: v for k, v in _service_states.items()} }")
        except Exception as e:
            logger.error(f"Health monitor error: {e}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
