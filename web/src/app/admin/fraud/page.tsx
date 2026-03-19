"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  CheckCircle,
  Bot,
  Ban,
  Fingerprint,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { fetchFraudQueue } from "@/lib/data";
import type { Json } from "@/types/database";

interface FraudAlert {
  id: string;
  worker: string;
  workerId: string;
  city: string;
  zone: string;
  claimId: string;
  fraudScore: number;
  amount: number;
  reason: string;
  features: { name: string; contribution: number; direction: string }[];
  status: string;
  detectedAt: string;
  resolvedAt: string | null;
}

const FALLBACK_ALERTS: FraudAlert[] = [
  { id: "FRD-001", worker: "Rajesh Kumar", workerId: "GW-007", city: "Delhi", zone: "Dwarka", claimId: "CLM-2024-1243", fraudScore: 0.89, amount: 1500, reason: "Multiple claims during non-event period, GPS inconsistency", features: [{ name: "Claim Frequency", contribution: 0.32, direction: "up" }, { name: "GPS Deviation", contribution: 0.28, direction: "up" }, { name: "Weather Mismatch", contribution: 0.18, direction: "up" }], status: "investigating", detectedAt: "2025-01-13T10:30:00", resolvedAt: null },
  { id: "FRD-002", worker: "Vikram Reddy", workerId: "GW-005", city: "Hyderabad", zone: "Banjara Hills", claimId: "CLM-2024-1245", fraudScore: 0.72, amount: 1800, reason: "Claim amount exceeds zone average by 2.1x", features: [{ name: "Amount Deviation", contribution: 0.35, direction: "up" }, { name: "Timing Pattern", contribution: 0.22, direction: "up" }], status: "investigating", detectedAt: "2025-01-14T09:15:00", resolvedAt: null },
];

function parseShapValues(shap: Json | null): { name: string; contribution: number; direction: string }[] {
  if (!shap || typeof shap !== "object" || !Array.isArray(shap)) {
    return [
      { name: "Claim Frequency", contribution: 0.25, direction: "up" },
      { name: "GPS Deviation", contribution: 0.18, direction: "up" },
      { name: "Weather Mismatch", contribution: 0.12, direction: "up" },
    ];
  }
  return (shap as { feature: string; value: number; direction: string }[]).map((s) => ({
    name: s.feature ?? "Unknown",
    contribution: s.value ?? 0,
    direction: s.direction ?? (s.value >= 0 ? "up" : "down"),
  }));
}

const fraudAlertsFallback = FALLBACK_ALERTS;

