# GigCover ML API - FastAPI Backend v3.0
# AI-Powered Parametric Insurance for Gig Workers
# Loads trained XGBoost + IsolationForest models from disk

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import numpy as np
import json
import os
import pickle
import threading
import time
import httpx
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="GigCover ML API",
    description="AI-powered risk assessment, fraud detection, and parametric trigger engine for gig worker insurance",
    version="3.0.0",
)


def _parse_cors_origins() -> List[str]:
    raw = os.getenv("FRONTEND_ORIGINS", "")
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    if origins:
        return origins
    return ["http://localhost:3000"]


_cors_origins = _parse_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Ingestion Configuration ──────────────────────────────────

WEATHER_SYNC_ENABLED = os.getenv("WEATHER_SYNC_ENABLED", "false").lower() == "true"
WEATHER_SYNC_INTERVAL_SEC = int(os.getenv("WEATHER_SYNC_INTERVAL_SEC", "300"))
WEATHER_HTTP_TIMEOUT_SECONDS = float(os.getenv("WEATHER_HTTP_TIMEOUT_SECONDS", "10"))
WEATHER_SOURCE_NAME = os.getenv("WEATHER_SOURCE_NAME", "openweathermap")

_sync_thread: Optional[threading.Thread] = None
_sync_stop_event = threading.Event()


