"""
GigCover — Production-Grade Synthetic Data Generator v3.0
==========================================================
Generates hyper-realistic data for 15K gig workers across 5 Indian cities.

Key improvements over v1:
  • Monsoon-aware seasonal weather (Jun-Sep Mumbai, Oct-Dec Chennai, etc.)
  • City-specific AQI seasonal patterns (Delhi Nov-Feb smog, Diwali spike)
  • Correlated fraud signals (GPS drift + timing + amount anomalies together)
  • Platform-specific earning distributions (Amazon > Swiggy > Dunzo)
  • Worker lifecycle: join date → ramp-up → steady state → churn
  • Claims linked to actual weather windows, not random events
  • 25+ engineered features for ML training
  • Supabase-ready JSON output with proper UUIDs and ISO timestamps
"""

import json
import random
import uuid
import math
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

import numpy as np

random.seed(42)
np.random.seed(42)

# ═══════════════════════════════════════════════════════════
# CONFIGURATION — Based on real Indian climate/city data
# ═══════════════════════════════════════════════════════════

CITIES = {
    "Mumbai": {
        "zones": [
            {"name": "Andheri West", "lat": 19.1314, "lng": 72.8296, "density": "high", "flood_prone": True},
            {"name": "Bandra", "lat": 19.0596, "lng": 72.8295, "density": "high", "flood_prone": False},
            {"name": "Dadar", "lat": 19.0185, "lng": 72.8425, "density": "medium", "flood_prone": True},
            {"name": "Colaba", "lat": 18.9067, "lng": 72.8147, "density": "low", "flood_prone": False},
            {"name": "Powai", "lat": 19.1197, "lng": 72.9074, "density": "medium", "flood_prone": True},
        ],
        "climate": {
            "monsoon_months": [6, 7, 8, 9],         # Jun-Sep (SW monsoon)
            "avg_annual_rain_mm": 2400,
            "avg_monsoon_rain_mm_per_day": 35,
            "off_monsoon_rain_mm_per_day": 2,
            "base_temp_range": (26, 34),
            "heat_peak_months": [4, 5],               # April-May
            "base_aqi": 90,
            "aqi_spike_months": [11, 12, 1],
            "base_wind": 12,
            "cyclone_months": [5, 6, 10, 11],
        },
    },
    "Delhi": {
        "zones": [
            {"name": "Connaught Place", "lat": 28.6315, "lng": 77.2167, "density": "high", "flood_prone": False},
            {"name": "Dwarka", "lat": 28.5733, "lng": 77.0700, "density": "medium", "flood_prone": True},
            {"name": "Rohini", "lat": 28.7495, "lng": 77.0653, "density": "medium", "flood_prone": False},
            {"name": "Saket", "lat": 28.5244, "lng": 77.2066, "density": "high", "flood_prone": False},
            {"name": "Karol Bagh", "lat": 28.6434, "lng": 77.1883, "density": "high", "flood_prone": False},
        ],
        "climate": {
            "monsoon_months": [7, 8, 9],
            "avg_annual_rain_mm": 800,
            "avg_monsoon_rain_mm_per_day": 18,
            "off_monsoon_rain_mm_per_day": 1,
            "base_temp_range": (20, 42),              # Extreme range
            "heat_peak_months": [5, 6],
            "base_aqi": 180,                          # Delhi's notorious baseline
            "aqi_spike_months": [10, 11, 12, 1],      # Stubble burning + winter inversion
            "base_wind": 8,
            "cyclone_months": [],
        },
    },
    "Bangalore": {
        "zones": [
            {"name": "Koramangala", "lat": 12.9352, "lng": 77.6245, "density": "high", "flood_prone": True},
            {"name": "Indiranagar", "lat": 12.9784, "lng": 77.6408, "density": "high", "flood_prone": False},
            {"name": "Whitefield", "lat": 12.9698, "lng": 77.7500, "density": "medium", "flood_prone": True},
            {"name": "Jayanagar", "lat": 12.9253, "lng": 77.5938, "density": "medium", "flood_prone": False},
            {"name": "HSR Layout", "lat": 12.9116, "lng": 77.6389, "density": "high", "flood_prone": True},
        ],
        "climate": {
            "monsoon_months": [6, 7, 8, 9, 10],      # Longer monsoon
            "avg_annual_rain_mm": 970,
            "avg_monsoon_rain_mm_per_day": 12,
            "off_monsoon_rain_mm_per_day": 1.5,
            "base_temp_range": (22, 34),
            "heat_peak_months": [3, 4],
            "base_aqi": 70,
            "aqi_spike_months": [11, 12],
            "base_wind": 10,
            "cyclone_months": [],
        },
    },
    "Chennai": {
        "zones": [
            {"name": "T. Nagar", "lat": 13.0399, "lng": 80.2340, "density": "high", "flood_prone": True},
            {"name": "Adyar", "lat": 13.0012, "lng": 80.2565, "density": "medium", "flood_prone": True},
            {"name": "Anna Nagar", "lat": 13.0850, "lng": 80.2101, "density": "medium", "flood_prone": False},
            {"name": "Mylapore", "lat": 13.0368, "lng": 80.2676, "density": "high", "flood_prone": True},
            {"name": "Velachery", "lat": 12.9815, "lng": 80.2180, "density": "medium", "flood_prone": True},
        ],
        "climate": {
            "monsoon_months": [10, 11, 12],           # NE monsoon (Oct-Dec!)
            "avg_annual_rain_mm": 1400,
            "avg_monsoon_rain_mm_per_day": 28,
            "off_monsoon_rain_mm_per_day": 3,
            "base_temp_range": (28, 40),
            "heat_peak_months": [4, 5, 6],
            "base_aqi": 80,
            "aqi_spike_months": [1, 11],
            "base_wind": 14,
            "cyclone_months": [10, 11, 12],           # Bay of Bengal cyclones
        },
    },
    "Hyderabad": {
        "zones": [
            {"name": "Banjara Hills", "lat": 17.4156, "lng": 78.4347, "density": "high", "flood_prone": False},
            {"name": "Madhapur", "lat": 17.4484, "lng": 78.3908, "density": "high", "flood_prone": True},
            {"name": "Secunderabad", "lat": 17.4399, "lng": 78.4983, "density": "medium", "flood_prone": False},
            {"name": "Kukatpally", "lat": 17.4849, "lng": 78.3873, "density": "medium", "flood_prone": True},
            {"name": "Gachibowli", "lat": 17.4401, "lng": 78.3489, "density": "medium", "flood_prone": False},
        ],
        "climate": {
            "monsoon_months": [6, 7, 8, 9],
            "avg_annual_rain_mm": 800,
            "avg_monsoon_rain_mm_per_day": 14,
            "off_monsoon_rain_mm_per_day": 1,
            "base_temp_range": (24, 40),
            "heat_peak_months": [4, 5],
            "base_aqi": 95,
            "aqi_spike_months": [11, 12, 1],
            "base_wind": 9,
            "cyclone_months": [],
        },
    },
}

