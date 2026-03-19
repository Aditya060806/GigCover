"use client";

import { useEffect, useState } from "react";

import {
  Zap,
  MapPin,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const weeklyGrowth = [
  { week: "W1", workers: 12800, policies: 10500, claims: 680 },
  { week: "W2", workers: 13200, policies: 10900, claims: 750 },
  { week: "W3", workers: 13900, policies: 11500, claims: 890 },
  { week: "W4", workers: 14500, policies: 12100, claims: 920 },
  { week: "W5", workers: 14900, policies: 12500, claims: 1050 },
  { week: "W6", workers: 15247, policies: 12891, claims: 1247 },
];

const cityPerformance = [
  { city: "Mumbai", premiums: 1250000, payouts: 980000, ratio: 0.78, workers: 4520, triggers: 245 },
  { city: "Delhi", premiums: 1050000, payouts: 890000, ratio: 0.85, workers: 3810, triggers: 312 },
  { city: "Bangalore", premiums: 850000, payouts: 620000, ratio: 0.73, workers: 3200, triggers: 156 },
  { city: "Chennai", premiums: 620000, payouts: 480000, ratio: 0.77, workers: 2100, triggers: 134 },
  { city: "Hyderabad", premiums: 480000, payouts: 350000, ratio: 0.73, workers: 1617, triggers: 98 },
];

const radarData = [
  { metric: "User Growth", value: 85 },
  { metric: "Claim Speed", value: 92 },
  { metric: "Fraud Detection", value: 88 },
  { metric: "Coverage Ratio", value: 78 },
  { metric: "Premium Revenue", value: 72 },
  { metric: "User Retention", value: 90 },
];

const platformBreakdown = [
  { platform: "Swiggy", workers: 4200, share: 27.5, color: "#f97316" },
  { platform: "Zomato", workers: 3800, share: 24.9, color: "#ef4444" },
  { platform: "Amazon", workers: 2900, share: 19.0, color: "#3b82f6" },
  { platform: "Zepto", workers: 1800, share: 11.8, color: "#a855f7" },
  { platform: "Blinkit", workers: 1500, share: 9.8, color: "#eab308" },
  { platform: "Dunzo", workers: 1047, share: 6.9, color: "#10b981" },
];

const kpis = [
  { label: "Loss Ratio", value: "78.2%", target: "< 85%", status: "good" },
  { label: "Avg. Claim Time", value: "38s", target: "< 60s", status: "good" },
  { label: "Auto-Trigger Rate", value: "92%", target: "> 85%", status: "good" },
  { label: "Fraud Detection Rate", value: "96.8%", target: "> 95%", status: "good" },
  { label: "User Retention (30d)", value: "89.2%", target: "> 80%", status: "good" },
  { label: "Premium Growth MoM", value: "+12.3%", target: "> 5%", status: "good" },
];

export default function AdminAnalytics() {
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Platform performance metrics and business intelligence
          </p>
        </div>
        <Badge variant="secondary" className="text-xs gap-1.5">
          <Calendar className="w-3 h-3" />
          Last 6 weeks
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {kpi.label}
              </p>
              <p className="text-lg font-bold">{kpi.value}</p>
              <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                Target: {kpi.target}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Platform Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyGrowth}>
                    <defs>
                      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
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
                      dataKey="workers"
                      stroke="#0d9488"
                      fill="url(#wGrad)"
                      strokeWidth={2}
                      name="Workers"
                    />
                    <Area
                      type="monotone"
                      dataKey="policies"
                      stroke="#3b82f6"
                      fill="url(#pGrad)"
                      strokeWidth={2}
                      name="Policies"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
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
                  <RadarChart data={radarData}>
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
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Workers</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Premiums</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Payouts</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Loss Ratio</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Triggers</th>
                </tr>
              </thead>
              <tbody>
                {cityPerformance.map((city) => (
                  <tr key={city.city} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{city.city}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm">{city.workers.toLocaleString()}</td>
                    <td className="p-3 text-sm text-emerald-600">{formatCurrency(city.premiums)}</td>
                    <td className="p-3 text-sm text-amber-600">{formatCurrency(city.payouts)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              city.ratio > 0.85 ? "bg-red-500" : city.ratio > 0.75 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${city.ratio * 100}%` }}
                          />
                        </div>
                        <span className="text-xs">{(city.ratio * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="w-2.5 h-2.5 mr-1" />
                        {city.triggers}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {platformBreakdown.map((platform) => (
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
                <p className="text-xs text-muted-foreground">{platform.share}% share</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
