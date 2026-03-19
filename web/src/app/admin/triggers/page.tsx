"use client";

import { useState } from "react";
import {
  Zap,
  CloudRain,
  Wind,
  Thermometer,
  AlertTriangle,
  Play,
  MapPin,
  CheckCircle,
  Users,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { CITIES, TRIGGER_THRESHOLDS } from "@/lib/constants";

const recentTriggers = [
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

export default function AdminTriggers() {
  const [selectedCity, setSelectedCity] = useState("Mumbai");
  const [manualType, setManualType] = useState<string>("heavy_rain");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    workers: number;
    payout: number;
  } | null>(null);

  const handleSimulate = () => {
    setIsSimulating(true);
    setSimResult(null);
    setTimeout(() => {
      setSimResult({
        workers: Math.floor(Math.random() * 300) + 100,
        payout: Math.floor(Math.random() * 300000) + 50000,
      });
      setIsSimulating(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Parametric Trigger Panel</h2>
          <p className="text-sm text-muted-foreground">
            Monitor, simulate, and manually fire parametric insurance triggers
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Trigger Engine Active
        </Badge>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
                onClick={handleSimulate}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Simulate
                  </>
                )}
              </Button>
              <Button variant="destructive" className="gap-2">
                <Zap className="w-4 h-4" />
                Fire
              </Button>
            </div>
          </div>

          {simResult && (
            <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">Simulation Complete</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Workers Affected</p>
                  <p className="text-lg font-bold">{simResult.workers}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Payout</p>
                  <p className="text-lg font-bold">{formatCurrency(simResult.payout)}</p>
                </div>
              </div>
            </div>
          )}
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
          {recentTriggers.map((trigger) => {
            const tc = triggerTypeConfig[trigger.type];
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
                    <Badge variant="success" className="text-[10px]">
                      <CheckCircle className="w-2.5 h-2.5 mr-1" />
                      Done
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