const statusConfig: Record<string, { color: string; label: string }> = {
  investigating: { color: "warning", label: "Investigating" },
  blocked: { color: "destructive", label: "Blocked" },
  cleared: { color: "success", label: "Cleared" },
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export default function AdminFraud() {
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>(fraudAlertsFallback);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(
    fraudAlertsFallback[0]
  );

  useEffect(() => {
    fetchFraudQueue().then((data) => {
      if (data.length > 0) {
        const mapped = data.map((f, i) => ({
          id: `FRD-${String(i + 1).padStart(3, "0")}`,
          worker: f.worker_name,
          workerId: f.worker_gw_id,
          city: f.city,
          zone: f.zone,
          claimId: f.claim_id,
          fraudScore: f.fraud_score,
          amount: Number(f.claim_amount),
          reason: f.reason ?? "Anomaly detected by ML model",
          features: parseShapValues(f.shap_values),
          status: f.investigation_status,
          detectedAt: f.detected_at,
          resolvedAt: null,
        }));
        setFraudAlerts(mapped);
        setSelectedAlert(mapped[0]);
      }
    });
  }, []);

  const totalSaved = fraudAlerts
    .filter((a) => a.status === "blocked")
    .reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">AI Fraud Detection</h2>
          <p className="text-sm text-muted-foreground">
            Isolation Forest anomaly detection + SHAP explainability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Bot className="w-3 h-3 text-teal-600" />
            Model v2.4
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Real-time
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Flags</p>
            <p className="text-2xl font-bold">{fraudAlerts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Blocked</p>
            <p className="text-2xl font-bold text-red-600">
              {fraudAlerts.filter((a) => a.status === "blocked").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Cleared</p>
            <p className="text-2xl font-bold text-emerald-600">
              {fraudAlerts.filter((a) => a.status === "cleared").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Money Saved</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fraud Alerts List */}
        <div className="lg:col-span-1 space-y-3">
          {fraudAlerts.map((alert) => {
            const cfg = statusConfig[alert.status];
            return (
              <Card
                key={alert.id}
                className={`cursor-pointer transition-all hover:border-slate-300 ${
                  selectedAlert?.id === alert.id ? "border-red-200 bg-red-50" : ""
                }`}
                onClick={() => setSelectedAlert(alert)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">{alert.id}</span>
                    <Badge variant={cfg.color as BadgeVariant} className="text-[10px] capitalize">
                      {cfg.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mb-1">{alert.worker}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {alert.city} · {alert.zone}
                    </span>
                    <span className={`text-sm font-bold ${
                      alert.fraudScore > 0.7 ? "text-red-600" : alert.fraudScore > 0.4 ? "text-amber-600" : "text-emerald-600"
                    }`}>
                      {(alert.fraudScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* SHAP Explanation Panel */}
        <Card className="lg:col-span-2 h-fit sticky top-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-red-600" />
                SHAP Fraud Explanation
              </CardTitle>
              {selectedAlert && (
                <Badge variant="outline" className="font-mono">
                  {selectedAlert.claimId}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedAlert ? (
              <div className="space-y-5">
                {/* Fraud Score Gauge */}
                <div className="flex items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke={
                          selectedAlert.fraudScore > 0.7
                            ? "#ef4444"
                            : selectedAlert.fraudScore > 0.4
                            ? "#f59e0b"
                            : "#10b981"
                        }
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${selectedAlert.fraudScore * 251.2} 251.2`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">
                        {(selectedAlert.fraudScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      {selectedAlert.fraudScore > 0.7
                        ? "🚨 High Fraud Risk"
                        : selectedAlert.fraudScore > 0.4
                        ? "⚠️ Moderate Risk"
                        : "✅ Low Risk"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedAlert.reason}
                    </p>
                  </div>
                </div>

                {/* SHAP Feature Bars */}
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-600" />
                    Feature Contributions (SHAP Values)
                  </p>
                  <div className="space-y-3">
                    {selectedAlert.features.map((feature) => {
                      const maxVal = 0.5;
                      const width = Math.min(Math.abs(feature.contribution) / maxVal, 1) * 100;
                      const isPositive = feature.direction === "up";
                      return (
                        <div key={feature.name}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{feature.name}</span>
                            <span
                              className={
                              isPositive ? "text-red-600" : "text-emerald-600"
                              }
                            >
                              {isPositive ? "+" : ""}
                              {feature.contribution.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-5 flex items-center">
                            <div className="w-full flex items-center">
                              {/* Center line */}
                              <div className="relative w-full h-2">
                                <div className="absolute inset-0 bg-slate-100 rounded-full" />
                                {isPositive ? (
                                  <div
                                    className="absolute left-1/2 top-0 h-full bg-gradient-to-r from-red-500/80 to-red-400 rounded-r-full"
                                    style={{ width: `${width / 2}%` }}
                                  />
                                ) : (
                                  <div
                                    className="absolute right-1/2 top-0 h-full bg-gradient-to-l from-emerald-500/80 to-emerald-400 rounded-l-full"
                                    style={{ width: `${width / 2}%` }}
                                  />
                                )}
                                <div className="absolute left-1/2 top-0 w-px h-full bg-slate-300" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    ← Decreases fraud risk | Increases fraud risk →
                  </p>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-muted-foreground mb-1">Worker</p>
                    <p>{selectedAlert.worker} ({selectedAlert.workerId})</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-muted-foreground mb-1">Claim Amount</p>
                    <p className="font-bold">{formatCurrency(selectedAlert.amount)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-muted-foreground mb-1">Location</p>
                    <p>{selectedAlert.city}, {selectedAlert.zone}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-muted-foreground mb-1">Detected</p>
                    <p>{formatDateTime(selectedAlert.detectedAt)}</p>
                  </div>
                </div>

                {selectedAlert.status === "investigating" && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 gap-1.5 text-emerald-600 hover:bg-emerald-50">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Clear
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1 gap-1.5">
                      <Ban className="w-3.5 h-3.5" />
                      Block Worker
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Select a fraud alert to view SHAP analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
