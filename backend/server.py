"""Subly backend: Google Play subscription verification + RTDN.

No user accounts. No Gmail data. Stores only subscription state keyed by a
SHA-256 hash of the purchase token. Secrets come from environment variables.
"""
import base64
from contextlib import asynccontextmanager
import hashlib
import json
import logging
import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Optional

import httpx
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("subly")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# Optional (pending external configuration). Missing values => "not_configured".
PLAY_PACKAGE_NAME = os.environ.get("PLAY_PACKAGE_NAME", "").strip()
PLAY_SUBSCRIPTION_ID = os.environ.get("PLAY_SUBSCRIPTION_ID", "").strip()
PLAY_SERVICE_ACCOUNT_FILE = os.environ.get("PLAY_SERVICE_ACCOUNT_FILE", "").strip()
PUBSUB_AUDIENCE = os.environ.get("PUBSUB_AUDIENCE", "").strip()
PUBSUB_PUSH_SERVICE_ACCOUNT = os.environ.get("PUBSUB_PUSH_SERVICE_ACCOUNT", "").strip()
ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
PLAY_API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"

@asynccontextmanager
async def lifespan(_app):
    await db.entitlements.create_index("token_hash", unique=True)
    await db.rtdn_seen.create_index("messageId", unique=True)
    m = missing_config()
    log.info("billing_configured=%s missing=%s", not m, ",".join(m))
    yield
    client.close()


app = FastAPI(title="Subly API", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------- models
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude_none=True)
        d.pop("_id", None)
        return d

    @classmethod
    def from_mongo(cls, doc: Optional[dict]):
        return cls.model_validate(doc) if doc else None


class Entitlement(BaseDocument):
    token_hash: str
    product_id: str
    state: str
    play_state: str
    expiry_time: Optional[str] = None
    auto_renewing: Optional[bool] = None
    install_hash: Optional[str] = None
    updated_at: str


class VerifyIn(BaseModel):
    purchaseToken: str = Field(min_length=10, max_length=4096)
    productId: str = Field(min_length=1, max_length=200)
    installHash: Optional[str] = Field(default=None, max_length=128)


# ---------------------------------------------------------------- helpers
def missing_config() -> list[str]:
    missing = []
    if not PLAY_PACKAGE_NAME:
        missing.append("PLAY_PACKAGE_NAME")
    if not PLAY_SUBSCRIPTION_ID:
        missing.append("PLAY_SUBSCRIPTION_ID")
    if not PLAY_SERVICE_ACCOUNT_FILE or not Path(PLAY_SERVICE_ACCOUNT_FILE).is_file():
        missing.append("PLAY_SERVICE_ACCOUNT_FILE")
    return missing


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


_creds = None


def play_access_token() -> str:
    global _creds
    from google.auth.transport.requests import Request as GRequest
    from google.oauth2 import service_account

    if _creds is None:
        _creds = service_account.Credentials.from_service_account_file(PLAY_SERVICE_ACCOUNT_FILE, scopes=[ANDROID_PUBLISHER_SCOPE])
    if not _creds.valid:
        _creds.refresh(GRequest())
    return _creds.token


async def fetch_subscription(purchase_token: str) -> Optional[dict]:
    """purchases.subscriptionsv2.get. Returns None when Google does not recognise the token."""
    url = f"{PLAY_API}/{PLAY_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/{purchase_token}"
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.get(url, headers={"Authorization": f"Bearer {play_access_token()}"})
    if r.status_code in (400, 404, 410):
        return None
    if r.status_code != 200:
        log.warning("play_api_error status=%s", r.status_code)
        raise HTTPException(502, "No se pudo consultar Google Play.")
    return r.json()


async def acknowledge(product_id: str, purchase_token: str) -> None:
    url = f"{PLAY_API}/{PLAY_PACKAGE_NAME}/purchases/subscriptions/{product_id}/tokens/{purchase_token}:acknowledge"
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.post(url, headers={"Authorization": f"Bearer {play_access_token()}"}, json={})
    if r.status_code not in (200, 204):
        log.warning("play_ack_failed status=%s", r.status_code)


PLAY_STATE_MAP = {
    "SUBSCRIPTION_STATE_ACTIVE": "active",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": "grace",
    "SUBSCRIPTION_STATE_ON_HOLD": "on_hold",
    "SUBSCRIPTION_STATE_PAUSED": "paused",
    "SUBSCRIPTION_STATE_CANCELED": "canceled_active",
    "SUBSCRIPTION_STATE_EXPIRED": "expired",
    "SUBSCRIPTION_STATE_PENDING": "none",
    "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED": "none",
}


