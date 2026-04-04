"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Activity,
  MapPin,
  Calendar,
  Download,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { getAdminOpsKpis, getAdminSnapshot, type AdminOpsKpisResponse } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const fallbackIncidentTrend = [
  { day: "29 Mar", fire: 2, simulate: 5, payoutLakh: 1.6 },
  { day: "30 Mar", fire: 1, simulate: 4, payoutLakh: 0.9 },
  { day: "31 Mar", fire: 3, simulate: 6, payoutLakh: 2.2 },
  { day: "01 Apr", fire: 1, simulate: 7, payoutLakh: 1.1 },
  { day: "02 Apr", fire: 2, simulate: 6, payoutLakh: 1.8 },
  { day: "03 Apr", fire: 4, simulate: 8, payoutLakh: 2.6 },
  { day: "04 Apr", fire: 2, simulate: 5, payoutLakh: 1.3 },
];

const fallbackAppealTrend = [
  { day: "29 Mar", submitted: 4, resolved: 2, backlog: 9 },
  { day: "30 Mar", submitted: 3, resolved: 4, backlog: 8 },
  { day: "31 Mar", submitted: 5, resolved: 3, backlog: 10 },
  { day: "01 Apr", submitted: 4, resolved: 5, backlog: 9 },
  { day: "02 Apr", submitted: 6, resolved: 4, backlog: 11 },
  { day: "03 Apr", submitted: 5, resolved: 6, backlog: 10 },
  { day: "04 Apr", submitted: 3, resolved: 4, backlog: 9 },
];

const fallbackCitySnapshot = [
  { city: "Mumbai", claims: 245, payouts: 980000, avg_claim: 4000, rejection_rate_pct: 8.2 },
  { city: "Delhi", claims: 221, payouts: 890000, avg_claim: 4027, rejection_rate_pct: 11.0 },
  { city: "Bangalore", claims: 164, payouts: 620000, avg_claim: 3780, rejection_rate_pct: 7.1 },
  { city: "Chennai", claims: 136, payouts: 480000, avg_claim: 3529, rejection_rate_pct: 9.5 },
  { city: "Hyderabad", claims: 101, payouts: 350000, avg_claim: 3465, rejection_rate_pct: 6.8 },
];

const radarData = [
  { metric: "User Growth", value: 85 },
  { metric: "Claim Speed", value: 92 },
  { metric: "Fraud Detection", value: 88 },
  { metric: "Coverage Ratio", value: 78 },
  { metric: "Premium Revenue", value: 72 },
  { metric: "User Retention", value: 90 },
];

const CHART_DURATION_FAST = 580;
const CHART_DURATION_MEDIUM = 700;
const CHART_DURATION_SLOW = 820;

const platformBreakdown = [
  { platform: "Swiggy", workers: 4200, share: 27.5, color: "#f97316" },
  { platform: "Zomato", workers: 3800, share: 24.9, color: "#ef4444" },
  { platform: "Amazon", workers: 2900, share: 19.0, color: "#3b82f6" },
  { platform: "Zepto", workers: 1800, share: 11.8, color: "#a855f7" },
  { platform: "Blinkit", workers: 1500, share: 9.8, color: "#eab308" },
  { platform: "Dunzo", workers: 1047, share: 6.9, color: "#10b981" },
];

const platformColorMap: Record<string, string> = {
  Swiggy: "#f97316",
  Zomato: "#ef4444",
  Amazon: "#3b82f6",
  Zepto: "#a855f7",
  Blinkit: "#eab308",
  Dunzo: "#10b981",
};

const fallbackKpis = [
  { label: "Loss Ratio", value: "78.2%", target: "< 85%", status: "good" },
  { label: "Avg. Claim Time", value: "38s", target: "< 60s", status: "good" },
  { label: "Auto-Trigger Rate", value: "92%", target: "> 85%", status: "good" },
  { label: "Fraud Detection Rate", value: "96.8%", target: "> 95%", status: "good" },
  { label: "User Retention (30d)", value: "89.2%", target: "> 80%", status: "good" },
  { label: "Premium Growth MoM", value: "+12.3%", target: "> 5%", status: "good" },
];