PLATFORMS = {
    "Swiggy":  {"share": 0.27, "avg_earnings": 800,  "sd_earnings": 150, "claim_propensity": 1.0},
    "Zomato":  {"share": 0.25, "avg_earnings": 750,  "sd_earnings": 140, "claim_propensity": 1.0},
    "Amazon":  {"share": 0.19, "avg_earnings": 950,  "sd_earnings": 200, "claim_propensity": 0.85},
    "Zepto":   {"share": 0.12, "avg_earnings": 700,  "sd_earnings": 120, "claim_propensity": 1.15},
    "Blinkit": {"share": 0.10, "avg_earnings": 680,  "sd_earnings": 110, "claim_propensity": 1.1},
    "Dunzo":   {"share": 0.07, "avg_earnings": 620,  "sd_earnings": 100, "claim_propensity": 0.9},
}

PLANS = {
    "basic":    {"share": 0.30, "weekly": 15, "max_payout": 500},
    "standard": {"share": 0.50, "weekly": 25, "max_payout": 1500},
    "pro":      {"share": 0.20, "weekly": 40, "max_payout": 3000},
}

TRIGGER_THRESHOLDS = {
    "heavy_rain": {"field": "rainfall_mm", "value": 30, "unit": "mm/hr"},
    "flood":      {"field": "rainfall_mm", "value": 100, "unit": "mm/hr"},
    "heatwave":   {"field": "temp_c",      "value": 45, "unit": "°C"},
    "aqi":        {"field": "aqi",         "value": 300, "unit": "AQI"},
    "storm":      {"field": "wind_kmh",    "value": 60, "unit": "km/h"},
}

FIRST_NAMES = [
    "Ravi", "Priya", "Amit", "Sunita", "Vikram", "Meena", "Rajesh", "Anjali",
    "Suresh", "Kavita", "Arun", "Deepa", "Manoj", "Neha", "Sanjay", "Lakshmi",
    "Prakash", "Divya", "Kumar", "Shweta", "Ganesh", "Rekha", "Ashok", "Pooja",
    "Venkat", "Anita", "Ramesh", "Swati", "Kiran", "Geeta", "Mohan", "Rita",
    "Srinivas", "Jyoti", "Sunil", "Padma", "Naveen", "Pallavi", "Ajay", "Seema",
    "Harish", "Nisha", "Dinesh", "Preeti", "Bhaskar", "Savita", "Satish", "Madhavi",
]

LAST_NAMES = [
    "Patel", "Sharma", "Singh", "Kumar", "Reddy", "Nair", "Joshi", "Yadav",
    "Gupta", "Verma", "Mishra", "Chauhan", "Devi", "Malhotra", "Mehta", "Iyer",
    "Rao", "Das", "Pillai", "Banerjee", "Shah", "Bhat", "Shetty", "Hegde",
    "Tiwari", "Pandey", "Chopra", "Saxena", "Nayak", "Kulkarni", "Menon", "Kaur",
]


