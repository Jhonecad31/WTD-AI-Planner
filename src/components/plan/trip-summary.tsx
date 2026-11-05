"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fullDates } from "@/lib/plan-days";
import { formatDate, formatUsd } from "@/lib/format";
import { tripNights } from "@/lib/trip-schema";
import {
  CompassIcon,
  FoodIcon,
  HotelIcon,
  KeyIcon,
  PlaneIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { draftRestDates, useWizard, type StepId } from "./wizard-state";

/** What the traveler picked in the wizard, shown above the itinerary with a way back to each step. */
export function TripSummary() {
  const t = useTranslations("wizard.itinerary.summary");
  const tz = useTranslations("wizard.stay.zones");
  const ti = useTranslations("wizard.preferences.interests");
  const tc = useTranslations("wizard.restaurants.cuisines");
  const locale = useLocale();
  const { draft, patch } = useWizard();

  const from = draft.inbound.date;
  const to = draft.outbound.date;
  const nights = from && to ? tripNights({ inbound: { date: from }, outbound: { date: to } }) : 0;
  const adults = draft.travelers.filter((x) => x.age >= 13).length;
  const children = draft.travelers.length - adults;
  const full = from && to && to > from ? fullDates(from, to).length : 0;
  const rest = draftRestDates(draft)?.length ?? 0;
  const tr = draft.transfers;
  const legs = [tr.arrival && t("transferArrival"), tr.departure && t("transferDeparture")].filter(
    Boolean,
  );
  const stay = draft.hotel.noHotel
    ? t("noHotel", { zone: draft.hotel.zone ? tz(draft.hotel.zone) : "Cancún" })
    : [draft.hotel.name, draft.hotel.zone ? tz(draft.hotel.zone) : null]
        .filter(Boolean)
        .join(" · ");

  const rows: { key: string; step: StepId; icon: ReactNode; label: string; value: ReactNode }[] = [
    {
      key: "dates",
      step: "flights",
      icon: <PlaneIcon size={16} />,
      label: t("dates"),
      value:
        from && to
          ? `${formatDate(from, locale)} – ${formatDate(to, locale)} · ${t("nights", { count: nights })}`
          : "—",
    },
    {
      key: "travelers",
      step: "travelers",
      icon: <UsersIcon size={16} />,
      label: t("travelers"),
      value: t("party", { adults, children }),
    },
    {
      key: "stay",
      step: "stay",
      icon: <HotelIcon size={16} />,
      label: t("stay"),
      value: (
        <>
          {stay || "—"}
          <span className="block text-brand-ink/60">
            {legs.length
              ? `${t("transfers")}: ${legs.join(", ")}${tr.luxury ? ` · ${t("luxury")}` : ""}`
              : t("noTransfers")}
          </span>
        </>
      ),
    },
    {
      key: "style",
      step: "preferences",
      icon: <CompassIcon size={16} />,
      label: t("style"),
      value: (
        <>
          {draft.interests.map((i) => ti(i)).join(", ") || "—"}
          <span className="block text-brand-ink/60">
            {t("pace", { tours: Math.max(0, full - rest), rest })} ·{" "}
            {t("budget", { budget: formatUsd(draft.budgetPerPerson, locale) })}
          </span>
          {draft.preferPrivate ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
              <KeyIcon size={12} /> {t("private")}
            </span>
          ) : null}
        </>
      ),
    },
    {
      key: "dining",
      step: "restaurants",
      icon: <FoodIcon size={16} />,
      label: t("dining"),
      value: draft.dining.skip
        ? t("noDining")
        : `${draft.dining.cuisines.map((c) => tc(c)).join(", ") || t("anyCuisine")} · ${t(
            "perDinner",
            { budget: formatUsd(draft.dining.budgetPerMeal, locale) },
          )}`,
    },
  ];

  return (
    <section
      aria-labelledby="trip-summary-title"
      className="rounded-card border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <h3 id="trip-summary-title" className="mb-3 text-sm font-bold uppercase tracking-wide">
        {t("title")}
      </h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className="flex min-w-0 gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <dt className="flex items-center justify-between gap-2 text-xs font-semibold text-brand-ink/60">
                {r.label}
                <button
                  type="button"
                  onClick={() => patch({ step: r.step, returnTo: "itinerary" })}
                  className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`${t("edit")}: ${r.label}`}
                >
                  {t("edit")}
                </button>
              </dt>
              <dd className="text-sm font-semibold text-heading">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
