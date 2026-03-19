"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudRain, Thermometer, Wind, AlertTriangle, Layers, Loader2 } from "lucide-react";
import { fetchZoneHeatmap } from "@/lib/data";
import { supabase } from "@/lib/supabase";
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

  useEffect(() => {
    let mounted = true;

    const load = async (initial = false) => {
      if (initial) setLoading(true);
      const data = await fetchZoneHeatmap();
      if (!mounted) return;

      setZones(data);
      setLastSync(new Date());
      setError(data.length === 0 ? "No live map rows available from v_zone_heatmap." : null);
      if (initial) setLoading(false);
    };

    load(true);

    // Realtime pushes (weather / claims / workers / triggers) refresh the zone heatmap immediately.
    const realtimeChannel = supabase
      .channel("zone-heatmap-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "weather_events" }, () => {
        void load(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, () => {
        void load(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gig_workers" }, () => {
        void load(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trigger_events" }, () => {
        void load(false);
      })
      .subscribe();

    // Polling fallback in case realtime is disabled in the Supabase project.
    const interval = setInterval(() => load(false), 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
      void supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const cityZones = zones.filter(
    (z) => z.city.toLowerCase() === (CITY_MAP[selectedCity] ?? selectedCity).toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Live Risk Map</h2>
          <p className="text-sm text-muted-foreground">
            Real-time weather & disruption monitoring across zones
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">
              Live{lastSync ? ` · ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
          </div>
        </div>
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
          <Card>
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
                    <div
                      key={zone.zone_name}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
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
          <Card>
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
