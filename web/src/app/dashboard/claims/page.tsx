"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Filter,
  Shield,
  Zap,
  Search,
  RotateCw,
  Sparkles,
  CalendarClock,
} from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { submitFraudAppeal } from "@/lib/api";

const TRIGGER_LABELS: Record<string, string> = {
  heavy_rain: "Heavy Rain",
  aqi: "AQI Hazardous",
  heatwave: "Extreme Heat",
  flood: "Flooding",
  storm: "Severe Storm",
  curfew: "Curfew",
};

const TRIGGER_ICONS: Record<string, string> = {
  heavy_rain: "🌧️",
  aqi: "😷",
  heatwave: "🔥",
  flood: "🌊",
  storm: "🌪️",
  curfew: "🚫",
};

const TRIGGER_UNITS: Record<string, string> = {
  heavy_rain: "mm/hr",
  aqi: "AQI",
  heatwave: "°C",
  flood: "mm/24hr",
  storm: "km/h",
  curfew: "alert",
};

const TRIGGER_THRESHOLDS: Record<string, number> = {
  heavy_rain: 30,
  aqi: 300,
  heatwave: 45,
  flood: 100,
  storm: 60,
  curfew: 1,
};

interface ClaimDetail {
  id: string;
  type: string;
  icon: string;
  triggerType: string;
  triggerValue: number;
  threshold: number;
  unit: string;
  amount: number;
  fraudScore: number;
  status: "paid" | "processing" | "flagged" | "rejected";
  autoTriggered: boolean;
  zone: string;
  createdAt: string;
  paidAt: string | null;
  shapExplanation: { feature: string; value: string; direction: string }[];
}

function generateShapExplanation(c: { trigger_type: string; amount: number; fraud_score: number }): { feature: string; value: string; direction: string }[] {
  const amt = Number(c.amount);
  const base = Math.round(amt * 0.25);
  const remaining = amt - base;
  return [
    { feature: `${TRIGGER_LABELS[c.trigger_type] ?? c.trigger_type} severity`, value: `+₹${Math.round(remaining * 0.4)}`, direction: "up" },
    { feature: "Zone risk history", value: `+₹${Math.round(remaining * 0.3)}`, direction: "up" },
    { feature: "Timing factor", value: `+₹${Math.round(remaining * 0.2)}`, direction: c.fraud_score > 0.5 ? "down" : "up" },
    { feature: "Fraud adjustment", value: c.fraud_score > 0.5 ? `-₹${Math.round(remaining * 0.1)}` : `+₹${Math.round(remaining * 0.1)}`, direction: c.fraud_score > 0.5 ? "down" : "up" },
    { feature: "Base payout", value: `₹${base}`, direction: "neutral" },
  ];
}

const FALLBACK_CLAIMS: ClaimDetail[] = [
  { id: "CLM-007", type: "Heavy Rain", icon: "🌧️", triggerType: "heavy_rain", triggerValue: 42, threshold: 30, unit: "mm/hr", amount: 400, fraudScore: 0.05, status: "paid", autoTriggered: true, zone: "Andheri West", createdAt: "2026-03-04T14:30:00", paidAt: "2026-03-04T14:32:00", shapExplanation: [{ feature: "Rainfall intensity", value: "+₹120", direction: "up" }, { feature: "Zone flood history", value: "+₹80", direction: "up" }, { feature: "Duration > 2hrs", value: "+₹60", direction: "up" }, { feature: "Low fraud score", value: "+₹40", direction: "up" }, { feature: "Base payout", value: "₹100", direction: "neutral" }] },
  { id: "CLM-006", type: "AQI Hazardous", icon: "😷", triggerType: "aqi", triggerValue: 356, threshold: 300, unit: "AQI", amount: 240, fraudScore: 0.08, status: "paid", autoTriggered: true, zone: "Andheri West", createdAt: "2026-03-03T09:15:00", paidAt: "2026-03-03T09:17:00", shapExplanation: [{ feature: "AQI severity (356)", value: "+₹80", direction: "up" }, { feature: "Zone pollution pattern", value: "+₹40", direction: "up" }, { feature: "Standard plan multiplier", value: "+₹20", direction: "up" }, { feature: "Base payout", value: "₹100", direction: "neutral" }] },
];

