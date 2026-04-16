"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Zap,
  ShieldAlert,
  BarChart3,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  RotateCw,
  Loader2,
  Clock3,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/workers", label: "Workers", icon: Users },
  { href: "/admin/claims", label: "Claims", icon: FileText },
  { href: "/admin/triggers", label: "Trigger Panel", icon: Zap },
  { href: "/admin/fraud", label: "Fraud Detection", icon: ShieldAlert },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openAppeals, setOpenAppeals] = useState(0);
  const [investigatingCount, setInvestigatingCount] = useState(0);
  const [firedRuns24h, setFiredRuns24h] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadShellStatus = useCallback(async (showSpinner = false) => {
    if (showSpinner) setSyncing(true);
    try {
      const [appealsResult, fraudResult, runsResult] = await Promise.all([
        supabase
          .from("claim_appeals")
          .select("id", { head: true, count: "exact" })
          .in("status", ["submitted", "under_review"]),
        supabase
          .from("fraud_logs")
          .select("id", { head: true, count: "exact" })
          .eq("status", "investigating"),
        supabase
          .from("incident_runs")
          .select("id", { head: true, count: "exact" })
          .eq("mode", "fire")
          .gte("started_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      setOpenAppeals(appealsResult.count ?? 0);
      setInvestigatingCount(fraudResult.count ?? 0);
      setFiredRuns24h(runsResult.count ?? 0);
      setLastSyncAt(new Date().toISOString());
    } finally {
      if (showSpinner) setSyncing(false);
    }
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadShellStatus();
    }, 600);
  }, [loadShellStatus]);

  useEffect(() => {
    void loadShellStatus();
    const intervalId = window.setInterval(() => {
      void loadShellStatus();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadShellStatus]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-shell-layout-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claim_appeals" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fraud_logs" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_runs" },
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col sidebar-dark transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">GigCover</span>
              <span className="ml-2 text-[9px] font-semibold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">ADMIN</span>
            </div>
          </Link>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {adminNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                    isActive
                      ? "bg-amber-500/15 text-amber-300 font-medium border-l-2 border-amber-400 pl-[10px]"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-300">Ops Pulse</p>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/5 border border-white/10 py-1.5">
                <p className="text-[10px] text-slate-400">Appeals</p>
                <p className="text-xs font-bold text-white">{openAppeals}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 py-1.5">
                <p className="text-[10px] text-slate-400">Fraud</p>
                <p className="text-xs font-bold text-white">{investigatingCount}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 py-1.5">
                <p className="text-[10px] text-slate-400">Fires</p>
                <p className="text-xs font-bold text-white">{firedRuns24h}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pb-4 pt-2 border-t border-white/5">
          <Link href="/dashboard">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all">
              <ArrowLeft className="w-4 h-4" />
              Worker Dashboard
            </button>
          </Link>
          <Link href="/">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-medium text-foreground">
              Admin Panel /{" "}
              {adminNavItems.find(
                (item) =>
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href))
              )?.label || "Overview"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => {
                void loadShellStatus(true);
              }}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sync
                </>
              ) : (
                <>
                  <RotateCw className="w-3 h-3" />
                  Refresh
                </>
              )}
            </Button>
            <Badge variant="warning" className="text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
              Live System
            </Badge>
            {lastSyncAt && (
              <Badge variant="secondary" className="text-[10px] gap-1 hidden sm:inline-flex">
                <Clock3 className="w-3 h-3" />
                {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <motion.div
            className="motion-shell"
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
