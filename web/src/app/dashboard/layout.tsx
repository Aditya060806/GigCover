"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  LayoutDashboard,
  Map,
  FileText,
  Wallet,
  LogOut,
  Bell,
  Menu,
  X,
  ShieldCheck,
  RotateCw,
  Loader2,
  Clock3,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import type { GigWorker, WeatherEvent } from "@/types/database";
import { NotificationBell } from "@/components/ui/NotificationDrawer";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/map", label: "Risk Map", icon: Map },
  { href: "/dashboard/claims", label: "Claims", icon: FileText },
  { href: "/dashboard/policy", label: "My Policy", icon: ShieldCheck },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState("Ravi Patel");
  const [workerInitials, setWorkerInitials] = useState("RP");
  const [workerPlatform, setWorkerPlatform] = useState("Swiggy");
  const [workerCity, setWorkerCity] = useState("Mumbai");
  const [workerPlan, setWorkerPlan] = useState("Standard");
  const [pendingClaims, setPendingClaims] = useState(0);
  const [weatherLabel, setWeatherLabel] = useState("Monitoring Active");
  const [weatherSeverity, setWeatherSeverity] = useState<"safe" | "moderate" | "warning">("safe");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadShellData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setSyncing(true);
    try {
      const { data: workers } = await supabase
        .from("gig_workers")
        .select("id, name, platform, city, zone, plan")
        .eq("status", "active")
        .limit(1)
        .returns<Pick<GigWorker, "id" | "name" | "platform" | "city" | "zone" | "plan">[]>();

      const worker = workers?.[0];
      if (!worker) return;

      setWorkerId(worker.id);
      setWorkerName(worker.name);
      setWorkerPlatform(worker.platform);
      setWorkerCity(worker.city);
      setWorkerPlan(worker.plan.charAt(0).toUpperCase() + worker.plan.slice(1));
      setWorkerInitials(
        worker.name
          .split(" ")
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("")
      );

      const [claimsResult, weatherResult] = await Promise.all([
        supabase
          .from("claims")
          .select("id", { head: true, count: "exact" })
          .eq("worker_id", worker.id)
          .in("status", ["processing", "flagged"]),
        supabase
          .from("weather_events")
          .select("rainfall_mm, aqi, temp_c")
          .eq("city", worker.city)
          .eq("zone", worker.zone)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .returns<Pick<WeatherEvent, "rainfall_mm" | "aqi" | "temp_c">[]>(),
      ]);

      setPendingClaims(claimsResult.count ?? 0);

      const weather = weatherResult.data?.[0];
      if (weather) {
        const warning = weather.rainfall_mm > 30 || weather.aqi > 300 || weather.temp_c > 42;
        const moderate = weather.rainfall_mm > 15 || weather.aqi > 200 || weather.temp_c > 38;
        if (warning) {
          setWeatherSeverity("warning");
          setWeatherLabel("Elevated Risk");
        } else if (moderate) {
          setWeatherSeverity("moderate");
          setWeatherLabel("Watch Conditions");
        } else {
          setWeatherSeverity("safe");
          setWeatherLabel("Monitoring Active");
        }
      }

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
      void loadShellData();
    }, 600);
  }, [loadShellData]);

  useEffect(() => {
    void loadShellData();
    const intervalId = window.setInterval(() => {
      void loadShellData();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadShellData]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-shell-layout-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weather_events" },
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col sidebar-dark transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">GigCover</span>
          </Link>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Worker Profile Card */}
        <div className="px-4 py-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {workerInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{workerName}</p>
                <p className="text-xs text-slate-400">{workerPlatform} &bull; {workerCity}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Policy
              </div>
              <span className="text-[10px] text-slate-400 font-medium bg-white/10 px-2 py-0.5 rounded-full">{workerPlan}</span>
            </div>
          </div>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Open Claims</span>
              <span className="font-semibold text-white">{pendingClaims}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-400">Weather Posture</span>
              <span
                className={cn(
                  "font-semibold text-xs",
                  weatherSeverity === "warning"
                    ? "text-amber-400"
                    : weatherSeverity === "moderate"
                    ? "text-sky-400"
                    : "text-emerald-400"
                )}
              >
                {weatherLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                    isActive
                      ? "bg-teal-500/20 text-teal-300 font-medium border-l-2 border-teal-400 pl-[10px]"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                  {item.label === "Claims" && pendingClaims > 0 && (
                    <span className="ml-auto bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {pendingClaims}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-2 border-t border-white/5">
          <Link href="/admin">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all">
              <Shield className="w-4 h-4" />
              Admin Panel
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-sm font-medium text-foreground">
                {navItems.find(
                  (item) =>
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href))
                )?.label || "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live weather indicator */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5">
              <span
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  weatherSeverity === "warning"
                    ? "bg-amber-500"
                    : weatherSeverity === "moderate"
                    ? "bg-sky-500"
                    : "bg-emerald-500"
                )}
              />
              <span className="text-xs text-muted-foreground">
                {weatherLabel}
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs gap-1"
              onClick={() => {
                void loadShellData(true);
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

            {lastSyncAt && (
              <Badge variant="secondary" className="hidden md:inline-flex text-[10px] gap-1">
                <Clock3 className="w-3 h-3" />
                {new Date(lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            )}

            <NotificationBell workerId={workerId} />

            <Badge variant="outline" className="hidden xl:inline-flex gap-1">
              <Activity className="w-3 h-3" />
              Live Shell
            </Badge>
          </div>
        </header>

        {/* Page content */}
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
