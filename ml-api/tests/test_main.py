"""
GigCover ML API — Unit Test Stubs
Run with: pytest ml-api/tests/ -v
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from main import app
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ("ok", "healthy", "running")


# ---------------------------------------------------------------------------
# Risk / Premium endpoint
# ---------------------------------------------------------------------------

def test_calculate_premium_valid(client):
    payload = {
        "city": "Mumbai",
        "zone": "Andheri West",
        "platform": "Swiggy",
        "plan": "standard",
        "worker_history_months": 6,
    }
    resp = client.post("/api/v1/risk/calculate-premium", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "final_premium" in data
    assert data["final_premium"] > 0
    assert "risk_score" in data
    assert 0 <= data["risk_score"] <= 1


def test_calculate_premium_invalid_city(client):
    payload = {
        "city": "Atlantis",
        "zone": "Unknown",
        "platform": "Swiggy",
        "plan": "standard",
        "worker_history_months": 6,
    }
    resp = client.post("/api/v1/risk/calculate-premium", json=payload)
    assert resp.status_code in (200, 422, 400)


def test_calculate_premium_missing_fields(client):
    resp = client.post("/api/v1/risk/calculate-premium", json={"city": "Mumbai"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Fraud check endpoint
# ---------------------------------------------------------------------------

def test_fraud_check_clean(client):
    payload = {
        "worker_id": "GW-001",
        "city": "Mumbai",
        "zone": "Andheri West",
        "platform": "Swiggy",
        "claim_amount": 400,
        "trigger_type": "heavy_rain",
        "trigger_value": 42.0,
        "worker_history_months": 12,
        "claims_last_30_days": 1,
        "hour_of_day": 14,
        "day_of_week": 2,
        "lat": 19.12,
        "lng": 72.83,
    }
    resp = client.post("/api/v1/fraud/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "fraud_score" in data
    assert 0 <= data["fraud_score"] <= 1
    assert "flagged" in data
    assert isinstance(data["flagged"], bool)


def test_fraud_check_high_risk_pattern(client):
    payload = {
        "worker_id": "GW-999",
        "city": "Delhi",
        "zone": "Dwarka",
        "platform": "Zomato",
        "claim_amount": 3000,
        "trigger_type": "heavy_rain",
        "trigger_value": 31.0,
        "worker_history_months": 1,
        "claims_last_30_days": 8,
        "hour_of_day": 3,
        "day_of_week": 6,
        "lat": 28.59,
        "lng": 77.06,
    }
    resp = client.post("/api/v1/fraud/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "fraud_score" in data


def test_fraud_check_shap_values_present(client):
    payload = {
        "worker_id": "GW-002",
        "city": "Bangalore",
        "zone": "Koramangala",
        "platform": "Amazon",
        "claim_amount": 600,
        "trigger_type": "aqi",
        "trigger_value": 320.0,
        "worker_history_months": 8,
        "claims_last_30_days": 2,
        "hour_of_day": 10,
        "day_of_week": 3,
        "lat": 12.93,
        "lng": 77.62,
    }
    resp = client.post("/api/v1/fraud/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "shap_values" in data
    assert isinstance(data["shap_values"], list)


# ---------------------------------------------------------------------------
# Trigger check endpoint
# ---------------------------------------------------------------------------

def test_trigger_check_no_fire(client):
    payload = {
        "city": "Mumbai",
        "zone": "Andheri West",
        "rainfall_mm": 10.0,
        "temp_c": 30.0,
        "aqi": 150,
        "wind_speed_kmh": 20.0,
    }
    resp = client.post("/api/v1/triggers/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "triggers_fired" in data
    assert len(data["triggers_fired"]) == 0


def test_trigger_check_heavy_rain(client):
    payload = {
        "city": "Mumbai",
        "zone": "Andheri West",
        "rainfall_mm": 45.0,
        "temp_c": 28.0,
        "aqi": 120,
        "wind_speed_kmh": 15.0,
    }
    resp = client.post("/api/v1/triggers/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "triggers_fired" in data
    fired_types = [t.get("type") if isinstance(t, dict) else t for t in data["triggers_fired"]]
    assert "heavy_rain" in fired_types


def test_trigger_check_heatwave(client):
    payload = {
        "city": "Chennai",
        "zone": "T. Nagar",
        "rainfall_mm": 0.0,
        "temp_c": 47.5,
        "aqi": 180,
        "wind_speed_kmh": 10.0,
    }
    resp = client.post("/api/v1/triggers/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    fired_types = [t.get("type") if isinstance(t, dict) else t for t in data.get("triggers_fired", [])]
    assert "heatwave" in fired_types


# ---------------------------------------------------------------------------
# Incident run endpoint
# ---------------------------------------------------------------------------

def test_incident_run_simulate(client):
    payload = {
        "city": "Mumbai",
        "zone": "Andheri West",
        "trigger_type": "heavy_rain",
        "mode": "simulate",
    }
    resp = client.post("/api/v1/incidents/run", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("simulation") is True or data.get("mode") == "simulate"
    assert "workers_affected" in data
    assert "total_estimated_payout" in data


def test_incident_run_fire_returns_metadata(client):
    payload = {
        "city": "Delhi",
        "zone": "Connaught Place",
        "trigger_type": "aqi",
        "mode": "fire",
    }
    resp = client.post("/api/v1/incidents/run", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "mode" in data
    assert "duration_ms" in data


# ---------------------------------------------------------------------------
# Duplicate claim prevention (internal helper)
# ---------------------------------------------------------------------------

def test_check_duplicate_claim_helper():
    """Unit test for _check_duplicate_claim helper."""
    with patch("main.supabase") as mock_sb:
        mock_response = MagicMock()
        mock_response.data = [{"count": 0}]
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value = mock_response

        from main import _check_duplicate_claim
        count = _check_duplicate_claim("GW-001", "heavy_rain", window_minutes=60)
        assert isinstance(count, int)


# ---------------------------------------------------------------------------
# Admin KPI endpoint
# ---------------------------------------------------------------------------

def test_admin_kpis(client):
    resp = client.get("/api/v1/admin/kpis")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
