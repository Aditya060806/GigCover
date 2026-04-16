"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ShieldAlert,
  CheckCircle,
  Bot,
  Ban,
  Fingerprint,
  BarChart3,
  RotateCw,
  Sparkles,
  AlertCircle,
  MapPin,
  Navigation,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { fetchFraudQueue } from "@/lib/data";
import { listOpenFraudAppeals, resolveFraudAppeal, submitFraudDecision } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

interface FraudAlert {
  id: string;
  recordId: string;
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

interface AppealItem {
  appeal_id: string;
  status: "submitted" | "under_review";
  reason: string;
  submitted_at: string;
  claim_id: string;
  claim_amount: number | null;
  fraud_score: number | null;
  city: string | null;
  zone: string | null;
  worker_gw_id: string | null;
  worker_name: string | null;
  platform: string | null;
}

const FALLBACK_ALERTS: FraudAlert[] = [
  { id: "FRD-001", recordId: "FRD-001", worker: "Rajesh Kumar", workerId: "GW-007", city: "Delhi", zone: "Dwarka", claimId: "CLM-2024-1243", fraudScore: 0.89, amount: 1500, reason: "Multiple claims during non-event period, GPS inconsistency", features: [{ name: "Claim Frequency", contribution: 0.32, direction: "up" }, { name: "GPS Deviation", contribution: 0.28, direction: "up" }, { name: "Weather Mismatch", contribution: 0.18, direction: "up" }], status: "investigating", detectedAt: "2025-01-13T10:30:00", resolvedAt: null },
  { id: "FRD-002", recordId: "FRD-002", worker: "Vikram Reddy", workerId: "GW-005", city: "Hyderabad", zone: "Banjara Hills", claimId: "CLM-2024-1245", fraudScore: 0.72, amount: 1800, reason: "Claim amount exceeds zone average by 2.1x", features: [{ name: "Amount Deviation", contribution: 0.35, direction: "up" }, { name: "Timing Pattern", contribution: 0.22, direction: "up" }], status: "investigating", detectedAt: "2025-01-14T09:15:00", resolvedAt: null },
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
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [appealActionInProgress, setAppealActionInProgress] = useState<{
    appealId: string;
    action: "accept" | "reject";
  } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<"clear" | "block" | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadFraudAlerts = useCallback(async () => {
    try {
      const data = await fetchFraudQueue();
      if (data.length === 0) return;
      const mapped = data.map((f, i) => ({
        id: `FRD-${String(i + 1).padStart(3, "0")}`,
        recordId: f.id,
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
      setSelectedAlert((prev) => {
        if (!prev) return mapped[0] ?? null;
        return mapped.find((item) => item.recordId === prev.recordId) ?? mapped[0] ?? null;
      });
      setLastSyncAt(new Date().toISOString());
    } catch {
      // Keep previous fraud queue when refresh fails.
    }
  }, []);

  const loadOpenAppeals = useCallback(async (showLoading: boolean) => {
    if (showLoading) setAppealsLoading(true);
    try {
      const openAppeals = await listOpenFraudAppeals(10);
      setAppeals(openAppeals);
      setLastSyncAt(new Date().toISOString());
    } catch {
      if (showLoading) setAppeals([]);
    } finally {
      if (showLoading) setAppealsLoading(false);
    }
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadFraudAlerts();
      void loadOpenAppeals(false);
    }, 500);
  }, [loadFraudAlerts, loadOpenAppeals]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([loadFraudAlerts(), loadOpenAppeals(false)]);
    } finally {
      setManualRefreshing(false);
    }
  }, [loadFraudAlerts, loadOpenAppeals]);

