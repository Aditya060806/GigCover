/**
 * GigCover — ML API Client
 * Connects Next.js frontend to FastAPI ML backend
 */

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────

export interface PremiumRequest {
  city: string;
  zone: string;
  platform: string;
  plan?: string;
  worker_history_months?: number;
}

export interface PremiumResponse {
  base_premium: number;
  risk_multiplier: number;
  final_premium: number;
  risk_level: string;
  risk_score: number;
  factors: {
    name: string;
    importance: number;
    impact: string;
    value: string;
  }[];
}

export interface FraudCheckRequest {
  worker_id: string;
  claim_amount: number;
  city: string;
  zone: string;
  trigger_type: string;
  claim_history_count?: number;
  avg_claim_amount?: number;
  days_since_last_claim?: number;
  gps_deviation_km?: number;
  platform_active_during_event?: boolean;
  weather_data_matches?: boolean;
}

export interface FraudCheckResponse {
  fraud_score: number;
  is_flagged: boolean;
  risk_level: string;
  recommendation: string;
  shap_values: {
    feature: string;
    value: number;
    direction: string;
  }[];
}

export interface ZoneHeatmapResponse {
  city: string;
  zones: {
    zone: string;
    risk_score: number;
    risk_level: string;
    rainfall_mm: number;
    aqi: number;
    temp_c: number;
    wind_speed_kmh: number;
    active_workers: number;
    active_policies: number;
  }[];
  timestamp: string;
}

export interface TriggerCheckRequest {
  city: string;
  zone: string;
  rainfall_mm?: number;
  temp_c?: number;
  aqi?: number;
  wind_speed_kmh?: number;
}

export interface TriggerCheckResponse {
  triggers_fired: {
    type: string;
    value: number;
    threshold: number;
    payout_pct: number;
  }[];
  total_payout_pct: number;
  risk_level: string;
}

// ── API Functions ──────────────────────────────────────────

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${ML_API_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API error: ${res.status}`);
    }
    return res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.warn(`ML API unavailable at ${ML_API_URL} — using fallback`);
      throw new Error("ML API unavailable");
    }
    throw error;
  }
}

/**
 * Calculate AI-powered premium based on zone risk
 */
export async function calculatePremium(req: PremiumRequest): Promise<PremiumResponse> {
  return apiCall<PremiumResponse>("/api/v1/risk/calculate-premium", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Run fraud detection on a claim
 */
export async function checkFraud(req: FraudCheckRequest): Promise<FraudCheckResponse> {
  return apiCall<FraudCheckResponse>("/api/v1/fraud/check", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Get risk heatmap for all zones in a city
 */
export async function getZoneHeatmap(city: string): Promise<ZoneHeatmapResponse> {
  return apiCall<ZoneHeatmapResponse>("/api/v1/risk/zone-heatmap", {
    method: "POST",
    body: JSON.stringify({ city }),
  });
}

/**
 * Check weather data against trigger thresholds
 */
export async function checkTriggers(req: TriggerCheckRequest): Promise<TriggerCheckResponse> {
  return apiCall<TriggerCheckResponse>("/api/v1/triggers/check", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Simulate a parametric trigger
 */
export async function simulateTrigger(
  city: string,
  zone: string,
  triggerType: string
): Promise<{
  workers_affected: number;
  total_estimated_payout: number;
  avg_payout_per_worker: number;
}> {
  return apiCall(
    `/api/v1/triggers/simulate?city=${encodeURIComponent(city)}&zone=${encodeURIComponent(zone)}&trigger_type=${encodeURIComponent(triggerType)}`,
    { method: "POST" }
  );
}

/**
 * Check ML API health
 */
export async function checkHealth(): Promise<{ status: string }> {
  return apiCall("/health");
}
