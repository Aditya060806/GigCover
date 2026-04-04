"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  IndianRupee,
  Plus,
  Download,
  RotateCw,
  Loader2,
  Activity,
  Wallet2,
  Clock3,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchTransactions } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { GigWorker, Transaction } from "@/types/database";

const FALLBACK_BALANCE_HISTORY = [
  { date: "Feb 1", balance: 500 },
  { date: "Feb 8", balance: 475 },
  { date: "Feb 15", balance: 1275 },
  { date: "Feb 20", balance: 2050 },
  { date: "Feb 25", balance: 2025 },
  { date: "Mar 1", balance: 2345 },
  { date: "Mar 4", balance: 2450 },
];

const FALLBACK_TRANSACTIONS = [
  { id: "demo-1", type: "claim_payout", amount: 400, description: "Heavy Rain — Auto Payout", date: "Mar 4, 2:30 PM", ref: "CLM-007", createdAt: "2026-03-04T14:30:00", status: "completed" },
  { id: "demo-2", type: "premium_payment", amount: -25, description: "Weekly Premium — Standard Shield", date: "Mar 3, 12:00 AM", ref: "PMT-045", createdAt: "2026-03-03T00:00:00", status: "completed" },
  { id: "demo-3", type: "claim_payout", amount: 240, description: "AQI Hazardous — Auto Payout", date: "Mar 3, 9:17 AM", ref: "CLM-006", createdAt: "2026-03-03T09:17:00", status: "completed" },
  { id: "demo-4", type: "claim_payout", amount: 320, description: "Severe Storm — Auto Payout", date: "Mar 1, 6:48 PM", ref: "CLM-005", createdAt: "2026-03-01T18:48:00", status: "completed" },
  { id: "demo-5", type: "premium_payment", amount: -25, description: "Weekly Premium — Standard Shield", date: "Feb 24, 12:00 AM", ref: "PMT-044", createdAt: "2026-02-24T00:00:00", status: "completed" },
  { id: "demo-6", type: "claim_payout", amount: 200, description: "Extreme Heat — Auto Payout", date: "Feb 25, 12:02 PM", ref: "CLM-003", createdAt: "2026-02-25T12:02:00", status: "completed" },
  { id: "demo-7", type: "claim_payout", amount: 800, description: "Flooding — Auto Payout", date: "Feb 20, 8:03 AM", ref: "CLM-002", createdAt: "2026-02-20T08:03:00", status: "completed" },
  { id: "demo-8", type: "premium_payment", amount: -25, description: "Weekly Premium — Standard Shield", date: "Feb 17, 12:00 AM", ref: "PMT-043", createdAt: "2026-02-17T00:00:00", status: "completed" },
  { id: "demo-9", type: "claim_payout", amount: 800, description: "Curfew — Admin Triggered Payout", date: "Feb 15, 12:05 AM", ref: "CLM-001", createdAt: "2026-02-15T00:05:00", status: "completed" },
  { id: "demo-10", type: "bonus", amount: 500, description: "Welcome Bonus — First Policy", date: "Feb 1, 10:00 AM", ref: "BON-001", createdAt: "2026-02-01T10:00:00", status: "completed" },
];

const CHART_DURATION_FAST = 560;
const CHART_DURATION_MEDIUM = 820;

type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  ref: string;
  createdAt: string;
  status: string;
};

interface WorkerContext {
  id: string;
  name: string;
  plan: string;
  weeklyPremium: number;
  maxPayout: number;
  walletHint: number;
}

interface StoredPayment {
  id?: number | string;
  type?: string;
  amount: number;
  description: string;
  date: string;
  ref: string;
}

function prettifyType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferSignedAmount(type: string, amount: number): number {
  if (amount < 0) return amount;
  const normalizedType = type.toLowerCase();
  const isDebit =
    normalizedType.includes("premium") ||
    normalizedType.includes("withdraw") ||
    normalizedType.includes("debit") ||
    normalizedType.includes("fee");
  return isDebit ? -Math.abs(amount) : Math.abs(amount);
}

function mapDbTransaction(tx: Transaction): WalletTransaction {
  const createdAt = tx.created_at;
  const signedAmount = inferSignedAmount(tx.type, Number(tx.amount));
  const ref = tx.claim_id ?? `TX-${tx.id.slice(0, 6).toUpperCase()}`;

  return {
    id: tx.id,
    type: tx.type,
    amount: signedAmount,
    description: tx.description ?? prettifyType(tx.type),
    date: new Date(createdAt).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    ref,
    createdAt,
    status: tx.status,
  };
}