  useEffect(() => {
    void loadFraudAlerts();
    void loadOpenAppeals(true);

    const intervalId = window.setInterval(() => {
      void loadFraudAlerts();
      void loadOpenAppeals(false);
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [loadFraudAlerts, loadOpenAppeals]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-fraud-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fraud_logs" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claim_appeals" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
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

  const updateFraudStatus = (recordId: string, nextStatus: string) => {
    const resolvedAt = new Date().toISOString();
    setFraudAlerts((prev) =>
      prev.map((item) =>
        item.recordId === recordId
          ? { ...item, status: nextStatus, resolvedAt }
          : item
      )
    );
    setSelectedAlert((prev) =>
      prev && prev.recordId === recordId
        ? { ...prev, status: nextStatus, resolvedAt }
        : prev
    );
  };

  const handleDecision = async (action: "clear" | "block") => {
    if (!selectedAlert || selectedAlert.status !== "investigating") return;

    const nextStatus = action === "clear" ? "cleared" : "blocked";
    setActionError(null);
    setActionInProgress(action);

    try {
      if (selectedAlert.recordId.startsWith("FRD-")) {
        updateFraudStatus(selectedAlert.recordId, nextStatus);
        return;
      }

      await submitFraudDecision({
        fraud_log_id: selectedAlert.recordId,
        action,
        reviewer: "admin-panel",
        note:
          action === "clear"
            ? "Cleared after manual investigation"
            : "Blocked after manual fraud confirmation",
      });
      updateFraudStatus(selectedAlert.recordId, nextStatus);
      void loadFraudAlerts();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to submit decision right now.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAppealDecision = async (appeal: AppealItem, action: "accept" | "reject") => {
    setActionError(null);
    setAppealActionInProgress({ appealId: appeal.appeal_id, action });

    try {
      await resolveFraudAppeal({
        appeal_id: appeal.appeal_id,
        action,
        reviewer: "admin-panel",
        note:
          action === "accept"
            ? "Appeal accepted after manual verification"
            : "Appeal rejected after manual review",
      });

      setAppeals((prev) => prev.filter((item) => item.appeal_id !== appeal.appeal_id));
      void loadOpenAppeals(false);

      const linkedAlert = fraudAlerts.find(
        (item) => item.claimId === appeal.claim_id && item.status === "investigating"
      );
      if (linkedAlert) {
        updateFraudStatus(linkedAlert.recordId, action === "accept" ? "cleared" : "blocked");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to resolve appeal right now.");
    } finally {
      setAppealActionInProgress(null);
    }
  };

  const totalSaved = fraudAlerts
    .filter((a) => a.status === "blocked")
    .reduce((s, a) => s + a.amount, 0);
  const blockedCount = fraudAlerts.filter((a) => a.status === "blocked").length;
  const clearedCount = fraudAlerts.filter((a) => a.status === "cleared").length;
  const investigatingCount = fraudAlerts.filter((a) => a.status === "investigating").length;
  const highRiskCount = fraudAlerts.filter((a) => a.fraudScore >= 0.8).length;
  const avgFraudScore =
    fraudAlerts.length > 0
      ? fraudAlerts.reduce((sum, alert) => sum + alert.fraudScore, 0) / fraudAlerts.length
      : 0;
  const resolvedCount = blockedCount + clearedCount;
  const resolutionRate = fraudAlerts.length > 0 ? (resolvedCount / fraudAlerts.length) * 100 : 0;

  const opsNarrative = [
    `${investigatingCount} alerts are under active investigation across ${new Set(fraudAlerts.map((a) => a.city)).size} cities.`,
    `${appeals.length} worker appeals are pending review with ${highRiskCount} high-risk cases flagged above 80%.`,
    `${resolutionRate.toFixed(1)}% of surfaced alerts are already resolved; blocked claims prevented ${formatCurrency(totalSaved)} in payouts.`,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">AI Fraud Detection</h2>
          <p className="text-sm text-muted-foreground">
            Isolation Forest anomaly detection + SHAP explainability
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
            <RotateCw className={`w-3.5 h-3.5 ${manualRefreshing ? "animate-spin" : ""}`} />
            {manualRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Badge variant="outline" className="gap-1.5">
            <Bot className="w-3 h-3 text-teal-600" />
            Model v2.4
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Real-time
          </Badge>
          {lastSyncAt && (
            <Badge variant="secondary" className="text-[10px]">
              Synced {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-700" />
                <p className="text-sm font-semibold">Fraud Ops Pulse</p>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Activity className="w-3 h-3" />
                Live Triage Signal
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {opsNarrative.map((line) => (
                <p
                  key={line}
                  className="text-xs leading-relaxed rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-slate-700"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 bg-gradient-to-b from-white to-slate-50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Flags</p>
            <p className="text-2xl font-bold">{fraudAlerts.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Avg score {(avgFraudScore * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-red-200/80 bg-gradient-to-b from-red-50/40 to-white">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Blocked</p>
            <p className="text-2xl font-bold text-red-600">
              {blockedCount}
            </p>
            <p className="text-[11px] text-red-700 mt-1">High-risk cases: {highRiskCount}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 to-white">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Cleared</p>
            <p className="text-2xl font-bold text-emerald-600">
              {clearedCount}
            </p>
            <p className="text-[11px] text-emerald-700 mt-1">Resolution rate {resolutionRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Money Saved</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
            <p className="text-[11px] text-amber-700 mt-1">{investigatingCount} still under review</p>
          </CardContent>
        </Card>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {actionError}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Appeals Queue</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {appeals.length} open
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {appealsLoading ? (
            <p className="text-sm text-muted-foreground">Loading appeals...</p>
          ) : appeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open appeals right now.</p>
          ) : (
            appeals.map((appeal) => (
              <div
                key={appeal.appeal_id}
                className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {appeal.worker_name ?? "Worker"} ({appeal.worker_gw_id ?? "N/A"})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appeal.claim_id} • {appeal.city ?? "-"}, {appeal.zone ?? "-"} • {formatDateTime(appeal.submitted_at)}
                    </p>
                  </div>
                  <Badge variant="warning" className="text-[10px]">Pending</Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {appeal.claim_amount !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      Amount: {formatCurrency(Number(appeal.claim_amount))}
                    </Badge>
                  )}
                  {appeal.fraud_score !== null && (
                    <Badge
                      variant={appeal.fraud_score >= 0.7 ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      Fraud: {(Number(appeal.fraud_score) * 100).toFixed(0)}%
                    </Badge>
                  )}
                  {appeal.platform && (
                    <Badge variant="secondary" className="text-[10px]">{appeal.platform}</Badge>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{appeal.reason}</p>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-emerald-700 hover:bg-emerald-50"
                    disabled={appealActionInProgress !== null}
                    onClick={() => handleAppealDecision(appeal, "accept")}
                  >
                    {appealActionInProgress?.appealId === appeal.appeal_id && appealActionInProgress.action === "accept"
                      ? "Accepting..."
                      : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={appealActionInProgress !== null}
                    onClick={() => handleAppealDecision(appeal, "reject")}
                  >
                    {appealActionInProgress?.appealId === appeal.appeal_id && appealActionInProgress.action === "reject"
                      ? "Rejecting..."
                      : "Reject"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
                        ? "High Fraud Risk"
                        : selectedAlert.fraudScore > 0.4
                        ? "Moderate Risk"
                        : "Low Risk"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedAlert.reason}
                    </p>
                  </div>
                </div>

                {/* GPS Spoofing Chip */}
                {(() => {
                  const gpsFeature = selectedAlert.features.find(
                    (f) => f.name.toLowerCase().includes("gps")
                  );
                  if (!gpsFeature) return null;
                  const isSpoofed = gpsFeature.contribution > 0.15;
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-3 rounded-xl p-3 border ${
                        isSpoofed
                          ? "bg-red-50 border-red-200"
                          : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        isSpoofed ? "bg-red-100" : "bg-emerald-100"
                      }`}>
                        <Navigation className={`w-4 h-4 ${
                          isSpoofed ? "text-red-600" : "text-emerald-600"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-semibold ${
                          isSpoofed ? "text-red-700" : "text-emerald-700"
                        }`}>
                          GPS Signal: {isSpoofed ? "🚨 Spoofing Detected" : "✅ Location Authentic"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Deviation contribution: {(gpsFeature.contribution * 100).toFixed(0)}%
                          {isSpoofed ? " — Location inconsistent with weather zone" : " — Consistent with reported zone"}
                        </p>
                      </div>
                      <Badge variant={isSpoofed ? "destructive" : "success"} className="text-[10px]">
                        {isSpoofed ? "High Risk" : "Verified"}
                      </Badge>
                    </motion.div>
                  );
                })()}

                {/* SHAP Feature Bars */}
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-600" />
                    Feature Contributions (SHAP Values)
                  </p>
                  <div className="space-y-3">
                    {selectedAlert.features.map((feature, idx) => {
                      const maxVal = 0.5;
                      const width = Math.min(Math.abs(feature.contribution) / maxVal, 1) * 100;
                      const isPositive = feature.direction === "up";
                      const isGPS = feature.name.toLowerCase().includes("gps");
                      return (
                        <motion.div
                          key={feature.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.06 }}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={`text-muted-foreground flex items-center gap-1.5 ${
                              isGPS ? "text-orange-600 font-medium" : ""
                            }`}>
                              {isGPS && <MapPin className="w-3 h-3" />}
                              {feature.name}
                            </span>
                            <span className={isPositive ? "text-red-600" : "text-emerald-600"}>
                              {isPositive ? "+" : ""}{feature.contribution.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-5 flex items-center">
                            <div className="w-full flex items-center">
                              <div className="relative w-full h-2">
                                <div className="absolute inset-0 bg-slate-100 rounded-full" />
                                {isPositive ? (
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${width / 2}%` }}
                                    transition={{ delay: 0.1 + idx * 0.06, duration: 0.4 }}
                                    className={`absolute left-1/2 top-0 h-full rounded-r-full ${
                                      isGPS
                                        ? "bg-gradient-to-r from-orange-500/80 to-orange-400"
                                        : "bg-gradient-to-r from-red-500/80 to-red-400"
                                    }`}
                                  />
                                ) : (
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${width / 2}%` }}
                                    transition={{ delay: 0.1 + idx * 0.06, duration: 0.4 }}
                                    className="absolute right-1/2 top-0 h-full bg-gradient-to-l from-emerald-500/80 to-emerald-400 rounded-l-full"
                                  />
                                )}
                                <div className="absolute left-1/2 top-0 w-px h-full bg-slate-300" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 text-emerald-600 hover:bg-emerald-50"
                      disabled={actionInProgress !== null}
                      onClick={() => handleDecision("clear")}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {actionInProgress === "clear" ? "Clearing..." : "Clear"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 gap-1.5"
                      disabled={actionInProgress !== null}
                      onClick={() => handleDecision("block")}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {actionInProgress === "block" ? "Blocking..." : "Block Worker"}
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