def gen_uuid():
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════
# WEATHER ENGINE — Seasonal, correlated, city-specific
# ═══════════════════════════════════════════════════════════

def generate_weather_for_day(city_name: str, zone: dict, dt: datetime) -> dict:
    """Generate a single weather reading with realistic seasonal patterns."""
    climate = CITIES[city_name]["climate"]
    month = dt.month
    hour = dt.hour

    is_monsoon = month in climate["monsoon_months"]
    is_heat_peak = month in climate["heat_peak_months"]
    is_aqi_spike = month in climate["aqi_spike_months"]
    is_cyclone_window = month in climate.get("cyclone_months", [])

    # ── Rainfall ──
    if is_monsoon:
        base_rain = climate["avg_monsoon_rain_mm_per_day"]
        # Afternoon thunderstorms more likely
        hour_mult = 1.5 if 14 <= hour <= 19 else 0.6
        rain = max(0, np.random.exponential(base_rain * hour_mult))
        # Mumbai gets extreme bursts
        if city_name == "Mumbai" and random.random() < 0.03:
            rain *= np.random.uniform(3, 6)  # Cloudburst
        # Flood-prone zones get waterlogged
        if zone.get("flood_prone") and rain > 40:
            rain *= 1.3
    else:
        rain = max(0, np.random.exponential(climate["off_monsoon_rain_mm_per_day"]))

    # Cyclone events (rare, devastating)
    if is_cyclone_window and random.random() < 0.005:
        rain = np.random.uniform(80, 200)

    rain = round(rain, 1)

    # ── Temperature ──
    temp_min, temp_max = climate["base_temp_range"]
    # Seasonal curve: hottest in peak months
    seasonal_offset = 0
    if is_heat_peak:
        seasonal_offset = 4
    elif is_monsoon:
        seasonal_offset = -3  # Monsoon cools things
    elif month in [12, 1, 2]:
        seasonal_offset = -6 if city_name == "Delhi" else -2

    # Diurnal cycle
    diurnal = -4 if (0 <= hour <= 6 or 20 <= hour <= 23) else 3 if (12 <= hour <= 15) else 0
    base_temp = (temp_min + temp_max) / 2 + seasonal_offset + diurnal
    temp = round(np.random.normal(base_temp, 2), 1)

    # ── AQI ──
    base_aqi = climate["base_aqi"]
    if is_aqi_spike:
        # Delhi winter smog: AQI 250-500+
        if city_name == "Delhi":
            aqi_mult = np.random.uniform(1.5, 3.0)
            # Diwali week spike (around Nov 1)
            if month == 11 and dt.day <= 7:
                aqi_mult *= 1.5
        else:
            aqi_mult = np.random.uniform(1.1, 1.5)
    elif is_monsoon:
        aqi_mult = 0.6  # Rain washes pollution
    else:
        aqi_mult = 1.0

    # Morning/evening rush hour AQI spikes
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        aqi_mult *= 1.15

    aqi = max(20, int(np.random.normal(base_aqi * aqi_mult, base_aqi * 0.2)))

    # ── Wind ──
    base_wind = climate["base_wind"]
    if is_cyclone_window and random.random() < 0.008:
        wind = np.random.uniform(60, 120)  # Cyclonic wind
    elif is_monsoon:
        wind = np.random.exponential(base_wind * 1.3)
    else:
        wind = np.random.exponential(base_wind * 0.8)
    wind = round(max(0, wind), 1)

    # ── Humidity ──
    if is_monsoon:
        humidity = np.random.normal(82, 8)
    elif rain > 5:
        humidity = np.random.normal(75, 10)
    else:
        humidity = np.random.normal(55, 12)
    humidity = round(np.clip(humidity, 15, 99), 1)

    # ── Determine triggers ──
    triggers = []
    if rain >= 30:
        triggers.append("heavy_rain")
    if rain >= 100:
        triggers.append("flood")
    if temp >= 45:
        triggers.append("heatwave")
    if aqi >= 300:
        triggers.append("aqi")
    if wind >= 60:
        triggers.append("storm")

    is_extreme = len(triggers) > 0

    return {
        "id": gen_uuid(),
        "city": city_name,
        "zone": zone["name"],
        "rainfall_mm": rain,
        "temp_c": temp,
        "aqi": aqi,
        "wind_speed_kmh": wind,
        "humidity": humidity,
        "triggers_fired": triggers,
        "is_extreme": is_extreme,
        "lat": round(zone["lat"] + np.random.uniform(-0.005, 0.005), 6),
        "lng": round(zone["lng"] + np.random.uniform(-0.005, 0.005), 6),
        "source": "openweathermap",
        "recorded_at": dt.isoformat(),
    }


