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

export interface IncidentRunRequest {
  city: string;
  zone: string;
  trigger_type: string;
  mode?: "simulate" | "fire";
}

export interface IncidentRunResponse {
  incident_id: string | null;
  trigger_event_id: string | null;
  simulation: boolean;
  mode: "simulate" | "fire";
  trigger_type: string;
  city: string;
  zone: string;
  workers_affected: number;
  avg_payout_per_worker: number;
  total_estimated_payout: number;
  threshold_value: number;
  measured_value: number;
  duration_ms: number;
  timestamp: string;
}

export interface FraudDecisionRequest {
  fraud_log_id: string;
  action: "clear" | "block";
  reviewer?: string;
  note?: string;
}

export interface FraudDecisionResponse {
  fraud_log_id: string;
  action: "clear" | "block";
  status: "cleared" | "blocked";
  claim_status: "processing" | "rejected";
  resolved_by: string;
  resolved_at: string;
}

export interface FraudAppealRequest {
  claim_id: string;
  reason: string;
  worker_id?: string;
}

export interface FraudAppealResponse {
  appeal_id: string;
  claim_id: string;
  status: "submitted";
  submitted_at: string;
}

export interface FraudAppealDecisionRequest {
  appeal_id: string;
  action: "accept" | "reject";
  reviewer?: string;
  note?: string;
}

export interface FraudAppealDecisionResponse {
  appeal_id: string;
  claim_id: string;
  action: "accept" | "reject";
  status: "accepted" | "rejected";
  claim_status: "processing" | "rejected";
  resolved_by: string;
  resolved_at: string;
}

export interface IncidentRunSummary {
  id: string;
  city: string;
  zone: string;
  trigger_type: string;
  mode: "simulate" | "fire";
  workers_affected: number;
  total_estimated_payout: number;
  avg_payout_per_worker: number;
  threshold_value: number;
  measured_value: number;
  trigger_event_id: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface OpenFraudAppealItem {
  appeal_id: string;
  status: "submitted" | "under_review";
  reason: string;
  submitted_at: string;
  claim_id: string;
  claim_amount: number | null;
  fraud_score: number | null;
  claim_status: string | null;
  city: string | null;
  zone: string | null;
  worker_gw_id: string | null;
  worker_name: string | null;
  platform: string | null;
}

export interface AdminOpsKpisResponse {
  window_days: number;
  generated_at: string;
  headline: {
    payout_total_24h: number;
    payout_velocity_per_hour: number;
    workers_protected_24h: number;
    open_appeals: number;
    avg_appeal_turnaround_hours: number | null;
    appeal_resolution_24h_pct: number | null;
    fraud_block_rate_pct: number | null;
    avg_fraud_resolution_hours: number | null;
    fire_drills: number;
    simulations: number;
    avg_incident_latency_ms: number | null;
  };
  incident_series: {
    date: string;
    fire: number;
    simulate: number;
    payout: number;
  }[];
  appeal_series: {
    date: string;
    submitted: number;
    resolved: number;
  }[];
  city_snapshot: {
    city: string;
    claims: number;
    payouts: number;
    avg_claim: number;
    rejection_rate_pct: number;
  }[];
  platform_snapshot: {
    platform: string;
    workers: number;
    share: number;
  }[];
}

export interface AdminSnapshotResponse {
  export_version: string;
  generated_at: string;
  window_days: number;
  headline: AdminOpsKpisResponse["headline"];
  incident_series: AdminOpsKpisResponse["incident_series"];
  appeal_series: AdminOpsKpisResponse["appeal_series"];
  city_snapshot: AdminOpsKpisResponse["city_snapshot"];
  platform_snapshot: AdminOpsKpisResponse["platform_snapshot"];
  recent_incidents: IncidentRunSummary[];
  open_appeals: OpenFraudAppealItem[];
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
 * Run an admin incident simulation or fire drill
 */
export async function runIncident(
  req: IncidentRunRequest
): Promise<IncidentRunResponse> {
  return apiCall<IncidentRunResponse>("/api/v1/incidents/run", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Fetch recent incident runs for admin panels
 */
export async function getRecentIncidents(limit = 10): Promise<IncidentRunSummary[]> {
  return apiCall<IncidentRunSummary[]>(`/api/v1/incidents/recent?limit=${encodeURIComponent(String(limit))}`);
}

/**
 * Resolve a fraud queue item from admin
 */
export async function submitFraudDecision(
  req: FraudDecisionRequest
): Promise<FraudDecisionResponse> {
  return apiCall<FraudDecisionResponse>("/api/v1/fraud/decision", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Submit a worker appeal for a flagged claim
 */
export async function submitFraudAppeal(
  req: FraudAppealRequest
): Promise<FraudAppealResponse> {
  return apiCall<FraudAppealResponse>("/api/v1/fraud/appeals/submit", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Resolve an appeal from admin
 */
export async function resolveFraudAppeal(
  req: FraudAppealDecisionRequest
): Promise<FraudAppealDecisionResponse> {
  return apiCall<FraudAppealDecisionResponse>("/api/v1/fraud/appeals/decision", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Fetch currently open fraud appeals for admin review
 */
export async function listOpenFraudAppeals(limit = 20): Promise<OpenFraudAppealItem[]> {
  return apiCall<OpenFraudAppealItem[]>(`/api/v1/fraud/appeals/open?limit=${encodeURIComponent(String(limit))}`);
}

/**
 * Fetch live admin operations KPIs for dashboards
 */
export async function getAdminOpsKpis(windowDays = 14): Promise<AdminOpsKpisResponse> {
  return apiCall<AdminOpsKpisResponse>(`/api/v1/admin/kpis?window_days=${encodeURIComponent(String(windowDays))}`);
}

/**
 * Export a complete admin operations snapshot for demos/reviews
 */
export async function getAdminSnapshot(
  windowDays = 14,
  incidentLimit = 8,
  appealLimit = 8
): Promise<AdminSnapshotResponse> {
  return apiCall<AdminSnapshotResponse>(
    `/api/v1/admin/snapshot?window_days=${encodeURIComponent(String(windowDays))}&incident_limit=${encodeURIComponent(String(incidentLimit))}&appeal_limit=${encodeURIComponent(String(appealLimit))}`
  );
}

/**
 * Check ML API health
 */
export async function checkHealth(): Promise<{ status: string }> {
  return apiCall("/health");
}