function mapStoredPayment(tx: StoredPayment): WalletTransaction {
  const parsedDate = new Date(tx.date);
  const createdAt = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();

  return {
    id: String(tx.id ?? tx.ref),
    type: tx.type ?? "claim_payout",
    amount: inferSignedAmount(tx.type ?? "claim_payout", Number(tx.amount)),
    description: tx.description,
    date: Number.isNaN(parsedDate.getTime())
      ? tx.date
      : parsedDate.toLocaleString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    ref: tx.ref,
    createdAt,
    status: "completed",
  };
}

export default function WalletPage() {
  const [chartsReady, setChartsReady] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(FALLBACK_TRANSACTIONS);
  const [workerContext, setWorkerContext] = useState<WorkerContext | null>(null);
  const [hasLiveLedger, setHasLiveLedger] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadWalletData = useCallback(async () => {
    try {
      const { data: worker, error: workerError } = await supabase
        .from("gig_workers")
        .select("id, name, plan, weekly_premium, max_payout, total_earnings, total_payouts")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (workerError || !worker) {
        setWorkerContext(null);
        setWalletTransactions(FALLBACK_TRANSACTIONS);
        setHasLiveLedger(false);
        setLastSyncAt(new Date().toISOString());
        return;
      }

      const workerRow = worker as Pick<GigWorker, "id" | "name" | "plan" | "weekly_premium" | "max_payout" | "total_earnings" | "total_payouts">;
      setWorkerContext({
        id: workerRow.id,
        name: workerRow.name,
        plan: workerRow.plan,
        weeklyPremium: Number(workerRow.weekly_premium),
        maxPayout: Number(workerRow.max_payout),
        walletHint: Number(workerRow.total_earnings) - Number(workerRow.total_payouts),
      });

      const liveTransactions = await fetchTransactions(workerRow.id, 120);
      let mapped = liveTransactions.map(mapDbTransaction);

      try {
        const raw = localStorage.getItem("gigcover_latest_payment");
        if (raw) {
          const parsed = JSON.parse(raw) as StoredPayment;
          const localTx = mapStoredPayment(parsed);
          if (!mapped.some((item) => item.ref === localTx.ref)) {
            mapped = [localTx, ...mapped];
          }
        }
      } catch {
        // Ignore malformed local payment cache.
      }

      setWalletTransactions(mapped);
      setHasLiveLedger(true);
      setLastSyncAt(new Date().toISOString());
    } catch {
      setWorkerContext(null);
      setWalletTransactions(FALLBACK_TRANSACTIONS);
      setHasLiveLedger(false);
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
      void loadWalletData();
    }, 600);
  }, [loadWalletData]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadWalletData();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadWalletData]);

  useEffect(() => {
    setChartsReady(true);
    void loadWalletData();

    const intervalId = window.setInterval(() => {
      void loadWalletData();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadWalletData]);

  useEffect(() => {
    const channel = supabase
      .channel("worker-wallet-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
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

  const sortedTransactions = useMemo(
    () => [...walletTransactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [walletTransactions]
  );

  const totalIncome = walletTransactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalSpent = Math.abs(
    walletTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const runningLedgerBalance = walletTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const walletBalance =
    Math.abs(runningLedgerBalance) < 1 && workerContext
      ? workerContext.walletHint
      : runningLedgerBalance;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const monthlyTransactions = walletTransactions.filter(
    (tx) => new Date(tx.createdAt).getTime() >= thirtyDaysAgo
  );
  const monthlyIncome = monthlyTransactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyOutflow = Math.abs(
    monthlyTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const monthlyNet = monthlyIncome - monthlyOutflow;

  const payoutCount = walletTransactions.filter(
    (tx) => tx.amount > 0 && tx.type.toLowerCase().includes("payout")
  ).length;
  const premiumCount = walletTransactions.filter(
    (tx) => tx.amount < 0 || tx.type.toLowerCase().includes("premium")
  ).length;

  const balanceHistory = useMemo(() => {
    const ordered = [...walletTransactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (ordered.length === 0) {
      return hasLiveLedger ? [] : FALLBACK_BALANCE_HISTORY;
    }

    let running = 0;
    const points = ordered.map((tx) => {
      running += tx.amount;
      return {
        date: new Date(tx.createdAt).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        balance: Math.max(0, Math.round(running)),
      };
    });

    return points.slice(-12);
  }, [walletTransactions, hasLiveLedger]);

  const workerName = workerContext?.name ?? "Ravi Patel";
  const upiId = `${workerName.toLowerCase().replace(/\s+/g, ".")}@upi`;
  const nextPremiumDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });

  const walletPulse = hasLiveLedger
    ? [
        walletTransactions.length > 0
          ? `${walletTransactions.length.toLocaleString("en-IN")} ledger events processed with ${payoutCount} payouts and ${premiumCount} premium debits recorded.`
          : "No ledger events in the current live window. New payouts and premium debits will appear here in real time.",
        `${formatCurrency(totalIncome)} credited and ${formatCurrency(totalSpent)} debited across the current wallet history.`,
        `Thirty-day net flow is ${formatCurrency(monthlyNet)} with live sync ${lastSyncAt ? "active" : "pending"}.`,
      ]
    : [
        "Displaying demo fallback ledger because live wallet data is currently unavailable.",
        `${formatCurrency(totalIncome)} credited and ${formatCurrency(totalSpent)} debited across sample treasury activity.`,
        `Thirty-day sample net flow is ${formatCurrency(monthlyNet)} while backend sync reconnects.`,
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Wallet Treasury Console</h2>
          <p className="text-sm text-muted-foreground">
            Live payout ledger, premium debits, and protection cashflow intelligence
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
          <Badge variant={hasLiveLedger ? "success" : "warning"} className="gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasLiveLedger ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            {hasLiveLedger ? "Live backend" : "Demo fallback"}
          </Badge>
          {lastSyncAt && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Clock3 className="w-3 h-3" />
              Synced {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white/80 p-2 text-teal-700 border border-teal-200">
            <Activity className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-900">Treasury Pulse</p>
            {walletPulse.map((line) => (
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
              <p className="text-xs text-muted-foreground">Net Wallet Balance</p>
              <Wallet2 className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(walletBalance)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Running ledger position</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalIncome)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Payouts + bonuses</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Debits</p>
              <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalSpent)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Premium + fee outflow</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Ledger Entries</p>
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{walletTransactions.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{payoutCount} payouts | {premiumCount} premium debits</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Card */}
      <Card className="relative overflow-hidden border-slate-200 bg-white/95">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50/30" />
        <CardContent className="relative p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Wallet Balance</p>
              <div className="flex items-baseline gap-1">
                <IndianRupee className="w-8 h-8 text-foreground" />
                <span className="text-5xl font-bold text-foreground">{Math.max(0, Math.round(walletBalance)).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{formatCurrency(totalIncome)} credited</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{formatCurrency(totalSpent)} debited</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Plan: {workerContext ? `${workerContext.plan.charAt(0).toUpperCase() + workerContext.plan.slice(1)} Shield` : "Standard Shield"}
              </p>
            </div>
            <div className="flex gap-3">
              <Button size="sm" disabled>
                <Download className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Plus className="w-4 h-4 mr-2" />
                Add Funds
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Chart + Transactions */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 border-slate-200 bg-white/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Balance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {loading ? (
                <div className="h-full w-full rounded-lg bg-slate-100 animate-pulse" />
              ) : balanceHistory.length > 0 ? (
                chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceHistory}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.75rem",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                        color: "#0f172a",
                      }}
                      formatter={(value: number | undefined) => [`₹${value ?? 0}`, "Balance"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#0d9488"
                      fill="url(#balGrad)"
                      strokeWidth={2}
                      isAnimationActive={chartsReady}
                      animationBegin={CHART_DURATION_FAST / 6}
                      animationDuration={CHART_DURATION_MEDIUM}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full rounded-lg bg-slate-100" />
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <p className="text-sm font-medium text-slate-800">No live balance movement yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">This chart will populate after the first payout or premium debit posts.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white/95">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium">Last 30 Days</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credits</span>
                  <span className="text-emerald-600 font-medium">+{formatCurrency(monthlyIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Debits</span>
                  <span className="text-red-600 font-medium">-{formatCurrency(monthlyOutflow)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Net</span>
                  <span className={`font-bold ${monthlyNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {monthlyNet >= 0 ? "+" : "-"}{formatCurrency(Math.abs(monthlyNet))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white/95">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">UPI ID</p>
              <p className="text-sm font-medium">{upiId}</p>
              <p className="text-xs text-muted-foreground mt-3 mb-1">Next Premium</p>
              <p className="text-sm font-medium">
                {formatCurrency(workerContext?.weeklyPremium ?? 25)} on {nextPremiumDate}
              </p>
              <p className="text-xs text-muted-foreground mt-3 mb-1">Coverage Ceiling</p>
              <p className="text-sm font-medium">{formatCurrency(workerContext?.maxPayout ?? 1500)} per event</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History */}
      <Card className="border-slate-200 bg-white/95">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedTransactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-800">No transactions to display</p>
              <p className="mt-1 text-xs text-muted-foreground">As soon as your next payout or premium posts, it will appear in this ledger.</p>
            </div>
          ) : (
            sortedTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    tx.amount > 0
                      ? "bg-emerald-50"
                      : "bg-red-50"
                  }`}
                >
                  {tx.amount > 0 ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.ref} • {tx.date}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-semibold ${
                      tx.amount > 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                  </span>
                  <div className="mt-1">
                    <Badge
                      variant={tx.amount > 0 ? "success" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {prettifyType(tx.type)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
