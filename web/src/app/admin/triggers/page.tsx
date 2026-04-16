"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  CloudRain,
  Wind,
  Thermometer,
  AlertTriangle,
  Play,
  MapPin,
  CheckCircle,
  Clock3,
  Users,
  Loader2,
  RotateCw,
  Activity,
  Sparkles,
  Bell,
  IndianRupee,
  FlameKindling,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { CITIES, TRIGGER_THRESHOLDS } from "@/lib/constants";
import { getRecentIncidents, runIncident } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface RecentTriggerRow {
  id: string;
  type: string;
  city: string;
  zone: string;
  value: string;
  threshold: string;
  workersAffected: number;
  totalPayout: number;
  timestamp: string;
  status: "simulated" | "fired" | "completed";
}

const FALLBACK_RECENT_TRIGGERS: RecentTriggerRow[] = [
  {
    id: "TRG-089",
    type: "heavy_rain",
    city: "Mumbai",
    zone: "Andheri West",
    value: "52mm/hr",
    threshold: "30mm/hr",
    workersAffected: 234,
    totalPayout: 198900,
    timestamp: "2025-01-15 14:32:00",
    status: "completed",
  },
  {
    id: "TRG-088",
    type: "aqi",
    city: "Delhi",
    zone: "Connaught Place",
    value: "AQI 385",
    threshold: "AQI 300",
    workersAffected: 567,
    totalPayout: 340200,
    timestamp: "2025-01-15 13:15:00",
    status: "completed",
  },
  {
    id: "TRG-087",
    type: "heatwave",
    city: "Chennai",
    zone: "T. Nagar",
    value: "46.2°C",
    threshold: "45°C",
    workersAffected: 189,
    totalPayout: 113400,
    timestamp: "2025-01-14 12:45:00",
    status: "completed",
  },
  {
    id: "TRG-086",
    type: "storm",
    city: "Hyderabad",
    zone: "Banjara Hills",
    value: "68km/h",
    threshold: "60km/h",
    workersAffected: 145,
    totalPayout: 87000,
    timestamp: "2025-01-14 08:20:00",
    status: "completed",
  },
  {
    id: "TRG-085",
    type: "flood",
    city: "Mumbai",
    zone: "Dadar",
    value: "118mm/hr",
    threshold: "100mm/hr",
    workersAffected: 312,
    totalPayout: 468000,
    timestamp: "2025-01-13 16:50:00",
    status: "completed",
  },
];

const triggerTypeConfig: Record<string, { icon: typeof CloudRain; color: string; label: string }> = {
  heavy_rain: { icon: CloudRain, color: "from-blue-500 to-blue-600", label: "Heavy Rain" },
  flood: { icon: CloudRain, color: "from-blue-700 to-indigo-700", label: "Flood" },
  heatwave: { icon: Thermometer, color: "from-orange-500 to-red-500", label: "Heatwave" },
  aqi: { icon: Wind, color: "from-amber-500 to-yellow-600", label: "AQI Spike" },
  storm: { icon: Wind, color: "from-slate-500 to-slate-700", label: "Storm" },
  curfew: { icon: AlertTriangle, color: "from-red-500 to-red-700", label: "Curfew" },
};

function formatTriggerValue(value: number, triggerType: string): string {
  const unit = TRIGGER_THRESHOLDS[triggerType]?.unit ?? "";
  if (unit === "AQI") return `AQI ${Math.round(value)}`;
  if (unit === "alert") return "Manual alert";
  return `${value}${unit}`;
}

function mapIncidentToRow(incident: {
  id: string;
  city: string;
  zone: string;
  trigger_type: string;
  mode: "simulate" | "fire";
  workers_affected: number;
  total_estimated_payout: number;
  threshold_value: number;
  measured_value: number;
  started_at: string;
}): RecentTriggerRow {
  const isFire = incident.mode === "fire";
  return {
    id: `TRG-${incident.id.slice(0, 6).toUpperCase()}`,
    type: incident.trigger_type,
    city: incident.city,
    zone: incident.zone,
    value: formatTriggerValue(incident.measured_value, incident.trigger_type),
    threshold: formatTriggerValue(incident.threshold_value, incident.trigger_type),
    workersAffected: incident.workers_affected,
    totalPayout: Number(incident.total_estimated_payout),
    timestamp: new Date(incident.started_at).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: isFire ? "fired" : "simulated",
  };
}