def _env(name: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    value = os.getenv(name, default)
    if required and not value:
        raise HTTPException(status_code=500, detail=f"Missing required env: {name}")
    return value


def _openweather_aqi_to_index(value: int) -> int:
    # OpenWeather air pollution API reports AQI on 1-5 scale.
    mapping = {1: 50, 2: 100, 3: 180, 4: 250, 5: 350}
    return mapping.get(value, 100)


def _compute_live_risk_level(rainfall_mm: float, temp_c: float, aqi: int, wind_speed_kmh: float) -> str:
    if rainfall_mm >= 100 or temp_c >= 45 or aqi >= 300 or wind_speed_kmh >= 60:
        return "critical"
    if rainfall_mm >= 30 or temp_c >= 40 or aqi >= 200 or wind_speed_kmh >= 40:
        return "high"
    if rainfall_mm >= 10 or temp_c >= 36 or aqi >= 120 or wind_speed_kmh >= 25:
        return "medium"
    return "low"


def _sb_headers(upsert: bool = False) -> Dict[str, str]:
    key = _env("SUPABASE_SERVICE_ROLE_KEY", required=True)
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if upsert:
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"
    else:
        # Ask PostgREST to return inserted rows instead of an empty body.
        headers["Prefer"] = "return=representation"
    return headers


def _sb_url(table: str) -> str:
    base = _env("SUPABASE_URL", required=True)
    return f"{base}/rest/v1/{table}"


def _sb_get(table: str, params: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    try:
        with httpx.Client(timeout=WEATHER_HTTP_TIMEOUT_SECONDS) as client:
            res = client.get(_sb_url(table), headers=_sb_headers(), params=params or {})
            res.raise_for_status()
            data = res.json()
            return data if isinstance(data, list) else []
    except Exception as exc:
        print(f"⚠️ Supabase GET {table} failed: {exc}")
        return []


def _sb_insert(
    table: str,
    rows: List[Dict[str, Any]],
    upsert: bool = False,
    on_conflict: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if not rows:
        return []
    try:
        with httpx.Client(timeout=WEATHER_HTTP_TIMEOUT_SECONDS) as client:
            params: Dict[str, str] = {}
            if on_conflict:
                params["on_conflict"] = on_conflict
            res = client.post(_sb_url(table), headers=_sb_headers(upsert=upsert), params=params, json=rows)
            res.raise_for_status()
            if not res.content:
                return []
            try:
                data = res.json()
            except ValueError:
                return []
            return data if isinstance(data, list) else []
    except Exception as exc:
        print(f"⚠️ Supabase INSERT {table} failed: {exc}")
        return []


def _sb_patch(table: str, filters: Dict[str, str], payload: Dict[str, Any]) -> bool:
    try:
        with httpx.Client(timeout=WEATHER_HTTP_TIMEOUT_SECONDS) as client:
            res = client.patch(_sb_url(table), headers=_sb_headers(), params=filters, json=payload)
            res.raise_for_status()
            return True
    except Exception as exc:
        print(f"⚠️ Supabase PATCH {table} failed: {exc}")
        return False


def _fetch_openweather_current(lat: float, lng: float) -> Dict[str, Any]:
    api_key = _env("OPENWEATHER_API_KEY", required=True)
    base = _env("OPENWEATHER_BASE_URL", "https://api.openweathermap.org/data/2.5")
    units = _env("OPENWEATHER_UNITS", "metric")

    with httpx.Client(timeout=WEATHER_HTTP_TIMEOUT_SECONDS) as client:
        weather_res = client.get(
            f"{base}/weather",
            params={"lat": lat, "lon": lng, "appid": api_key, "units": units},
        )
        weather_res.raise_for_status()
        weather_json = weather_res.json()

        aqi_res = client.get(
            f"{base}/air_pollution",
            params={"lat": lat, "lon": lng, "appid": api_key},
        )
        aqi = 100
        if aqi_res.status_code == 200:
            air = aqi_res.json()
            aqi_bucket = (air.get("list") or [{}])[0].get("main", {}).get("aqi", 2)
            aqi = _openweather_aqi_to_index(int(aqi_bucket))

    rainfall = float((weather_json.get("rain") or {}).get("1h", 0) or 0)
    temp_c = float((weather_json.get("main") or {}).get("temp", 35) or 35)
    wind_kmh = float((weather_json.get("wind") or {}).get("speed", 0) or 0) * 3.6
    humidity = float((weather_json.get("main") or {}).get("humidity", 60) or 60)

    return {
        "rainfall_mm": rainfall,
        "temp_c": temp_c,
        "aqi": int(aqi),
        "wind_speed_kmh": wind_kmh,
        "humidity": humidity,
        "lat": lat,
        "lng": lng,
    }


def _evaluate_triggers(rainfall_mm: float, temp_c: float, aqi: int, wind_speed_kmh: float) -> tuple[list, float, str]:
    triggers_fired = []
    total_payout_pct = 0

    if rainfall_mm >= TRIGGER_THRESHOLDS["heavy_rain"]["threshold"]:
        triggers_fired.append({
            "type": "heavy_rain",
            "value": rainfall_mm,
            "threshold": TRIGGER_THRESHOLDS["heavy_rain"]["threshold"],
            "payout_pct": TRIGGER_THRESHOLDS["heavy_rain"]["payout_pct"],
        })
        total_payout_pct += TRIGGER_THRESHOLDS["heavy_rain"]["payout_pct"]

    if rainfall_mm >= TRIGGER_THRESHOLDS["flood"]["threshold"]:
        triggers_fired.append({
            "type": "flood",
            "value": rainfall_mm,
            "threshold": TRIGGER_THRESHOLDS["flood"]["threshold"],
            "payout_pct": TRIGGER_THRESHOLDS["flood"]["payout_pct"],
        })
        total_payout_pct += TRIGGER_THRESHOLDS["flood"]["payout_pct"]

    if temp_c >= TRIGGER_THRESHOLDS["heatwave"]["threshold"]:
        triggers_fired.append({
            "type": "heatwave",
            "value": temp_c,
            "threshold": TRIGGER_THRESHOLDS["heatwave"]["threshold"],
            "payout_pct": TRIGGER_THRESHOLDS["heatwave"]["payout_pct"],
        })
        total_payout_pct += TRIGGER_THRESHOLDS["heatwave"]["payout_pct"]

    if aqi >= TRIGGER_THRESHOLDS["aqi"]["threshold"]:
        triggers_fired.append({
            "type": "aqi",
            "value": aqi,
            "threshold": TRIGGER_THRESHOLDS["aqi"]["threshold"],
            "payout_pct": TRIGGER_THRESHOLDS["aqi"]["payout_pct"],
        })
        total_payout_pct += TRIGGER_THRESHOLDS["aqi"]["payout_pct"]

    if wind_speed_kmh >= TRIGGER_THRESHOLDS["storm"]["threshold"]:
        triggers_fired.append({
            "type": "storm",
            "value": wind_speed_kmh,
            "threshold": TRIGGER_THRESHOLDS["storm"]["threshold"],
            "payout_pct": TRIGGER_THRESHOLDS["storm"]["payout_pct"],
        })
        total_payout_pct += TRIGGER_THRESHOLDS["storm"]["payout_pct"]

    total_payout_pct = min(total_payout_pct, 100)
    risk_level = "Critical" if len(triggers_fired) > 2 else "High" if len(triggers_fired) > 0 else "Normal"
    return triggers_fired, total_payout_pct, risk_level


def _persist_zone_weather(city: str, zone: str, weather: Dict[str, Any]) -> Dict[str, Any]:
    triggers_fired, _, _ = _evaluate_triggers(
        weather["rainfall_mm"],
        weather["temp_c"],
        weather["aqi"],
        weather["wind_speed_kmh"],
    )

    weather_row = {
        "city": city,
        "zone": zone,
        "rainfall_mm": weather["rainfall_mm"],
        "temp_c": weather["temp_c"],
        "aqi": weather["aqi"],
        "wind_speed_kmh": weather["wind_speed_kmh"],
        "humidity": weather["humidity"],
        "triggers_fired": [t["type"] for t in triggers_fired],
        "is_extreme": len(triggers_fired) > 0,
        "lat": weather.get("lat"),
        "lng": weather.get("lng"),
        "source": WEATHER_SOURCE_NAME,
        "recorded_at": datetime.utcnow().isoformat(),
    }
    weather_inserted = _sb_insert("weather_events", [weather_row])
    weather_event_id = weather_inserted[0].get("id") if weather_inserted else None

    _sb_patch(
        "zones",
        filters={"city": f"eq.{city}", "zone_name": f"eq.{zone}"},
        payload={
            "current_rainfall": weather["rainfall_mm"],
            "current_aqi": weather["aqi"],
            "current_temp": weather["temp_c"],
            "current_wind": weather["wind_speed_kmh"],
            "risk_level": _compute_live_risk_level(
                weather["rainfall_mm"], weather["temp_c"], weather["aqi"], weather["wind_speed_kmh"]
            ),
            "last_updated": datetime.utcnow().isoformat(),
        },
    )

    if triggers_fired and _env("WEATHER_ENABLE_TRIGGER_EVENT_WRITES", "true").lower() == "true":
        trigger_rows = []
        for trig in triggers_fired:
            trigger_rows.append({
                "trigger_type": trig["type"],
                "city": city,
                "zone": zone,
                "measured_value": float(trig["value"]),
                "threshold_value": float(trig["threshold"]),
                "workers_affected": 0,
                "total_payout": 0,
                "status": "completed",
                "is_manual": False,
                "weather_event_id": weather_event_id,
            })
        _sb_insert("trigger_events", trigger_rows)

    return {
        "weather_event_id": weather_event_id,
        "triggers": [t["type"] for t in triggers_fired],
        "is_extreme": len(triggers_fired) > 0,
    }


def _sync_once(city: Optional[str] = None, zone: Optional[str] = None) -> Dict[str, Any]:
    if not _env("SUPABASE_URL") or not _env("SUPABASE_SERVICE_ROLE_KEY"):
        raise HTTPException(status_code=500, detail="Supabase env missing for ingestion")
    if not _env("OPENWEATHER_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENWEATHER_API_KEY missing for ingestion")

    params = {"select": "city,zone_name,lat,lng"}
    if city:
        params["city"] = f"eq.{city}"
    if zone:
        params["zone_name"] = f"eq.{zone}"

    rows = _sb_get("zones", params=params)
    success = 0
    failures: List[Dict[str, str]] = []

    for row in rows:
        try:
            weather = _fetch_openweather_current(float(row["lat"]), float(row["lng"]))
            _persist_zone_weather(str(row["city"]), str(row["zone_name"]), weather)
            success += 1
        except Exception as exc:
            failures.append({"city": str(row.get("city")), "zone": str(row.get("zone_name")), "error": str(exc)})

    return {
        "requested": len(rows),
        "success": success,
        "failed": len(failures),
        "errors": failures[:10],
        "timestamp": datetime.utcnow().isoformat(),
    }


def _sync_loop() -> None:
    while not _sync_stop_event.is_set():
        try:
            result = _sync_once()
            print(f"🌦️ Ingestion sync: {result['success']}/{result['requested']} zones updated")
        except Exception as exc:
            print(f"⚠️ Ingestion sync failed: {exc}")
        _sync_stop_event.wait(max(30, WEATHER_SYNC_INTERVAL_SEC))

# ── Model Loading ──────────────────────────────────────────

MODEL_DIR = Path(__file__).parent / "models"

# Trained models (loaded at startup if available)
_risk_model = None
_risk_explainer = None
_risk_features = None
_fraud_classifier = None
_fraud_isoforest = None
_fraud_explainer = None
_fraud_features = None
_fraud_scaler = None

def _load_models():
    """Load trained ML models from disk. Falls back to simulation if not found."""
    global _risk_model, _risk_explainer, _risk_features
    global _fraud_classifier, _fraud_isoforest, _fraud_explainer, _fraud_features, _fraud_scaler

    loaded = []

    # Risk model
    try:
        with open(MODEL_DIR / "risk_model.pkl", "rb") as f:
            _risk_model = pickle.load(f)
        with open(MODEL_DIR / "risk_model_info.json") as f:
            info = json.load(f)
            _risk_features = info["features"]
        loaded.append("risk_model")
    except Exception:
        pass

    try:
        with open(MODEL_DIR / "risk_explainer.pkl", "rb") as f:
            _risk_explainer = pickle.load(f)
        loaded.append("risk_explainer")
    except Exception:
        pass

    # Fraud classifier
    try:
        with open(MODEL_DIR / "fraud_classifier.pkl", "rb") as f:
            _fraud_classifier = pickle.load(f)
        with open(MODEL_DIR / "fraud_model_info.json") as f:
            info = json.load(f)
            _fraud_features = info["features"]
        loaded.append("fraud_classifier")
    except Exception:
        # Try legacy fraud_model.pkl
        try:
            with open(MODEL_DIR / "fraud_model.pkl", "rb") as f:
                _fraud_classifier = pickle.load(f)
            loaded.append("fraud_model_legacy")
        except Exception:
            pass

    # Isolation forest
    try:
        with open(MODEL_DIR / "fraud_isoforest.pkl", "rb") as f:
            _fraud_isoforest = pickle.load(f)
        loaded.append("fraud_isoforest")
    except Exception:
        pass

    try:
        with open(MODEL_DIR / "fraud_explainer.pkl", "rb") as f:
            _fraud_explainer = pickle.load(f)
        loaded.append("fraud_explainer")
    except Exception:
        pass

    try:
        with open(MODEL_DIR / "fraud_scaler.pkl", "rb") as f:
            _fraud_scaler = pickle.load(f)
        loaded.append("fraud_scaler")
    except Exception:
        pass

    if loaded:
        print(f"✅ Loaded trained models: {loaded}")
    else:
        print("⚠️  No trained models found — using simulation fallbacks")
        print("   Run: python generate_synthetic.py && python train_models.py")

_load_models()

# ── Constants ──────────────────────────────────────────────

TRIGGER_THRESHOLDS = {
    "heavy_rain": {"field": "rainfall_mm", "threshold": 30, "unit": "mm/hr", "payout_pct": 50},
    "flood": {"field": "rainfall_mm_24h", "threshold": 100, "unit": "mm/24hr", "payout_pct": 100},
    "heatwave": {"field": "temp_c", "threshold": 45, "unit": "°C", "payout_pct": 25},
    "aqi": {"field": "aqi", "threshold": 300, "unit": "AQI", "payout_pct": 30},
    "storm": {"field": "wind_speed_kmh", "threshold": 60, "unit": "km/h", "payout_pct": 40},
    "curfew": {"field": "manual_trigger", "threshold": 1, "unit": "alert", "payout_pct": 100},
}

CITY_RISK_PROFILES = {
    "Mumbai": {"base_risk": 0.65, "monsoon_mult": 1.8, "flood_prone": True},
    "Delhi": {"base_risk": 0.55, "aqi_mult": 2.2, "pollution_prone": True},
    "Bangalore": {"base_risk": 0.35, "monsoon_mult": 1.3, "flood_prone": False},
    "Chennai": {"base_risk": 0.50, "heat_mult": 1.6, "cyclone_prone": True},
    "Hyderabad": {"base_risk": 0.40, "heat_mult": 1.4, "flood_prone": False},
}

AVG_DAILY_EARNINGS = {
    "Swiggy": 800, "Zomato": 750, "Amazon": 900,
    "Zepto": 700, "Blinkit": 650, "Dunzo": 600,
}

PLAN_TIERS = {
    "basic": {"weekly": 15, "max_payout": 500},
    "standard": {"weekly": 25, "max_payout": 1500},
    "pro": {"weekly": 40, "max_payout": 3000},
}


# ── Request / Response Models ──────────────────────────────

class PremiumRequest(BaseModel):
    city: str
    zone: str
    platform: str
    plan: str = "standard"
    worker_history_months: int = 0

class PremiumResponse(BaseModel):
    base_premium: float
    risk_multiplier: float
    final_premium: float
    risk_level: str
    risk_score: float
    factors: list

class FraudCheckRequest(BaseModel):
    worker_id: str
    claim_amount: float
    city: str
    zone: str
    trigger_type: str
    claim_history_count: int = 0
    avg_claim_amount: float = 0
    days_since_last_claim: int = 30
    gps_deviation_km: float = 0
    platform_active_during_event: bool = True
    weather_data_matches: bool = True

class FraudCheckResponse(BaseModel):
    fraud_score: float
    is_flagged: bool
    risk_level: str
    recommendation: str
    shap_values: list

class ZoneRiskRequest(BaseModel):
    city: str

class TriggerCheckRequest(BaseModel):
    city: str
    zone: str
    rainfall_mm: float = 0
    temp_c: float = 35
    aqi: int = 100
    wind_speed_kmh: float = 10

class TriggerCheckResponse(BaseModel):
    triggers_fired: list
    total_payout_pct: float
    risk_level: str

class WeatherData(BaseModel):
    city: str
    zone: str
    rainfall_mm: float = 0
    temp_c: float = 35
    aqi: int = 100
    wind_speed_kmh: float = 10
    humidity: float = 60


class IngestionSyncRequest(BaseModel):
    city: Optional[str] = None
    zone: Optional[str] = None


class AddPlaceRequest(BaseModel):
    city: str
    zone_name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    flood_prone: bool = False
    density: str = "medium"


class IncidentRunRequest(BaseModel):
    city: str
    zone: str
    trigger_type: str
    mode: str = "simulate"


class FraudDecisionRequest(BaseModel):
    fraud_log_id: str
    action: str
    reviewer: str = "admin-panel"
    note: Optional[str] = None


class FraudAppealRequest(BaseModel):
    claim_id: str
    reason: str = Field(min_length=12, max_length=1000)
    worker_id: Optional[str] = None


class FraudAppealDecisionRequest(BaseModel):
    appeal_id: str
    action: str
    reviewer: str = "admin-panel"
    note: Optional[str] = None


# ── Helper Functions (Model-backed with simulation fallback) ─

def _build_risk_features(city: str, zone: str, platform: str, history_months: int) -> dict:
    """Build the 25-feature dict expected by the trained risk model."""
    city_profile = CITY_RISK_PROFILES.get(city, {"base_risk": 0.4})
    climate_lookup = {
        "Mumbai": {"base_aqi": 90, "monsoon_rain": 35, "has_cyclones": 1},
        "Delhi": {"base_aqi": 180, "monsoon_rain": 18, "has_cyclones": 0},
        "Bangalore": {"base_aqi": 70, "monsoon_rain": 12, "has_cyclones": 0},
        "Chennai": {"base_aqi": 80, "monsoon_rain": 28, "has_cyclones": 1},
        "Hyderabad": {"base_aqi": 95, "monsoon_rain": 14, "has_cyclones": 0},
    }
    cl = climate_lookup.get(city, {"base_aqi": 100, "monsoon_rain": 15, "has_cyclones": 0})

    city_map = {"Mumbai": 0, "Delhi": 1, "Bangalore": 2, "Chennai": 3, "Hyderabad": 4}
    platform_map = {"Swiggy": 0, "Zomato": 1, "Amazon": 2, "Zepto": 3, "Blinkit": 4, "Dunzo": 5}
    plan_map = {"basic": 0, "standard": 1, "pro": 2}

    flood_prone_zones = {
        "Andheri West", "Dadar", "Powai", "Dwarka", "Koramangala", "Whitefield",
        "HSR Layout", "T. Nagar", "Adyar", "Mylapore", "Velachery", "Madhapur", "Kukatpally",
    }
    high_density_zones = {
        "Andheri West", "Bandra", "Connaught Place", "Saket", "Karol Bagh", "Koramangala",
        "Indiranagar", "HSR Layout", "T. Nagar", "Mylapore", "Banjara Hills", "Madhapur",
    }

    base_risk = city_profile["base_risk"]
    is_flood = 1 if zone in flood_prone_zones else 0
    is_high_density = 1 if zone in high_density_zones else 0
    tenure_days = max(1, history_months * 30)

    return {
        "zone_extreme_rate": round(base_risk * 0.5 + is_flood * 0.15, 4),
        "zone_avg_rainfall": cl["monsoon_rain"] * 0.6,
        "zone_rainfall_std": cl["monsoon_rain"] * 0.4,
        "zone_max_rainfall": cl["monsoon_rain"] * 4,
        "zone_avg_aqi": cl["base_aqi"] * 1.1,
        "zone_avg_temp": 32.0,
        "zone_max_wind": 35.0 + cl["has_cyclones"] * 25,
        "zone_monsoon_extreme_pct": round(base_risk * 0.4, 4),
        "city_encoded": city_map.get(city, 0),
        "city_base_aqi": cl["base_aqi"],
        "city_monsoon_rain": cl["monsoon_rain"],
        "city_has_cyclones": cl["has_cyclones"],
        "platform_encoded": platform_map.get(platform, 0),
        "plan_encoded": 1,
        "avg_daily_earnings": AVG_DAILY_EARNINGS.get(platform, 750),
        "tenure_days": tenure_days,
        "claims_count": max(0, int(tenure_days / 30 * 0.8)),
        "claims_per_month": 0.8,
        "fraud_flags": 0,
        "worker_status_encoded": 0,
        "payout_to_premium_ratio": 0.5,
        "is_high_density_zone": is_high_density,
        "is_flood_prone": is_flood,
        "earnings_vs_platform_avg": 1.0,
        "weekly_premium": 25,
    }


def _xgboost_risk_score(city: str, zone: str, platform: str, history_months: int) -> tuple[float, list]:
    """XGBoost risk scoring — uses trained model if available, else simulation."""

    if _risk_model is not None and _risk_features is not None:
        # ── TRAINED MODEL PATH ──
        feat_dict = _build_risk_features(city, zone, platform, history_months)
        X = np.array([[feat_dict[f] for f in _risk_features]], dtype=np.float32)
        risk_score = float(np.clip(_risk_model.predict(X)[0], 0.05, 0.98))

        # SHAP-based factors
        factors = []
        if _risk_explainer is not None:
            try:
                shap_vals = _risk_explainer.shap_values(X)[0]
                pairs = sorted(zip(_risk_features, shap_vals), key=lambda x: -abs(x[1]))[:6]
                for fname, sv in pairs:
                    factors.append({
                        "name": fname.replace("_", " ").title(),
                        "importance": round(abs(float(sv)), 4),
                        "impact": "increases" if sv > 0 else "decreases",
                    })
            except Exception:
                pass

        if not factors:
            factors = _fallback_factors(city, zone, platform, history_months, risk_score)

        return risk_score, factors

    # ── SIMULATION FALLBACK ──
    np.random.seed(hash(f"{city}{zone}{platform}") % 2**31)
    city_profile = CITY_RISK_PROFILES.get(city, {"base_risk": 0.4})
    base = city_profile["base_risk"]
    zone_hash = hash(zone) % 100 / 100
    platform_factor = 0.05 if platform in ["Amazon", "Zepto"] else -0.03
    history_factor = max(-0.15, -history_months * 0.01)
    seasonal_factor = 0.1
    noise = np.random.normal(0, 0.05)
    risk_score = float(np.clip(base + zone_hash * 0.2 + platform_factor + history_factor + seasonal_factor + noise, 0.05, 0.98))
    factors = _fallback_factors(city, zone, platform, history_months, risk_score)
    return risk_score, factors


def _fallback_factors(city, zone, platform, history_months, risk_score):
    """Generate human-readable factor list for API response."""
    city_profile = CITY_RISK_PROFILES.get(city, {"base_risk": 0.4})
    return [
        {"name": "Zone Weather History", "importance": 0.28, "impact": "increases" if risk_score > 0.5 else "neutral"},
        {"name": "Monsoon/Seasonal Risk", "importance": 0.22, "impact": "increases"},
        {"name": "City Base Risk", "importance": 0.18, "impact": "increases" if city_profile["base_risk"] > 0.4 else "neutral"},
        {"name": "Platform Density", "importance": 0.15, "impact": "increases" if platform in ["Swiggy", "Zomato"] else "neutral"},
        {"name": "Worker History", "importance": 0.10, "impact": "decreases" if history_months > 3 else "neutral"},
        {"name": "AQI Baseline", "importance": 0.07, "impact": "increases" if city == "Delhi" else "neutral"},
    ]


def _build_fraud_features(req) -> dict:
    """Build the 15-feature dict expected by the trained fraud model."""
    trigger_map = {"heavy_rain": 0, "flood": 1, "heatwave": 2, "aqi": 3, "storm": 4}
    claim_hour = datetime.utcnow().hour

    # Estimate weather values from trigger type if not explicitly provided
    rain_est = 50 if req.trigger_type in ["heavy_rain", "flood"] else 5
    if req.trigger_type == "flood":
        rain_est = 120
    temp_est = 46 if req.trigger_type == "heatwave" else 33
    aqi_est = 350 if req.trigger_type == "aqi" else 100
    wind_est = 70 if req.trigger_type == "storm" else 15

    return {
        "claim_amount": req.claim_amount,
        "auto_triggered": 1,
        "trigger_encoded": trigger_map.get(req.trigger_type, 0),
        "claim_hour": claim_hour,
        "days_since_last_claim": req.days_since_last_claim,
        "rainfall_mm": rain_est,
        "temp_c": temp_est,
        "aqi": aqi_est,
        "wind_speed_kmh": wind_est,
        "gps_deviation_km": req.gps_deviation_km,
        "timing_anomaly": 1 if claim_hour < 6 or claim_hour > 22 else 0,
        "amount_anomaly": 1 if req.claim_amount > 2500 else 0,
        "platform_active": 1 if req.platform_active_during_event else 0,
        "weather_matches": 1 if req.weather_data_matches else 0,
        "is_night_claim": 1 if claim_hour < 6 or claim_hour > 22 else 0,
    }


def _isolation_forest_fraud_score(req) -> tuple[float, list]:
    """Fraud detection — ensemble of XGBClassifier + IsolationForest if available."""

    if _fraud_classifier is not None and _fraud_features is not None:
        # ── TRAINED MODEL PATH ──
        feat_dict = _build_fraud_features(req)
        X = np.array([[feat_dict[f] for f in _fraud_features]], dtype=np.float32)

        # XGBClassifier score
        try:
            xgb_proba = float(_fraud_classifier.predict_proba(X)[0][1])
        except Exception:
            xgb_proba = 0.0

        # IsolationForest anomaly score
        iso_score = 0.0
        if _fraud_isoforest is not None:
            try:
                raw = float(_fraud_isoforest.score_samples(X)[0])
                # Normalise: typical range is [-0.6, 0.0]; map to [0, 1]
                iso_score = float(np.clip((0.0 - raw) / 0.6, 0, 1))
            except Exception:
                pass

        # Ensemble: 0.7 × classifier + 0.3 × isolation forest
        fraud_score = float(np.clip(0.7 * xgb_proba + 0.3 * iso_score, 0.01, 0.99))

        # SHAP-based explanations
        shap_values = []
        if _fraud_explainer is not None:
            try:
                sv = _fraud_explainer.shap_values(X)[0]
                pairs = sorted(zip(_fraud_features, sv), key=lambda x: -abs(x[1]))[:6]
                for fname, val in pairs:
                    shap_values.append({
                        "feature": fname.replace("_", " ").title(),
                        "value": round(float(val), 4),
                        "direction": "increases" if val > 0 else "decreases",
                    })
            except Exception:
                pass

        if not shap_values:
            shap_values = _fallback_shap(req, fraud_score)

        return fraud_score, shap_values

    # ── SIMULATION FALLBACK ──
    np.random.seed(hash(f"{req.worker_id}{req.claim_amount}") % 2**31)
    score = 0.0

    freq_score = min(req.claim_history_count / 20.0, 1.0)
    freq_contrib = freq_score * 0.25
    score += freq_contrib

    plan = PLAN_TIERS.get("standard", {"max_payout": 1500})
    amount_ratio = req.claim_amount / plan["max_payout"]
    amount_contrib = max(0, (amount_ratio - 0.5) * 0.3)
    score += amount_contrib

    gps_contrib = min(req.gps_deviation_km / 5.0, 1.0) * 0.2
    score += gps_contrib

    weather_contrib = 0.0 if req.weather_data_matches else 0.25
    score += weather_contrib

    platform_contrib = 0.0 if req.platform_active_during_event else 0.15
    score += platform_contrib

    time_contrib = max(0, (15 - req.days_since_last_claim) / 15.0 * 0.15)
    score += time_contrib

    noise = np.random.normal(0, 0.03)
    final_score = float(np.clip(score + noise, 0.01, 0.99))

    shap_values = _fallback_shap(req, final_score)
    return final_score, shap_values


def _fallback_shap(req, score):
    """Generate SHAP-like explanations for simulation mode."""
    return [
        {"feature": "Claim Frequency", "value": round(min(req.claim_history_count / 20.0, 1.0) * 0.25, 3), "direction": "increases" if req.claim_history_count > 4 else "neutral"},
        {"feature": "Amount Deviation", "value": round(max(0, (req.claim_amount / 1500 - 0.5) * 0.3), 3), "direction": "increases" if req.claim_amount > 750 else "neutral"},
        {"feature": "GPS Deviation", "value": round(min(req.gps_deviation_km / 5.0, 1.0) * 0.2, 3), "direction": "increases" if req.gps_deviation_km > 1 else "decreases"},
        {"feature": "Weather Match", "value": round(-0.1 if req.weather_data_matches else 0.25, 3), "direction": "decreases" if req.weather_data_matches else "increases"},
        {"feature": "Platform Activity", "value": round(-0.08 if req.platform_active_during_event else 0.15, 3), "direction": "decreases" if req.platform_active_during_event else "increases"},
        {"feature": "Time Since Last Claim", "value": round(max(0, (15 - req.days_since_last_claim) / 15.0 * 0.15), 3), "direction": "increases" if req.days_since_last_claim < 15 else "neutral"},
    ]


def _simulate_trigger_payload(city: str, zone: str, trigger_type: str) -> Dict[str, Any]:
    threshold = TRIGGER_THRESHOLDS.get(trigger_type)
    if not threshold:
        raise HTTPException(status_code=400, detail=f"Unknown trigger type: {trigger_type}")

    np.random.seed(hash(f"{city}{zone}{datetime.utcnow().isoformat()}") % 2**31)
    workers_affected = int(np.random.uniform(80, 400))
    avg_payout = threshold["payout_pct"] / 100 * AVG_DAILY_EARNINGS.get("Swiggy", 800)
    total_payout = round(workers_affected * avg_payout)

    threshold_value = float(threshold["threshold"])
    if threshold_value <= 1:
        measured_value = 1.0
    else:
        measured_value = round(threshold_value * float(np.random.uniform(1.05, 1.45)), 1)

    return {
        "simulation": True,
        "trigger_type": trigger_type,
        "city": city,
        "zone": zone,
        "workers_affected": workers_affected,
        "avg_payout_per_worker": round(avg_payout),
        "total_estimated_payout": total_payout,
        "threshold_value": threshold_value,
        "measured_value": measured_value,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── API Endpoints ──────────────────────────────────────────

@app.get("/")
def root():
    models_status = "trained" if _risk_model is not None else "simulated"
    return {
        "service": "GigCover ML API",
        "version": "3.0.0",
        "status": "operational",
        "models": {
            "risk_pricing": f"XGBoost Regressor v3.0 ({models_status})",
            "fraud_detection": f"XGBClassifier + IsolationForest v3.0 ({models_status})",
            "explainability": "SHAP TreeExplainer",
        },
        "endpoints": [
            "/api/v1/risk/calculate-premium",
            "/api/v1/risk/zone-heatmap",
            "/api/v1/admin/kpis",
            "/api/v1/admin/snapshot",
            "/api/v1/fraud/check",
            "/api/v1/fraud/decision",
            "/api/v1/fraud/appeals/open",
            "/api/v1/fraud/appeals/submit",
            "/api/v1/fraud/appeals/decision",
            "/api/v1/triggers/check",
            "/api/v1/triggers/simulate",
            "/api/v1/incidents/run",
            "/api/v1/incidents/recent",
            "/api/v1/weather/current",
            "/health",
        ],
    }


@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "uptime": "operational"}


@app.on_event("startup")
def startup_ingestion_loop():
    global _sync_thread
    if not WEATHER_SYNC_ENABLED:
        print("ℹ️ Weather ingestion loop disabled (WEATHER_SYNC_ENABLED=false)")
        return
    if _sync_thread and _sync_thread.is_alive():
        return
    _sync_stop_event.clear()
    _sync_thread = threading.Thread(target=_sync_loop, daemon=True)
    _sync_thread.start()
    print(f"✅ Weather ingestion loop started (interval={WEATHER_SYNC_INTERVAL_SEC}s)")


@app.on_event("shutdown")
def shutdown_ingestion_loop():
    _sync_stop_event.set()


@app.post("/api/v1/ingestion/sync-now")
def sync_now(req: IngestionSyncRequest):
    """Manual weather sync for all zones, one city, or one zone."""
    return _sync_once(city=req.city, zone=req.zone)


@app.post("/api/v1/ingestion/add-place")
def add_place(req: AddPlaceRequest):
    """Add or update a place in zones and immediately ingest live weather for it."""
    density = req.density.lower().strip()
    if density not in {"low", "medium", "high"}:
        raise HTTPException(status_code=400, detail="density must be one of: low, medium, high")

    upserted = _sb_insert(
        "zones",
        [
            {
                "city": req.city,
                "zone_name": req.zone_name,
                "lat": req.lat,
                "lng": req.lng,
                "flood_prone": req.flood_prone,
                "density": density,
                "risk_level": "medium",
                "last_updated": datetime.utcnow().isoformat(),
            }
        ],
        upsert=True,
        on_conflict="city,zone_name",
    )

    if not upserted:
        raise HTTPException(status_code=500, detail="Failed to upsert place into zones")

    weather = _fetch_openweather_current(req.lat, req.lng)
    persist_meta = _persist_zone_weather(req.city, req.zone_name, weather)

    return {
        "place_added": True,
        "city": req.city,
        "zone": req.zone_name,
        "coordinates": {"lat": req.lat, "lng": req.lng},
        "weather": {
            "rainfall_mm": weather["rainfall_mm"],
            "temp_c": weather["temp_c"],
            "aqi": weather["aqi"],
            "wind_speed_kmh": weather["wind_speed_kmh"],
            "humidity": weather["humidity"],
        },
        "weather_event_id": persist_meta.get("weather_event_id"),
        "triggers": persist_meta.get("triggers", []),
        "is_extreme": persist_meta.get("is_extreme", False),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/v1/risk/calculate-premium", response_model=PremiumResponse)
def calculate_premium(req: PremiumRequest):
    """XGBoost-powered dynamic premium calculation based on zone risk."""
    if req.city not in CITY_RISK_PROFILES:
        raise HTTPException(status_code=400, detail=f"City '{req.city}' not supported. Available: {list(CITY_RISK_PROFILES.keys())}")

    plan = PLAN_TIERS.get(req.plan, PLAN_TIERS["standard"])
    risk_score, factors = _xgboost_risk_score(req.city, req.zone, req.platform, req.worker_history_months)

    # Risk multiplier: 0.7 (low risk) to 1.5 (high risk)
    risk_multiplier = 0.7 + risk_score * 0.8
    base_premium = plan["weekly"]
    final_premium = round(base_premium * risk_multiplier)

    risk_level = "High" if risk_score > 0.6 else "Medium" if risk_score > 0.35 else "Low"

    formatted_factors = [
        {
            "name": f["name"],
            "importance": f["importance"],
            "impact": f["impact"],
            "value": f"{req.city} - {req.zone}" if "Zone" in f["name"] else
                     "Active monsoon season" if "Seasonal" in f["name"] else
                     f"Base: {CITY_RISK_PROFILES[req.city]['base_risk']}" if "City" in f["name"] else
                     req.platform if "Platform" in f["name"] else
                     f"{req.worker_history_months} months" if "History" in f["name"] else
                     f"{req.city} AQI profile",
        }
        for f in factors
    ]

    return PremiumResponse(
        base_premium=base_premium,
        risk_multiplier=round(risk_multiplier, 2),
        final_premium=final_premium,
        risk_level=risk_level,
        risk_score=round(risk_score, 3),
        factors=formatted_factors,
    )


@app.post("/api/v1/fraud/check", response_model=FraudCheckResponse)
def fraud_check(req: FraudCheckRequest):
    """Isolation Forest anomaly detection with SHAP explainability."""
    fraud_score, shap_values = _isolation_forest_fraud_score(req)

    is_flagged = fraud_score > 0.5
    risk_level = "Critical" if fraud_score > 0.8 else "High" if fraud_score > 0.6 else "Medium" if fraud_score > 0.4 else "Low"

    if fraud_score > 0.8:
        recommendation = "Block immediately — manual review required"
    elif fraud_score > 0.6:
        recommendation = "Flag for investigation — hold payout"
    elif fraud_score > 0.4:
        recommendation = "Monitor closely — additional verification recommended"
    else:
        recommendation = "Safe to auto-approve — low anomaly score"

    return FraudCheckResponse(
        fraud_score=round(fraud_score, 3),
        is_flagged=is_flagged,
        risk_level=risk_level,
        recommendation=recommendation,
        shap_values=shap_values,
    )


@app.post("/api/v1/risk/zone-heatmap")
def zone_heatmap(req: ZoneRiskRequest):
    """Generate risk heatmap data for all zones in a city."""
    if req.city not in CITY_RISK_PROFILES:
        raise HTTPException(status_code=400, detail=f"City '{req.city}' not supported")

    city_zones = {
        "Mumbai": ["Andheri West", "Bandra", "Dadar", "Colaba", "Powai"],
        "Delhi": ["Connaught Place", "Dwarka", "Rohini", "Saket", "Karol Bagh"],
        "Bangalore": ["Koramangala", "Indiranagar", "Whitefield", "Jayanagar", "HSR Layout"],
        "Chennai": ["T. Nagar", "Adyar", "Anna Nagar", "Mylapore", "Velachery"],
        "Hyderabad": ["Banjara Hills", "Madhapur", "Secunderabad", "Kukatpally", "Gachibowli"],
    }

    zones = city_zones.get(req.city, [])
    np.random.seed(hash(req.city) % 2**31)

    heatmap = []
    for zone in zones:
        risk, _ = _xgboost_risk_score(req.city, zone, "Swiggy", 0)
        heatmap.append({
            "zone": zone,
            "risk_score": round(risk, 3),
            "risk_level": "High" if risk > 0.6 else "Medium" if risk > 0.35 else "Low",
            "rainfall_mm": round(np.random.uniform(0, 60), 1),
            "aqi": int(np.random.uniform(50, 400 if req.city == "Delhi" else 200)),
            "temp_c": round(np.random.uniform(28, 46 if req.city == "Chennai" else 38), 1),
            "wind_speed_kmh": round(np.random.uniform(5, 50), 1),
            "active_workers": int(np.random.uniform(50, 500)),
            "active_policies": int(np.random.uniform(40, 400)),
        })

    return {"city": req.city, "zones": heatmap, "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/v1/triggers/check", response_model=TriggerCheckResponse)
def check_triggers(req: TriggerCheckRequest):
    """Check weather data against parametric trigger thresholds."""
    triggers_fired, total_payout_pct, risk_level = _evaluate_triggers(
        req.rainfall_mm,
        req.temp_c,
        req.aqi,
        req.wind_speed_kmh,
    )

    return TriggerCheckResponse(
        triggers_fired=triggers_fired,
        total_payout_pct=total_payout_pct,
        risk_level=risk_level,
    )


@app.post("/api/v1/triggers/simulate")
def simulate_trigger(city: str, zone: str, trigger_type: str):
    """Simulate a parametric trigger for testing."""
    return _simulate_trigger_payload(city, zone, trigger_type)


@app.post("/api/v1/incidents/run")
def run_incident(req: IncidentRunRequest):
    """Create a manual incident run for admin simulation or fire drill flows."""
    mode = req.mode.strip().lower()
    if mode not in {"simulate", "fire"}:
        raise HTTPException(status_code=400, detail="mode must be one of: simulate, fire")

    started = datetime.utcnow()
    payload = _simulate_trigger_payload(req.city, req.zone, req.trigger_type)
    payload["simulation"] = mode == "simulate"

    trigger_event_id = None
    incident_run_id = None

    if _env("SUPABASE_URL") and _env("SUPABASE_SERVICE_ROLE_KEY"):
        trigger_rows = _sb_insert(
            "trigger_events",
            [
                {
                    "trigger_type": req.trigger_type,
                    "city": req.city,
                    "zone": req.zone,
                    "measured_value": payload["measured_value"],
                    "threshold_value": payload["threshold_value"],
                    "workers_affected": payload["workers_affected"],
                    "total_payout": payload["total_estimated_payout"],
                    "status": "completed",
                    "is_manual": True,
                }
            ],
        )
        if trigger_rows:
            trigger_event_id = trigger_rows[0].get("id")

        incident_rows = _sb_insert(
            "incident_runs",
            [
                {
                    "city": req.city,
                    "zone": req.zone,
                    "trigger_type": req.trigger_type,
                    "mode": mode,
                    "workers_affected": payload["workers_affected"],
                    "total_estimated_payout": payload["total_estimated_payout"],
                    "avg_payout_per_worker": payload["avg_payout_per_worker"],
                    "threshold_value": payload["threshold_value"],
                    "measured_value": payload["measured_value"],
                    "trigger_event_id": trigger_event_id,
                    "started_at": started.isoformat(),
                }
            ],
        )
        if incident_rows:
            incident_run_id = incident_rows[0].get("id")

    finished = datetime.utcnow()
    duration_ms = int((finished - started).total_seconds() * 1000)

    if incident_run_id:
        _sb_patch(
            "incident_runs",
            filters={"id": f"eq.{incident_run_id}"},
            payload={
                "completed_at": finished.isoformat(),
                "duration_ms": duration_ms,
            },
        )

    payload["incident_id"] = incident_run_id
    payload["trigger_event_id"] = trigger_event_id
    payload["duration_ms"] = duration_ms
    payload["mode"] = mode
    return payload


@app.get("/api/v1/incidents/recent")
def recent_incidents(limit: int = 10):
    """List recent incident simulations/fires from Supabase."""
    safe_limit = max(1, min(limit, 50))
    rows = _sb_get(
        "incident_runs",
        params={
            "select": "id,city,zone,trigger_type,mode,workers_affected,total_estimated_payout,avg_payout_per_worker,threshold_value,measured_value,trigger_event_id,started_at,completed_at,duration_ms",
            "order": "started_at.desc",
            "limit": str(safe_limit),
        },
    )
    return rows


@app.get("/api/v1/admin/kpis")
def admin_kpis(window_days: int = 14):
    """Aggregate live operational KPIs for admin analytics panels."""
    safe_days = max(3, min(window_days, 60))
    now = datetime.utcnow()
    since = now - timedelta(days=safe_days)
    since_iso = since.isoformat()
    last_24h = now - timedelta(hours=24)

    def _parse_dt(raw_value: Any) -> Optional[datetime]:
        if not raw_value or not isinstance(raw_value, str):
            return None
        raw = raw_value.strip()
        try:
            if raw.endswith("Z"):
                raw = raw[:-1] + "+00:00"
            dt = datetime.fromisoformat(raw)
            if dt.tzinfo is not None:
                return dt.replace(tzinfo=None)
            return dt
        except Exception:
            return None

    incident_series: List[Dict[str, Any]] = []
    incident_index: Dict[str, Dict[str, Any]] = {}
    for day_offset in range(6, -1, -1):
        day_key = (now - timedelta(days=day_offset)).date().isoformat()
        bucket = {"date": day_key, "fire": 0, "simulate": 0, "payout": 0.0}
        incident_series.append(bucket)
        incident_index[day_key] = bucket

    payout_total_24h = 0.0
    workers_protected_24h = 0
    fire_drills = 0
    simulations = 0
    incident_latencies: List[float] = []

    incident_rows = _sb_get(
        "incident_runs",
        params={
            "select": "mode,total_estimated_payout,workers_affected,duration_ms,started_at",
            "started_at": f"gte.{since_iso}",
            "order": "started_at.desc",
            "limit": "800",
        },
    )

    for row in incident_rows:
        mode = str(row.get("mode") or "simulate").strip().lower()
        started_at = _parse_dt(row.get("started_at"))
        payout = float(row.get("total_estimated_payout") or 0)
        workers = int(row.get("workers_affected") or 0)

        if mode == "fire":
            fire_drills += 1
        else:
            simulations += 1

        if started_at and started_at >= last_24h and mode == "fire":
            payout_total_24h += payout
            workers_protected_24h += workers

        if started_at:
            bucket = incident_index.get(started_at.date().isoformat())
            if bucket:
                if mode == "fire":
                    bucket["fire"] += 1
                else:
                    bucket["simulate"] += 1
                bucket["payout"] += payout

        duration_ms = row.get("duration_ms")
        if duration_ms is not None:
            try:
                incident_latencies.append(float(duration_ms))
            except (TypeError, ValueError):
                pass

    for bucket in incident_series:
        bucket["payout"] = round(float(bucket["payout"]), 2)

    appeal_series: List[Dict[str, Any]] = []
    appeal_index: Dict[str, Dict[str, Any]] = {}
    for day_offset in range(6, -1, -1):
        day_key = (now - timedelta(days=day_offset)).date().isoformat()
        bucket = {"date": day_key, "submitted": 0, "resolved": 0}
        appeal_series.append(bucket)
        appeal_index[day_key] = bucket

    open_appeals = 0
    appeal_turnaround_hours: List[float] = []
    resolved_within_24h = 0

    appeal_rows = _sb_get(
        "claim_appeals",
        params={
            "select": "status,submitted_at,resolved_at",
            "submitted_at": f"gte.{since_iso}",
            "order": "submitted_at.desc",
            "limit": "800",
        },
    )

    for row in appeal_rows:
        status = str(row.get("status") or "submitted").strip().lower()
        submitted_at = _parse_dt(row.get("submitted_at"))
        resolved_at = _parse_dt(row.get("resolved_at"))

        if status in {"submitted", "under_review"}:
            open_appeals += 1

        if submitted_at:
            submitted_bucket = appeal_index.get(submitted_at.date().isoformat())
            if submitted_bucket:
                submitted_bucket["submitted"] += 1

        if resolved_at:
            resolved_bucket = appeal_index.get(resolved_at.date().isoformat())
            if resolved_bucket:
                resolved_bucket["resolved"] += 1

        if submitted_at and resolved_at:
            turnaround_hours = max((resolved_at - submitted_at).total_seconds() / 3600.0, 0.0)
            appeal_turnaround_hours.append(turnaround_hours)
            if turnaround_hours <= 24:
                resolved_within_24h += 1

    resolved_appeals_count = len(appeal_turnaround_hours)

    fraud_rows = _sb_get(
        "fraud_logs",
        params={
            "select": "status,detected_at,resolved_at",
            "detected_at": f"gte.{since_iso}",
            "order": "detected_at.desc",
            "limit": "800",
        },
    )

    blocked_count = 0
    cleared_count = 0
    fraud_resolution_hours: List[float] = []
    for row in fraud_rows:
        status = str(row.get("status") or "").strip().lower()
        if status == "blocked":
            blocked_count += 1
        elif status == "cleared":
            cleared_count += 1

        if status in {"blocked", "cleared"}:
            detected_at = _parse_dt(row.get("detected_at"))
            resolved_at = _parse_dt(row.get("resolved_at"))
            if detected_at and resolved_at:
                fraud_resolution_hours.append(max((resolved_at - detected_at).total_seconds() / 3600.0, 0.0))

    resolved_fraud_count = blocked_count + cleared_count

    claims_rows = _sb_get(
        "claims",
        params={
            "select": "city,amount,status",
            "created_at": f"gte.{since_iso}",
            "limit": "1500",
        },
    )
    city_rollup: Dict[str, Dict[str, Any]] = {}
    for row in claims_rows:
        city = str(row.get("city") or "Unknown")
        amount = float(row.get("amount") or 0)
        status = str(row.get("status") or "").strip().lower()
        if city not in city_rollup:
            city_rollup[city] = {
                "city": city,
                "claims": 0,
                "payouts": 0.0,
                "rejected": 0,
            }
        city_rollup[city]["claims"] += 1
        city_rollup[city]["payouts"] += amount
        if status == "rejected":
            city_rollup[city]["rejected"] += 1

    city_snapshot: List[Dict[str, Any]] = []
    for city_data in city_rollup.values():
        claims_count = int(city_data["claims"])
        payouts = float(city_data["payouts"])
        rejected = int(city_data["rejected"])
        city_snapshot.append(
            {
                "city": city_data["city"],
                "claims": claims_count,
                "payouts": round(payouts, 2),
                "avg_claim": round(payouts / claims_count, 2) if claims_count else 0.0,
                "rejection_rate_pct": round((rejected / claims_count) * 100, 1) if claims_count else 0.0,
            }
        )
    city_snapshot.sort(key=lambda item: item["claims"], reverse=True)
    city_snapshot = city_snapshot[:6]

    worker_rows = _sb_get(
        "gig_workers",
        params={
            "select": "platform,status",
            "limit": "5000",
        },
    )
    platform_rollup: Dict[str, int] = {}
    for row in worker_rows:
        platform = str(row.get("platform") or "Unknown")
        status = str(row.get("status") or "").strip().lower()
        if status and status != "active":
            continue
        platform_rollup[platform] = platform_rollup.get(platform, 0) + 1

    # Fallback to all workers if no active-status rows were returned.
    if not platform_rollup:
        for row in worker_rows:
            platform = str(row.get("platform") or "Unknown")
            platform_rollup[platform] = platform_rollup.get(platform, 0) + 1

    total_platform_workers = sum(platform_rollup.values())
    platform_snapshot: List[Dict[str, Any]] = []
    for platform, count in platform_rollup.items():
        share = round((count / total_platform_workers) * 100, 1) if total_platform_workers else 0.0
        platform_snapshot.append(
            {
                "platform": platform,
                "workers": count,
                "share": share,
            }
        )
    platform_snapshot.sort(key=lambda item: item["workers"], reverse=True)
    platform_snapshot = platform_snapshot[:6]

    avg_incident_latency_ms = (
        round(sum(incident_latencies) / len(incident_latencies), 1)
        if incident_latencies
        else None
    )
    avg_appeal_turnaround_hours = (
        round(sum(appeal_turnaround_hours) / resolved_appeals_count, 2)
        if resolved_appeals_count
        else None
    )
    appeal_resolution_24h_pct = (
        round((resolved_within_24h / resolved_appeals_count) * 100, 1)
        if resolved_appeals_count
        else None
    )
    fraud_block_rate_pct = (
        round((blocked_count / resolved_fraud_count) * 100, 1)
        if resolved_fraud_count
        else None
    )
    avg_fraud_resolution_hours = (
        round(sum(fraud_resolution_hours) / len(fraud_resolution_hours), 2)
        if fraud_resolution_hours
        else None
    )

    return {
        "window_days": safe_days,
        "generated_at": now.isoformat(),
        "headline": {
            "payout_total_24h": round(payout_total_24h, 2),
            "payout_velocity_per_hour": round(payout_total_24h / 24.0, 2),
            "workers_protected_24h": workers_protected_24h,
            "open_appeals": open_appeals,
            "avg_appeal_turnaround_hours": avg_appeal_turnaround_hours,
            "appeal_resolution_24h_pct": appeal_resolution_24h_pct,
            "fraud_block_rate_pct": fraud_block_rate_pct,
            "avg_fraud_resolution_hours": avg_fraud_resolution_hours,
            "fire_drills": fire_drills,
            "simulations": simulations,
            "avg_incident_latency_ms": avg_incident_latency_ms,
        },
        "incident_series": incident_series,
        "appeal_series": appeal_series,
        "city_snapshot": city_snapshot,
        "platform_snapshot": platform_snapshot,
    }


@app.get("/api/v1/admin/snapshot")
def admin_snapshot(window_days: int = 14, incident_limit: int = 8, appeal_limit: int = 8):
    """Export a judge/demo-friendly operational snapshot payload."""
    safe_days = max(3, min(window_days, 60))
    safe_incident_limit = max(1, min(incident_limit, 50))
    safe_appeal_limit = max(1, min(appeal_limit, 50))

    kpis = admin_kpis(window_days=safe_days)
    recent_incidents = _sb_get(
        "incident_runs",
        params={
            "select": "id,city,zone,trigger_type,mode,workers_affected,total_estimated_payout,avg_payout_per_worker,threshold_value,measured_value,trigger_event_id,started_at,completed_at,duration_ms",
            "order": "started_at.desc",
            "limit": str(safe_incident_limit),
        },
    )
    open_appeals = open_fraud_appeals(limit=safe_appeal_limit)

    return {
        "export_version": "admin-snapshot.v1",
        "generated_at": datetime.utcnow().isoformat(),
        "window_days": safe_days,
        "headline": kpis.get("headline", {}),
        "incident_series": kpis.get("incident_series", []),
        "appeal_series": kpis.get("appeal_series", []),
        "city_snapshot": kpis.get("city_snapshot", []),
        "platform_snapshot": kpis.get("platform_snapshot", []),
        "recent_incidents": recent_incidents,
        "open_appeals": open_appeals,
    }


@app.post("/api/v1/fraud/decision")
def fraud_decision(req: FraudDecisionRequest):
    """Resolve a fraud alert from the admin panel."""
    action = req.action.strip().lower()
    if action not in {"clear", "block"}:
        raise HTTPException(status_code=400, detail="action must be one of: clear, block")

    status = "cleared" if action == "clear" else "blocked"
    update_payload: Dict[str, Any] = {
        "status": status,
        "resolved_by": req.reviewer,
        "resolved_at": datetime.utcnow().isoformat(),
    }
    if req.note and req.note.strip():
        update_payload["reason"] = req.note.strip()

    success = _sb_patch("fraud_logs", filters={"id": f"eq.{req.fraud_log_id}"}, payload=update_payload)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update fraud log")

    fraud_rows = _sb_get(
        "fraud_logs",
        params={
            "select": "id,claim_id,status,resolved_at,resolved_by,reason",
            "id": f"eq.{req.fraud_log_id}",
            "limit": "1",
        },
    )
    if not fraud_rows:
        raise HTTPException(status_code=404, detail="Fraud log not found")

    claim_row_id = fraud_rows[0].get("claim_id")
    claim_status = "processing" if action == "clear" else "rejected"
    if claim_row_id:
        _sb_patch(
            "claims",
            filters={"id": f"eq.{claim_row_id}"},
            payload={
                "status": claim_status,
                "process_time": "manual_review",
            },
        )

    return {
        "fraud_log_id": req.fraud_log_id,
        "action": action,
        "status": status,
        "claim_status": claim_status,
        "resolved_by": req.reviewer,
        "resolved_at": update_payload["resolved_at"],
    }


@app.get("/api/v1/fraud/appeals/open")
def open_fraud_appeals(limit: int = 20):
    """Return currently open worker appeals with claim and worker context."""
    safe_limit = max(1, min(limit, 100))
    appeals = _sb_get(
        "claim_appeals",
        params={
            "select": "id,claim_public_id,claim_row_id,worker_id,reason,status,submitted_at,resolved_at",
            "status": "in.(submitted,under_review)",
            "order": "submitted_at.desc",
            "limit": str(safe_limit),
        },
    )

    enriched: List[Dict[str, Any]] = []
    for appeal in appeals:
        claim_row_id = appeal.get("claim_row_id")
        worker_row_id = appeal.get("worker_id")

        claim = None
        worker = None

        if claim_row_id:
            claim_rows = _sb_get(
                "claims",
                params={
                    "select": "claim_id,city,zone,amount,fraud_score,status,worker_id",
                    "id": f"eq.{claim_row_id}",
                    "limit": "1",
                },
            )
            if claim_rows:
                claim = claim_rows[0]

        if worker_row_id:
            worker_rows = _sb_get(
                "gig_workers",
                params={
                    "select": "worker_id,name,platform,city,zone",
                    "id": f"eq.{worker_row_id}",
                    "limit": "1",
                },
            )
            if worker_rows:
                worker = worker_rows[0]

        enriched.append(
            {
                "appeal_id": appeal.get("id"),
                "status": appeal.get("status"),
                "reason": appeal.get("reason"),
                "submitted_at": appeal.get("submitted_at"),
                "claim_id": appeal.get("claim_public_id"),
                "claim_amount": (claim or {}).get("amount"),
                "fraud_score": (claim or {}).get("fraud_score"),
                "claim_status": (claim or {}).get("status"),
                "city": (claim or {}).get("city") or (worker or {}).get("city"),
                "zone": (claim or {}).get("zone") or (worker or {}).get("zone"),
                "worker_gw_id": (worker or {}).get("worker_id"),
                "worker_name": (worker or {}).get("name"),
                "platform": (worker or {}).get("platform"),
            }
        )

    return enriched


@app.post("/api/v1/fraud/appeals/submit")
def submit_fraud_appeal(req: FraudAppealRequest):
    """Allow workers to submit a human review request for a flagged claim."""
    claim_rows = _sb_get(
        "claims",
        params={
            "select": "id,claim_id,worker_id,status",
            "claim_id": f"eq.{req.claim_id}",
            "limit": "1",
        },
    )
    if not claim_rows:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = claim_rows[0]
    claim_worker_id = claim.get("worker_id")

    if req.worker_id and req.worker_id != claim_worker_id:
        raise HTTPException(status_code=403, detail="Worker does not own this claim")

    inserted = _sb_insert(
        "claim_appeals",
        [
            {
                "claim_public_id": req.claim_id,
                "claim_row_id": claim.get("id"),
                "worker_id": claim_worker_id,
                "reason": req.reason.strip(),
                "status": "submitted",
                "submitted_at": datetime.utcnow().isoformat(),
            }
        ],
    )
    if not inserted:
        raise HTTPException(status_code=500, detail="Unable to submit appeal. Ensure claim_appeals table exists.")

    _sb_patch(
        "claims",
        filters={"id": f"eq.{claim.get('id')}"},
        payload={
            "status": "processing",
            "process_time": "appeal_submitted",
        },
    )

    return {
        "appeal_id": inserted[0].get("id"),
        "claim_id": req.claim_id,
        "status": "submitted",
        "submitted_at": inserted[0].get("submitted_at", datetime.utcnow().isoformat()),
    }


@app.post("/api/v1/fraud/appeals/decision")
def resolve_fraud_appeal(req: FraudAppealDecisionRequest):
    """Resolve a submitted appeal from the admin panel."""
    action = req.action.strip().lower()
    if action not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="action must be one of: accept, reject")

    appeal_status = "accepted" if action == "accept" else "rejected"
    resolved_at = datetime.utcnow().isoformat()
    success = _sb_patch(
        "claim_appeals",
        filters={"id": f"eq.{req.appeal_id}"},
        payload={
            "status": appeal_status,
            "reviewer": req.reviewer,
            "resolution_note": req.note,
            "resolved_at": resolved_at,
        },
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to resolve appeal")

    appeal_rows = _sb_get(
        "claim_appeals",
        params={
            "select": "id,claim_public_id,claim_row_id,status",
            "id": f"eq.{req.appeal_id}",
            "limit": "1",
        },
    )
    if not appeal_rows:
        raise HTTPException(status_code=404, detail="Appeal not found")

    claim_row_id = appeal_rows[0].get("claim_row_id")
    claim_status = "processing" if action == "accept" else "rejected"
    if claim_row_id:
        _sb_patch(
            "claims",
            filters={"id": f"eq.{claim_row_id}"},
            payload={
                "status": claim_status,
                "process_time": "appeal_review",
            },
        )
        _sb_patch(
            "fraud_logs",
            filters={"claim_id": f"eq.{claim_row_id}"},
            payload={
                "status": "cleared" if action == "accept" else "blocked",
                "resolved_by": req.reviewer,
                "resolved_at": resolved_at,
            },
        )

    return {
        "appeal_id": req.appeal_id,
        "claim_id": appeal_rows[0].get("claim_public_id"),
        "action": action,
        "status": appeal_status,
        "claim_status": claim_status,
        "resolved_by": req.reviewer,
        "resolved_at": resolved_at,
    }


@app.post("/api/v1/weather/current")
def get_weather(req: WeatherData, persist_to_supabase: bool = True):
    """Process weather data and check for alerts."""
    alerts = []

    if req.rainfall_mm > 20:
        alerts.append({"type": "rain_warning", "message": f"Heavy rainfall: {req.rainfall_mm}mm/hr", "severity": "high" if req.rainfall_mm > 30 else "medium"})
    if req.aqi > 200:
        alerts.append({"type": "aqi_warning", "message": f"Poor air quality: AQI {req.aqi}", "severity": "high" if req.aqi > 300 else "medium"})
    if req.temp_c > 40:
        alerts.append({"type": "heat_warning", "message": f"Extreme heat: {req.temp_c}°C", "severity": "high" if req.temp_c > 45 else "medium"})
    if req.wind_speed_kmh > 40:
        alerts.append({"type": "wind_warning", "message": f"Strong winds: {req.wind_speed_kmh}km/h", "severity": "high" if req.wind_speed_kmh > 60 else "medium"})

    persisted = False
    weather_event_id = None
    trigger_event_count = 0

    if persist_to_supabase and _env("SUPABASE_URL") and _env("SUPABASE_SERVICE_ROLE_KEY"):
        persist_meta = _persist_zone_weather(
            req.city,
            req.zone,
            {
                "rainfall_mm": req.rainfall_mm,
                "temp_c": req.temp_c,
                "aqi": req.aqi,
                "wind_speed_kmh": req.wind_speed_kmh,
                "humidity": req.humidity,
                "lat": None,
                "lng": None,
            },
        )
        persisted = True
        weather_event_id = persist_meta.get("weather_event_id")
        trigger_event_count = len(persist_meta.get("triggers", []))

    return {
        "city": req.city,
        "zone": req.zone,
        "current": {
            "rainfall_mm": req.rainfall_mm,
            "temp_c": req.temp_c,
            "aqi": req.aqi,
            "wind_speed_kmh": req.wind_speed_kmh,
            "humidity": req.humidity,
        },
        "alerts": alerts,
        "risk_level": "High" if len(alerts) > 1 else "Medium" if len(alerts) > 0 else "Low",
        "persisted": persisted,
        "weather_event_id": weather_event_id,
        "trigger_event_count": trigger_event_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