def generate_weather_events(n_days: int = 400) -> list:
    """Generate weather events across all cities/zones for n_days.
    4 readings/day × 25 zones × 400 days ≈ 40,000 events.
    """
    events = []
    start_date = datetime(2024, 1, 1)
    readings_per_day = [6, 12, 16, 21]  # 6AM, noon, 4PM, 9PM

    for day_offset in range(n_days):
        dt_base = start_date + timedelta(days=day_offset)
        for city_name, city_data in CITIES.items():
            for zone in city_data["zones"]:
                # 1-2 readings per day per zone (to keep dataset manageable at ~40K)
                n_readings = 1 if random.random() < 0.6 else 2
                for _ in range(n_readings):
                    hour = random.choice(readings_per_day)
                    dt = dt_base.replace(hour=hour, minute=random.randint(0, 59))
                    event = generate_weather_for_day(city_name, zone, dt)
                    events.append(event)

    return events


# ═══════════════════════════════════════════════════════════
# WORKER GENERATOR — Realistic lifecycle
# ═══════════════════════════════════════════════════════════

def generate_workers(n: int = 15000) -> list:
    """Generate workers with realistic city/platform distributions."""
    workers = []
    city_shares = {"Mumbai": 0.28, "Delhi": 0.25, "Bangalore": 0.20, "Chennai": 0.14, "Hyderabad": 0.13}
    platform_names = list(PLATFORMS.keys())
    platform_weights = [PLATFORMS[p]["share"] for p in platform_names]
    plan_names = list(PLANS.keys())
    plan_weights = [PLANS[p]["share"] for p in plan_names]

    start_date = datetime(2024, 1, 1)
    end_date = datetime(2025, 2, 1)

    used_phones = set()
    used_emails = set()

    for i in range(n):
        # City weighted by population
        city = np.random.choice(list(city_shares.keys()), p=list(city_shares.values()))
        city_data = CITIES[city]
        zone = random.choice(city_data["zones"])

        platform = np.random.choice(platform_names, p=platform_weights)
        plan = np.random.choice(plan_names, p=plan_weights)
        plan_info = PLANS[plan]
        plat_info = PLATFORMS[platform]

        # Earnings with platform-specific distribution
        avg_earnings = round(max(300, np.random.normal(plat_info["avg_earnings"], plat_info["sd_earnings"])))

        # Join date — more recent joiners
        join_date = start_date + timedelta(days=int(np.random.exponential(120)))
        join_date = min(join_date, end_date - timedelta(days=7))
        tenure_days = (end_date - join_date).days

        # Status: newer workers more likely active, old + high-risk more likely suspended
        base_active_prob = 0.88
        if tenure_days < 30:
            base_active_prob = 0.95
        elif tenure_days > 300:
            base_active_prob = 0.75

        status_roll = random.random()
        if status_roll < base_active_prob:
            status = "active"
        elif status_roll < base_active_prob + 0.09:
            status = "inactive"
        else:
            status = "suspended"

        # Claims count depends on tenure + plan + zone risk
        zone_risk_mult = 1.3 if zone.get("flood_prone") else 0.85
        claims_rate = (tenure_days / 30) * 0.8 * zone_risk_mult * plat_info["claim_propensity"]
        total_claims = max(0, int(np.random.poisson(claims_rate)))
        total_payouts = total_claims * avg_earnings * np.random.uniform(0.3, 0.8,)
        total_earnings = tenure_days * avg_earnings * np.random.uniform(0.7, 1.0) / 30  # Monthly estimate

        # Fraud flags — correlated with claims and status
        fraud_base = 0.04 if total_claims > 8 else 0.01
        if status == "suspended":
            fraud_base = 0.5
        fraud_flags = np.random.binomial(3, fraud_base)

        # Risk score — engineered, not random  
        risk_base = 0.20
        risk_base += 0.15 if zone.get("flood_prone") else 0
        risk_base += 0.10 if city in ["Mumbai", "Delhi"] else 0
        risk_base += min(total_claims * 0.02, 0.20)
        risk_base += fraud_flags * 0.12
        risk_base -= min(tenure_days * 0.0003, 0.10)  # Loyalty discount
        risk_score = round(np.clip(risk_base + np.random.normal(0, 0.06), 0.05, 0.95), 3)

        # Unique phone/email
        phone = f"+91{random.randint(7000000000, 9999999999)}"
        while phone in used_phones:
            phone = f"+91{random.randint(7000000000, 9999999999)}"
        used_phones.add(phone)

        email = f"worker{i+1}@gigcover.in"
        used_emails.add(email)

        worker = {
            "id": gen_uuid(),
            "worker_id": f"GW-{i+1:05d}",
            "name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "phone": phone,
            "email": email,
            "platform": platform,
            "city": city,
            "zone": zone["name"],
            "plan": plan,
            "weekly_premium": plan_info["weekly"],
            "max_payout": plan_info["max_payout"],
            "status": status,
            "lat": round(zone["lat"] + np.random.uniform(-0.01, 0.01), 6),
            "lng": round(zone["lng"] + np.random.uniform(-0.01, 0.01), 6),
            "avg_daily_earnings": avg_earnings,
            "total_earnings": round(total_earnings),
            "total_claims": total_claims,
            "total_payouts": round(total_payouts),
            "fraud_flags": int(fraud_flags),
            "risk_score": risk_score,
            "created_at": join_date.isoformat(),
        }
        workers.append(worker)

    return workers


