"""
Mentova Stripe Service
Handles Product/Price creation, Checkout Sessions, Customer Portal,
and Webhook processing for the VIP subscription lifecycle.
"""
import stripe
import os
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("stripe_service")

STRIPE_SK = os.environ.get("STRIPE_SK", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

if STRIPE_SK:
    stripe.api_key = STRIPE_SK
    logger.info(f"Stripe initialized: {STRIPE_SK[:14]}...")
else:
    logger.warning("No STRIPE_SK — Stripe features disabled")

VIP_PRICE_CENTS = 2199  # $21.99
VIP_CURRENCY = "usd"
VIP_PRODUCT_NAME = "Mentova VIP"
VIP_PRODUCT_METADATA_KEY = "mentova_plan"
VIP_PRODUCT_METADATA_VALUE = "vip_monthly"

# Cached IDs (set once at startup or first use)
_cached_price_id: Optional[str] = None
_cached_product_id: Optional[str] = None


def _ensure_product_and_price() -> str:
    """Find or create the Mentova VIP product and monthly price. Returns price_id."""
    global _cached_price_id, _cached_product_id

    if _cached_price_id:
        return _cached_price_id

    if not STRIPE_SK:
        raise Exception("Stripe not configured")

    # Search for existing product by metadata
    products = stripe.Product.search(query=f"metadata['{VIP_PRODUCT_METADATA_KEY}']:'{VIP_PRODUCT_METADATA_VALUE}'")
    product_id = None
    if products.data:
        product_id = products.data[0].id
        logger.info(f"Found existing Stripe product: {product_id}")
    else:
        product = stripe.Product.create(
            name=VIP_PRODUCT_NAME,
            description="Mentova VIP - Caufid Premium, mémoire persistante, briefing quotidien, outils pro",
            metadata={VIP_PRODUCT_METADATA_KEY: VIP_PRODUCT_METADATA_VALUE},
        )
        product_id = product.id
        logger.info(f"Created Stripe product: {product_id}")

    _cached_product_id = product_id

    # Search for existing price
    prices = stripe.Price.list(product=product_id, active=True, type="recurring")
    for p in prices.data:
        if p.unit_amount == VIP_PRICE_CENTS and p.currency == VIP_CURRENCY and p.recurring.interval == "month":
            _cached_price_id = p.id
            logger.info(f"Found existing Stripe price: {_cached_price_id}")
            return _cached_price_id

    # Create new price
    price = stripe.Price.create(
        product=product_id,
        currency=VIP_CURRENCY,
        unit_amount=VIP_PRICE_CENTS,
        recurring={"interval": "month"},
        metadata={VIP_PRODUCT_METADATA_KEY: VIP_PRODUCT_METADATA_VALUE},
    )
    _cached_price_id = price.id
    logger.info(f"Created Stripe price: {_cached_price_id}")
    return _cached_price_id


def get_or_create_customer(db_user: dict) -> str:
    """Get existing Stripe customer or create one. Returns customer_id."""
    if db_user.get("stripe_customer_id"):
        return db_user["stripe_customer_id"]

    customer = stripe.Customer.create(
        email=db_user.get("email", ""),
        name=db_user.get("name", ""),
        metadata={"user_id": db_user["id"]},
    )
    return customer.id


async def create_checkout_session(user: dict, origin_url: str, db) -> dict:
    """Create a Stripe Checkout session for VIP subscription."""
    price_id = _ensure_product_and_price()
    customer_id = get_or_create_customer(user)

    # Save customer_id to user if new
    if not user.get("stripe_customer_id"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"stripe_customer_id": customer_id}}
        )

    success_url = f"{origin_url}/vip/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/vip"

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data={"metadata": {"user_id": user["id"]}},
        metadata={"user_id": user["id"]},
        allow_promotion_codes=True,
    )

    return {"checkout_url": session.url, "session_id": session.id}


async def create_portal_session(user: dict, return_url: str) -> dict:
    """Create a Stripe Customer Portal session for subscription management."""
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise Exception("No Stripe customer found for this user")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return {"url": session.url}


async def handle_webhook_event(payload: bytes, signature: str, db) -> dict:
    """
    Process a Stripe webhook event.
    Returns a dict with processing result.
    """
    if not STRIPE_WEBHOOK_SECRET:
        logger.warning("No webhook secret configured — processing without signature verification")
        import json
        event = json.loads(payload)
    else:
        try:
            event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
        except ValueError:
            return {"error": "Invalid payload", "status": 400}
        except stripe.error.SignatureVerificationError:
            return {"error": "Invalid signature", "status": 400}

    event_id = event.get("id", "")
    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    # Idempotency: skip if already processed
    existing = await db.stripe_events.find_one({"event_id": event_id})
    if existing:
        return {"received": True, "duplicate": True}

    await db.stripe_events.insert_one({
        "event_id": event_id,
        "type": event_type,
        "processed_at": datetime.now(timezone.utc),
    })

    logger.info(f"Stripe webhook: {event_type} (event={event_id})")

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(obj, db)

    elif event_type == "customer.subscription.created":
        await _handle_subscription_update(obj, db, "created")

    elif event_type == "customer.subscription.updated":
        await _handle_subscription_update(obj, db, "updated")

    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(obj, db)

    elif event_type == "invoice.paid":
        await _handle_invoice_paid(obj, db)

    elif event_type == "invoice.payment_failed":
        await _handle_invoice_failed(obj, db)

    return {"received": True}


