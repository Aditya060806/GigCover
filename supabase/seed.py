"""
GigCover — Supabase Seeder
Reads synthetic data from ml-api/output/ and seeds Supabase tables.

Prerequisites:
  1. Run rls_demo.sql in Supabase SQL Editor first (enables anon INSERT)
  2. pip install requests

Usage:
  python supabase/seed.py
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests:  pip install requests")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://ypntjrlxzaekiifcjjju.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnRqcmx4emFla2lpZmNqamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAyMDMsImV4cCI6MjA4ODI3NjIwM30.ig6TD-19kyovZx98HzqOw9ycZI1LqzwNNB-k1dyC3CI"
)

DATA_DIR = Path(__file__).resolve().parent.parent / "ml-api" / "output"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",  # upsert
}

BATCH_SIZE = 500  # Supabase REST API limit per request


def load_json(name: str) -> list[dict]:
    path = DATA_DIR / name
    if not path.exists():
        print(f"  ⚠ {name} not found at {path}")
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    print(f"  Loaded {len(data):,} rows from {name}")
    return data


def batch_upsert(table: str, rows: list[dict], batch_size: int = BATCH_SIZE) -> int:
    """Insert rows in batches via Supabase REST API. Returns total inserted."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        resp = requests.post(url, headers=HEADERS, json=batch, timeout=30)
        if resp.status_code in (200, 201):
            total += len(batch)
        elif resp.status_code == 409:
            # Conflict (duplicates) — expected with upsert
            total += len(batch)
        else:
            print(f"    ✗ Batch {i//batch_size + 1}: HTTP {resp.status_code} — {resp.text[:200]}")
            # Continue with next batch
        if (i // batch_size) % 20 == 0 and i > 0:
            print(f"    … {total:,} / {len(rows):,}")
    return total


def seed_weather_events():
    print("\n1/5 — Weather Events")
    raw = load_json("weather_events.json")
    if not raw:
        return
    rows = [
        {
            "id": r["id"],
            "city": r["city"],
            "zone": r["zone"],
            "rainfall_mm": r["rainfall_mm"],
            "temp_c": r["temp_c"],
            "aqi": r["aqi"],
            "wind_speed_kmh": r["wind_speed_kmh"],
            "humidity": r.get("humidity", 60),
            "triggers_fired": r.get("triggers_fired", []),
            "is_extreme": r.get("is_extreme", False),
            "lat": r.get("lat"),
            "lng": r.get("lng"),
            "source": r.get("source", "openweathermap"),
            "recorded_at": r.get("recorded_at"),
        }
        for r in raw
    ]
    n = batch_upsert("weather_events", rows)
    print(f"  ✓ {n:,} weather events seeded")


def seed_workers():
    print("\n2/5 — Gig Workers")
    raw = load_json("workers.json")
    if not raw:
        return
    rows = [
        {
            "id": r["id"],
            "worker_id": r["worker_id"],
            "name": r["name"],
            "phone": r["phone"],
            "email": r.get("email"),
            "platform": r["platform"],
            "city": r["city"],
            "zone": r["zone"],
            "plan": r.get("plan", "standard"),
            "weekly_premium": r.get("weekly_premium", 25),
            "max_payout": r.get("max_payout", 1500),
            "status": r.get("status", "active"),
            "lat": r.get("lat"),
            "lng": r.get("lng"),
            "avg_daily_earnings": r.get("avg_daily_earnings", 800),
            "total_earnings": r.get("total_earnings", 0),
            "total_claims": r.get("total_claims", 0),
            "total_payouts": r.get("total_payouts", 0),
            "fraud_flags": r.get("fraud_flags", 0),
            "risk_score": r.get("risk_score", 0.3),
            "created_at": r.get("created_at"),
        }
        for r in raw
    ]
    n = batch_upsert("gig_workers", rows)
    print(f"  ✓ {n:,} workers seeded")


def seed_claims():
    print("\n3/5 — Claims")
    raw = load_json("claims.json")
    if not raw:
        return
    # Claims reference workers by UUID (worker_id in JSON is the worker's UUID `id`)
    rows = [
        {
            "id": r["id"],
            "claim_id": r["claim_id"],
            "worker_id": r["worker_id"],  # UUID reference to gig_workers.id
            "trigger_type": r["trigger_type"],
            "weather_event_id": r.get("weather_event_id"),
            "city": r.get("city", ""),
            "zone": r.get("zone", ""),
            "amount": r["amount"],
            "status": r["status"],
            "auto_triggered": r.get("auto_triggered", False),
            "fraud_score": r.get("fraud_score", 0),
            "process_time": r.get("process_time"),
            "created_at": r.get("created_at"),
        }
        for r in raw
    ]
    n = batch_upsert("claims", rows)
    print(f"  ✓ {n:,} claims seeded")


def seed_transactions():
    print("\n4/5 — Transactions")
    raw = load_json("transactions.json")
    if not raw:
        return
    rows = [
        {
            "id": r["id"],
            "worker_id": r["worker_id"],  # UUID ref to gig_workers.id
            "type": r["type"],
            "amount": r["amount"],
            "description": r.get("description"),
            "claim_id": r.get("claim_id"),
            "status": r.get("status", "completed"),
            "created_at": r.get("created_at"),
        }
        for r in raw
    ]
    n = batch_upsert("transactions", rows)
    print(f"  ✓ {n:,} transactions seeded")


def seed_fraud_logs():
    """Generate fraud_logs from claims with fraud_score > 0.5"""
    print("\n5/5 — Fraud Logs (generated from flagged claims)")
    raw = load_json("claims.json")
    if not raw:
        return

    import uuid
    flagged = [r for r in raw if r.get("fraud_score", 0) > 0.5]
    rows = [
        {
            "id": str(uuid.uuid4()),
            "worker_id": r["worker_id"],
            "claim_id": r["id"],
            "fraud_score": r["fraud_score"],
            "risk_level": (
                "critical" if r["fraud_score"] > 0.9
                else "high" if r["fraud_score"] > 0.7
                else "medium"
            ),
            "reason": f"Auto-flagged: {r['trigger_type']} claim of ₹{r['amount']} "
                      f"(score {r['fraud_score']:.2f})",
            "shap_values": json.dumps({
                "gps_deviation_km": r.get("gps_deviation_km", 0),
                "timing_anomaly": 1 if r.get("timing_anomaly") else 0,
                "amount_anomaly": 1 if r.get("amount_anomaly") else 0,
                "platform_active": 1 if r.get("platform_active_during_event") else 0,
                "weather_match": 1 if r.get("weather_data_matches") else 0,
                "days_since_last": r.get("days_since_last_claim", 30),
            }),
            "model_version": "3.0",
            "status": "investigating" if r["fraud_score"] > 0.7 else "cleared",
            "detected_at": r.get("created_at"),
        }
        for r in flagged
    ]
    n = batch_upsert("fraud_logs", rows)
    print(f"  ✓ {n:,} fraud logs seeded (from {len(flagged):,} flagged claims)")


def main():
    print("=" * 60)
    print("GigCover — Supabase Seeder")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"Data dir: {DATA_DIR}")
    print("=" * 60)

    if not DATA_DIR.exists():
        print(f"\n✗ Data directory not found: {DATA_DIR}")
        print("  Run: python ml-api/generate_synthetic.py")
        sys.exit(1)

    start = time.time()

    seed_weather_events()
    seed_workers()
    seed_claims()
    seed_transactions()
    seed_fraud_logs()

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"✓ Seeding complete in {elapsed:.1f}s")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
