"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CITIES } from "@/lib/constants";

export interface GpsDeviationResult {
  deviationKm: number;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  city: string | null;
  spoofingLikely: boolean;
  status: "idle" | "fetching" | "done" | "error";
  error: string | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestZone(lat: number, lng: number): { zone: string; city: string; distKm: number } | null {
  let best: { zone: string; city: string; distKm: number } | null = null;
  for (const city of CITIES) {
    for (const zone of city.zones) {
      const dist = haversineKm(lat, lng, zone.lat, zone.lng);
      if (!best || dist < best.distKm) {
        best = { zone: zone.name, city: city.name, distKm: dist };
      }
    }
  }
  return best;
}

const SPOOFING_THRESHOLD_KM = 15;

export function useGpsDeviation(workerZone?: string, workerCity?: string) {
  const [result, setResult] = useState<GpsDeviationResult>({
    deviationKm: 0,
    lat: null,
    lng: null,
    zone: null,
    city: null,
    spoofingLikely: false,
    status: "idle",
    error: null,
  });
  const hasRunRef = useRef(false);

  const capture = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setResult((prev) => ({ ...prev, status: "error", error: "Geolocation not supported" }));
      return;
    }

    setResult((prev) => ({ ...prev, status: "fetching", error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const nearest = findNearestZone(lat, lng);

        let deviationKm = nearest?.distKm ?? 0;

        if (workerZone && workerCity) {
          const expectedCity = CITIES.find((c) => c.name === workerCity);
          const expectedZone = expectedCity?.zones.find((z) => z.name === workerZone);
          if (expectedZone) {
            deviationKm = haversineKm(lat, lng, expectedZone.lat, expectedZone.lng);
          }
        }

        setResult({
          deviationKm: Math.round(deviationKm * 10) / 10,
          lat,
          lng,
          zone: nearest?.zone ?? null,
          city: nearest?.city ?? null,
          spoofingLikely: deviationKm > SPOOFING_THRESHOLD_KM,
          status: "done",
          error: null,
        });
      },
      (err) => {
        setResult((prev) => ({
          ...prev,
          status: "error",
          error: err.message ?? "Location access denied",
        }));
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [workerZone, workerCity]);

  useEffect(() => {
    if (!hasRunRef.current) {
      hasRunRef.current = true;
      capture();
    }
  }, [capture]);

  return { ...result, capture };
}
