/**
 * GigCover — Supabase Data Layer
 * Fetches real data from Supabase with graceful fallbacks.
 */

import { supabase } from "./supabase";
import type {
  DashboardKPIs,
  RecentClaim,
  ZoneHeatmap,
  FraudQueueItem,
  WorkerRisk,
  GigWorker,
  Claim,
  Transaction,
  TriggerEvent,
  WeatherEvent,
} from "@/types/database";

// ── Admin KPIs (from v_dashboard_kpis view) ────────────────

export async function fetchDashboardKPIs(): Promise<DashboardKPIs | null> {
  const { data, error } = await supabase
    .from("v_dashboard_kpis")
    .select("*")
    .returns<DashboardKPIs[]>()
    .single();
  if (error) {
    console.warn("fetchDashboardKPIs:", error.message);
    return null;
  }
  return data;
}

// ── Recent Claims (from v_recent_claims view) ──────────────

export async function fetchRecentClaims(
  limit = 50
): Promise<RecentClaim[]> {
  const { data, error } = await supabase
    .from("v_recent_claims")
    .select("*")
    .limit(limit)
    .returns<RecentClaim[]>();
  if (error) {
    console.warn("fetchRecentClaims:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Zone Heatmap (from v_zone_heatmap view) ────────────────

export async function fetchZoneHeatmap(): Promise<ZoneHeatmap[]> {
  const { data, error } = await supabase
    .from("v_zone_heatmap")
    .select("*")
    .returns<ZoneHeatmap[]>();
  if (error) {
    console.warn("fetchZoneHeatmap:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Fraud Queue (from v_fraud_queue view) ──────────────────

export async function fetchFraudQueue(): Promise<FraudQueueItem[]> {
  const { data, error } = await supabase
    .from("v_fraud_queue")
    .select("*")
    .returns<FraudQueueItem[]>();
  if (error) {
    console.warn("fetchFraudQueue:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Workers ────────────────────────────────────────────────

export async function fetchWorkers(
  limit = 100,
  offset = 0
): Promise<{ workers: GigWorker[]; count: number }> {
  const { data, error, count } = await supabase
    .from("gig_workers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<GigWorker[]>();
  if (error) {
    console.warn("fetchWorkers:", error.message);
    return { workers: [], count: 0 };
  }
  return { workers: data ?? [], count: count ?? 0 };
}

export async function fetchWorkerRiskView(): Promise<WorkerRisk[]> {
  const { data, error } = await supabase
    .from("v_worker_risk")
    .select("*")
    .limit(200)
    .returns<WorkerRisk[]>();
  if (error) {
    console.warn("fetchWorkerRiskView:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Claims ─────────────────────────────────────────────────

export async function fetchClaims(
  opts: { limit?: number; status?: string; workerId?: string } = {}
): Promise<Claim[]> {
  let query = supabase
    .from("claims")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.workerId) query = query.eq("worker_id", opts.workerId);
  const { data, error } = await query.returns<Claim[]>();
  if (error) {
    console.warn("fetchClaims:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Transactions ───────────────────────────────────────────

export async function fetchTransactions(
  workerId?: string,
  limit = 50
): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (workerId) query = query.eq("worker_id", workerId);
  const { data, error } = await query.returns<Transaction[]>();
  if (error) {
    console.warn("fetchTransactions:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Trigger Events ─────────────────────────────────────────

export async function fetchTriggerEvents(
  limit = 50
): Promise<TriggerEvent[]> {
  const { data, error } = await supabase
    .from("trigger_events")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(limit)
    .returns<TriggerEvent[]>();
  if (error) {
    console.warn("fetchTriggerEvents:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Weather Events ─────────────────────────────────────────

export async function fetchWeatherEvents(
  opts: { city?: string; zone?: string; extreme?: boolean; limit?: number } = {}
): Promise<WeatherEvent[]> {
  let query = supabase
    .from("weather_events")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.city) query = query.eq("city", opts.city);
  if (opts.zone) query = query.eq("zone", opts.zone);
  if (opts.extreme) query = query.eq("is_extreme", true);
  const { data, error } = await query.returns<WeatherEvent[]>();
  if (error) {
    console.warn("fetchWeatherEvents:", error.message);
    return [];
  }
  return data ?? [];
}

// ── Aggregate helpers ──────────────────────────────────────

export async function fetchClaimsByCity(): Promise<
  { city: string; count: number; total: number }[]
> {
  const { data, error } = await supabase
    .from("claims")
    .select("city, amount")
    .returns<{ city: string; amount: number }[]>();
  if (error) {
    console.warn("fetchClaimsByCity:", error.message);
    return [];
  }
  const map = new Map<string, { count: number; total: number }>();
  for (const row of data ?? []) {
    const entry = map.get(row.city) ?? { count: 0, total: 0 };
    entry.count++;
    entry.total += Number(row.amount);
    map.set(row.city, entry);
  }
  return Array.from(map, ([city, v]) => ({ city, ...v }));
}

export async function fetchWorkersByCity(): Promise<
  { city: string; count: number }[]
> {
  const { data, error } = await supabase
    .from("gig_workers")
    .select("city")
    .returns<{ city: string }[]>();
  if (error) {
    console.warn("fetchWorkersByCity:", error.message);
    return [];
  }
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.city, (map.get(row.city) ?? 0) + 1);
  }
  return Array.from(map, ([city, count]) => ({ city, count }));
}

export async function fetchClaimsByTriggerType(): Promise<
  { type: string; count: number }[]
> {
  const { data, error } = await supabase
    .from("claims")
    .select("trigger_type")
    .returns<{ trigger_type: string }[]>();
  if (error) {
    console.warn("fetchClaimsByTriggerType:", error.message);
    return [];
  }
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.trigger_type, (map.get(row.trigger_type) ?? 0) + 1);
  }
  return Array.from(map, ([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