def evaluate(sub: dict, expected_product: str, now: Optional[datetime] = None) -> dict:
    """Pure evaluation of a subscriptionsv2 resource. Grants only when product,
    state and expiry all match. A CANCELED subscription stays usable until expiry."""
    now = now or datetime.now(timezone.utc)
    items = [li for li in sub.get("lineItems") or [] if li.get("productId") == expected_product]
    if not items:
        return {"entitled": False, "state": "none", "expiryTime": None, "autoRenewing": None, "reason": "product_mismatch"}
    item = max(items, key=lambda li: li.get("expiryTime") or "")
    expiry = item.get("expiryTime")
    play_state = sub.get("subscriptionState", "")
    state = PLAY_STATE_MAP.get(play_state, "none")
    offer = (item.get("offerDetails") or {})
    in_trial = any("trial" in str(t).lower() for t in (offer.get("offerTags") or [])) or "trial" in str(offer.get("offerId", "")).lower()
    if state == "active" and in_trial:
        state = "trial"
    not_expired = False
    if expiry:
        try:
            not_expired = datetime.fromisoformat(expiry.replace("Z", "+00:00")) > now
        except ValueError:
            not_expired = False
    entitled = state in ("active", "trial", "grace", "canceled_active") and not_expired
    if sub.get("testPurchase") is not None:
        log.info("play_test_purchase=true")
    return {
        "entitled": entitled,
        "state": state if entitled or state not in ("active", "trial", "canceled_active") else "expired",
        "expiryTime": expiry,
        "autoRenewing": (item.get("autoRenewingPlan") or {}).get("autoRenewEnabled"),
        "playState": play_state,
        "ackState": sub.get("acknowledgementState"),
    }


# ---------------------------------------------------------------- rate limit
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request, limit: int = 30, window: int = 60) -> None:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    q = _hits[ip]
    t = time.time()
    while q and q[0] < t - window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Demasiadas solicitudes.")
    q.append(t)


# ---------------------------------------------------------------- routes
@api.get("/health")
async def health():
    return {"ok": True, "service": "subly"}


@api.get("/billing/config")
async def billing_config():
    missing = missing_config()
    return {
        "configured": not missing,
        "productId": PLAY_SUBSCRIPTION_ID or None,
        "packageName": PLAY_PACKAGE_NAME or None,
        "missing": missing,
    }


@api.post("/billing/verify")
async def billing_verify(body: VerifyIn, request: Request):
    rate_limit(request)
    if missing_config():
        raise HTTPException(503, "Google Play Billing no está configurado en el servidor.")
    if body.productId != PLAY_SUBSCRIPTION_ID:
        raise HTTPException(400, "Producto no válido.")
    if not re.fullmatch(r"[A-Za-z0-9._\-:]+", body.purchaseToken):
        raise HTTPException(400, "Token de compra con formato inválido.")
    sub = await fetch_subscription(body.purchaseToken)
    if sub is None:
        raise HTTPException(403, "Google Play no reconoce esta compra.")
    result = evaluate(sub, PLAY_SUBSCRIPTION_ID)
    if result.get("reason") == "product_mismatch":
        raise HTTPException(403, "La compra no corresponde a la suscripción de Subly.")
    if result["entitled"] and result.get("ackState") == "ACKNOWLEDGEMENT_STATE_PENDING":
        await acknowledge(PLAY_SUBSCRIPTION_ID, body.purchaseToken)
    ent = Entitlement(
        token_hash=token_hash(body.purchaseToken),
        product_id=PLAY_SUBSCRIPTION_ID,
        state=result["state"],
        play_state=result.get("playState", ""),
        expiry_time=result["expiryTime"],
        auto_renewing=result["autoRenewing"],
        install_hash=body.installHash,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    await db.entitlements.update_one({"token_hash": ent.token_hash}, {"$set": ent.to_mongo()}, upsert=True)
    return {"entitled": result["entitled"], "state": result["state"], "expiryTime": result["expiryTime"], "autoRenewing": result["autoRenewing"]}


@api.post("/billing/rtdn")
async def billing_rtdn(request: Request):
    """Google Play Real-time Developer Notifications via authenticated Pub/Sub push."""
    if missing_config() or not PUBSUB_AUDIENCE or not PUBSUB_PUSH_SERVICE_ACCOUNT:
        raise HTTPException(503, "RTDN no configurado.")
    from google.auth.transport.requests import Request as GRequest
    from google.oauth2 import id_token

    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Sin autenticación.")
    try:
        claims = id_token.verify_oauth2_token(auth[7:], GRequest(), audience=PUBSUB_AUDIENCE)
    except Exception:
        raise HTTPException(401, "Token inválido.")
    if claims.get("email") != PUBSUB_PUSH_SERVICE_ACCOUNT or not claims.get("email_verified"):
        raise HTTPException(401, "Emisor no autorizado.")
    envelope: dict[str, Any] = await request.json()
    msg = envelope.get("message") or {}
    mid = msg.get("messageId")
    if not mid:
        raise HTTPException(400, "Mensaje inválido.")
    if await db.rtdn_seen.find_one({"messageId": mid}):
        return {"ok": True, "duplicate": True}
    await db.rtdn_seen.insert_one({"messageId": mid, "seenAt": datetime.now(timezone.utc).isoformat()})
    try:
        payload = json.loads(base64.b64decode(msg.get("data", "")))
    except Exception:
        return {"ok": True}
    if payload.get("packageName") != PLAY_PACKAGE_NAME:
        return {"ok": True, "ignored": "package"}
    sn = payload.get("subscriptionNotification") or {}
    token = sn.get("purchaseToken")
    if not token:
        return {"ok": True}
    sub = await fetch_subscription(token)
    if sub is None:
        return {"ok": True}
    result = evaluate(sub, PLAY_SUBSCRIPTION_ID)
    await db.entitlements.update_one(
        {"token_hash": token_hash(token)},
        {"$set": {"state": result["state"], "play_state": result.get("playState", ""), "expiry_time": result["expiryTime"], "auto_renewing": result["autoRenewing"], "product_id": PLAY_SUBSCRIPTION_ID, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


