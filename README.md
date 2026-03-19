# 🛡️ GigCover — AI-Powered Parametric Insurance for Gig Workers

> **Guidewire DEVTrails 2026** | Team Vandalizers | Phase 1 — Idea Document

<div align="center">

![GigCover](https://img.shields.io/badge/GigCover-AI%20Parametric%20Insurance-8B5CF6?style=for-the-badge&logo=shield&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js%2014-black?style=for-the-badge&logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-FF6600?style=for-the-badge)
![SHAP](https://img.shields.io/badge/SHAP-Explainable%20AI-purple?style=for-the-badge)

**Protecting India's 15M+ gig workers from weather-driven income loss with instant, zero-claim, AI-powered parametric payouts.**

[🎥 Demo Video](#-demo-video) · [👤 User Personas](#-user-personas--real-world-scenarios) · [💡 How It Works](#-how-it-works) · [🗺️ Roadmap](#️-development-roadmap)

</div>

---

## 🎯 Problem Statement

India's gig economy has crossed **15 million workers** — Swiggy riders, Zomato delivery partners, Amazon Flex drivers, Zepto dark-store pickers. They earn ₹400–900/day, but have **zero income protection**.

When extreme weather hits — a Mumbai monsoon, a Delhi heatwave, a Chennai cyclone warning — they simply cannot work. They lose a full day's wages with no recourse. Traditional insurance products exclude them entirely: too informal, no employer, no fixed salary, no claims history.

**The result**: India's fastest-growing workforce is also its most financially vulnerable.

---

## 👤 User Personas & Real-World Scenarios

### Scenario 1 — Ravi (Swiggy Rider, Andheri West, Mumbai)

> *"It's July. Rainfall crosses 35mm/hr in Andheri. Ravi's app shows an orange alert. Within 90 seconds, ₹450 lands in his GigCover wallet — 50% of his daily earnings — automatically. No claim form. No waiting. He uses it to pay for lunch at the shelter."*

Ravi earns ₹850/day average, works 5–6 days/week. He pays **₹28/week** for GigCover Standard — adjusted by our XGBoost model for Andheri West's historically higher rainfall risk. He's had 3 weather-triggered payouts this monsoon season.

### Scenario 2 — Priya (Zepto Picker, Indiranagar, Bengaluru)

> *"AQI hits 315 in Indiranagar. Priya is asthmatic. Her GigCover policy triggers automatically — she gets ₹270 (30% of her daily earnings) and a push notification recommending she stay indoors. Her policy was ₹18/week — lower, because Bengaluru zones historically have fewer extreme AQI events."*

Priya is 23, no banking history, onboarded in 4 steps using her phone number. Her premium was calculated in real-time by our model using zone-level AQI, temperature, and claims history.

### Scenario 3 — Arjun (Amazon Flex Driver, Connaught Place, Delhi)

> *"June. 46°C heatwave. Arjun gets ₹200 (25% payout). But the system also flags a suspicious pattern: three claims in the same zone within 4 hours, all under the same trigger. Isolation Forest scores this cluster at 0.82 anomaly confidence — our admin is alerted. Arjun's claim passes (it's real), but the duplicate attempts are blocked."*

This is fraud prevention in action — SHAP explains exactly which features drove the anomaly score in the admin fraud panel.

---

## 💡 Solution: Parametric Insurance, Reimagined

**GigCover** is an AI-powered **parametric micro-insurance** platform built specifically for India's gig workforce.

**What makes it parametric**: Payouts are triggered by **objective, sensor-measured thresholds** — not by loss assessment, paperwork, or adjuster review. The moment a zone's rainfall crosses 30mm/hr, every insured worker in that zone gets paid. Automatically. In under 2 minutes.

| Trigger Event | Threshold | Auto-Payout (% of Daily Earnings) |
|---------------|-----------|-----------------------------------|
| 🌧️ Heavy Rain | > 30 mm/hr | 50% |
| 🌊 Flood / Waterlogging | > 100 mm / 24 hrs | 100% |
| 🌡️ Heatwave | > 45 °C | 25% |
| 💨 Hazardous AQI | > 300 AQI | 30% |
| 🌪️ Severe Wind / Storm | > 60 km/h wind speed | 40% |
| 🚫 Government Curfew / Disruption | Govt order flagged | 100% |

---

## ⚙️ How It Works

The complete workflow — from sign-up to payout — in one pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GIGCOVER WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. REGISTER (4 steps)                                              │
│     Worker → enters platform + city + zone + contact                │
│           → XGBoost calculates zone risk score                      │
│           → AI-priced weekly premium shown in real-time             │
│           → Worker selects Basic / Standard / Pro plan              │
│                                                                     │
│  2. MONITOR (continuous)                                            │
│     OpenWeatherMap + AQICN APIs → zone weather refresh every 15min  │
│     TomTom traffic API → disruption events flagged                  │
│     Admin dashboard → live zone risk heatmap + alert feed           │
│                                                                     │
│  3. TRIGGER (automatic)                                             │
│     Sensor value crosses threshold in zone                          │
│     → System queries all active policies in that zone               │
│     → Trigger event logged with timestamp + data                    │
│     → Payout calculated (% of registered daily earnings)            │
│                                                                     │
│  4. FRAUD CHECK (per trigger event)                                 │
│     Isolation Forest model scores the claim anomaly probability     │
│     SHAP values explain which features contributed                   │
│     Score < 0.4 → Auto-approved                                     │
│     Score 0.4–0.7 → Flagged for admin review                        │
│     Score > 0.7 → Held, escalated                                   │
│                                                                     │
│  5. PAYOUT (< 2 minutes)                                            │
│     Approved amount credited to GigCover wallet                     │
│     Worker receives push notification + wallet update               │
│     Admin ledger updated, payout logged                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Where AI/ML Fires in the Workflow

| Stage | Model | What it does |
|-------|-------|--------------|
| **Registration / `/insure` flow** | XGBoost (risk pricing) | Computes `risk_score` from zone's historical rainfall, AQI, temperature extremes, monsoon coefficient, and seasonal index. Outputs `final_premium` = `base_premium × risk_multiplier` |
| **Every trigger event** | Isolation Forest (fraud detection) | Scores each triggered claim for anomaly: duplicate zone clusters, same-device multiple claims, implausible timing patterns |
| **Admin fraud panel** | SHAP (explainability) | Generates waterfall charts showing exactly which features drove the Isolation Forest anomaly score — making every decision auditable |

---

## 💰 Weekly Premium Model

GigCover uses a **weekly subscription** model instead of annual premiums for three reasons:
1. Gig workers earn daily — weekly billing matches their cash flow cycle
2. Seasonal risk (monsoon vs. winter) means annual pricing is unfair
3. Workers can pause coverage in low-risk periods

### How XGBoost Prices Each Worker

The model takes 8 inputs at registration:

```
city             → base risk coefficient (Mumbai 1.3x, Delhi 1.1x, Bengaluru 0.9x...)
zone             → zone-level historical claims rate  
platform         → delivery category (rain impacts food delivery more than storage)
plan             → Basic / Standard / Pro coverage multiplier
current_rainfall → live zone weather at moment of signup
current_aqi      → live air quality index
current_temp     → current temperature
monsoon_season   → boolean flag (Jun–Sep = 1.4x multiplier)
```

**Output example** for Ravi (Andheri West, Swiggy Standard, July):

```
base_premium      = ₹25/week
risk_multiplier   = 1.12  (zone history: 28% above avg rainfall events)
seasonal_boost    = 1.08  (monsoon active)
final_premium     = ₹30/week  ← shown to worker before confirming
```

**Output example** for Priya (Indiranagar, Zepto Basic, February):

```
base_premium      = ₹15/week
risk_multiplier   = 0.92  (Bengaluru lower rainfall risk, dry season)
seasonal_boost    = 1.0   (no active monsoon)
final_premium     = ₹14/week
```

Premium ranges: **₹12–₹65/week** depending on zone, city, plan, and live conditions.

---

## 📱 Why Web (Not Mobile-First)?

We chose a **web-first architecture** for deliberate reasons:

| Concern | Rationale |
|---------|-----------|
| **Admin panel complexity** | The insurer-side dashboard (fraud SHAP charts, trigger management, city-wide heatmaps, worker tables) is genuinely complex — desktop web is the right surface for it |
| **No app store barrier** | Workers register via browser link — zero install friction. Works on any Android with Chrome |
| **Hackathon timeline** | A full-featured Next.js PWA delivers mobile UX parity in days, not weeks |
| **Progressive Web App ready** | The Next.js app is PWA-compatible — a manifest + service worker is the only addition needed for Phase 3 |
| **Cross-platform access** | Insurance regulators, Guidewire judges, and potential B2B partners (Swiggy HR, Amazon Flex ops) all access on desktop |

The worker-facing dashboard (`/dashboard`) is fully **mobile-responsive** — tested at 375px (iPhone SE) and 414px (Android standard). Workers can check their wallet, view coverage, and see weather alerts on any phone browser.

---

## 🏗️ Technical Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    GigCover Architecture                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐ │
│  │   Next.js    │    │   FastAPI    │    │    Supabase      │ │
│  │   Frontend   │◄──►│   ML API    │◄──►│  (PostgreSQL)    │ │
│  │  (Vercel)    │    │  (Render)   │    │  (Auth + DB)     │ │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────┘ │
│         │                   │                                  │
│         │            ┌──────┴───────┐                         │
│         │            │  ML Models   │                         │
│         │            ├──────────────┤                         │
│         │            │ XGBoost Risk │  ← Dynamic Pricing     │
│         │            │ IsoForest    │  ← Fraud Detection     │
│         │            │ SHAP Values  │  ← Explainability      │
│         │            └──────────────┘                         │
│         │                                                      │
│  ┌──────┴─────────────────────────────────┐                   │
│  │          External APIs (Free Tier)      │                   │
│  ├─────────────────────────────────────────┤                   │
│  │ OpenWeatherMap │ AQICN │ TomTom Maps   │                   │
│  └─────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Development Roadmap

### Phase 1 — Idea & Core Platform (Feb–Mar 20, 2026) ✅ *Current*
- [x] Full-stack web app: Next.js 14 + FastAPI + Supabase
- [x] Supabase Auth (sign-up, sign-in with real credentials)
- [x] XGBoost dynamic premium pricing model (trained on synthetic data)
- [x] Isolation Forest fraud detection with SHAP explainability
- [x] Live zone risk heatmap (OpenStreetMap + Supabase `v_zone_heatmap` view)
- [x] Admin panel: workers, claims, triggers, fraud analytics
- [x] Parametric trigger system with threshold configuration
- [x] CSV export for workers and claims
- [x] Loading skeletons and smooth UX across all pages
- [x] 5 cities: Mumbai, Delhi, Bengaluru, Chennai, Hyderabad

### Phase 2 — Claims Automation & Payments (Mar 21–Apr 4, 2026)
- [ ] **Razorpay sandbox integration** — mock instant payout to worker wallet on trigger
- [ ] Duplicate claim prevention — block same worker / same trigger / < 1 hr window
- [ ] TomTom traffic disruption surfaced as a trigger type (API key already integrated)
- [ ] Automated trigger-to-payout pipeline without admin intervention
- [ ] Notification system (in-app alerts when trigger fires in worker's zone)
- [ ] Unit test coverage for ML API endpoints

### Phase 3 — Scale, Fraud & Demo-Ready (Apr 5–17, 2026)
- [ ] **GPS spoofing fraud detection** — cross-check worker's claimed zone against device location during trigger
- [ ] Razorpay live mode (bank transfer simulation for demo)
- [ ] 5-minute video: live trigger demo — weather threshold crossed → auto-payout fires → wallet credited
- [ ] Final pitch deck PDF
- [ ] PWA manifest + service worker (installable on mobile)
- [ ] Stress-test: simulate 500 concurrent trigger events across zones
- [ ] Regulatory compliance doc (IRDAI sandbox alignment notes)

---

## 🖥️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 14** (App Router) | React framework with SSR/SSG |
| **TypeScript** | End-to-end type safety |
| **Tailwind CSS** | Utility-first styling |
| **Radix UI** | Accessible component primitives |
| **Framer Motion** | Page transitions & animations |
| **Recharts** | Data visualization |
| **Leaflet** + react-leaflet | Interactive zone risk maps |

### Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI** (Python) | ML inference API |
| **XGBoost** | Dynamic risk pricing model |
| **Isolation Forest** (scikit-learn) | Anomaly / fraud detection |
| **SHAP** | Explainable AI for fraud decisions |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Supabase** | PostgreSQL DB + Auth + Realtime |
| **Vercel** | Frontend hosting |
| **Render** | ML API hosting (free tier) |
| **OpenWeatherMap** | Live rainfall, temperature, wind data |
| **AQICN** | Real-time Air Quality Index by zone |
| **TomTom** | Traffic disruption events |

---

## 🎥 Demo Video

> 📹 **[Watch 2-Minute Demo](#)** ← *(link will be added before March 20 submission)*

**Demo script outline:**
1. **Problem** (0:00–0:30) — Show the uninsured gig worker gap in India
2. **GigCover solution** (0:30–1:00) — Worker registers, XGBoost prices premium live
3. **Trigger fires** (1:00–1:45) — Admin triggers a heavy rain event in Andheri → dashboard shows auto-payout → worker wallet credited
4. **Admin + Fraud panel** (1:45–2:00) — SHAP waterfall chart explaining a fraud decision

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+, Python 3.10+, npm

### 1. Clone & Install Frontend

```bash
cd web
npm install
cp .env.example .env.local
# Add your Supabase URL + anon key to .env.local
npm run dev
```

Frontend: `http://localhost:3000`

> **Quick Demo Access**: Use the "Demo Worker" or "Demo Admin" buttons on the login page to explore without creating an account.

### 2. Setup ML Backend

```bash
cd ml-api
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python generate_synthetic.py   # generates 10K workers + 50K weather events
python train_models.py          # trains XGBoost + Isolation Forest
uvicorn main:app --port 8000    # starts FastAPI on :8000
```

ML API: `http://localhost:8000`

### 3. Setup Supabase

1. Create project at [supabase.com](https://supabase.com)
2. SQL Editor → paste `supabase/schema.sql`
3. Copy project URL + anon key → `.env.local`

---

## 📱 Pages & Features

### Worker-Facing
| Page | Features |
|------|----------|
| **Landing** `/` | Hero, stats, features, pricing tiers, CTA |
| **Register** `/register` | 4-step onboarding: platform → zone → AI premium preview → confirmation |
| **Login** `/login` | Phone / email with Supabase Auth |
| **Dashboard** `/dashboard` | Earnings chart, wallet balance, weather alerts, recent claims |
| **Risk Map** `/dashboard/map` | Leaflet map with live zone risk circles from Supabase heatmap view |
| **Claims** `/dashboard/claims` | Claim history with AI explainability (SHAP summary) |
| **Policy** `/dashboard/policy` | Active coverage, upgrade options |
| **Wallet** `/dashboard/wallet` | Balance chart, transaction history |
| **Get Insured** `/insure` | Platform → Zone → XGBoost premium → Plan selection |

### Admin Panel
| Page | Features |
|------|----------|
| **Overview** `/admin` | 6 KPI cards, revenue chart, city distribution, live alerts |
| **Workers** `/admin/workers` | Search/filter table, risk scores, CSV export |
| **Claims** `/admin/claims` | Approve/reject queue, fraud scores, CSV export |
| **Triggers** `/admin/triggers` | Threshold config, manual trigger simulator, event log |
| **Fraud** `/admin/fraud` | SHAP waterfall charts, Isolation Forest scores |
| **Analytics** `/admin/analytics` | Growth charts, radar performance, city comparison |

---

## 🧠 ML API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/risk/calculate-premium` | POST | XGBoost risk-based premium |
| `/api/v1/risk/zone-heatmap` | POST | Zone-level risk scores for map |
| `/api/v1/fraud/check` | POST | Isolation Forest + SHAP fraud detection |
| `/api/v1/triggers/check` | POST | Check sensor data against thresholds |
| `/api/v1/triggers/simulate` | POST | Simulate trigger impact (workers + payout) |
| `/api/v1/weather/current` | POST | Process weather data, fire alerts |
| `/health` | GET | Service health check |

**Example — Premium Calculation:**
```bash
curl -X POST http://localhost:8000/api/v1/risk/calculate-premium \
  -H "Content-Type: application/json" \
  -d '{"city": "Mumbai", "zone": "Andheri West", "platform": "Swiggy", "plan": "standard"}'
```
```json
{
  "base_premium": 25,
  "risk_multiplier": 1.12,
  "final_premium": 28,
  "risk_level": "Medium",
  "risk_score": 0.523,
  "factors": [
    {"name": "Zone Weather History", "importance": 0.28, "impact": "increases"},
    {"name": "Monsoon/Seasonal Risk",  "importance": 0.22, "impact": "increases"}
  ]
}
```

---

## 📁 Project Structure

```
GigCover/
├── web/                          # Next.js 14 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Landing page
│   │   │   ├── login/           # Supabase Auth login
│   │   │   ├── register/        # 4-step signup wizard
│   │   │   ├── insure/          # Insurance purchase flow
│   │   │   ├── dashboard/       # Worker dashboard
│   │   │   │   ├── map/         # Live zone risk map
│   │   │   │   ├── claims/      # Claims + SHAP
│   │   │   │   ├── policy/
│   │   │   │   └── wallet/
│   │   │   └── admin/           # Admin panel
│   │   │       ├── workers/
│   │   │       ├── claims/
│   │   │       ├── triggers/
│   │   │       ├── fraud/
│   │   │       └── analytics/
│   │   ├── components/
│   │   │   ├── ui/              # Design system
│   │   │   ├── landing/
│   │   │   └── dashboard/
│   │   └── lib/
│   │       ├── api.ts           # ML API client
│   │       ├── supabase.ts      # Supabase client
│   │       ├── data.ts          # Supabase fetch functions
│   │       └── constants.ts
│   └── .env.local
├── ml-api/                       # FastAPI ML Backend
│   ├── main.py
│   ├── generate_synthetic.py
│   ├── train_models.py
│   └── requirements.txt
├── supabase/
│   └── schema.sql
└── README.md
```

---

## 🏆 Why GigCover

| Dimension | GigCover's Approach |
|-----------|---------------------|
| **Real Problem** | 15M+ uninsured gig workers with zero income safety net |
| **Right Product** | Parametric > traditional: no claims, no waiting, objective triggers |
| **AI-First** | XGBoost pricing + Isolation Forest fraud + SHAP audit trail |
| **Guidewire Aligned** | Insurance domain: claims automation, risk analytics, fraud detection |
| **Production-Ready** | Real auth, live weather data, full admin panel, CSV exports |
| **Deployable Now** | 100% free-tier stack: Vercel + Render + Supabase |

---

## 👥 Team Vandalizers

Built for **Guidewire DEVTrails 2026** Hackathon.

---

<div align="center">
<strong>GigCover</strong> — Because every delivery matters, rain or shine. 🛡️
</div>

---

*Dev commands: `cd ml-api; .\.venv\Scripts\Activate.ps1; uvicorn main:app --port 8000` · `cd web && npm run dev`*
