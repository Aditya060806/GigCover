"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  IndianRupee,
  Plus,
  Download,
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

const balanceHistory = [
  { date: "Feb 1", balance: 500 },
  { date: "Feb 8", balance: 475 },
  { date: "Feb 15", balance: 1275 },
  { date: "Feb 20", balance: 2050 },
  { date: "Feb 25", balance: 2025 },
  { date: "Mar 1", balance: 2345 },
  { date: "Mar 4", balance: 2450 },
];

const transactions = [
  { id: 1, type: "claim_payout", amount: 400, description: "Heavy Rain — Auto Payout", date: "Mar 4, 2:30 PM", ref: "CLM-007" },
  { id: 2, type: "premium_payment", amount: -25, description: "Weekly Premium — Standard Shield", date: "Mar 3, 12:00 AM", ref: "PMT-045" },
  { id: 3, type: "claim_payout", amount: 240, description: "AQI Hazardous — Auto Payout", date: "Mar 3, 9:17 AM", ref: "CLM-006" },
  { id: 4, type: "claim_payout", amount: 320, description: "Severe Storm — Auto Payout", date: "Mar 1, 6:48 PM", ref: "CLM-005" },
  { id: 5, type: "premium_payment", amount: -25, description: "Weekly Premium — Standard Shield", date: "Feb 24, 12:00 AM", ref: "PMT-044" },
  { id: 6, type: "claim_payout", amount: 200, description: "Extreme Heat — Auto Payout", date: "Feb 25, 12:02 PM", ref: "CLM-003" },
  { id: 7, type: "claim_payout", amount: 800, description: "Flooding — Auto Payout", date: "Feb 20, 8:03 AM", ref: "CLM-002" },
  { id: 8, type: "premium_payment", amount: -25, description: "Weekly Premium — Standard Shield", date: "Feb 17, 12:00 AM", ref: "PMT-043" },
  { id: 9, type: "claim_payout", amount: 800, description: "Curfew — Admin Triggered Payout", date: "Feb 15, 12:05 AM", ref: "CLM-001" },
  { id: 10, type: "bonus", amount: 500, description: "Welcome Bonus — First Policy", date: "Feb 1, 10:00 AM", ref: "BON-001" },
];

type WalletTransaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  date: string;
  ref: string;
};

export default function WalletPage() {
  const [chartsReady, setChartsReady] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(transactions);

  useEffect(() => {
    setChartsReady(true);

    try {
      const raw = localStorage.getItem("gigcover_latest_payment");
      if (!raw) return;

      const parsed = JSON.parse(raw) as WalletTransaction;
      setWalletTransactions((prev) => {
        if (prev.some((t) => t.ref === parsed.ref)) return prev;
        return [parsed, ...prev];
      });
    } catch {
      // Ignore invalid storage payloads
    }
  }, []);

  const totalIncome = walletTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalSpent = Math.abs(walletTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50/30" />
        <CardContent className="relative p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Wallet Balance</p>
              <div className="flex items-baseline gap-1">
                <IndianRupee className="w-8 h-8 text-foreground" />
                <span className="text-5xl font-bold text-foreground">2,450</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>₹{totalIncome.toLocaleString("en-IN")} received</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>₹{totalSpent.toLocaleString("en-IN")} premiums</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button size="sm">
                <Download className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
              <Button variant="outline" size="sm">
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
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Balance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {chartsReady ? (
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
                    <Area type="monotone" dataKey="balance" stroke="#0d9488" fill="url(#balGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-slate-100" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium">This Month</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payouts</span>
                  <span className="text-emerald-600 font-medium">+₹960</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Premiums</span>
                  <span className="text-red-600 font-medium">-₹25</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Net</span>
                  <span className="font-bold text-emerald-600">+₹935</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">UPI ID</p>
              <p className="text-sm font-medium">ravi.patel@upi</p>
              <p className="text-xs text-muted-foreground mt-3 mb-1">Next Premium</p>
              <p className="text-sm font-medium">₹25 on Mar 10</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {walletTransactions.map((tx) => (
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
              <span
                className={`text-sm font-semibold shrink-0 ${
                  tx.amount > 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
