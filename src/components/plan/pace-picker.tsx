"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  AdventureIcon,
  ChillIcon,
  CompassIcon,
  PlaneLandIcon,
  PlaneTakeoffIcon,
  SunIcon,
} from "@/components/ui/icons";
import { PACES, fullDates, restCountFor, type Pace } from "@/lib/plan-days";
import { formatDate } from "@/lib/format";
import { draftRestDates, useWizard } from "./wizard-state";

const PACE_ICONS = {
  relaxed: <ChillIcon size={20} />,
  balanced: <CompassIcon size={20} />,
  intense: <AdventureIcon size={20} />,
} as const;

/**
 * One decision for the trip's rhythm: pick a pace card, then (optionally) tap a day
 * on the strip to swap tour ↔ rest. Arrival and departure days are fixed.
 */
export function PacePicker() {
  const t = useTranslations("wizard.preferences.pace");
  const locale = useLocale();
  const { draft, patch } = useWizard();
  const from = draft.inbound.date;
  const to = draft.outbound.date;
  if (!from || !to || to <= from) return null;

  const dates = fullDates(from, to);
  if (!dates.length) return null;
  const rest = new Set(draftRestDates(draft) ?? []);

  function toggle(date: string) {
    const next = new Set(rest);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    patch({ pace: "custom", restDates: [...next].sort() });
  }

  const day = (d: string) => formatDate(d, locale, { month: undefined });

  return (
    <section>
      <h3 className="mb-3 text-lg font-bold">{t("title")}</h3>
      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-3 gap-2 sm:gap-3">
        {PACES.map((p: Pace) => {
          const restCount = restCountFor(p, dates.length);
          const selected = draft.pace === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => patch({ pace: p, restDates: undefined })}
              className={`flex flex-col items-center gap-1.5 rounded-card border px-2 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:py-4 ${
                selected
                  ? "border-primary bg-primary text-white shadow-card"
                  : "border-line bg-white text-heading shadow-sm hover:border-primary/50"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  selected ? "bg-white/20" : "bg-primary-soft text-primary"
                }`}
              >
                {PACE_ICONS[p]}
              </span>
              <span className="text-sm font-bold leading-tight sm:text-base">{t(p)}</span>
              <span
                className={`text-xs leading-snug ${selected ? "text-white/85" : "text-brand-ink/60"}`}
              >
                {t("counts", { tours: dates.length - restCount, rest: restCount })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-card border border-line bg-surface p-3">
        <div className="flex flex-col gap-0.5 px-1 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-sm font-bold text-heading">
            {t("summary", { tours: dates.length - rest.size, rest: rest.size })}
          </p>
          <p className="text-xs text-brand-ink/60">{t("tapHint")}</p>
        </div>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-7">
          <DayChip label={day(from)} kind="arrival" text={t("arrival")} />
          {dates.map((d) => (
            <li key={d}>
              <button
                type="button"
                aria-pressed={!rest.has(d)}
                aria-label={`${day(d)}: ${rest.has(d) ? t("rest") : t("tour")}`}
                onClick={() => toggle(d)}
                className={`flex min-h-11 w-full flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                  rest.has(d)
                    ? "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400"
                    : "border-primary bg-primary text-white hover:bg-primary-hover"
                }`}
              >
                <span className="capitalize">{day(d)}</span>
                {rest.has(d) ? <SunIcon size={18} /> : <CompassIcon size={18} />}
                <span>{rest.has(d) ? t("rest") : t("tour")}</span>
              </button>
            </li>
          ))}
          <DayChip label={day(to)} kind="departure" text={t("departure")} />
        </ol>
      </div>
    </section>
  );
}

function DayChip({
  label,
  kind,
  text,
}: {
  label: string;
  kind: "arrival" | "departure";
  text: string;
}) {
  return (
    <li>
      <div className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line bg-white px-2 py-2 text-xs font-semibold text-brand-ink/60">
        <span className="capitalize">{label}</span>
        {kind === "arrival" ? <PlaneLandIcon size={18} /> : <PlaneTakeoffIcon size={18} />}
        <span>{text}</span>
      </div>
    </li>
  );
}
