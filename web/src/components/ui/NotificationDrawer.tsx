"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, CheckCheck, CloudRain, Flame, Wind, AlertTriangle, Shield, Megaphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types/database";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  trigger_fired:    { icon: CloudRain,     color: "text-blue-600",   bg: "bg-blue-50" },
  payout_credited:  { icon: Shield,        color: "text-green-600",  bg: "bg-green-50" },
  fraud_flagged:    { icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50" },
  appeal_update:    { icon: Megaphone,     color: "text-purple-600", bg: "bg-purple-50" },
  weather_alert:    { icon: Flame,         color: "text-orange-600", bg: "bg-orange-50" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

interface Props {
  workerId: string | null;
}

export function NotificationBell({ workerId }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!workerId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<Notification[]>();
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [workerId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!workerId) return;

    channelRef.current = supabase
      .channel(`notifications:${workerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `worker_id=eq.${workerId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev.slice(0, 29)]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [workerId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = useCallback(async () => {
    if (!workerId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("worker_id", workerId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [workerId]);

  const markOneRead = useCallback(
    async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    []
  );

  return (
    <div className="relative" ref={drawerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[420px]">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG["weather_alert"];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                        !notif.read && "bg-purple-50/40"
                      )}
                      onClick={() => markOneRead(notif.id)}
                    >
                      <div className={cn("mt-0.5 p-2 rounded-xl flex-shrink-0", cfg.bg)}>
                        <Icon className={cn("w-4 h-4", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm font-medium text-slate-800 leading-tight", !notif.read && "font-semibold")}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-400">{timeAgo(notif.created_at)}</span>
                          {notif.amount && (
                            <span className="text-[11px] font-semibold text-green-600">
                              +₹{Number(notif.amount).toLocaleString("en-IN")}
                            </span>
                          )}
                          {notif.zone && (
                            <span className="text-[11px] text-slate-400">• {notif.zone}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400 text-center">
                  Showing last {notifications.length} notifications
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