# ═══════════════════════════════════════════════════════════
# CLAIMS GENERATOR — Linked to actual weather windows
# ═══════════════════════════════════════════════════════════

def generate_claims(workers: list, weather_events: list, n: int = 8000) -> list:
    """Generate claims triggered by actual extreme weather events.
    Claims are matched to workers in the same city/zone during weather events.
    """
    claims = []
    active_workers = [w for w in workers if w["status"] != "suspended"]

    # Index weather events with triggers by city+zone
    event_index = defaultdict(list)
    for e in weather_events:
        if e["is_extreme"]:
            event_index[f"{e['city']}_{e['zone']}"].append(e)

    # Flat list of all events with triggers for fallback
    all_extreme = [e for e in weather_events if e["is_extreme"]]

    # Worker index by city+zone
    worker_index = defaultdict(list)
    for w in active_workers:
        worker_index[f"{w['city']}_{w['zone']}"].append(w)

    claim_count = 0
    fraud_count = 0

    # For each extreme weather event, generate claims for affected workers
    for event in all_extreme:
        if claim_count >= n:
            break

        key = f"{event['city']}_{event['zone']}"
        zone_workers = worker_index.get(key, [])
        if not zone_workers:
            continue

        # 15-40% of zone workers file a claim per event
        affected_pct = np.random.uniform(0.15, 0.40)
        n_claims = max(1, int(len(zone_workers) * affected_pct))
        affected_workers = random.sample(zone_workers, min(n_claims, len(zone_workers)))

        # Pick the primary trigger from this event
        if event["triggers_fired"]:
            trigger = random.choice(event["triggers_fired"])
        else:
            continue

        for worker in affected_workers:
            if claim_count >= n:
                break

            plan_info = PLANS[worker["plan"]]
            plat_info = PLATFORMS[worker["platform"]]

            # Payout calculation based on trigger severity
            payout_pct_map = {
                "heavy_rain": 0.50, "flood": 1.0,
                "heatwave": 0.25, "aqi": 0.30, "storm": 0.40,
            }
            base_payout = worker["avg_daily_earnings"] * payout_pct_map.get(trigger, 0.5)

            # Severity scaling (worse weather → higher payout)
            severity_mult = 1.0
            if trigger == "heavy_rain" and event["rainfall_mm"] > 60:
                severity_mult = 1.3
            elif trigger == "flood" and event["rainfall_mm"] > 150:
                severity_mult = 1.5
            elif trigger == "aqi" and event["aqi"] > 400:
                severity_mult = 1.4

            amount = round(min(base_payout * severity_mult + np.random.uniform(-80, 120), plan_info["max_payout"]))
            amount = max(100, amount)

            auto_triggered = random.random() < 0.90

            # ── Fraud simulation (correlated signals) ──
            is_fraud = False
            fraud_score = 0.0
            gps_deviation = 0.0
            timing_anomaly = False
            amount_anomaly = False
            platform_mismatch = False

            # 4% base fraud rate, higher for suspended-adjacent workers
            fraud_prob = 0.04
            if worker["fraud_flags"] > 0:
                fraud_prob = 0.15
            if worker["total_claims"] > 10:
                fraud_prob += 0.05

            if random.random() < fraud_prob:
                is_fraud = True
                fraud_count += 1

                # Correlated fraud signals — fraudsters rarely have just ONE anomaly
                n_signals = np.random.choice([2, 3, 4], p=[0.3, 0.5, 0.2])

                signals = random.sample([
                    "gps", "timing", "amount", "platform", "weather_mismatch"
                ], min(n_signals, 5))

                if "gps" in signals:
                    gps_deviation = round(np.random.uniform(2.0, 15.0), 2)  # km away from zone
                if "timing" in signals:
                    timing_anomaly = True  # Claiming at 3AM
                if "amount" in signals:
                    amount_anomaly = True
                    amount = round(plan_info["max_payout"] * np.random.uniform(0.85, 1.0))
                if "platform" in signals:
                    platform_mismatch = True  # Not active on platform during event

                fraud_score = round(np.random.uniform(0.65, 0.98), 3)
            else:
                # Legitimate claims still have some noise
                gps_deviation = round(abs(np.random.normal(0, 0.3)), 2)
                fraud_score = round(np.random.uniform(0.01, 0.30), 3)

            if is_fraud:
                status = random.choices(["flagged", "rejected"], weights=[0.6, 0.4])[0]
            elif auto_triggered:
                status = "paid"
            else:
                status = random.choices(["paid", "processing"], weights=[0.85, 0.15])[0]

            process_time = f"{random.randint(12, 90)}s" if status == "paid" and auto_triggered else "—"

            # Parse event date
            event_dt = datetime.fromisoformat(event["recorded_at"])
            # Claim filed 0-24 hours after event
            claim_dt = event_dt + timedelta(hours=np.random.uniform(0, 24) if not auto_triggered else np.random.uniform(0, 0.5))

            claim = {
                "id": gen_uuid(),
                "claim_id": f"CLM-{claim_dt.year}-{claim_count+1:05d}",
                "worker_id": worker["id"],
                "worker_name": worker["name"],
                "worker_gw_id": worker["worker_id"],
                "city": worker["city"],
                "zone": worker["zone"],
                "platform": worker["platform"],
                "plan": worker["plan"],
                "trigger_type": trigger,
                "weather_event_id": event["id"],
                "rainfall_mm": event["rainfall_mm"],
                "temp_c": event["temp_c"],
                "aqi": event["aqi"],
                "wind_speed_kmh": event["wind_speed_kmh"],
                "amount": amount,
                "status": status,
                "auto_triggered": auto_triggered,
                "fraud_score": fraud_score,
                "process_time": process_time,
                # Fraud-specific features for ML
                "gps_deviation_km": gps_deviation,
                "timing_anomaly": timing_anomaly,
                "amount_anomaly": amount_anomaly,
                "platform_active_during_event": not platform_mismatch,
                "weather_data_matches": not is_fraud or "weather_mismatch" not in (signals if is_fraud else []),
                "days_since_last_claim": random.randint(1 if is_fraud else 7, 15 if is_fraud else 90),
                "claim_hour": claim_dt.hour,
                "created_at": claim_dt.isoformat(),
            }
            claims.append(claim)
            claim_count += 1

    # If we haven't hit target, generate more from random events
    while claim_count < n and all_extreme:
        event = random.choice(all_extreme)
        worker = random.choice(active_workers)
        if not event["triggers_fired"]:
            continue

        trigger = random.choice(event["triggers_fired"])
        plan_info = PLANS[worker["plan"]]
        amount = round(min(worker["avg_daily_earnings"] * 0.5, plan_info["max_payout"]))
        event_dt = datetime.fromisoformat(event["recorded_at"])

        claim = {
            "id": gen_uuid(),
            "claim_id": f"CLM-{event_dt.year}-{claim_count+1:05d}",
            "worker_id": worker["id"],
            "worker_name": worker["name"],
            "worker_gw_id": worker["worker_id"],
            "city": worker["city"],
            "zone": worker["zone"],
            "platform": worker["platform"],
            "plan": worker["plan"],
            "trigger_type": trigger,
            "weather_event_id": event["id"],
            "rainfall_mm": event["rainfall_mm"],
            "temp_c": event["temp_c"],
            "aqi": event["aqi"],
            "wind_speed_kmh": event["wind_speed_kmh"],
            "amount": max(100, amount),
            "status": "paid",
            "auto_triggered": True,
            "fraud_score": round(np.random.uniform(0.01, 0.20), 3),
            "process_time": f"{random.randint(15, 60)}s",
            "gps_deviation_km": round(abs(np.random.normal(0, 0.3)), 2),
            "timing_anomaly": False,
            "amount_anomaly": False,
            "platform_active_during_event": True,
            "weather_data_matches": True,
            "days_since_last_claim": random.randint(10, 90),
            "claim_hour": random.randint(8, 20),
            "created_at": event_dt.isoformat(),
        }
        claims.append(claim)
        claim_count += 1

    return claims


