"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CloudSun,
  Compass,
  Droplets,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wind,
} from "lucide-react";
import type { BoatSafetyLevel, LakeWeatherPayload } from "@/app/api/weather/route";

const safetyMeta: Record<
  BoatSafetyLevel,
  { badge: string; chip: string; icon: typeof ShieldCheck }
> = {
  clear: {
    badge: "Clear for departures",
    chip: "bg-moss-50 text-moss-800 ring-moss-600/25",
    icon: ShieldCheck,
  },
  caution: {
    badge: "Proceed with caution",
    chip: "bg-reed-50 text-reed-800 ring-reed-600/25",
    icon: Compass,
  },
  suspend: {
    badge: "Small-craft advisory",
    chip: "bg-alert-50 text-alert-700 ring-alert-600/25",
    icon: ShieldAlert,
  },
};

export default function LakeWeatherCard() {
  const [weather, setWeather] = useState<LakeWeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/weather", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<LakeWeatherPayload>) : null))
      .then((data) => {
        if (active && data) setWeather(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshWeather = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weather", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as LakeWeatherPayload;
        setWeather(data);
      }
    } catch {
      // Fail quietly; keep last weather snapshot.
    } finally {
      setLoading(false);
    }
  }, []);

  const safety = weather ? safetyMeta[weather.boatSafety] : safetyMeta.clear;
  const SafetyIcon = safety.icon;

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-ink/10 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/8 pb-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lake-800 text-sand-50">
            <CloudSun className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
              Live Meteorological Feed · Open-Meteo API
            </p>
            <h2 className="mt-1 font-display text-[20px] leading-tight text-ink">
              Naujan Lake surface conditions
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-soft/65">
              13.168° N, 121.351° E · Synchronized with park boarding guidance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {weather ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold tracking-[0.12em] uppercase ring-1 ring-inset ${safety.chip}`}
            >
              <SafetyIcon className="size-3.5" strokeWidth={2.2} />
              {safety.badge}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshWeather()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-sand-50 px-3 py-1.5 text-[11.5px] font-medium text-ink transition hover:bg-sand-100 disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            Refresh
          </button>
        </div>
      </div>

      {weather ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-sand-50 p-4 ring-1 ring-ink/6">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
              Air temperature
            </p>
            <p className="mt-1 font-display text-[26px] leading-none text-ink">
              {weather.temperatureC}°C
            </p>
            <p className="mt-1.5 text-[11.5px] text-ink-soft/75">
              {weather.condition}
            </p>
          </div>

          <div className="rounded-xl bg-sand-50 p-4 ring-1 ring-ink/6">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
              <Wind className="size-3" strokeWidth={2.2} />
              Surface wind
            </p>
            <p className="mt-1 font-display text-[26px] leading-none text-ink">
              {weather.windKmh} <span className="text-[14px]">km/h</span>
            </p>
            <p className="mt-1.5 text-[11.5px] text-ink-soft/75">
              {weather.windKmh >= 20
                ? "Elevated basin gusts"
                : "Calm open-water crossing"}
            </p>
          </div>

          <div className="rounded-xl bg-sand-50 p-4 ring-1 ring-ink/6">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
              <Droplets className="size-3" strokeWidth={2.2} />
              Humidity
            </p>
            <p className="mt-1 font-display text-[26px] leading-none text-ink">
              {weather.humidityPercent}%
            </p>
            <p className="mt-1.5 text-[11.5px] text-ink-soft/75">
              {weather.source === "open-meteo"
                ? "Live sensor readout"
                : "Offline fallback baseline"}
            </p>
          </div>

          <div className="rounded-xl bg-lake-50/70 p-4 ring-1 ring-lake-600/20">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-lake-800 uppercase">
              Ranger guidance
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft/90">
              {weather.boatGuidance}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="h-24 animate-pulse rounded-xl bg-sand-100"
            />
          ))}
        </div>
      )}
    </div>
  );
}
