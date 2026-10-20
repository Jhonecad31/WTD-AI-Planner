"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CheckIcon, ChevronIcon, ClockIcon, SunIcon } from "@/components/ui/icons";
import type { Itinerary } from "@/lib/itinerary-schema";
import type { TripRequest } from "@/lib/trip-schema";
import type { Alternative } from "@/server/ai/edit";
import { formatDate, formatUsd } from "@/lib/format";

/**
 * Client helpers for editing a generated itinerary through /api/itinerary/edit:
 * move a tour to another day, swap it, or make the day a chill day.
 */

type EditResult = { ok: true; itinerary: Itinerary } | { ok: false; check: { reason?: string } };

export async function editItinerary(
  request: TripRequest,
  itinerary: Itinerary,
  action:
    | { type: "move"; bokunId: number; fromDate: string; toDate: string }
    | { type: "replace"; date: string; bokunId: number | null },
): Promise<EditResult> {
  const r = await fetch("/api/itinerary/edit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request, itinerary, action }),
  });
  if (!r.ok) return { ok: false, check: { reason: "unknown_product" } };
  return (await r.json()) as EditResult;
}

function reasonText(
  t: ReturnType<typeof useTranslations>,
  reason: string | undefined,
  date: string,
  locale: string,
) {
  const key =
    reason &&
    ["sold_out", "no_slots", "does_not_fit", "not_in_trip", "unknown_product"].includes(reason)
      ? reason
      : "unknown_product";
  return t(`error.${key}`, { date: formatDate(date, locale) });
}

/** "Other options" dropdown at the bottom of a tour card; the panel opens inside it. */
export function TourOptions({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("wizard.itinerary.edit");
  return (
    <div className="mt-1 border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-sm font-bold text-primary"
      >
        {t("seeOptions")}
        <ChevronIcon
          size={18}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}

/** Panel listing other tours for one day, with live availability. */
export function AlternativesPanel({
  request,
  itinerary,
  date,
  onPick,
  onClose,
  onChill,
  busy,
  embedded = false,
}: {
  request: TripRequest;
  itinerary: Itinerary;
  date: string;
  onPick: (bokunId: number) => void;
  onClose?: () => void;
  /** Optional "make it a free day" link at the bottom. */
  onChill?: () => void;
  busy: boolean;
  /** Inside a tour card's dropdown: no header, the dropdown itself closes it. */
  embedded?: boolean;
}) {
  const t = useTranslations("wizard.itinerary.edit");
  const locale = useLocale();
  const [alts, setAlts] = useState<Alternative[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/itinerary/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, itinerary, action: { type: "alternatives", date } }),
    })
      .then((r) => r.json())
      .then((j: { alternatives?: Alternative[] }) => alive && setAlts(j.alternatives ?? []))
      .catch(() => alive && setAlts([]));
    return () => {
      alive = false;
    };
    // Mounted with key={date} by the parent, so a new day means a fresh panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div
      className={
        embedded ? "" : "mt-3 rounded-card border border-primary/30 bg-primary-soft/40 p-4 sm:p-5"
      }
    >
      <div className={embedded ? "hidden" : "flex items-start justify-between gap-3"}>
        <div>
          <h4 className="font-bold">
            {t("alternativesTitle", {
              date: formatDate(date, locale, { weekday: "long", month: "long", day: "numeric" }),
            })}
          </h4>
          <p className="text-xs text-muted">{t("alternativesBody")}</p>
        </div>
        {onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
        ) : null}
      </div>

      {alts === null ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2" aria-busy>
          <p className="col-span-full text-sm text-muted">{t("checking")}</p>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-white/70" />
          ))}
        </div>
      ) : alts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("noAlternatives")}</p>
      ) : (
        <ul className={`mt-2 grid grid-cols-1 gap-2 ${embedded ? "" : "sm:grid-cols-2"}`}>
          {alts.map((a) => (
            <li key={a.bokunId}>
              <button
                type="button"
                disabled={busy || !a.available}
                onClick={() => onPick(a.bokunId)}
                className="flex w-full items-stretch gap-3 overflow-hidden rounded-card border border-line bg-white text-left transition enabled:hover:border-primary disabled:opacity-60"
              >
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="h-24 w-20 shrink-0 object-cover sm:w-24"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 w-20 shrink-0 bg-gray-100 sm:w-24" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1 py-2 pr-3">
                  <p className="line-clamp-2 text-sm font-bold leading-snug">{a.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {a.durationMinutes ? (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon size={12} /> {Math.round(a.durationMinutes / 60)}h
                      </span>
                    ) : null}
                    {a.startTime && a.startTime !== "00:00" ? <span>{a.startTime}</span> : null}
                  </p>
                  <p className="mt-auto flex flex-wrap items-center justify-between gap-x-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        a.available ? "text-primary" : "text-brand-deal"
                      }`}
                    >
                      {a.available ? <CheckIcon size={12} /> : null}
                      {a.available ? t("available") : t("unavailable")}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatUsd(a.priceTotalUsd, locale)}
                    </span>
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onChill ? (
        <button
          type="button"
          disabled={busy}
          onClick={onChill}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-muted hover:text-heading"
        >
          <SunIcon size={14} /> {t("makeChill")}
        </button>
      ) : null}
    </div>
  );
}

export { reasonText };