# ═══════════════════════════════════════════════════════════
# TRANSACTIONS
# ═══════════════════════════════════════════════════════════

def generate_transactions(workers: list, claims: list) -> list:
    """Generate financial transactions: premiums + payouts + bonuses."""
    transactions = []

    # Premium payments — weekly for each active worker
    for worker in workers:
        if worker["status"] == "suspended":
            continue
        join_dt = datetime.fromisoformat(worker["created_at"])
        end_dt = datetime(2025, 2, 1)
        current = join_dt
        while current < end_dt:
            transactions.append({
                "id": gen_uuid(),
                "worker_id": worker["id"],
                "type": "premium",
                "amount": -worker["weekly_premium"],
                "description": f"Weekly premium — {worker['plan'].capitalize()} plan",
                "claim_id": None,
                "status": "completed",
                "created_at": current.isoformat(),
            })
            current += timedelta(days=7)

    # Claim payouts
    for claim in claims:
        if claim["status"] == "paid":
            transactions.append({
                "id": gen_uuid(),
                "worker_id": claim["worker_id"],
                "type": "payout",
                "amount": claim["amount"],
                "description": f"Auto-payout: {claim['trigger_type'].replace('_', ' ').title()} ({claim['city']})",
                "claim_id": claim["id"],
                "status": "completed",
                "created_at": claim["created_at"],
            })

    # Referral bonuses (small %)
    for worker in random.sample(workers, min(500, len(workers))):
        transactions.append({
            "id": gen_uuid(),
            "worker_id": worker["id"],
            "type": "bonus",
            "amount": random.choice([50, 100, 150, 200]),
            "description": "Referral bonus",
            "claim_id": None,
            "status": "completed",
            "created_at": (datetime.fromisoformat(worker["created_at"]) + timedelta(days=random.randint(3, 30))).isoformat(),
        })

    return transactions


