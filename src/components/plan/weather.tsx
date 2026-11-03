"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DayWeather } from "@/lib/itinerary-schema";
import type { HotelZone } from "@/lib/trip-schema";
import type { SeasonNote } from "@/lib/weather";
import { formatDate } from "@/lib/format";
import { ChevronIcon, CloudRainIcon, SunIcon, WindIcon } from "@/components/ui/icons";

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

/** Fetches /api/weather for the dates; undefined while loading, null if it failed. */
function useTripWeather(
  from?: string,
  to?: string,
  zone?: HotelZone,
): WeatherResponse | null | undefined {
  const key = from && to && from < to ? `${from}|${to}|${zone ?? ""}` : null;
  const [state, setState] = useState<{ key: string; data: WeatherResponse | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    const [f, t, z] = key.split("|");
    const qs = new URLSearchParams({ from: f, to: t, ...(z ? { zone: z } : {}) });
    let alive = true;
    fetch(`/api/weather?${qs}`)
      .then((r) => (r.ok ? (r.json() as Promise<WeatherResponse>) : null))
      .then((data) => {
        if (alive) setState({ key, data });
      })
      .catch(() => {
        if (alive) setState({ key, data: null });
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return key && state?.key === key ? state.data : undefined;
}

const CARD = "flex w-36 shrink-0 snap-start flex-col gap-2 rounded-card border border-line p-3";

/** One day of the carousel. Typical days are monthly averages, so they never claim a condition. */
function WeatherDayCard({ date, weather }: { date: string; weather: DayWeather }) {
  const t = useTranslations("wizard.weather");
  const locale = useLocale();
  const typical = weather.source === "typical";
  const Icon = ICON[weather.kind];
  return (
    <li className={`${CARD} ${typical ? "bg-surface" : "bg-white"}`}>
      <p className="text-sm font-bold leading-tight text-heading first-letter:uppercase">
        {formatDate(date, locale, { weekday: "short", month: "short", day: "numeric" })}
      </p>
      <p className="flex items-center gap-2">
        <Icon size={22} className={typical ? "shrink-0 text-muted" : "shrink-0 text-primary"} />
        <span className="text-base font-bold tabular-nums text-brand-ink">
          {weather.tMaxC}° / {weather.tMinC}°
        </span>
      </p>
      <p className="text-xs font-semibold text-brand-ink/80 first-letter:uppercase">
        {typical ? t("typical") : t(`kind.${weather.kind}`)}
      </p>
      {weather.rainChance !== undefined ? (
        <p className="text-xs text-brand-ink/60 first-letter:uppercase">
          {typical
            ? t("typicalRain", { pct: weather.rainChance })
            : t("rain", { pct: weather.rainChance })}
        </p>
      ) : null}
    </li>
  );
}

/** Day-by-day weather carousel under the trip dates (step 1). */
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
  const data = useTripWeather(from, to, zone);
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const days = data ? Object.entries(data.days).sort(([a], [b]) => a.localeCompare(b)) : [];
  const count = days.length;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      setEdges({
        start: list.scrollLeft <= 1,
        end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1,
      });
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [count]);

  if (!from || !to || from >= to || data === null) return null;

  const rainy = days.some(([, w]) => w.source === "forecast" && w.kind === "rainy");
  const scrollBy = (direction: 1 | -1) => {
    const list = listRef.current;
    list?.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: "smooth" });
  };
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-heading transition hover:bg-surface disabled:cursor-default disabled:opacity-35";

  return (
    <section
      aria-label={t("title")}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-heading">{t("title")}</h3>
        {!(edges.start && edges.end) ? (
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              aria-label={t("previous")}
              className={arrow}
              disabled={edges.start}
              onClick={() => scrollBy(-1)}
            >
              <ChevronIcon size={18} className="rotate-90" />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              className={arrow}
              disabled={edges.end}
              onClick={() => scrollBy(1)}
            >
              <ChevronIcon size={18} className="-rotate-90" />
            </button>
          </div>
        ) : null}
      </div>

      {data === undefined ? (
        <ul aria-hidden className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className={`${CARD} h-[7.5rem] animate-pulse bg-surface`} />
          ))}
        </ul>
      ) : (
        <ul
          ref={listRef}
          tabIndex={0}
          aria-label={t("title")}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-card [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {days.map(([date, weather]) => (
            <WeatherDayCard key={date} date={date} weather={weather} />
          ))}
        </ul>
      )}

      {rainy ? <p className="text-sm text-brand-ink/70">{t("rainyTip")}</p> : null}
      <p className="text-xs text-brand-ink/60">{t("disclaimer")}</p>
    </section>
  );
}