type WindowDays = 7 | 14 | 30;

function sparklinePoints(values: number[]): string {
  if (values.length === 0) return "";

  const safeValues = values.map((value) => (Number.isFinite(value) ? value : 0));
  const minValue = Math.min(...safeValues);
  const maxValue = Math.max(...safeValues);
  const range = maxValue - minValue || 1;
  const lastIndex = Math.max(safeValues.length - 1, 1);

  return safeValues
    .map((value, index) => {
      const x = (index / lastIndex) * 100;
      const y = 30 - ((value - minValue) / range) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function AdminAnalytics() {
  const [chartsReady, setChartsReady] = useState(false);
  const [windowDays, setWindowDays] = useState<WindowDays>(14);
  const [opsKpis, setOpsKpis] = useState<AdminOpsKpisResponse | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [snapshotExporting, setSnapshotExporting] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadOpsKpis = useCallback(async () => {
    try {
      const data = await getAdminOpsKpis(windowDays);
      setOpsKpis(data);
      setLastSyncAt(data.generated_at);
    } catch {
      // Keep static analytics values as fallback when live API is unavailable.
    }
  }, [windowDays]);

  const scheduleKpiRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadOpsKpis();
    }, 600);
  }, [loadOpsKpis]);

  useEffect(() => {
    setChartsReady(true);
    void loadOpsKpis();
    const intervalId = window.setInterval(() => {
      void loadOpsKpis();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadOpsKpis]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-analytics-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_runs" },
        scheduleKpiRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claim_appeals" },
        scheduleKpiRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fraud_logs" },
        scheduleKpiRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        scheduleKpiRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gig_workers" },
        scheduleKpiRefresh
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [scheduleKpiRefresh]);

  const handleExportSnapshot = useCallback(async () => {
    if (snapshotExporting) return;

    setSnapshotExporting(true);
    setSnapshotError(null);
    try {
      const snapshot = await getAdminSnapshot(windowDays, 10, 10);
      const fileStamp = snapshot.generated_at
        .replace(/[:]/g, "-")
        .replace(/\.\d+/, "");
      const fileName = `gigcover-admin-snapshot-${fileStamp}.json`;
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setSnapshotError(
        error instanceof Error ? error.message : "Unable to export admin snapshot right now."
      );
    } finally {
      setSnapshotExporting(false);
    }
  }, [snapshotExporting, windowDays]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadOpsKpis();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadOpsKpis]);

  const liveKpis = opsKpis
    ? [
        {
          label: "Payout Velocity",
          value: `${formatCurrency(opsKpis.headline.payout_velocity_per_hour)}/hr`,
          target: "> ₹10,000/hr",
          status: "good",
        },
        {
          label: "Open Appeals",
          value: String(opsKpis.headline.open_appeals),
          target: "< 15",
          status: opsKpis.headline.open_appeals <= 15 ? "good" : "warn",
        },
        {
          label: "Appeal Turnaround",
          value:
            opsKpis.headline.avg_appeal_turnaround_hours === null
              ? "--"
              : `${opsKpis.headline.avg_appeal_turnaround_hours.toFixed(1)}h`,
          target: "< 24h",
          status:
            opsKpis.headline.avg_appeal_turnaround_hours !== null &&
            opsKpis.headline.avg_appeal_turnaround_hours <= 24
              ? "good"
              : "warn",
        },
        {
          label: "Fraud Block Rate",
          value:
            opsKpis.headline.fraud_block_rate_pct === null
              ? "--"
              : `${opsKpis.headline.fraud_block_rate_pct.toFixed(1)}%`,
          target: "> 60%",
          status:
            opsKpis.headline.fraud_block_rate_pct !== null &&
            opsKpis.headline.fraud_block_rate_pct >= 60
              ? "good"
              : "warn",
        },
        {
          label: "Incident Latency",
          value:
            opsKpis.headline.avg_incident_latency_ms === null
              ? "--"
              : `${Math.round(opsKpis.headline.avg_incident_latency_ms)}ms`,
          target: "< 1200ms",
          status:
            opsKpis.headline.avg_incident_latency_ms !== null &&
            opsKpis.headline.avg_incident_latency_ms <= 1200
              ? "good"
              : "warn",
        },
        {
          label: "Workers Protected (24h)",
          value: String(opsKpis.headline.workers_protected_24h),
          target: "> 500",
          status: opsKpis.headline.workers_protected_24h >= 500 ? "good" : "warn",
        },
      ]
    : fallbackKpis;

  const hasLiveOps = Boolean(opsKpis);

  const incidentTrend =
    hasLiveOps
      ? (opsKpis?.incident_series ?? []).map((point) => ({
          day: new Date(point.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          fire: point.fire,
          simulate: point.simulate,
          payoutLakh: Number((point.payout / 100000).toFixed(2)),
        }))
      : fallbackIncidentTrend;

  const cityRows =
    hasLiveOps
      ? (opsKpis?.city_snapshot ?? [])
      : fallbackCitySnapshot;

  const performanceRadar = opsKpis
    ? [
        {
          metric: "Appeal SLA",
          value: Math.round(opsKpis.headline.appeal_resolution_24h_pct ?? 0),
        },
        {
          metric: "Fraud Quality",
          value: Math.round(opsKpis.headline.fraud_block_rate_pct ?? 0),
        },
        {
          metric: "Incident Speed",
          value:
            opsKpis.headline.avg_incident_latency_ms === null
              ? 0
              : Math.max(0, 100 - Math.round(opsKpis.headline.avg_incident_latency_ms / 20)),
        },
        {
          metric: "Fire Readiness",
          value: Math.min(100, opsKpis.headline.fire_drills * 10),
        },
        {
          metric: "Simulation Depth",
          value: Math.min(100, opsKpis.headline.simulations * 5),
        },
        {
          metric: "Protection Reach",
          value: Math.min(100, Math.round(opsKpis.headline.workers_protected_24h / 20)),
        },
      ]
    : radarData;

  const appealTrend =
    hasLiveOps
      ? (() => {
          const appealSeries = opsKpis?.appeal_series ?? [];
          if (appealSeries.length === 0) return [];
          const totalDelta = appealSeries.reduce(
            (sum, point) => sum + point.submitted - point.resolved,
            0
          );
          let backlog = Math.max(0, (opsKpis?.headline.open_appeals ?? 0) - totalDelta);
          return appealSeries.map((point) => {
            backlog = Math.max(0, backlog + point.submitted - point.resolved);
            return {
              day: new Date(point.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
              submitted: point.submitted,
              resolved: point.resolved,
              backlog,
            };
          });
        })()
      : fallbackAppealTrend;

  const platformRows =
    hasLiveOps
      ? (opsKpis?.platform_snapshot ?? []).map((item) => ({
          ...item,
          color: platformColorMap[item.platform] ?? "#0ea5e9",
        }))
      : platformBreakdown;

  const kpiSparklines: Record<string, number[]> = {
    "Payout Velocity": incidentTrend.map((point) => point.payoutLakh),
    "Open Appeals": appealTrend.map((point) => point.backlog),
    "Appeal Turnaround": appealTrend.map((point) => point.resolved),
    "Fraud Block Rate": performanceRadar.map((point) => point.value),
    "Incident Latency": incidentTrend.map((point) => point.fire + point.simulate),
    "Workers Protected (24h)": incidentTrend.map((point) => point.fire * 40 + point.simulate * 20),
  };

  const fallbackSparkline =
    incidentTrend.length > 0
      ? incidentTrend.map((point) => point.fire + point.simulate)
      : [0, 1, 0, 1];

  const kpiCards = liveKpis.map((kpi) => ({
    ...kpi,
    sparkline: kpiSparklines[kpi.label] ?? fallbackSparkline,
    tone: kpi.status === "warn" ? "warn" : "good",
  }));

  const opsNarrative = opsKpis
    ? [
        `In the last 24 hours, ${formatCurrency(opsKpis.headline.payout_total_24h)} was processed across ${opsKpis.headline.workers_protected_24h} workers.`,
        `Appeals queue stands at ${opsKpis.headline.open_appeals} with ${opsKpis.headline.appeal_resolution_24h_pct?.toFixed(1) ?? "--"}% resolved within 24 hours.`,
        `Fraud control blocked ${opsKpis.headline.fraud_block_rate_pct?.toFixed(1) ?? "--"}% of resolved suspicious claims while running ${opsKpis.headline.fire_drills} fire drills.`,
      ]
    : [
        "Live operations pulse will appear once the admin KPI endpoint returns data.",
        "Use Export Snapshot for demo evidence and audit-friendly reporting.",
        "Window controls can be used to compare 7, 14, and 30-day behavior.",
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Platform performance metrics and business intelligence
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                  windowDays === days
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => setWindowDays(days as WindowDays)}
              >
                {days}d
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void handleManualRefresh();
            }}
            disabled={manualRefreshing}
          >
            <RotateCw className={`w-3.5 h-3.5 ${manualRefreshing ? "animate-spin" : ""}`} />
            {manualRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void handleExportSnapshot();
            }}
            disabled={snapshotExporting}
          >
            <Download className="w-3.5 h-3.5" />
            {snapshotExporting ? "Exporting..." : "Export Snapshot"}
          </Button>
          <Badge variant="secondary" className="text-xs gap-1.5">
            <Calendar className="w-3 h-3" />
            {windowDays} day window
          </Badge>
          <Badge variant={hasLiveOps ? "success" : "warning"} className="text-xs">
            {hasLiveOps ? "Live backend" : "Demo fallback"}
          </Badge>
          {lastSyncAt && (
            <Badge variant="outline" className="text-xs">
              Live sync {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      {snapshotError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {snapshotError}
        </div>
      )}

      <Card className="border-teal-100 bg-gradient-to-r from-teal-50 via-white to-amber-50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-700" />
                <p className="text-sm font-semibold">Operational Pulse</p>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Activity className="w-3 h-3" />
                Live Narrative
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {opsNarrative.map((line) => (
                <p
                  key={line}
                  className="text-xs leading-relaxed rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-slate-700"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map((kpi) => (
          <Card
            key={kpi.label}
            className={
              kpi.tone === "warn"
                ? "border-amber-200/80 bg-gradient-to-b from-amber-50/60 to-white"
                : "border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white"
            }
          >
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {kpi.label}
              </p>
              <p className="text-lg font-bold">{kpi.value}</p>
              <p
                className={`text-[10px] flex items-center gap-1 mt-0.5 ${
                  kpi.tone === "warn" ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                Target: {kpi.target}
              </p>
              <div className="mt-1.5 h-8 w-full">
                <svg viewBox="0 0 100 32" className="h-8 w-full" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke={kpi.tone === "warn" ? "#d97706" : "#0f766e"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklinePoints(kpi.sparkline)}
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Incident Activity (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {chartsReady ? (
                incidentTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={incidentTrend}>
                      <defs>
                        <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        formatter={(value: number | undefined, name: string | undefined) => {
                          const seriesName = name ?? "";
                          if (seriesName === "Payout (Lakh)") return [`₹${(value ?? 0).toFixed(2)}L`, seriesName];
                          return [value ?? 0, seriesName];
                        }}
                        contentStyle={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="simulate"
                        stroke="#0d9488"
                        fill="url(#simGrad)"
                        strokeWidth={2}
                        name="Simulations"
                        isAnimationActive={chartsReady}
                        animationBegin={0}
                        animationDuration={CHART_DURATION_FAST}
                        animationEasing="ease-out"
                      />
                      <Area
                        type="monotone"
                        dataKey="fire"
                        stroke="#3b82f6"
                        fill="url(#fireGrad)"
                        strokeWidth={2}
                        name="Fire Drills"
                        isAnimationActive={chartsReady}
                        animationBegin={60}
                        animationDuration={CHART_DURATION_MEDIUM}
                        animationEasing="ease-out"
                      />
                      <Area
                        type="monotone"
                        dataKey="payoutLakh"
                        stroke="#f59e0b"
                        fill="url(#payGrad)"
                        strokeWidth={2}
                        name="Payout (Lakh)"
                        isAnimationActive={chartsReady}
                        animationBegin={120}
                        animationDuration={CHART_DURATION_SLOW}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-center px-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">No incident trend in selected window</p>
                      <p className="text-xs text-muted-foreground mt-1">Run a drill or widen the window to populate this chart.</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
            {opsKpis && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payouts (24h)</p>
                  <p className="text-sm font-semibold">{formatCurrency(opsKpis.headline.payout_total_24h)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fire Drills</p>
                  <p className="text-sm font-semibold">{opsKpis.headline.fire_drills}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Simulations</p>
                  <p className="text-sm font-semibold">{opsKpis.headline.simulations}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={performanceRadar}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="#0d9488"
                      fill="#0d9488"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      isAnimationActive={chartsReady}
                      animationBegin={80}
                      animationDuration={CHART_DURATION_MEDIUM}
                      animationEasing="ease-out"
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* City Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">City Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">City</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Claims</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Payouts</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Avg Claim</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Reject Rate</th>
                </tr>
              </thead>
              <tbody>
                {cityRows.length > 0 ? (
                  cityRows.map((city) => (
                    <tr key={city.city} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{city.city}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{city.claims.toLocaleString()}</td>
                      <td className="p-3 text-sm text-amber-600">{formatCurrency(city.payouts)}</td>
                      <td className="p-3 text-sm text-emerald-600">{formatCurrency(city.avg_claim)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                city.rejection_rate_pct > 12
                                  ? "bg-red-500"
                                  : city.rejection_rate_pct > 8
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(city.rejection_rate_pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs">{city.rejection_rate_pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      No city-level records available for this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appeals Throughput</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {chartsReady ? (
              appealTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={appealTrend}>
                    <defs>
                      <linearGradient id="apSubGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="apResGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="apBackGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      stroke="#3b82f6"
                      fill="url(#apSubGrad)"
                      strokeWidth={2}
                      name="Submitted"
                      isAnimationActive={chartsReady}
                      animationBegin={0}
                      animationDuration={CHART_DURATION_FAST}
                      animationEasing="ease-out"
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      stroke="#10b981"
                      fill="url(#apResGrad)"
                      strokeWidth={2}
                      name="Resolved"
                      isAnimationActive={chartsReady}
                      animationBegin={60}
                      animationDuration={CHART_DURATION_MEDIUM}
                      animationEasing="ease-out"
                    />
                    <Area
                      type="monotone"
                      dataKey="backlog"
                      stroke="#f59e0b"
                      fill="url(#apBackGrad)"
                      strokeWidth={2}
                      name="Backlog"
                      isAnimationActive={chartsReady}
                      animationBegin={120}
                      animationDuration={CHART_DURATION_SLOW}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-center px-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">No appeal throughput in selected window</p>
                    <p className="text-xs text-muted-foreground mt-1">Appeals activity will render here as soon as records arrive.</p>
                  </div>
                </div>
              )
            ) : (
              <div className="h-full w-full rounded-lg bg-slate-100" />
            )}
          </div>

          {opsKpis && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Open Appeals</p>
                <p className="text-sm font-semibold">{opsKpis.headline.open_appeals}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Resolved &lt; 24h</p>
                <p className="text-sm font-semibold">
                  {opsKpis.headline.appeal_resolution_24h_pct === null
                    ? "--"
                    : `${opsKpis.headline.appeal_resolution_24h_pct.toFixed(1)}%`}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Turnaround</p>
                <p className="text-sm font-semibold">
                  {opsKpis.headline.avg_appeal_turnaround_hours === null
                    ? "--"
                    : `${opsKpis.headline.avg_appeal_turnaround_hours.toFixed(1)}h`}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {platformRows.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {platformRows.map((platform) => (
                <div
                  key={platform.platform}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center"
                >
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: platform.color }}
                  >
                    {platform.platform[0]}
                  </div>
                  <p className="text-sm font-medium">{platform.platform}</p>
                  <p className="text-lg font-bold mt-1">{platform.workers.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{platform.share.toFixed(1)}% share</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-800">No platform split available</p>
              <p className="text-xs text-muted-foreground mt-1">Platform share cards will appear once worker platform data is ingested.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
