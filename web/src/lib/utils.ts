import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getRiskColor(score: number): string {
  if (score >= 0.8) return "text-red-400";
  if (score >= 0.6) return "text-orange-400";
  if (score >= 0.4) return "text-yellow-400";
  if (score >= 0.2) return "text-blue-400";
  return "text-green-400";
}

export function getRiskBgColor(score: number): string {
  if (score >= 0.8) return "bg-red-500/20 border-red-500/30";
  if (score >= 0.6) return "bg-orange-500/20 border-orange-500/30";
  if (score >= 0.4) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 0.2) return "bg-blue-500/20 border-blue-500/30";
  return "bg-green-500/20 border-green-500/30";
}

export function getRiskLabel(score: number): string {
  if (score >= 0.8) return "Critical";
  if (score >= 0.6) return "High";
  if (score >= 0.4) return "Moderate";
  if (score >= 0.2) return "Low";
  return "Safe";
}

export function getWeatherIcon(type: string): string {
  const icons: Record<string, string> = {
    rain: "🌧️",
    heavy_rain: "⛈️",
    flood: "🌊",
    heatwave: "🔥",
    aqi: "😷",
    storm: "🌪️",
    curfew: "🚫",
  };
  return icons[type] || "⚠️";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
