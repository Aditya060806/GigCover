"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CloudRain,
  Thermometer,
  Wind,
  AlertTriangle,
  Layers,
  Loader2,
  RotateCw,
  Activity,
  Users,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { fetchZoneHeatmap } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { ZoneHeatmap } from "@/types/database";

const RiskMapComponent = dynamic(() => import("@/components/dashboard/RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] rounded-xl bg-white border border-slate-200 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading Risk Map...</p>
      </div>
    </div>
  ),
});

function riskLevelToScore(level: string): number {
  switch (level) {
    case "critical": return 0.9;
    case "high": return 0.7;
    case "medium": return 0.5;
    case "low": return 0.25;
    default: return 0.3;
  }
}

const CITY_MAP: Record<string, string> = {
  mumbai: "Mumbai",
  delhi: "Delhi",
  bangalore: "Bangalore",
  chennai: "Chennai",
  hyderabad: "Hyderabad",
};

export default function MapPage() {
  const [selectedCity, setSelectedCity] = useState("mumbai");
  const [zones, setZones] = useState<ZoneHeatmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadHeatmap = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    const data = await fetchZoneHeatmap();

    setZones(data);
    setLastSync(new Date());
    setError(data.length === 0 ? "No live map rows available from v_zone_heatmap." : null);
    if (initial) setLoading(false);
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadHeatmap(false);
    }, 600);
  }, [loadHeatmap]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadHeatmap(false);
    } finally {
      setManualRefreshing(false);
    }
  }, [loadHeatmap]);

  useEffect(() => {
    void loadHeatmap(true);

    // Realtime pushes (weather / claims / workers / triggers) refresh the zone heatmap immediately.
    const realtimeChannel = supabase
      .channel("zone-heatmap-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "weather_events" }, () => {
        scheduleRealtimeRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, () => {
        scheduleRealtimeRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gig_workers" }, () => {
        scheduleRealtimeRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trigger_events" }, () => {
        scheduleRealtimeRefresh();
      })
      .subscribe();

    // Polling fallback in case realtime is disabled in the Supabase project.
    const interval = window.setInterval(() => {
      void loadHeatmap(false);
    }, 30000);

    return () => {
      window.clearInterval(interval);
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(realtimeChannel);
    };
  }, [loadHeatmap, scheduleRealtimeRefresh]);

  const cityLabel = CITY_MAP[selectedCity] ?? selectedCity;

  const cityZones = useMemo(
    () =>
      zones.filter(
        (z) => z.city.toLowerCase() === cityLabel.toLowerCase()
      ),
    [zones, cityLabel]
  );

  const avgRiskScore =
    cityZones.length > 0
      ? cityZones.reduce((sum, zone) => sum + riskLevelToScore(zone.risk_level), 0) / cityZones.length
      : 0;
  const criticalZones = cityZones.filter((zone) => riskLevelToScore(zone.risk_level) >= 0.8).length;
  const highRiskZones = cityZones.filter((zone) => riskLevelToScore(zone.risk_level) >= 0.6).length;
  const totalWorkers = cityZones.reduce((sum, zone) => sum + zone.active_workers, 0);
  const totalClaims = cityZones.reduce((sum, zone) => sum + zone.total_claims, 0);
  const totalPayouts = cityZones.reduce((sum, zone) => sum + zone.total_payouts, 0);
  const totalExtremeEvents = cityZones.reduce((sum, zone) => sum + zone.extreme_event_count, 0);

  const mapPulse = [
    `${cityZones.length} zones are live in ${cityLabel} with ${totalWorkers.toLocaleString("en-IN")} active workers in coverage.`,
    `${highRiskZones} zones are currently high risk and ${criticalZones} zones are in critical conditions requiring rapid response readiness.`,
    `${totalClaims.toLocaleString("en-IN")} historical claims represent ${formatCurrency(totalPayouts)} in payouts across this city's map footprint.`,
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Geo Risk Command Map</h2>
          <p className="text-sm text-muted-foreground">
            Live weather-disruption intelligence with zone-level operational context
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={manualRefreshing}
            onClick={() => {
              void handleManualRefresh();
            }}
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
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mumbai">Mumbai</SelectItem>
              <SelectItem value="delhi">Delhi</SelectItem>
              <SelectItem value="bangalore">Bangalore</SelectItem>
              <SelectItem value="chennai">Chennai</SelectItem>
              <SelectItem value="hyderabad">Hyderabad</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Feed
          </Badge>
          {lastSync && (
            <Badge variant="secondary" className="text-[10px]">
              Synced {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-cyan-50 to-sky-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white/80 p-2 text-emerald-700 border border-emerald-200">
            <Activity className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-900">City Ops Pulse</p>
            {mapPulse.map((line) => (
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
              <p className="text-xs text-muted-foreground">Average Risk</p>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {Math.round(avgRiskScore * 100)}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Across {cityZones.length} tracked zones</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">High-Risk Zones</p>
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{highRiskZones}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{criticalZones} critical right now</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Worker Coverage</p>
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totalWorkers.toLocaleString("en-IN")}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{totalClaims.toLocaleString("en-IN")} cumulative claims</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Event + Payout Footprint</p>
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(totalPayouts)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{totalExtremeEvents} extreme events logged</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3">
          <RiskMapComponent city={selectedCity} zones={zones} loading={loading} />
        </div>

        {/* Zone Risk Sidebar */}
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Zone Risk Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : cityZones.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No zone data available</p>
              ) : (
                cityZones.map((zone) => {
                  const risk = riskLevelToScore(zone.risk_level);
                  return (
                    <div key={zone.zone_name} className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{zone.zone_name}</span>
                        <Badge
                          variant={
                            risk >= 0.7
                              ? "destructive"
                              : risk >= 0.5
                              ? "warning"
                              : "success"
                          }
                          className="text-[10px]"
                        >
                          {Math.round(risk * 100)}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CloudRain className="w-3 h-3 text-blue-600" />
                          {zone.current_rainfall.toFixed(0)}mm
                        </div>
                        <div className="flex items-center gap-1">
                          <Wind className="w-3 h-3 text-amber-600" />
                          {Math.round(zone.current_aqi)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-orange-600" />
                          {zone.current_temp.toFixed(0)}°C
                        </div>
                      </div>
                      {zone.extreme_event_count > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] text-amber-600">
                            {zone.extreme_event_count} extreme event{zone.extreme_event_count > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="border-slate-200 bg-white/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Risk Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { color: "bg-emerald-500", label: "Safe (0-20%)" },
                { color: "bg-blue-500", label: "Low (20-40%)" },
                { color: "bg-yellow-500", label: "Moderate (40-60%)" },
                { color: "bg-orange-500", label: "High (60-80%)" },
                { color: "bg-red-500", label: "Critical (80-100%)" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                  <span className="text-xs text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
