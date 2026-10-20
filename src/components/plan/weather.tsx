"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DayWeather } from "@/lib/itinerary-schema";
import type { HotelZone } from "@/lib/trip-schema";
import type { SeasonNote } from "@/lib/weather";
import { formatDate } from "@/lib/format";
import { CloudRainIcon, SunIcon, WindIcon } from "@/components/ui/icons";

const ICON = { good: SunIcon, rainy: CloudRainIcon, windy: WindIcon } as const;

/** Small weather pill for an itinerary day. */
export function WeatherChip({ weather }: { weather: DayWeather }) {
  const t = useTranslations("wizard.weather");
  const Icon = ICON[weather.kind];
  const tone =
    weather.kind === "rainy"
      ? "bg-sky-50 text-sky-800"
      : weather.kind === "windy"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      <Icon size={15} />
      <span className="tabular-nums">
        {weather.tMaxC}° / {weather.tMinC}°
      </span>
      {weather.source === "forecast" && weather.rainChance !== undefined ? (
        <span className="tabular-nums">· {t("rain", { pct: weather.rainChance })}</span>
      ) : null}
      {weather.source === "typical" ? (
        <span className="font-normal opacity-75">· {t("typical")}</span>
      ) : null}
    </span>
  );
}

type WeatherResponse = { days: Record<string, DayWeather>; seasons: SeasonNote[] };

/** Fetches /api/weather for the dates; null while loading or when dates are incomplete. */
function useTripWeather(from?: string, to?: string, zone?: HotelZone): WeatherResponse | null {
  const key = from && to && from < to ? `${from}|${to}|${zone ?? ""}` : null;
  const [state, setState] = useState<{ key: string; data: WeatherResponse } | null>(null);
  useEffect(() => {
    if (!key) return;
    const [f, t, z] = key.split("|");
    const qs = new URLSearchParams({ from: f, to: t, ...(z ? { zone: z } : {}) });
    let alive = true;
    fetch(`/api/weather?${qs}`)
      .then((r) => (r.ok ? (r.json() as Promise<WeatherResponse>) : null))
      .then((data) => {
        if (alive && data) setState({ key, data });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return key && state?.key === key ? state.data : null;
}

/** One-line weather summary under the trip dates (step 1). */
export function TripWeatherSummary({
  from,
  to,
  zone,
}: {
  from?: string;
  to?: string;
  zone?: HotelZone;
}) {
  const t = useTranslations("wizard.weather");
  const locale = useLocale();
  const data = useTripWeather(from, to, zone);
  if (!data || !from || !to) return null;

  const days = Object.values(data.days);
  const forecast = days.filter((d) => d.source === "forecast");
  const count = (k: DayWeather["kind"]) => forecast.filter((d) => d.kind === k).length;
  const rainy = count("rainy");

  let line: string;
  let Icon = SunIcon;
  if (forecast.length) {
    const parts = [
      count("good") ? t("goodDays", { count: count("good") }) : null,
      rainy ? t("rainyDays", { count: rainy }) : null,
      count("windy") ? t("windyDays", { count: count("windy") }) : null,
    ].filter(Boolean);
    line = `${t("forecastLabel")}: ${parts.join(", ")}`;
    if (rainy) Icon = CloudRainIcon;
  } else {
    const first = days[0];
    const month = formatDate(from, locale, { month: "long", weekday: undefined, day: undefined });
    line = t("typicalLine", {
      month,
      max: first.tMaxC,
      min: first.tMinC,
      rain: first.rainChance ?? 0,
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-white px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
        <Icon size={18} className="shrink-0 text-primary" />
        {line}
      </p>
      {rainy ? <p className="text-sm text-brand-ink/70">{t("rainyTip")}</p> : null}
    </div>
  );
}