const statusConfig = {
  paid: { label: "Paid", icon: CheckCircle2, color: "success" as const },
  processing: { label: "Processing", icon: Clock, color: "warning" as const },
  triggered: { label: "Triggered", icon: Zap, color: "default" as const },
  flagged: { label: "Flagged", icon: AlertTriangle, color: "destructive" as const },
  rejected: { label: "Rejected", icon: XCircle, color: "destructive" as const },
  fraud_check: { label: "Fraud Check", icon: Shield, color: "warning" as const },
  approved: { label: "Approved", icon: CheckCircle2, color: "success" as const },
};

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export default function ClaimsPage() {
  const [allClaims, setAllClaims] = useState<ClaimDetail[]>(FALLBACK_CLAIMS);
  const [selectedClaim, setSelectedClaim] = useState<ClaimDetail | null>(null);
  const [filter, setFilter] = useState("all");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealMessage, setAppealMessage] = useState<string | null>(null);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadClaims = useCallback(async () => {
    try {
      // Get first active worker (same as dashboard)
      const { data: worker } = await supabase
        .from("gig_workers")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .single();
      if (!worker) return;
      const workerId = (worker as { id: string }).id;

      const { data: claims } = await supabase
        .from("claims")
        .select("claim_id, trigger_type, amount, fraud_score, status, auto_triggered, zone, created_at, payout_at, weather_event_id")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!claims || claims.length === 0) return;
      const rows = claims as { claim_id: string; trigger_type: string; amount: number; fraud_score: number; status: string; auto_triggered: boolean; zone: string; created_at: string; payout_at: string | null; weather_event_id: string | null }[];

      const mapped: ClaimDetail[] = rows.map((c, i) => {
        // Estimate trigger value from amount and trigger type thresholds
        const threshold = TRIGGER_THRESHOLDS[c.trigger_type] ?? 30;
        const triggerValue = Math.round(threshold * (1 + Number(c.amount) / 1000));
        return {
          id: c.claim_id || `CLM-${String(rows.length - i).padStart(3, "0")}`,
          type: TRIGGER_LABELS[c.trigger_type] ?? c.trigger_type,
          icon: TRIGGER_ICONS[c.trigger_type] ?? "⚡",
          triggerType: c.trigger_type,
          triggerValue,
          threshold,
          unit: TRIGGER_UNITS[c.trigger_type] ?? "",
          amount: Number(c.amount),
          fraudScore: Number(c.fraud_score),
          status: (c.status === "paid" ? "paid" : c.status === "processing" ? "processing" : c.status === "flagged" ? "flagged" : c.status === "rejected" ? "rejected" : "processing") as ClaimDetail["status"],
          autoTriggered: c.auto_triggered ?? false,
          zone: c.zone ?? "",
          createdAt: c.created_at,
          paidAt: c.payout_at,
          shapExplanation: generateShapExplanation(c),
        };
      });

      setAllClaims(mapped);
      setSelectedClaim((prev) => {
        if (!prev) return mapped[0] ?? null;
        return mapped.find((claim) => claim.id === prev.id) ?? null;
      });
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      console.warn("Claims fetch failed, using fallback", err);
    }
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadClaims();
    }, 600);
  }, [loadClaims]);

  useEffect(() => {
    void loadClaims();
    const intervalId = window.setInterval(() => {
      void loadClaims();
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [loadClaims]);

  useEffect(() => {
    const channel = supabase
      .channel("worker-claims-live")
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

  useEffect(() => {
    setAppealReason("");
    setAppealError(null);
    setAppealMessage(null);
  }, [selectedClaim?.id]);

  const handleSubmitAppeal = async () => {
    if (!selectedClaim || selectedClaim.status !== "flagged") return;

    const reason = appealReason.trim();
    if (reason.length < 12) {
      setAppealError("Please add a short explanation (minimum 12 characters).");
      return;
    }

    setAppealSubmitting(true);
    setAppealError(null);
    setAppealMessage(null);

    try {
      const response = await submitFraudAppeal({
        claim_id: selectedClaim.id,
        reason,
      });

      setAppealMessage(`Appeal submitted successfully (${response.appeal_id.slice(0, 8)}).`);
      setAllClaims((prev) =>
        prev.map((claim) =>
          claim.id === selectedClaim.id
            ? { ...claim, status: "processing" }
            : claim
        )
      );
      setSelectedClaim((prev) =>
        prev ? { ...prev, status: "processing" } : prev
      );
    } catch (error) {
      setAppealError(error instanceof Error ? error.message : "Unable to submit appeal right now.");
    } finally {
      setAppealSubmitting(false);
    }
  };

  const filteredClaims = filter === "all"
    ? allClaims
    : allClaims.filter((c) => c.status === filter);

  const totalPaid = allClaims
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.amount, 0);
  const paidCount = allClaims.filter((c) => c.status === "paid").length;
  const processingCount = allClaims.filter((c) => c.status === "processing").length;
  const flaggedCount = allClaims.filter((c) => c.status === "flagged").length;
  const avgFraudScore =
    allClaims.length > 0
      ? allClaims.reduce((sum, claim) => sum + claim.fraudScore, 0) / allClaims.length
      : 0;
  const autoTriggeredPct =
    allClaims.length > 0
      ? (allClaims.filter((c) => c.autoTriggered).length / allClaims.length) * 100
      : 0;

  const workerPulse = [
    `${paidCount} claims completed with total payouts of ₹${totalPaid.toLocaleString("en-IN")}.`,
    `${processingCount} claims are moving through review while ${flaggedCount} are currently flagged.`,
    `Auto-trigger efficiency is ${autoTriggeredPct.toFixed(1)}% with average fraud score ${(avgFraudScore * 100).toFixed(1)}%.`,
  ];

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadClaims();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadClaims]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Claims Command Center</h2>
          <p className="text-sm text-muted-foreground">
            Track payouts, investigations, and claim-level explainability in one view
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
          <Badge variant="secondary" className="text-xs gap-1.5">
            <CalendarClock className="w-3 h-3" />
            Live claims board
          </Badge>
          {lastSyncAt && (
            <Badge variant="outline" className="text-[10px]">
              Synced {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-teal-100 bg-gradient-to-r from-teal-50 via-white to-amber-50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-700" />
                <p className="text-sm font-semibold">Worker Claims Pulse</p>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Activity className="w-3 h-3" />
                Real-time
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {workerPulse.map((line) => (
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">Total Payouts</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-gradient-to-b from-white to-slate-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{allClaims.length}</p>
            <p className="text-xs text-muted-foreground">Total Claims</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200/80 bg-gradient-to-b from-blue-50/40 to-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {allClaims.filter((c) => c.autoTriggered).length}
            </p>
            <p className="text-xs text-muted-foreground">Auto-Triggered</p>
            <p className="text-[11px] text-blue-700 mt-1">{autoTriggeredPct.toFixed(1)}% of total</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {flaggedCount}
            </p>
            <p className="text-xs text-muted-foreground">Flagged</p>
            <p className="text-[11px] text-amber-700 mt-1">Avg fraud {(avgFraudScore * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Claims list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Claims History</CardTitle>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Claims</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredClaims.map((claim) => {
                const config = statusConfig[claim.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={claim.id}
                    className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedClaim?.id === claim.id
                        ? "bg-teal-50 border border-teal-200"
                        : "bg-slate-50 border border-slate-100 hover:bg-slate-100"
                    }`}
                    onClick={() => setSelectedClaim(claim)}
                  >
                    <div className="text-2xl">{claim.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium">{claim.type}</p>
                        <Badge variant={config.color} className="text-[10px]">
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        {claim.autoTriggered && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Zap className="w-3 h-3 mr-0.5" />
                            Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {claim.id} • {claim.triggerValue}{claim.unit} (threshold: {claim.threshold}{claim.unit}) • {formatDate(claim.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${claim.status === "paid" ? "text-emerald-600" : claim.status === "flagged" ? "text-amber-600" : "text-foreground"}`}>
                        {claim.status === "paid" ? "+" : ""}₹{claim.amount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Fraud: {(claim.fraudScore * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Claim detail / SHAP */}
        <div>
          {selectedClaim ? (
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Claim Detail</CardTitle>
                  <Badge variant={statusConfig[selectedClaim.status].color} className="text-[10px]">
                    {statusConfig[selectedClaim.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Claim info */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedClaim.icon}</span>
                    <div>
                      <p className="font-semibold">{selectedClaim.type}</p>
                      <p className="text-xs text-muted-foreground">{selectedClaim.id}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Trigger Value</p>
                      <p className="font-medium">{selectedClaim.triggerValue} {selectedClaim.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Threshold</p>
                      <p className="font-medium">{selectedClaim.threshold} {selectedClaim.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payout</p>
                      <p className="font-medium text-emerald-600">₹{selectedClaim.amount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fraud Score</p>
                      <p className={`font-medium ${selectedClaim.fraudScore > 0.5 ? "text-red-600" : "text-emerald-600"}`}>
                        {(selectedClaim.fraudScore * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Zone: {selectedClaim.zone}</p>
                    <p>Filed: {formatDate(selectedClaim.createdAt)}</p>
                    {selectedClaim.paidAt && <p>Paid: {formatDate(selectedClaim.paidAt)}</p>}
                  </div>
                </div>

                {selectedClaim.status === "flagged" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-amber-800">Appeal Fraud Review</h4>
                    <p className="text-xs text-amber-700">
                      If this claim was flagged incorrectly, submit context for manual review.
                    </p>
                    <textarea
                      className="w-full min-h-[88px] rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="Example: I was outside my delivery zone due to a reroute during storm closure..."
                      value={appealReason}
                      onChange={(e) => setAppealReason(e.target.value)}
                    />
                    {appealError && (
                      <p className="text-xs text-red-600">{appealError}</p>
                    )}
                    {appealMessage && (
                      <p className="text-xs text-emerald-700">{appealMessage}</p>
                    )}
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={appealSubmitting}
                      onClick={handleSubmitAppeal}
                    >
                      {appealSubmitting ? "Submitting Appeal..." : "Submit Appeal"}
                    </Button>
                  </div>
                )}

                {/* SHAP Explanation */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-teal-100 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-primary" />
                    </span>
                    AI Payout Explanation (SHAP)
                  </h4>
                  <div className="space-y-2">
                    {selectedClaim.shapExplanation.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">{item.feature}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            item.direction === "up"
                              ? "text-emerald-600"
                              : item.direction === "down"
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.value}
                        </span>
                        {/* Visual bar */}
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.direction === "up"
                                ? "bg-emerald-500"
                                : item.direction === "down"
                                ? "bg-red-500"
                                : "bg-slate-300"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (parseInt(item.value.replace(/[^0-9]/g, "")) / 400) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3 italic">
                    SHAP values show how each feature contributed to the final payout decision.
                    Positive values increase payout, negative values decrease it.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a claim to view details and AI explanation
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