export default function AdminTriggers() {
  const [selectedCity, setSelectedCity] = useState("Mumbai");
  const [selectedZone, setSelectedZone] = useState(
    CITIES.find((c) => c.name === "Mumbai")?.zones[0]?.name ?? ""
  );
  const [manualType, setManualType] = useState<string>("heavy_rain");
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeMode, setActiveMode] = useState<"simulate" | "fire">("simulate");
  const [runError, setRunError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [recentTriggerRows, setRecentTriggerRows] = useState<RecentTriggerRow[]>(
    FALLBACK_RECENT_TRIGGERS
  );
  const [simResult, setSimResult] = useState<{
    workers: number;
    payout: number;
    mode: "simulate" | "fire";
    triggerValue: string;
    thresholdValue: string;
    durationMs: number;
    notificationsSent: number;
  } | null>(null);

  const loadRecentIncidents = useCallback(async () => {
    try {
      const incidents = await getRecentIncidents(8);
      if (!incidents.length) return;
      setRecentTriggerRows(incidents.map(mapIncidentToRow));
      setLastSyncAt(new Date().toISOString());
    } catch {
      // Keep fallback rows when API is unavailable.
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadRecentIncidents();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadRecentIncidents]);

  useEffect(() => {
    const cityConfig = CITIES.find((c) => c.name === selectedCity);
    setSelectedZone(cityConfig?.zones[0]?.name ?? "");
  }, [selectedCity]);

  useEffect(() => {
    void loadRecentIncidents();
    const intervalId = window.setInterval(() => {
      void loadRecentIncidents();
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [loadRecentIncidents]);

  useEffect(() => {
    const channel = supabase
      .channel("incident-runs-admin-triggers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_runs",
        },
        () => {
          void loadRecentIncidents();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRecentIncidents]);

  const handleRun = async (mode: "simulate" | "fire") => {
    setActiveMode(mode);
    setIsSimulating(true);
    setSimResult(null);
    setRunError(null);

    try {
      const result = await runIncident({
        city: selectedCity,
        zone: selectedZone,
        trigger_type: manualType,
        mode,
      });

      const thresholdLabel = formatTriggerValue(result.threshold_value, manualType);
      const measuredLabel = formatTriggerValue(result.measured_value, manualType);

      setSimResult({
        workers: result.workers_affected,
        payout: result.total_estimated_payout,
        mode,
        triggerValue: measuredLabel,
        thresholdValue: thresholdLabel,
        durationMs: result.duration_ms,
        notificationsSent: result.notifications_sent ?? 0,
      });

      const recentRow: RecentTriggerRow = {
        id: result.trigger_event_id
          ? `TRG-${result.trigger_event_id.slice(0, 6).toUpperCase()}`
          : `SIM-${Date.now().toString().slice(-6)}`,
        type: manualType,
        city: selectedCity,
        zone: selectedZone,
        value: measuredLabel,
        threshold: thresholdLabel,
        workersAffected: result.workers_affected,
        totalPayout: result.total_estimated_payout,
        timestamp: new Date().toLocaleString("en-IN", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: mode === "fire" ? "fired" : "simulated",
      };
      setRecentTriggerRows((prev) => [recentRow, ...prev].slice(0, 8));
      void loadRecentIncidents();
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unable to run trigger right now.");
    } finally {
      setIsSimulating(false);
    }
  };

  const totalExposure = recentTriggerRows.reduce((sum, row) => sum + row.totalPayout, 0);
  const totalWorkersImpacted = recentTriggerRows.reduce((sum, row) => sum + row.workersAffected, 0);
  const firedCount = recentTriggerRows.filter((row) => row.status === "fired").length;
  const simulatedCount = recentTriggerRows.filter((row) => row.status === "simulated").length;
  const averagePayout = recentTriggerRows.length > 0 ? totalExposure / recentTriggerRows.length : 0;
  const topCityEntry = Object.entries(
    recentTriggerRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.city] = (acc[row.city] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];
  const topCity = topCityEntry?.[0] ?? "N/A";
  const opsPulse = [
    `${firedCount} triggers were manually fired while ${simulatedCount} runs were dry-tested by ops teams.`,
    `${totalWorkersImpacted.toLocaleString("en-IN")} workers were impacted across recent incidents with ${formatCurrency(totalExposure)} in projected payouts.`,
    `${topCity} is currently the highest activity city with average trigger exposure of ${formatCurrency(averagePayout)} per run.`,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Parametric Trigger Control Room</h2>
          <p className="text-sm text-muted-foreground">
            Monitor, rehearse, and deploy trigger responses with live exposure visibility
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Syncing
              </>
            ) : (
              <>
                <RotateCw className="h-3.5 w-3.5" />
                Refresh
              </>
            )}
          </Button>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Trigger Engine Active
          </Badge>
          {lastSyncAt && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Clock3 className="w-3 h-3" />
              Synced {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white/80 p-2 text-teal-700 border border-teal-200">
            <Activity className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-900">Trigger Ops Pulse</p>
            {opsPulse.map((line) => (
              <p key={line} className="text-xs text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Workers Impacted</p>
              <Users className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalWorkersImpacted.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Across the latest 8 runs</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Projected Exposure</p>
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalExposure)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Avg {formatCurrency(averagePayout)} per incident</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Execution Mix</p>
              <Zap className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {firedCount} / {simulatedCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Fired vs Simulated</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Most Active City</p>
              <MapPin className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{topCity}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Highest trigger run volume</p>
          </CardContent>
        </Card>
      </div>

      {/* Threshold Config */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(TRIGGER_THRESHOLDS).map(([key, config]) => {
          const tc = triggerTypeConfig[key];
          if (!tc) return null;
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tc.color} flex items-center justify-center`}>
                    <tc.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tc.label}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Threshold</span>
                  <span className="font-mono font-medium text-amber-600">
                    {config.value}
                    {config.unit}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manual Trigger Simulator */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4.5 h-4.5 text-amber-600" />
            Manual Trigger Simulator
          </CardTitle>
          <CardDescription>
            Simulate or manually fire a parametric trigger for testing/emergency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">City</label>
              <select
                className="w-full h-9 rounded-lg bg-white border border-slate-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Zone</label>
              <select
                className="w-full h-9 rounded-lg bg-white border border-slate-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {(CITIES.find((c) => c.name === selectedCity)?.zones ?? []).map((zone) => (
                  <option key={zone.id} value={zone.name}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Trigger Type</label>
              <select
                className="w-full h-9 rounded-lg bg-white border border-slate-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
              >
                {Object.entries(triggerTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={() => handleRun("simulate")}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {activeMode === "fire" ? "Firing..." : "Simulating..."}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Simulate
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={isSimulating}
                onClick={() => handleRun("fire")}
              >
                <Zap className="w-4 h-4" />
                Fire
              </Button>
            </div>
          </div>

          {runError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {runError}
            </div>
          )}

          <AnimatePresence>
          {simResult && (
            <motion.div
              key={simResult.mode + simResult.workers}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className={`mt-4 p-5 rounded-xl border shadow-sm ${
                simResult.mode === "fire"
                  ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200"
                  : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-1.5 rounded-lg ${simResult.mode === "fire" ? "bg-emerald-100" : "bg-blue-100"}`}>
                  {simResult.mode === "fire" ? (
                    <FlameKindling className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-blue-700" />
                  )}
                </div>
                <span className={`text-sm font-semibold ${simResult.mode === "fire" ? "text-emerald-700" : "text-blue-700"}`}>
                  {simResult.mode === "fire" ? "🔥 Trigger Fired — Live Payouts Initiating" : "✅ Simulation Complete — No Real Payouts"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/60 rounded-xl p-3 border border-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Users className="w-3 h-3" /> Workers Affected
                  </div>
                  <motion.p
                    key={simResult.workers}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-slate-900"
                  >
                    {simResult.workers.toLocaleString("en-IN")}
                  </motion.p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 border border-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <IndianRupee className="w-3 h-3" /> Est. Payout
                  </div>
                  <motion.p
                    key={simResult.payout}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-emerald-700"
                  >
                    {formatCurrency(simResult.payout)}
                  </motion.p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 border border-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Bell className="w-3 h-3" /> Notified Workers
                  </div>
                  <motion.p
                    key={simResult.notificationsSent}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className={`text-2xl font-bold ${
                      simResult.mode === "fire" ? "text-purple-700" : "text-slate-400"
                    }`}
                  >
                    {simResult.mode === "fire" ? simResult.notificationsSent.toLocaleString("en-IN") : "—"}
                  </motion.p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 border border-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Activity className="w-3 h-3" /> Latency
                  </div>
                  <motion.p
                    key={simResult.durationMs}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-2xl font-bold text-slate-700"
                  >
                    {simResult.durationMs} ms
                  </motion.p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Measured: {simResult.triggerValue} · Threshold: {simResult.thresholdValue}
                {simResult.mode === "fire" && " · Notifications sent to all active workers in zone"}
              </p>
            </motion.div>
          )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Recent Triggers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Trigger Events</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Last 48 hours
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTriggerRows.map((trigger) => {
            const tc = triggerTypeConfig[trigger.type] ?? triggerTypeConfig.heavy_rain;
            return (
              <div
                key={trigger.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tc.color} flex items-center justify-center shrink-0`}>
                  <tc.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{tc.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{trigger.id}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {trigger.city} · {trigger.zone}
                    </span>
                    <span>{trigger.value} (threshold: {trigger.threshold})</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{trigger.timestamp}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Users className="w-3 h-3" />
                        {trigger.workersAffected}
                      </div>
                      <p className="font-bold">{formatCurrency(trigger.totalPayout)}</p>
                    </div>
                    <Badge
                      variant={trigger.status === "fired" ? "destructive" : "success"}
                      className="text-[10px]"
                    >
                      <CheckCircle className="w-2.5 h-2.5 mr-1" />
                      {trigger.status === "fired"
                        ? "Fired"
                        : trigger.status === "completed"
                        ? "Done"
                        : "Sim"}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