async def _handle_checkout_completed(obj: dict, db):
    """Link checkout to user, activate VIP."""
    user_id = (obj.get("metadata") or {}).get("user_id")
    customer_id = obj.get("customer")
    subscription_id = obj.get("subscription")

    if user_id and customer_id:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
                "is_vip": True,
                "vip_activated_at": datetime.now(timezone.utc),
                "vip_expires_at": datetime.now(timezone.utc) + timedelta(days=32),
            }}
        )
        logger.info(f"VIP activated for user {user_id} via checkout")


async def _handle_subscription_update(obj: dict, db, action: str):
    """Handle subscription created or updated."""
    sub_id = obj.get("id")
    customer_id = obj.get("customer")
    status = obj.get("status")
    cancel_at_period_end = obj.get("cancel_at_period_end", False)
    current_period_end = obj.get("current_period_end")
    metadata = obj.get("metadata") or {}
    user_id = metadata.get("user_id")

    # Save subscription record
    sub_doc = {
        "stripe_subscription_id": sub_id,
        "stripe_customer_id": customer_id,
        "user_id": user_id,
        "status": status,
        "cancel_at_period_end": cancel_at_period_end,
        "current_period_end": current_period_end,
        "action": action,
        "updated_at": datetime.now(timezone.utc),
    }
    await db.subscriptions.update_one(
        {"stripe_subscription_id": sub_id},
        {"$set": sub_doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    # Update user VIP status based on subscription status
    if user_id:
        if status in ("active", "trialing"):
            expires = None
            if current_period_end:
                expires = datetime.fromtimestamp(current_period_end, tz=timezone.utc) + timedelta(days=2)
            update = {"is_vip": True, "vip_status": status}
            if expires:
                update["vip_expires_at"] = expires
            if cancel_at_period_end:
                update["vip_cancel_at_period_end"] = True
            else:
                update["vip_cancel_at_period_end"] = False
            await db.users.update_one({"id": user_id}, {"$set": update})
        elif status in ("past_due", "unpaid"):
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"vip_status": status}}
            )

    logger.info(f"Subscription {action}: sub={sub_id} status={status} user={user_id}")


async def _handle_subscription_deleted(obj: dict, db):
    """Subscription fully ended — downgrade to FREE."""
    sub_id = obj.get("id")
    metadata = obj.get("metadata") or {}
    user_id = metadata.get("user_id")

    await db.subscriptions.update_one(
        {"stripe_subscription_id": sub_id},
        {"$set": {"status": "canceled", "updated_at": datetime.now(timezone.utc)}}
    )

    if user_id:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "is_vip": False,
                "vip_status": "canceled",
                "vip_cancel_at_period_end": False,
            }}
        )
        logger.info(f"VIP deactivated for user {user_id} — subscription deleted")
    else:
        # Find user by customer_id
        customer_id = obj.get("customer")
        if customer_id:
            await db.users.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {
                    "is_vip": False,
                    "vip_status": "canceled",
                    "vip_cancel_at_period_end": False,
                }}
            )


async def _handle_invoice_paid(obj: dict, db):
    """Invoice paid — ensure VIP is active (handles renewals)."""
    sub_id = obj.get("subscription")
    customer_id = obj.get("customer")
    if sub_id:
        await db.subscriptions.update_one(
            {"stripe_subscription_id": sub_id},
            {"$set": {"last_invoice_status": "paid", "updated_at": datetime.now(timezone.utc)}}
        )
    # Ensure user is VIP (covers renewal case)
    if customer_id:
        user = await db.users.find_one({"stripe_customer_id": customer_id})
        if user and not user.get("is_vip"):
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "is_vip": True,
                    "vip_status": "active",
                    "vip_expires_at": datetime.now(timezone.utc) + timedelta(days=32),
                }}
            )
            logger.info(f"VIP restored for user {user['id']} via invoice.paid")


async def _handle_invoice_failed(obj: dict, db):
    """Payment failed — log but don't immediately downgrade (Stripe retries)."""
    sub_id = obj.get("subscription")
    if sub_id:
        await db.subscriptions.update_one(
            {"stripe_subscription_id": sub_id},
            {"$set": {
                "last_invoice_status": "payment_failed",
                "updated_at": datetime.now(timezone.utc),
            }}
        )
    logger.warning(f"Invoice payment failed for subscription {sub_id}")


async def get_subscription_info(user: dict, db) -> dict:
    """Get detailed subscription info for a user."""
    if not user.get("stripe_subscription_id"):
        return {"has_subscription": False}
    try:
        sub = stripe.Subscription.retrieve(user["stripe_subscription_id"])
        return {
            "has_subscription": True,
            "status": sub.status,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "current_period_end": datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc).isoformat() if sub.current_period_end else None,
            "current_period_start": datetime.fromtimestamp(sub.current_period_start, tz=timezone.utc).isoformat() if sub.current_period_start else None,
        }
    except Exception as e:
        logger.error(f"Error fetching subscription: {e}")
        return {"has_subscription": True, "error": "Could not fetch subscription details"}
