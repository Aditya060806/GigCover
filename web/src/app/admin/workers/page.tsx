"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Search,
  MapPin,
  AlertTriangle,
  Download,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { fetchWorkers } from "@/lib/data";

interface WorkerRow {
  id: string;
  name: string;
  platform: string;
  city: string;
  zone: string;
  plan: string;
  status: string;
  earnings: number;
  claimsCount: number;
  riskScore: number;
  joined: string;
  fraudFlags: number;
}

const FALLBACK_WORKERS: WorkerRow[] = [
  { id: "GW-001", name: "Ravi Patel", platform: "Swiggy", city: "Mumbai", zone: "Andheri West", plan: "Standard", status: "active", earnings: 18500, claimsCount: 3, riskScore: 0.32, joined: "2024-08-15", fraudFlags: 0 },
  { id: "GW-002", name: "Priya Sharma", platform: "Zomato", city: "Delhi", zone: "Connaught Place", plan: "Pro", status: "active", earnings: 22400, claimsCount: 5, riskScore: 0.45, joined: "2024-07-22", fraudFlags: 0 },
  { id: "GW-003", name: "Amit Singh", platform: "Amazon", city: "Bangalore", zone: "Koramangala", plan: "Basic", status: "active", earnings: 15200, claimsCount: 2, riskScore: 0.18, joined: "2024-09-01", fraudFlags: 0 },
  { id: "GW-005", name: "Vikram Reddy", platform: "Zepto", city: "Hyderabad", zone: "Banjara Hills", plan: "Pro", status: "active", earnings: 24800, claimsCount: 7, riskScore: 0.68, joined: "2024-05-18", fraudFlags: 1 },
  { id: "GW-007", name: "Rajesh Kumar", platform: "Zomato", city: "Delhi", zone: "Dwarka", plan: "Basic", status: "suspended", earnings: 12100, claimsCount: 8, riskScore: 0.82, joined: "2024-04-20", fraudFlags: 3 },
];

const platformColors: Record<string, string> = {
  Swiggy: "text-orange-600 bg-orange-50 border-orange-200",
  Zomato: "text-red-600 bg-red-50 border-red-200",
  Amazon: "text-blue-600 bg-blue-50 border-blue-200",
  Zepto: "text-purple-600 bg-purple-50 border-purple-200",
  Blinkit: "text-yellow-600 bg-yellow-50 border-yellow-200",
  Dunzo: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<WorkerRow[]>(FALLBACK_WORKERS);
  const [totalCount, setTotalCount] = useState(FALLBACK_WORKERS.length);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkers(200).then(({ workers: data, count }) => {
      if (data.length > 0) {
        setWorkers(
          data.map((w) => ({
            id: w.worker_id,
            name: w.name,
            platform: w.platform,
            city: w.city,
            zone: w.zone,
            plan: w.plan.charAt(0).toUpperCase() + w.plan.slice(1),
            status: w.status,
            earnings: Number(w.total_earnings),
            claimsCount: w.total_claims,
            riskScore: w.risk_score,
            joined: w.created_at?.split("T")[0] ?? "",
            fraudFlags: w.fraud_flags,
          }))
        );
        setTotalCount(count);
      }
      setLoading(false);
    });
  }, []);

  const exportCSV = () => {
    const headers = ["ID", "Name", "Platform", "City", "Zone", "Plan", "Status", "Earnings", "Risk Score", "Fraud Flags"];
    const rows = filtered.map((w) =>
      [w.id, w.name, w.platform, w.city, w.zone, w.plan, w.status, w.earnings, (w.riskScore * 100).toFixed(0) + "%", w.fraudFlags].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gigcover-workers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = workers.filter((w) => {
    const matchSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.city.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || w.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Worker Management</h2>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} registered workers across 5 cities
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or city..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {["all", "active", "inactive", "suspended"].map((s) => (
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Worker
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Platform
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Location
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Plan
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Earnings
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Risk Score
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.map((worker) => (
                <tr
                  key={worker.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700">
                        {worker.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{worker.name}</p>
                        <p className="text-xs text-muted-foreground">{worker.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-md border ${
                        platformColors[worker.platform] || "text-gray-400"
                      }`}
                    >
                      {worker.platform}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span>{worker.city}</span>
                      <span className="text-muted-foreground">· {worker.zone}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        worker.plan === "Pro"
                          ? "default"
                          : worker.plan === "Standard"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {worker.plan}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm font-medium">
                    {formatCurrency(worker.earnings)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            worker.riskScore > 0.7
                              ? "bg-red-500"
                              : worker.riskScore > 0.4
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${worker.riskScore * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(worker.riskScore * 100).toFixed(0)}%
                      </span>
                      {worker.fraudFlags > 0 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        worker.status === "active"
                          ? "success"
                          : worker.status === "suspended"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs capitalize"
                    >
                      {worker.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No workers match your search</p>
          </div>
        )}
      </Card>
    </div>
  );
}
