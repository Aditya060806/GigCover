"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  CheckCircle2,
  Calendar,
  MapPin,
  Zap,
  TrendingUp,
  RotateCw,
  Loader2,
  Activity,
  Clock3,
  Sparkles,
} from "lucide-react";
import { PLAN_TIERS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { Claim, GigWorker, Policy } from "@/types/database";

interface WorkerContext {
  id: string;
  name: string;
  city: string;
  zone: string;
  plan: string;
  weeklyPremium: number;
  maxPayout: number;
}

const DEFAULT_WORKER_CONTEXT: WorkerContext = {
  id: "",
  name: "Ravi Patel",
  city: "Mumbai",
  zone: "Andheri",
  plan: "standard",
  weeklyPremium: 25,
  maxPayout: 1500,
};

function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PolicyPage() {
  const [workerContext, setWorkerContext] = useState<WorkerContext>(DEFAULT_WORKER_CONTEXT);
  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadPolicyData = useCallback(async () => {
    try {
      const { data: worker } = await supabase
        .from("gig_workers")
        .select("id, name, city, zone, plan, weekly_premium, max_payout")
        .eq("status", "active")
        .limit(1)
        .single();

      if (!worker) {
        setLoading(false);
        return;
      }

      const workerRow = worker as Pick<GigWorker, "id" | "name" | "city" | "zone" | "plan" | "weekly_premium" | "max_payout">;
      setWorkerContext({
        id: workerRow.id,
        name: workerRow.name,
        city: workerRow.city,
        zone: workerRow.zone,
        plan: workerRow.plan,
        weeklyPremium: Number(workerRow.weekly_premium),
        maxPayout: Number(workerRow.max_payout),
      });

      const [policyResult, claimsResult] = await Promise.all([
        supabase
          .from("policies")
          .select("*")
          .eq("worker_id", workerRow.id)
          .eq("status", "active")
          .order("coverage_start", { ascending: false })
          .limit(1)
          .returns<Policy[]>(),
        supabase
          .from("claims")
          .select("*")
          .eq("worker_id", workerRow.id)
          .order("created_at", { ascending: false })
          .limit(200)
          .returns<Claim[]>(),
      ]);

      setActivePolicy((policyResult.data && policyResult.data[0]) ?? null);
      setClaims(claimsResult.data ?? []);
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
      void loadPolicyData();
    }, 550);
  }, [loadPolicyData]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadPolicyData();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadPolicyData]);

  useEffect(() => {
    void loadPolicyData();

    const intervalId = window.setInterval(() => {
      void loadPolicyData();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadPolicyData]);

  useEffect(() => {
    const channel = supabase
      .channel("worker-policy-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "policies" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gig_workers" },
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

  const planId = activePolicy?.plan ?? workerContext.plan ?? "standard";
  const currentPlan = PLAN_TIERS.find((plan) => plan.id === planId) ?? PLAN_TIERS[1];

  const coverageStart = new Date(activePolicy?.coverage_start ?? Date.now() - 18 * 24 * 60 * 60 * 1000);
  const coverageEnd = activePolicy?.coverage_end
    ? new Date(activePolicy.coverage_end)
    : new Date(coverageStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const totalDays = Math.max(
    1,
    Math.ceil((coverageEnd.getTime() - coverageStart.getTime()) / (24 * 60 * 60 * 1000))
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((coverageEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );
  const usagePercent = Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100);

  const totalClaimsPaid = claims
    .filter((claim) => claim.status === "paid")
    .reduce((sum, claim) => sum + Number(claim.amount), 0);
  const claimsFiled = claims.length;
  const autoTriggered = claims.filter((claim) => claim.auto_triggered).length;
  const avgFraudScore = claims.length > 0
    ? claims.reduce((sum, claim) => sum + Number(claim.fraud_score), 0) / claims.length
    : 0;
  const riskMultiplier = 1 + avgFraudScore * 0.8;

  const elapsedDays = Math.max(1, Math.ceil((Date.now() - coverageStart.getTime()) / (24 * 60 * 60 * 1000)));
  const premiumCyclesPaid = Math.max(1, Math.ceil(elapsedDays / 7));
  const totalPremiumsPaid = premiumCyclesPaid * Number(workerContext.weeklyPremium || currentPlan.weeklyPremium);
  const roiMultiple = totalPremiumsPaid > 0 ? totalClaimsPaid / totalPremiumsPaid : 0;

  const policyPulse = [
    `${claimsFiled} claims have been filed in this coverage cycle with ${autoTriggered} auto-triggered approvals.`,
    `${formatCurrency(totalClaimsPaid)} paid out against ${formatCurrency(totalPremiumsPaid)} in premiums over ${premiumCyclesPaid} billing cycles.`,
    `Live risk multiplier is ${riskMultiplier.toFixed(2)}x and current policy utilization is ${usagePercent.toFixed(0)}%.`,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Policy Coverage Command</h2>
          <p className="text-sm text-muted-foreground">
            Live policy status, payout performance, and coverage utilization analytics
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
            Policy Live
          </Badge>
          {lastSyncAt && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Clock3 className="w-3 h-3" />
              Synced {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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
            <p className="text-sm font-semibold text-slate-900">Coverage Ops Pulse</p>
            {policyPulse.map((line) => (
              <p key={line} className="text-xs text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Claims Filed</p>
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{claimsFiled}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{autoTriggered} auto-triggered approvals</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Payouts</p>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalClaimsPaid)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Protected payout delivered</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Premiums Paid</p>
              <Zap className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalPremiumsPaid)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Across {premiumCyclesPaid} cycles</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">ROI Multiple</p>
              <Shield className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{roiMultiple.toFixed(1)}x</p>
            <p className="text-[11px] text-muted-foreground mt-1">Risk multiplier {riskMultiplier.toFixed(2)}x</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Policy Card */}
      <Card className="relative overflow-hidden border-slate-200 bg-white/95">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-slate-50 to-transparent" />
        <CardContent className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{currentPlan.name}</h2>
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {activePolicy?.status ? titleCase(activePolicy.status) : "Active"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {currentPlan.description}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Expires {coverageEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{workerContext.zone}, {workerContext.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Auto-renew {activePolicy?.auto_renew ? "ON" : "OFF"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <p className="text-3xl font-bold text-teal-600">
                  {formatCurrency(workerContext.weeklyPremium || currentPlan.weeklyPremium)}
                </p>
                <p className="text-xs text-muted-foreground">per week</p>
              </div>
              <p className="text-sm">
                Max payout:{" "}
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(workerContext.maxPayout || currentPlan.maxPayout)}/event
                </span>
              </p>
            </div>
          </div>

          {/* Coverage period progress */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Coverage Period</span>
              <span>{daysRemaining} days remaining</span>
            </div>
            <Progress value={usagePercent} />
          </div>
        </CardContent>
      </Card>

      {/* Plan features + Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Features */}
        <Card className="border-slate-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">Plan Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentPlan.features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Coverage stats */}
        <Card className="border-slate-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">Coverage Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalClaimsPaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Claims Paid</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{claimsFiled}</p>
                <p className="text-xs text-muted-foreground mt-1">Claims Filed</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-teal-600">{autoTriggered}</p>
                <p className="text-xs text-muted-foreground mt-1">Auto-Triggered</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{riskMultiplier.toFixed(1)}x</p>
                <p className="text-xs text-muted-foreground mt-1">Risk Multiplier</p>
              </div>
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium">ROI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;ve paid <span className="text-foreground font-medium">{formatCurrency(totalPremiumsPaid)}</span> in premiums and received{" "}
                <span className="text-emerald-600 font-medium">{formatCurrency(totalClaimsPaid)}</span> in payouts.
                That&apos;s a <span className="text-emerald-600 font-bold">{roiMultiple.toFixed(1)}x</span> return.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade section */}
      <Card className="border-slate-200 bg-white/95">
        <CardHeader>
          <CardTitle className="text-base">Upgrade Your Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_TIERS.map((plan) => {
              const isCurrent = plan.id === currentPlan.id;
              return (
                <div
                  key={plan.id}
                  className={`bg-white border border-slate-200 rounded-xl p-4 ${
                    isCurrent ? "border-teal-300 ring-1 ring-teal-200" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {isCurrent && (
                      <Badge variant="default" className="text-[10px]">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold mb-1">₹{plan.weeklyPremium}<span className="text-sm text-muted-foreground font-normal">/wk</span></p>
                  <p className="text-xs text-muted-foreground mb-4">Up to ₹{plan.maxPayout}/event</p>
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-xs text-muted-foreground text-center py-2">Loading live policy signals...</div>
      )}
    </div>
  );
}