# ═══════════════════════════════════════════════════════════
# ML TRAINING DATA — 25+ Engineered Features
# ═══════════════════════════════════════════════════════════

def generate_risk_training_data(workers: list, weather_events: list) -> tuple:
    """Generate rich feature matrix for XGBoost risk model.
    25 features including zone history, seasonal patterns, worker behavior.
    """
    # Pre-compute zone-level statistics
    zone_stats = defaultdict(lambda: {
        "total_events": 0, "extreme_events": 0, "avg_rain": [], "avg_aqi": [],
        "avg_temp": [], "max_rain": 0, "max_wind": 0,
        "monsoon_extreme_pct": 0, "total_monsoon": 0, "extreme_monsoon": 0,
    })

    for event in weather_events:
        key = f"{event['city']}_{event['zone']}"
        stats = zone_stats[key]
        stats["total_events"] += 1
        stats["avg_rain"].append(event["rainfall_mm"])
        stats["avg_aqi"].append(event["aqi"])
        stats["avg_temp"].append(event["temp_c"])
        stats["max_rain"] = max(stats["max_rain"], event["rainfall_mm"])
        stats["max_wind"] = max(stats["max_wind"], event["wind_speed_kmh"])
        if event["is_extreme"]:
            stats["extreme_events"] += 1
        # Track monsoon stats
        month = datetime.fromisoformat(event["recorded_at"]).month
        if month in [6, 7, 8, 9]:
            stats["total_monsoon"] += 1
            if event["is_extreme"]:
                stats["extreme_monsoon"] += 1

    # Compute final stats
    for key in zone_stats:
        s = zone_stats[key]
        s["avg_rain_val"] = np.mean(s["avg_rain"]) if s["avg_rain"] else 0
        s["avg_aqi_val"] = np.mean(s["avg_aqi"]) if s["avg_aqi"] else 100
        s["avg_temp_val"] = np.mean(s["avg_temp"]) if s["avg_temp"] else 30
        s["rain_std"] = np.std(s["avg_rain"]) if len(s["avg_rain"]) > 1 else 0
        s["extreme_rate"] = s["extreme_events"] / max(s["total_events"], 1)
        s["monsoon_extreme_pct"] = s["extreme_monsoon"] / max(s["total_monsoon"], 1)

    X_data = []
    y_data = []

    city_map = {"Mumbai": 0, "Delhi": 1, "Bangalore": 2, "Chennai": 3, "Hyderabad": 4}
    platform_map = {p: i for i, p in enumerate(PLATFORMS.keys())}
    plan_map = {"basic": 0, "standard": 1, "pro": 2}

    for worker in workers:
        key = f"{worker['city']}_{worker['zone']}"
        zs = zone_stats.get(key, zone_stats["Mumbai_Bandra"])
        climate = CITIES[worker["city"]]["climate"]
        tenure_days = max(1, (datetime(2025, 2, 1) - datetime.fromisoformat(worker["created_at"])).days)

        features = {
            # Zone weather features (8)
            "zone_extreme_rate": round(zs["extreme_rate"], 4),
            "zone_avg_rainfall": round(zs["avg_rain_val"], 2),
            "zone_rainfall_std": round(zs["rain_std"], 2),
            "zone_max_rainfall": round(zs["max_rain"], 1),
            "zone_avg_aqi": round(zs["avg_aqi_val"], 1),
            "zone_avg_temp": round(zs["avg_temp_val"], 1),
            "zone_max_wind": round(zs["max_wind"], 1),
            "zone_monsoon_extreme_pct": round(zs["monsoon_extreme_pct"], 4),
            # City features (4)
            "city_encoded": city_map.get(worker["city"], 0),
            "city_base_aqi": climate["base_aqi"],
            "city_monsoon_rain": climate["avg_monsoon_rain_mm_per_day"],
            "city_has_cyclones": 1 if climate.get("cyclone_months") else 0,
            # Worker features (8)
            "platform_encoded": platform_map.get(worker["platform"], 0),
            "plan_encoded": plan_map.get(worker["plan"], 0),
            "avg_daily_earnings": worker["avg_daily_earnings"],
            "tenure_days": tenure_days,
            "claims_count": worker["total_claims"],
            "claims_per_month": round(worker["total_claims"] / max(tenure_days / 30, 1), 3),
            "fraud_flags": worker["fraud_flags"],
            "worker_status_encoded": {"active": 0, "inactive": 1, "suspended": 2}.get(worker["status"], 0),
            # Derived features (5)
            "payout_to_premium_ratio": round(worker["total_payouts"] / max(worker["weekly_premium"] * (tenure_days / 7), 1), 3),
            "is_high_density_zone": 1 if any(z["name"] == worker["zone"] and z.get("density") == "high" for z in CITIES[worker["city"]]["zones"]) else 0,
            "is_flood_prone": 1 if any(z["name"] == worker["zone"] and z.get("flood_prone") for z in CITIES[worker["city"]]["zones"]) else 0,
            "earnings_vs_platform_avg": round(worker["avg_daily_earnings"] / PLATFORMS[worker["platform"]]["avg_earnings"], 3),
            "weekly_premium": worker["weekly_premium"],
        }

        X_data.append(features)
        y_data.append(worker["risk_score"])

    return X_data, y_data


