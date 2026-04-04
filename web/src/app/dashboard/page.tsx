"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Shield,
  TrendingUp,
  Wallet,
  CloudRain,
  Thermometer,
  Wind,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Eye,
  RotateCw,
  Loader2,
  Activity,
  Clock3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { GigWorker, Claim, WeatherEvent } from "@/types/database";

const TRIGGER_LABELS: Record<string, string> = {
  heavy_rain: "Heavy Rain",
  aqi: "AQI Hazardous",
  heatwave: "Heatwave",
  flood: "Flood",
  storm: "Severe Storm",
  curfew: "Curfew",
};

const TRIGGER_ICONS: Record<string, string> = {
  heavy_rain: "🌧️",
  aqi: "😷",
  heatwave: "🔥",
  flood: "🌊",
  storm: "🌪️",
  curfew: "🚨",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

interface DashboardStats {
  walletBalance: number;
  incomeProtected: number;
  totalPayouts: number;
  claimsThisMonth: number;
  autoTriggered: number;
  workerName: string;
  zone: string;
  city: string;
  plan: string;
  maxPayout: number;
  weeklyPremium: number;
}

interface ClaimItem {
  id: string;
  type: string;
  icon: string;
  amount: number;
  status: string;
  time: string;
  triggerValue: string;
}

const DEFAULT_STATS: DashboardStats = {
  walletBalance: 2450,
  incomeProtected: 5600,
  totalPayouts: 12800,
  claimsThisMonth: 7,
  autoTriggered: 3,
  workerName: "Ravi",
  zone: "Andheri West",
  city: "Mumbai",
  plan: "Standard Shield",
  maxPayout: 1500,
  weeklyPremium: 25,
};

const earningsData = [
  { day: "Mon", actual: 780, protected: 800 },
  { day: "Tue", actual: 650, protected: 800 },
  { day: "Wed", actual: 420, protected: 800 },
  { day: "Thu", actual: 810, protected: 810 },
  { day: "Fri", actual: 300, protected: 800 },
  { day: "Sat", actual: 880, protected: 880 },
  { day: "Sun", actual: 750, protected: 800 },
];

const CHART_DURATION_FAST = 560;
const CHART_DURATION_MEDIUM = 700;

const statusColors: Record<string, string> = {
  paid: "success",
  processing: "warning",
  triggered: "default",
  rejected: "destructive",
  flagged: "destructive",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [recentClaims, setRecentClaims] = useState<ClaimItem[]>([
    { id: "CLM-001", type: "Heavy Rain", icon: "🌧️", amount: 400, status: "paid", time: "2 hours ago", triggerValue: "42mm/hr" },
    { id: "CLM-002", type: "AQI Hazardous", icon: "😷", amount: 240, status: "paid", time: "Yesterday", triggerValue: "AQI 356" },
    { id: "CLM-003", type: "Severe Storm", icon: "🌪️", amount: 320, status: "processing", time: "2 days ago", triggerValue: "72 km/h" },
  ]);
  const [weatherAlerts, setWeatherAlerts] = useState([
    { type: "Rain Expected", icon: CloudRain, value: "25mm/hr forecast", severity: "moderate" as const },
    { type: "AQI Rising", icon: Wind, value: "AQI 245 → 280", severity: "warning" as const },
    { type: "Temperature", icon: Thermometer, value: "34°C — Normal", severity: "safe" as const },
  ]);
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const { data: workers } = await supabase
        .from("gig_workers")
        .select("*")
        .eq("status", "active")
        .limit(1)
        .returns<GigWorker[]>();

      if (workers && workers.length > 0) {
        const worker = workers[0];
        const firstName = worker.name.split(" ")[0];

        const [claimsResult, weatherResult] = await Promise.all([
          supabase
            .from("claims")
            .select("*")
            .eq("worker_id", worker.id)
            .order("created_at", { ascending: false })
            .limit(5)
            .returns<Claim[]>(),
          supabase
            .from("weather_events")
            .select("*")
            .eq("city", worker.city)
            .eq("zone", worker.zone)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .returns<WeatherEvent[]>(),
        ]);

        const claims = claimsResult.data;
        const weather = weatherResult.data;
        const thisMonth = claims?.length ?? 0;
        const autoCount = claims?.filter((claim) => claim.auto_triggered).length ?? 0;

        setStats({
          walletBalance: Number(worker.total_earnings) - Number(worker.total_payouts),
          incomeProtected: Number(worker.max_payout) * thisMonth,
          totalPayouts: Number(worker.total_payouts),
          claimsThisMonth: thisMonth,
          autoTriggered: autoCount,
          workerName: firstName,
          zone: worker.zone,
          city: worker.city,
          plan: worker.plan.charAt(0).toUpperCase() + worker.plan.slice(1) + " Shield",
          maxPayout: Number(worker.max_payout),
          weeklyPremium: Number(worker.weekly_premium),
        });

        if (claims && claims.length > 0) {
          setRecentClaims(
            claims.slice(0, 3).map((claim) => ({
              id: claim.claim_id,
              type: TRIGGER_LABELS[claim.trigger_type] ?? claim.trigger_type,
              icon: TRIGGER_ICONS[claim.trigger_type] ?? "⚡",
              amount: Number(claim.amount),
              status: claim.status,
              time: timeAgo(claim.created_at),
              triggerValue: claim.trigger_type,
            }))
          );
        }

        if (weather && weather.length > 0) {
          const weatherEvent = weather[0];
          setWeatherAlerts([
            {
              type: weatherEvent.rainfall_mm > 15 ? "Heavy Rain" : "Rainfall",
              icon: CloudRain,
              value: `${weatherEvent.rainfall_mm.toFixed(1)}mm/hr`,
              severity: weatherEvent.rainfall_mm > 30 ? "warning" as const : weatherEvent.rainfall_mm > 15 ? "moderate" as const : "safe" as const,
            },
            {
              type: "Air Quality",
              icon: Wind,
              value: `AQI ${weatherEvent.aqi}`,
              severity: weatherEvent.aqi > 300 ? "warning" as const : weatherEvent.aqi > 200 ? "moderate" as const : "safe" as const,
            },
            {
              type: "Temperature",
              icon: Thermometer,
              value: `${weatherEvent.temp_c.toFixed(1)}°C`,
              severity: weatherEvent.temp_c > 42 ? "warning" as const : weatherEvent.temp_c > 38 ? "moderate" as const : "safe" as const,
            },
          ]);
        }
      }

      setLastSyncAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadDashboard();
    }, 600);
  }, [loadDashboard]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    void loadDashboard();
    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, 25000);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard]);

  useEffect(() => {
    const channel = supabase
      .channel("worker-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weather_events" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gig_workers" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        scheduleRealtimeRefresh
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [scheduleRealtimeRefresh]);

  const protectionLevel =
    stats.claimsThisMonth > 0
      ? Math.min(95, Math.round((stats.autoTriggered / stats.claimsThisMonth) * 100 + 35))
      : 75;

  const nextPremiumDate = useMemo(
    () =>
      new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
    []
  );

  const hasElevatedRisk = weatherAlerts.some((alert) => alert.severity === "warning");

  const missionPulse = [
    `${stats.claimsThisMonth} claims were recorded this cycle, with ${stats.autoTriggered} auto-triggered payouts processed without manual intervention.`,
    `${formatCurrency(stats.totalPayouts)} has been protected in ${stats.zone}, ${stats.city}, while wallet reserve stands at ${formatCurrency(stats.walletBalance)}.`,
    `Local weather posture is ${hasElevatedRisk ? "elevated" : "stable"} and mission protection currently tracks at ${protectionLevel}%.`,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Worker Mission Console</h2>
          <p className="text-sm text-muted-foreground">
            Real-time protection health, weather exposure, and payout readiness
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void handleManualRefresh();
            }}
            disabled={manualRefreshing}
          >
            {manualRefreshing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing
              </>
            ) : (
              <>
                <RotateCw className="w-3.5 h-3.5" />
                Refresh
              </>
            )}
          </Button>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Mission Live
          </Badge>
          {lastSyncAt && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Clock3 className="w-3 h-3" />
              Synced {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white/80 p-2 text-teal-700 border border-teal-200">
            <Activity className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-900">Mission Pulse</p>
            {missionPulse.map((line) => (
              <p key={line} className="text-xs text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-xl bg-white border border-slate-200 p-6">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="h-10 w-10 bg-slate-200 rounded-lg mb-3" />
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-slate-200 rounded w-2/3" />
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
              <div className="h-[280px] bg-slate-100 rounded" />
            </div>
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="h-32 bg-slate-100 rounded-full w-32 mx-auto" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Welcome banner */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-50 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Good evening, {stats.workerName}! 👋</h2>
            <p className="text-muted-foreground">
              Your zone <span className="text-foreground font-medium">{stats.zone}, {stats.city}</span> is
              currently at <span className="ml-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200">Moderate Risk</span>
            </p>
          </div>
          <Link href="/dashboard/map">
            <Button variant="outline" size="sm" className="shrink-0">
              <Eye className="w-4 h-4 mr-2" />
              View Risk Map
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Wallet Balance"
          value={`₹${stats.walletBalance.toLocaleString()}`}
          change="+₹400 today"
          changeType="positive"
          icon={Wallet}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
        />
        <StatsCard
          title="Income Protected"
          value={`₹${stats.incomeProtected.toLocaleString()}`}
          change="This week"
          changeType="neutral"
          icon={Shield}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Total Payouts"
          value={`₹${stats.totalPayouts.toLocaleString()}`}
          change="+24% vs last month"
          changeType="positive"
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Claims This Month"
          value={String(stats.claimsThisMonth)}
          change={`${stats.autoTriggered} auto-triggered`}
          changeType="neutral"
          icon={Zap}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Earnings Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Weekly Earnings Protection</CardTitle>
            <Badge variant="outline" className="text-xs">This Week</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={earningsData}>
                    <defs>
                      <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="protectedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.75rem",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                        color: "#0f172a",
                      }}
                      formatter={(value: number | undefined) => [`₹${value ?? 0}`, ""]}
                    />
                    <Area
                      type="monotone"
                      dataKey="protected"
                      stroke="#0d9488"
                      fill="url(#protectedGrad)"
                      strokeWidth={2}
                      name="Protected"
                      isAnimationActive={chartsReady}
                      animationBegin={0}
                      animationDuration={CHART_DURATION_FAST}
                      animationEasing="ease-out"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#6366f1"
                      fill="url(#actualGrad)"
                      strokeWidth={2}
                      name="Actual"
                      isAnimationActive={chartsReady}
                      animationBegin={80}
                      animationDuration={CHART_DURATION_MEDIUM}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-indigo-500 rounded" />
                <span className="text-xs text-muted-foreground">Actual Earnings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-teal-600 rounded" />
                <span className="text-xs text-muted-foreground">Protected Level</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weather alerts + protection meter */}
        <div className="space-y-6">
          {/* Income Protection Meter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Protection Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative flex items-center justify-center mb-4">
                <div className="w-32 h-32 rounded-full border-[6px] border-slate-100 flex items-center justify-center relative">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${protectionLevel * 2.76} ${100 * 2.76}`}
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{protectionLevel}%</p>
                    <p className="text-[10px] text-muted-foreground">Protected</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="text-foreground font-medium">{formatCurrency(stats.maxPayout)}/event</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Next Premium</span>
                  <span className="text-foreground font-medium">{formatCurrency(stats.weeklyPremium)} on {nextPremiumDate}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge variant="default" className="text-[10px]">{stats.plan}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weather Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Weather — {stats.zone}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weatherAlerts.map((alert) => (
                <div
                  key={alert.type}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <alert.icon className={`w-4 h-4 ${
                    alert.severity === "safe" ? "text-emerald-600" :
                    alert.severity === "warning" ? "text-amber-600" : "text-blue-600"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{alert.type}</p>
                    <p className="text-xs text-muted-foreground">{alert.value}</p>
                  </div>
                  <Badge
                    variant={
                      alert.severity === "safe"
                        ? "success"
                        : alert.severity === "warning"
                        ? "warning"
                        : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Claims */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent Claims</CardTitle>
          <Link href="/dashboard/claims">
            <Button variant="ghost" size="sm" className="text-xs">
              View All
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentClaims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors"
              >
                <div className="text-2xl">{claim.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{claim.type}</p>
                    <Badge
                      variant={statusColors[claim.status] as "success" | "warning" | "default" | "destructive"}
                      className="text-[10px]"
                    >
                      {claim.status === "paid" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {claim.status === "processing" && <Clock className="w-3 h-3 mr-1" />}
                      {claim.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {claim.id} &bull; Triggered at {claim.triggerValue} &bull; {claim.time}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600">
                    +{formatCurrency(claim.amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Auto-triggered</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}

function StatsCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="hover:border-slate-300 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {changeType === "positive" && (
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          )}
          {changeType === "negative" && (
            <ArrowDownRight className="w-4 h-4 text-red-600" />
          )}
        </div>
        <p className="text-2xl font-bold text-foreground mb-0.5">{value}</p>
        <p
          className={`text-xs ${
            changeType === "positive"
              ? "text-emerald-600"
              : changeType === "negative"
              ? "text-red-600"
              : "text-muted-foreground"
          }`}
        >
          {change}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}
