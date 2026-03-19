"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITIES } from "@/lib/constants";
import type { ZoneHeatmap } from "@/types/database";

// Map risk_level string to a numeric score
function riskLevelToScore(level: string): number {
  switch (level) {
    case "critical": return 0.9;
    case "high": return 0.7;
    case "medium": return 0.5;
    case "low": return 0.25;
    default: return 0.3;
  }
}

function getRiskColor(risk: number): string {
  if (risk >= 0.8) return "#ef4444";
  if (risk >= 0.6) return "#f97316";
  if (risk >= 0.4) return "#eab308";
  if (risk >= 0.2) return "#3b82f6";
  return "#22c55e";
}

function getRiskOpacity(risk: number): number {
  return 0.15 + risk * 0.35;
}

interface RiskMapProps {
  city: string;
  zones: ZoneHeatmap[];
  loading?: boolean;
}

export default function RiskMap({ city, zones, loading = false }: RiskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const selectedCity = useMemo(
    () => CITIES.find((c) => c.id === city) || CITIES[0],
    [city]
  );
  const cityZones = useMemo(
    () => zones.filter((z) => z.city.toLowerCase() === selectedCity.name.toLowerCase()),
    [zones, selectedCity.name]
  );

  useEffect(() => {
    if (!mapRef.current) return;

    // Cleanup previous map instance
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    // Create map
    const map = L.map(mapRef.current, {
      center: [selectedCity.lat, selectedCity.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstance.current = map;

    // OpenStreetMap tile layer
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(map);

    // Render zones from live Supabase data only
    cityZones.forEach((zone) => {
        const risk = riskLevelToScore(zone.risk_level);
        const color = getRiskColor(risk);

        const circle = L.circle([zone.lat, zone.lng], {
          radius: 1500,
          color,
          fillColor: color,
          fillOpacity: getRiskOpacity(risk),
          weight: 2,
          opacity: 0.8,
        }).addTo(map);

        const popupContent = `
          <div style="min-width: 200px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <h3 style="font-size: 14px; font-weight: 600; margin: 0;">${zone.zone_name}</h3>
              <span style="font-size: 11px; font-weight: 600; color: ${color}; background: ${color}22; padding: 2px 8px; border-radius: 12px;">
                ${Math.round(risk * 100)}% Risk
              </span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
              <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 8px;">
                <div style="color: #2563eb; font-size: 10px;">🌧️ Rainfall</div>
                <div style="font-weight: 600; color: #0f172a;">${zone.current_rainfall.toFixed(1)} mm/hr</div>
              </div>
              <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 8px;">
                <div style="color: #d97706; font-size: 10px;">😷 AQI</div>
                <div style="font-weight: 600; color: #0f172a;">${Math.round(zone.current_aqi)}</div>
              </div>
              <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 8px;">
                <div style="color: #ea580c; font-size: 10px;">🌡️ Temp</div>
                <div style="font-weight: 600; color: #0f172a;">${zone.current_temp.toFixed(1)}°C</div>
              </div>
              <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 8px;">
                <div style="color: #7c3aed; font-size: 10px;">💨 Wind</div>
                <div style="font-weight: 600; color: #0f172a;">${zone.current_wind.toFixed(1)} km/h</div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-top: 8px; color: #64748b;">
              <div>👷 ${zone.active_workers} workers</div>
              <div>📋 ${zone.total_claims} claims</div>
            </div>
            ${risk >= 0.6 ? `
            <div style="margin-top: 8px; padding: 6px 8px; background: ${color}15; border: 1px solid ${color}30; border-radius: 8px; display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px;">⚠️</span>
              <span style="font-size: 11px; color: ${color};">Auto-trigger may activate</span>
            </div>` : ""}
          </div>
        `;

        circle.bindPopup(popupContent);

        const icon = L.divIcon({
          className: "custom-zone-label",
          html: `<div style="
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 500;
            color: #0f172a;
            white-space: nowrap;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ">${zone.zone_name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, -20],
        });

        L.marker([zone.lat, zone.lng], { icon }).addTo(map);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [selectedCity, cityZones]);

  return (
    <div className="relative h-[600px] rounded-xl overflow-hidden border border-slate-200">
      <div
        ref={mapRef}
        className="h-full"
        style={{ zIndex: 0 }}
      />
      {!loading && cityZones.length === 0 && (
        <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-sm font-medium text-slate-900">No live zones found for {selectedCity.name}</p>
            <p className="text-xs text-slate-600 mt-1">Map only renders real records from v_zone_heatmap.</p>
          </div>
        </div>
      )}
    </div>
  );
}
