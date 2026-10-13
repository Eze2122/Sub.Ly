"""Backend tests: config state, input validation, forged purchases, evaluation logic."""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


def future(days=10):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat().replace("+00:00", "Z")


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_config_reports_not_configured(client, monkeypatch):
    monkeypatch.setattr(server, "PLAY_SUBSCRIPTION_ID", "")
    r = client.get("/api/billing/config").json()
    assert r["configured"] is False and "PLAY_SUBSCRIPTION_ID" in r["missing"]


def test_verify_not_configured_returns_503(client, monkeypatch):
    monkeypatch.setattr(server, "PLAY_SUBSCRIPTION_ID", "")
    r = client.post("/api/billing/verify", json={"purchaseToken": "x" * 20, "productId": "p"})
    assert r.status_code == 503


def test_verify_validates_input(client):
    assert client.post("/api/billing/verify", json={"purchaseToken": "short", "productId": "p"}).status_code == 422


def _configure(monkeypatch, tmp_path):
    f = tmp_path / "sa.json"
    f.write_text("{}")
    monkeypatch.setattr(server, "PLAY_PACKAGE_NAME", "com.example.app")
    monkeypatch.setattr(server, "PLAY_SUBSCRIPTION_ID", "subly_monthly")
    monkeypatch.setattr(server, "PLAY_SERVICE_ACCOUNT_FILE", str(f))


def test_forged_token_rejected(client, monkeypatch, tmp_path):
    _configure(monkeypatch, tmp_path)

    async def fake_fetch(token):
        return None  # Google does not recognise the token

    monkeypatch.setattr(server, "fetch_subscription", fake_fetch)
    r = client.post("/api/billing/verify", json={"purchaseToken": "forged-token-123456", "productId": "subly_monthly"})
    assert r.status_code == 403


def test_wrong_product_rejected(client, monkeypatch, tmp_path):
    _configure(monkeypatch, tmp_path)
    r = client.post("/api/billing/verify", json={"purchaseToken": "token-123456789012", "productId": "other"})
    assert r.status_code == 400


def test_token_for_other_product_rejected(client, monkeypatch, tmp_path):
    _configure(monkeypatch, tmp_path)

    async def fake_fetch(token):
        return {"subscriptionState": "SUBSCRIPTION_STATE_ACTIVE", "lineItems": [{"productId": "another", "expiryTime": future()}]}

    monkeypatch.setattr(server, "fetch_subscription", fake_fetch)
    r = client.post("/api/billing/verify", json={"purchaseToken": "token-123456789012", "productId": "subly_monthly"})
    assert r.status_code == 403


def test_rtdn_requires_auth(client, monkeypatch, tmp_path):
    _configure(monkeypatch, tmp_path)
    monkeypatch.setattr(server, "PUBSUB_AUDIENCE", "aud")
    monkeypatch.setattr(server, "PUBSUB_PUSH_SERVICE_ACCOUNT", "push@x.iam.gserviceaccount.com")
    assert client.post("/api/billing/rtdn", json={}).status_code == 401


@pytest.mark.parametrize(
    "state,expiry,entitled,expected",
    [
        ("SUBSCRIPTION_STATE_ACTIVE", 10, True, "active"),
        ("SUBSCRIPTION_STATE_IN_GRACE_PERIOD", 2, True, "grace"),
        ("SUBSCRIPTION_STATE_CANCELED", 5, True, "canceled_active"),
        ("SUBSCRIPTION_STATE_EXPIRED", -1, False, "expired"),
        ("SUBSCRIPTION_STATE_ON_HOLD", -1, False, "on_hold"),
        ("SUBSCRIPTION_STATE_ACTIVE", -1, False, "expired"),
    ],
)
def test_evaluate_states(state, expiry, entitled, expected):
    r = server.evaluate({"subscriptionState": state, "lineItems": [{"productId": "p", "expiryTime": future(expiry)}]}, "p")
    assert r["entitled"] is entitled and r["state"] == expected


def test_evaluate_trial():
    r = server.evaluate({"subscriptionState": "SUBSCRIPTION_STATE_ACTIVE", "lineItems": [{"productId": "p", "expiryTime": future(7), "offerDetails": {"offerId": "free-trial-7d"}}]}, "p")
    assert r["entitled"] and r["state"] == "trial"
