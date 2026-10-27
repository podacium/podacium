# Chargily Pay Sandbox Testing Guide

## Setup

1. Get a test API key from [Chargily Pay Dashboard](https://dashboard.chargily.com) (Test Mode)
2. Set env vars:

```bash
export CHARGILY_API_KEY="test_api_key_..."
export CHARGILY_WEBHOOK_SECRET="test_webhook_secret"
export CHARGILY_MODE="test"
```

Test API base URL: `https://pay.chargily.net/test/api/v2`

## API Exploration Script

Save as `scripts/test_chargily.py` and run with `python scripts/test_chargily.py`:

```python
#!/usr/bin/env python3
"""Test Chargily Pay API interactions in sandbox mode."""
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("CHARGILY_API_KEY", "")
BASE = "https://pay.chargily.net/test/api/v2"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def create_checkout(amount: int = 1000, currency: str = "DZD") -> dict:
    """Create a test payment checkout."""
    payload = {
        "amount": amount,
        "currency": currency,
        "success_url": "http://localhost:8000/payments/success",
        "failure_url": "http://localhost:8000/payments/failure",
        "metadata": {"test": True, "source": "sandbox_script"},
    }
    resp = requests.post(f"{BASE}/checkouts", json=payload, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def get_checkout(checkout_id: str) -> dict:
    """Get checkout details."""
    resp = requests.get(f"{BASE}/checkouts/{checkout_id}", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def expire_checkout(checkout_id: str) -> dict:
    """Expire/delete a pending checkout."""
    resp = requests.post(f"{BASE}/checkouts/{checkout_id}/expire", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def list_checkouts(page: int = 1) -> dict:
    """List all checkouts (paginated)."""
    resp = requests.get(f"{BASE}/checkouts?page={page}", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def simulate_webhook(checkout_id: str, event: str = "PAID") -> dict:
    """
    Simulate a webhook event for a checkout.

    Events: PAID, FAILED, CANCELED, REFUNDED, DISPUTED, PENDING
    """
    checkout = get_checkout(checkout_id)
    payload = {
        "id": checkout["id"],
        "status": event,
        "amount": checkout["amount"],
        "currency": checkout.get("currency", "DZD"),
        "metadata": checkout.get("metadata", {}),
        "checkout_id": checkout_id,
    }
    print(f"\nSimulated {event} webhook payload:\n{json.dumps(payload, indent=2)}")
    return payload


if __name__ == "__main__":
    print("=== Chargily Sandbox Test ===\n")

    # 1. Create checkout
    print("1. Creating checkout...")
    checkout = create_checkout(5000)
    checkout_id = checkout["id"]
    print(f"   Checkout ID: {checkout_id}")
    print(f"   Checkout URL: {checkout.get('checkout_url', 'N/A')}")

    # 2. Get checkout
    print("\n2. Getting checkout...")
    detail = get_checkout(checkout_id)
    print(f"   Status: {detail.get('status')}")

    # 3. Simulate webhook events
    print("\n3. Simulating webhook events:")
    paid = simulate_webhook(checkout_id, "PAID")
    refunded = simulate_webhook(checkout_id, "REFUNDED")

    # 4. List checkouts
    print("\n4. Listing checkouts...")
    checkouts = list_checkouts()
    print(f"   Total: {checkouts.get('total', len(checkouts.get('data', [])))}")

    # 5. Create and expire
    print("\n5. Creating + expiring checkout...")
    c2 = create_checkout(2500)
    expire_checkout(c2["id"])
    expired = get_checkout(c2["id"])
    print(f"   Expired status: {expired.get('status')}")

    print("\n=== Done ===")
```

## Webhook Testing

Send the simulated webhook payload to your local server:

```bash
curl -X POST http://localhost:8000/webhooks/chargily \
  -H "Content-Type: application/json" \
  -H "X-Signature: $(echo -n '{"status":"REFUNDED","checkout_id":"..."}' | openssl dgst -sha256 -hmac "$CHARGILY_WEBHOOK_SECRET" | awk '{print $2}')" \
  -d '{"status":"REFUNDED","checkout_id":"..."}'
```

## Refund Flow Test

1. Create a checkout (amount ≥ 100 DZD)
2. Simulate `PAID` webhook → transaction becomes COMPLETED
3. Call `POST /payments/{tx_id}/refund?reason=Test` → creates REFUND PENDING
4. Call `POST /payments/admin/refunds/{refund_id}/approve` → dispatches Celery task
5. Wallet should be credited, original tx marked REFUNDED
6. Refund confirmation email sent (if SMTP configured)
