"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Download,
  Zap,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchRecentClaims } from "@/lib/data";
import type { RecentClaim } from "@/types/database";

const TRIGGER_LABELS: Record<string, string> = {
  heavy_rain: "Heavy Rain",
  aqi: "AQI Spike",
  heatwave: "Heatwave",
  flood: "Flood",
  storm: "Storm",
  curfew: "Curfew",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

interface ClaimRow {
  id: string;
  worker: string;
  workerId: string;
  city: string;
  zone: string;
  trigger: string;
  rainfall: string;
  amount: number;
  status: string;
  autoTriggered: boolean;
  fraudScore: number;
  date: string;
  processTime: string;
}

const FALLBACK_CLAIMS: ClaimRow[] = [
  { id: "CLM-2024-1247", worker: "Ravi Patel", workerId: "GW-001", city: "Mumbai", zone: "Andheri West", trigger: "Heavy Rain", rainfall: "48mm/hr", amount: 850, status: "paid", autoTriggered: true, fraudScore: 0.05, date: "2025-01-15", processTime: "47s" },
  { id: "CLM-2024-1246", worker: "Priya Sharma", workerId: "GW-002", city: "Delhi", zone: "Connaught Place", trigger: "AQI Spike", rainfall: "AQI 385", amount: 1200, status: "paid", autoTriggered: true, fraudScore: 0.08, date: "2025-01-15", processTime: "32s" },
  { id: "CLM-2024-1245", worker: "Vikram Reddy", workerId: "GW-005", city: "Hyderabad", zone: "Banjara Hills", trigger: "Heavy Rain", rainfall: "62mm/hr", amount: 1800, status: "flagged", autoTriggered: false, fraudScore: 0.72, date: "2025-01-14", processTime: "—" },
  { id: "CLM-2024-1244", worker: "Anjali Nair", workerId: "GW-008", city: "Bangalore", zone: "Indiranagar", trigger: "Flood", rainfall: "120mm/hr", amount: 2400, status: "processing", autoTriggered: true, fraudScore: 0.12, date: "2025-01-14", processTime: "—" },
  { id: "CLM-2024-1243", worker: "Rajesh Kumar", workerId: "GW-007", city: "Delhi", zone: "Dwarka", trigger: "Storm", rainfall: "Wind 72km/h", amount: 1500, status: "rejected", autoTriggered: false, fraudScore: 0.89, date: "2025-01-13", processTime: "—" },
  { id: "CLM-2024-1242", worker: "Meena Kumari", workerId: "GW-006", city: "Mumbai", zone: "Bandra", trigger: "Heavy Rain", rainfall: "55mm/hr", amount: 950, status: "paid", autoTriggered: true, fraudScore: 0.03, date: "2025-01-13", processTime: "28s" },
];

function mapRecentClaim(c: RecentClaim): ClaimRow {
  return {
    id: c.claim_id,
    worker: c.worker_name,
    workerId: c.worker_gw_id,
    city: c.city,
    zone: c.zone,
    trigger: TRIGGER_LABELS[c.trigger_type] ?? c.trigger_type,
    rainfall: c.trigger_type,
    amount: Number(c.amount),
    status: c.status,
    autoTriggered: c.auto_triggered,
    fraudScore: c.fraud_score,
    date: c.created_at?.split("T")[0] ?? "",
    processTime: c.process_time ?? "—",
  };
}

const statusConfig: Record<string, { color: BadgeVariant; icon: typeof CheckCircle }> = {
  paid: { color: "success", icon: CheckCircle },
  processing: { color: "warning", icon: Clock },
  flagged: { color: "destructive", icon: AlertTriangle },
  rejected: { color: "secondary", icon: XCircle },
};

export default function AdminClaims() {
  const [claims, setClaims] = useState<ClaimRow[]>(FALLBACK_CLAIMS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentClaims(200).then((data) => {
      if (data.length > 0) setClaims(data.map(mapRecentClaim));
      setLoading(false);
    });
  }, []);

  const exportCSV = () => {
    const headers = ["Claim ID", "Worker", "Worker ID", "City", "Zone", "Trigger", "Amount", "Status", "Auto-Triggered", "Fraud Score", "Date"];
    const rows = filtered.map((c) =>
      [c.id, c.worker, c.workerId, c.city, c.zone, c.trigger, c.amount, c.status, c.autoTriggered, (c.fraudScore * 100).toFixed(0) + "%", c.date].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gigcover-claims-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = claims.filter((c) => {
    const matchSearch =
      c.worker.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPaid = claims.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0);
  const autoRate = ((claims.filter((c) => c.autoTriggered).length / claims.length) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Claims</p>
            <p className="text-2xl font-bold">{claims.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Payouts</p>
            <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Auto-Trigger Rate</p>
            <p className="text-2xl font-bold">{autoRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Flagged</p>
            <p className="text-2xl font-bold text-red-600">
              {claims.filter((c) => c.status === "flagged").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search claims..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "paid", "processing", "flagged", "rejected"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "ghost"}
                  size="sm"
                  className="capitalize"
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : filtered.map((claim) => {
            const cfg = statusConfig[claim.status];
            return (
              <Card
                key={claim.id}
                className={`cursor-pointer transition-all hover:border-slate-300 ${
                  selectedClaim?.id === claim.id ? "border-teal-200 bg-teal-50" : ""
                }`}
                onClick={() => setSelectedClaim(claim)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground">{claim.id}</span>
                      {claim.autoTriggered && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Zap className="w-2.5 h-2.5" /> Auto
                        </Badge>
                      )}
                    </div>
                    <Badge variant={cfg.color} className="text-xs capitalize">
                      {claim.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{claim.worker}</p>
                      <p className="text-xs text-muted-foreground">
                        {claim.city} · {claim.zone} · {claim.trigger} ({claim.rainfall})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(claim.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(claim.date)}</p>
                    </div>
                  </div>
                  {claim.fraudScore > 0.5 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-md px-2 py-1">
                      <AlertTriangle className="w-3 h-3" />
                      High fraud score: {(claim.fraudScore * 100).toFixed(0)}%
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Claim Detail */}
        <Card className="h-fit sticky top-4">
          <CardHeader>
            <CardTitle className="text-base">Claim Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClaim ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Claim ID</span>
                    <span className="font-mono">{selectedClaim.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Worker</span>
                    <span>{selectedClaim.worker} ({selectedClaim.workerId})</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Location</span>
                    <span>{selectedClaim.city}, {selectedClaim.zone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trigger</span>
                    <span>{selectedClaim.trigger}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reading</span>
                    <span>{selectedClaim.rainfall}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold">{formatCurrency(selectedClaim.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Process Time</span>
                    <span>{selectedClaim.processTime}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-muted-foreground mb-2">AI Fraud Assessment</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            selectedClaim.fraudScore > 0.7
                              ? "bg-red-500"
                              : selectedClaim.fraudScore > 0.4
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${selectedClaim.fraudScore * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold">
                      {(selectedClaim.fraudScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Bot className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-xs text-muted-foreground">
                      {selectedClaim.fraudScore > 0.7
                        ? "High risk — Manual review required"
                        : selectedClaim.fraudScore > 0.4
                        ? "Moderate risk — Additional verification recommended"
                        : "Low risk — Safe to auto-approve"
                      }
                    </span>
                  </div>
                </div>

                {(selectedClaim.status === "flagged" || selectedClaim.status === "processing") && (
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" className="flex-1 gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1 gap-1.5">
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a claim to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
