"use client";

import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  Shield,
  Zap,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Activity,
  ShieldAlert,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  fetchDashboardKPIs,
  fetchWorkersByCity,
  fetchClaimsByTriggerType,
  fetchRecentClaims,
} from "@/lib/data";
import type { DashboardKPIs } from "@/types/database";

// Fallback data for when Supabase is empty / unavailable
const FALLBACK_STATS = {
  active_workers: 15247,
  active_policies: 12891,
  total_claims: 1247,
  paid_claims: 1100,
  total_payouts: 4527800,
  flagged_claims: 23,
  auto_payouts: 89,
  avg_fraud_score: 0.12,
  extreme_events: 42,
} as DashboardKPIs;

const FALLBACK_CITY = [
  { name: "Mumbai", value: 4520, color: "#0d9488" },
  { name: "Delhi", value: 3810, color: "#6366f1" },
  { name: "Bangalore", value: 3200, color: "#0ea5e9" },
  { name: "Chennai", value: 2100, color: "#10b981" },
  { name: "Hyderabad", value: 1617, color: "#f59e0b" },
];

const CITY_COLORS: Record<string, string> = {
  Mumbai: "#0d9488",
  Delhi: "#6366f1",
  Bangalore: "#0ea5e9",
  Chennai: "#10b981",
  Hyderabad: "#f59e0b",
};

const TRIGGER_LABELS: Record<string, string> = {
  heavy_rain: "Heavy Rain",
  aqi: "AQI Spike",
  heatwave: "Heatwave",
  flood: "Flood",
  storm: "Storm",
  curfew: "Curfew",
};