def generate_fraud_training_data(claims: list) -> tuple:
    """Generate rich feature matrix for fraud detection.
    15 features including correlated anomaly signals.
    """
    X_data = []
    y_labels = []

    trigger_map = {"heavy_rain": 0, "flood": 1, "heatwave": 2, "aqi": 3, "storm": 4}

    for claim in claims:
        features = {
            # Claim features (5)
            "claim_amount": claim["amount"],
            "auto_triggered": 1 if claim["auto_triggered"] else 0,
            "trigger_encoded": trigger_map.get(claim["trigger_type"], 0),
            "claim_hour": claim.get("claim_hour", 12),
            "days_since_last_claim": claim.get("days_since_last_claim", 30),
            # Weather features (4)
            "rainfall_mm": claim["rainfall_mm"],
            "temp_c": claim["temp_c"],
            "aqi": claim["aqi"],
            "wind_speed_kmh": claim["wind_speed_kmh"],
            # Anomaly signals (6)
            "gps_deviation_km": claim.get("gps_deviation_km", 0),
            "timing_anomaly": 1 if claim.get("timing_anomaly") else 0,
            "amount_anomaly": 1 if claim.get("amount_anomaly") else 0,
            "platform_active": 1 if claim.get("platform_active_during_event", True) else 0,
            "weather_matches": 1 if claim.get("weather_data_matches", True) else 0,
            "is_night_claim": 1 if claim.get("claim_hour", 12) < 6 or claim.get("claim_hour", 12) > 22 else 0,
        }

        X_data.append(features)
        y_labels.append(1 if claim["fraud_score"] > 0.6 else 0)

    return X_data, y_labels


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════

def main():
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    print("=" * 60)
    print("  GigCover Synthetic Data Generator v3.0")
    print("  Production-Grade • Seasonal • Correlated Fraud")
    print("=" * 60)
    print()

    # 1. Weather
    print("🌦️  Generating seasonal weather events (400 days × 25 zones)...")
    weather = generate_weather_events(400)
    extreme_count = sum(1 for e in weather if e["is_extreme"])
    triggers_by_type = defaultdict(int)
    for e in weather:
        for t in e["triggers_fired"]:
            triggers_by_type[t] += 1
    print(f"   ✅ {len(weather):,} events ({extreme_count:,} extreme)")
    print(f"   📊 Triggers: {dict(triggers_by_type)}")

    # 2. Workers
    print()
    print("👷 Generating 15,000 workers with realistic distributions...")
    workers = generate_workers(15000)
    city_dist = defaultdict(int)
    for w in workers:
        city_dist[w["city"]] += 1
    print(f"   ✅ {len(workers):,} workers generated")
    print(f"   🏙️  Distribution: {dict(city_dist)}")

    # 3. Claims
    print()
    print("📋 Generating 8,000 claims linked to weather events...")
    claims = generate_claims(workers, weather, 8000)
    fraud_count = sum(1 for c in claims if c["fraud_score"] > 0.6)
    paid_count = sum(1 for c in claims if c["status"] == "paid")
    print(f"   ✅ {len(claims):,} claims ({paid_count:,} paid, {fraud_count:,} fraudulent)")

    # 4. Transactions
    print()
    print("💳 Generating transactions (premiums + payouts)...")
    transactions = generate_transactions(workers, claims)
    print(f"   ✅ {len(transactions):,} transactions")

    # 5. ML Training Data
    print()
    print("🧠 Generating ML training features...")
    risk_X, risk_y = generate_risk_training_data(workers, weather)
    fraud_X, fraud_y = generate_fraud_training_data(claims)
    print(f"   ✅ Risk model:  {len(risk_X):,} samples × {len(risk_X[0]):,} features")
    print(f"   ✅ Fraud model: {len(fraud_X):,} samples × {len(fraud_X[0]):,} features ({sum(fraud_y):,} positives)")

    # 6. Save
    print()
    print("💾 Saving all datasets...")

    datasets = {
        "workers.json": workers,
        "weather_events.json": weather,
        "claims.json": claims,
        "transactions.json": transactions,
        "risk_training_X.json": risk_X,
        "risk_training_y.json": risk_y,
        "fraud_training_X.json": fraud_X,
        "fraud_training_y.json": fraud_y,
    }

    for fname, data in datasets.items():
        with open(output_dir / fname, "w") as f:
            json.dump(data, f, indent=2 if "training" in fname else None, default=str)
        size_mb = (output_dir / fname).stat().st_size / 1024 / 1024
        print(f"   📄 {fname}: {size_mb:.1f} MB")

    total_records = sum(len(d) if isinstance(d, list) else 0 for d in datasets.values())
    print()
    print("=" * 60)
    print(f"  ✨ Done! {total_records:,} total records generated")
    print(f"  📁 Output: {output_dir.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
