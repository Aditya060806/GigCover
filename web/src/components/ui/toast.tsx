"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

let globalAddToast: ((message: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = "info") {
  if (globalAddToast) globalAddToast(message, type);
}
toast.success = (message: string) => toast(message, "success");
toast.error = (message: string) => toast(message, "error");
toast.info = (message: string) => toast(message, "info");

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
  info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
};

const styles: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white",
  error: "border-red-200 bg-white",
  info: "border-sky-200 bg-white",
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => { globalAddToast = null; };
  }, [addToast]);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles[t.type]}`}
          >
            {icons[t.type]}
            <p className="flex-1 text-sm text-slate-800 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