const monthlyData = [
  { month: "Jul", claims: 780, payouts: 2850000, premiums: 3200000 },
  { month: "Aug", claims: 920, payouts: 3100000, premiums: 3350000 },
  { month: "Sep", claims: 1150, payouts: 3680000, premiums: 3400000 },
  { month: "Oct", claims: 980, payouts: 3250000, premiums: 3500000 },
  { month: "Nov", claims: 850, payouts: 2920000, premiums: 3550000 },
  { month: "Dec", claims: 1100, payouts: 3540000, premiums: 3600000 },
  { month: "Jan", claims: 1247, payouts: 4527800, premiums: 3750000 },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function AdminOverview() {
  const [kpis, setKpis] = useState<DashboardKPIs>(FALLBACK_STATS);
  const [cityDist, setCityDist] = useState(FALLBACK_CITY);
  const [topTriggers, setTopTriggers] = useState<{ type: string; count: number; pct: number }[]>([
    { type: "Heavy Rain", count: 342, pct: 38 },
    { type: "AQI Spike", count: 218, pct: 24 },
    { type: "Heatwave", count: 176, pct: 20 },
    { type: "Flood", count: 98, pct: 11 },
    { type: "Storm", count: 63, pct: 7 },
  ]);
  const [recentAlerts, setRecentAlerts] = useState<
    { id: number; type: string; message: string; time: string; severity: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    (async () => {
      const [kpiData, cityData, trigData, claimsData] = await Promise.all([
        fetchDashboardKPIs(),
        fetchWorkersByCity(),
        fetchClaimsByTriggerType(),
        fetchRecentClaims(10),
      ]);

      if (kpiData) setKpis(kpiData);

      if (cityData.length > 0) {
        setCityDist(
          cityData.map((c) => ({
            name: c.city,
            value: c.count,
            color: CITY_COLORS[c.city] ?? "#94a3b8",
          }))
        );
      }

      if (trigData.length > 0) {
        const total = trigData.reduce((s, t) => s + t.count, 0) || 1;
        setTopTriggers(
          trigData.slice(0, 5).map((t) => ({
            type: TRIGGER_LABELS[t.type] ?? t.type,
            count: t.count,
            pct: Math.round((t.count / total) * 100),
          }))
        );
      }

      if (claimsData.length > 0) {
        setRecentAlerts(
          claimsData.slice(0, 5).map((c, i) => ({
            id: i + 1,
            type: c.fraud_score > 0.5 ? "fraud" : "trigger",
            message:
              c.fraud_score > 0.5
                ? `Suspicious claim — ${c.worker_name} (score ${c.fraud_score.toFixed(2)})`
                : `${TRIGGER_LABELS[c.trigger_type] ?? c.trigger_type} trigger — ${c.city}, ${c.zone}`,
            time: timeAgo(c.created_at),
            severity:
              c.fraud_score > 0.8
                ? "critical"
                : c.fraud_score > 0.5
                ? "high"
                : "medium",
          }))
        );
      }

      // If no alerts came from DB, use static fallback
      if (claimsData.length === 0 && recentAlerts.length === 0) {
        setRecentAlerts([
          { id: 1, type: "trigger", message: "Heavy rain trigger — Mumbai, Andheri West", time: "2 min ago", severity: "high" },
          { id: 2, type: "fraud", message: "Suspicious claim pattern — Worker #8847", time: "15 min ago", severity: "critical" },
          { id: 3, type: "trigger", message: "AQI threshold breached — Delhi, Connaught Place", time: "28 min ago", severity: "medium" },
          { id: 4, type: "system", message: "ML model retrained — Risk v3.0 deployed", time: "1 hr ago", severity: "info" },
          { id: 5, type: "trigger", message: "Heatwave alert — Chennai, T. Nagar", time: "2 hr ago", severity: "high" },
        ]);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = [
    {
      label: "Total Workers",
      value: kpis.active_workers.toLocaleString(),
      change: "+12.3%",
      trend: "up" as const,
      icon: Users,
      color: "from-violet-500 to-purple-600",
    },
    {
      label: "Active Policies",
      value: kpis.active_policies.toLocaleString(),
      change: "+8.7%",
      trend: "up" as const,
      icon: Shield,
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "Total Claims",
      value: kpis.total_claims.toLocaleString(),
      change: "+23.1%",
      trend: "up" as const,
      icon: FileText,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Auto Payouts",
      value: kpis.auto_payouts.toLocaleString(),
      trend: "up" as const,
      change: `${kpis.paid_claims} paid`,
      icon: Zap,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "Total Payouts",
      value: formatCurrency(Number(kpis.total_payouts)),
      change: "+15.6%",
      trend: "up" as const,
      icon: IndianRupee,
      color: "from-pink-500 to-rose-500",
    },
    {
      label: "Fraud Flagged",
      value: kpis.flagged_claims.toLocaleString(),
      change: "-18.4%",
      trend: "down" as const,
      icon: ShieldAlert,
      color: "from-red-500 to-red-600",
    },
  ];
  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="h-9 w-9 bg-slate-200 rounded-lg mb-3" />
                <div className="h-5 bg-slate-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-slate-200 rounded w-2/3" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
              <div className="h-72 bg-slate-100 rounded" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="h-72 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="group hover:border-slate-300 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                >
                  <stat.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span
                  className={`text-xs font-medium flex items-center gap-1 ${
                    stat.trend === "up" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {stat.trend === "up" ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {stat.change}
                </span>
              </div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Premiums vs Payouts</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Last 7 months
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="premGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 12,
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                      }}
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), ""]}
                    />
                    <Area
                      type="monotone"
                      dataKey="premiums"
                      stroke="#0d9488"
                      fill="url(#premGrad)"
                      strokeWidth={2}
                      name="Premiums"
                    />
                    <Area
                      type="monotone"
                      dataKey="payouts"
                      stroke="#f59e0b"
                      fill="url(#payGrad)"
                      strokeWidth={2}
                      name="Payouts"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* City Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Worker Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 mb-4">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cityDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {cityDist.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 12,
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
            <div className="space-y-2">
              {cityDist.map((city) => (
                <div key={city.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: city.color }}
                    />
                    <span className="text-muted-foreground">{city.name}</span>
                  </div>
                  <span className="font-medium">{city.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-600 animate-pulse" />
                Live Alerts
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    alert.severity === "critical"
                      ? "bg-red-500 animate-pulse"
                      : alert.severity === "high"
                      ? "bg-amber-500"
                      : alert.severity === "medium"
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {alert.time}
                  </p>
                </div>
                <Badge
                  variant={
                    alert.severity === "critical"
                      ? "destructive"
                      : alert.severity === "high"
                      ? "warning"
                      : "secondary"
                  }
                  className="text-[10px] shrink-0"
                >
                  {alert.severity}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Trigger Types */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top Trigger Types</CardTitle>
              <Badge variant="secondary" className="text-xs">
                This month
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {topTriggers.map((trigger) => (
              <div key={trigger.type}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span>{trigger.type}</span>
                  <span className="text-muted-foreground">
                    {trigger.count} ({trigger.pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-700"
                    style={{ width: `${trigger.pct}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Triggers</span>
              <span className="font-bold text-lg">{topTriggers.reduce((s, t) => s + t.count, 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}
