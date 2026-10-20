"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useWizard } from "./wizard-state";
import { ARRIVAL_SLOTS, DEPARTURE_SLOTS, tripNights, type Flight } from "@/lib/trip-schema";
import { todayIso } from "@/lib/format";
import { Field, Input } from "@/components/ui/field";
import { PlaneLandIcon, PlaneTakeoffIcon } from "@/components/ui/icons";
import { TripWeatherSummary } from "./weather";

/** Step 1: only the arrival and departure dates. No flight lookup. */
export function StepFlights() {
  const t = useTranslations("wizard.flights");
  const { draft, patch } = useWizard();
  // `new Date()` is not allowed during prerender; server snapshot is "" (no min date).
  const today = useSyncExternalStore(
    () => () => {},
    () => todayIso(),
    () => "",
  );
  const arrival = draft.inbound.date ?? "";
  const departure = draft.outbound.date ?? "";
  const orderError = !!arrival && !!departure && departure <= arrival;
  const nights =
    arrival && departure && !orderError
      ? tripNights({ inbound: { date: arrival }, outbound: { date: departure } })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
      </header>
      <section className="grid gap-4 rounded-card border border-line bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
        <div className="flex flex-col gap-3">
          <DateField
            id="arrival-date"
            icon={<PlaneLandIcon size={22} />}
            label={t("arrival")}
            value={arrival}
            min={today}
            onChange={(date) => patch({ inbound: { ...draft.inbound, date, source: "manual" } })}
          />
          <SlotPicker
            label={t("arrivalSlot")}
            options={ARRIVAL_SLOTS}
            value={draft.inbound.slot}
            onChange={(slot) => patch({ inbound: { ...draft.inbound, slot } })}
          />
        </div>
        <div className="flex flex-col gap-3">
          <DateField
            id="departure-date"
            icon={<PlaneTakeoffIcon size={22} />}
            label={t("departure")}
            value={departure}
            min={arrival || today}
            onChange={(date) => patch({ outbound: { ...draft.outbound, date, source: "manual" } })}
          />
          <SlotPicker
            label={t("departureSlot")}
            options={DEPARTURE_SLOTS}
            value={draft.outbound.slot}
            onChange={(slot) => patch({ outbound: { ...draft.outbound, slot } })}
          />
        </div>
      </section>
      {orderError ? (
        <p className="text-sm font-semibold text-red-600">{t("errorOrder")}</p>
      ) : nights !== null ? (
        <p className="inline-flex w-fit items-center rounded-pill bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
          {t("nights", { count: nights })}
        </p>
      ) : null}
      {!orderError ? (
        <TripWeatherSummary from={arrival} to={departure} zone={draft.hotel.zone} />
      ) : null}
    </div>
  );
}

/** Optional time-of-day chips. Clicking the selected chip clears it. */
function SlotPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly NonNullable<Flight["slot"]>[];
  value: Flight["slot"];
  onChange: (slot: Flight["slot"]) => void;
}) {
  const t = useTranslations("wizard.flights");
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-brand-ink/60">
        {label} <span className="font-normal">· {t("optional")}</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? undefined : o)}
              className={`rounded-pill border px-3 py-1.5 text-sm font-semibold transition ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white text-brand-ink/75 hover:border-primary/60"
              }`}
            >
              {t(`slots.${o}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateField({
  id,
  icon,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  value: string;
  min?: string;
  onChange: (date: string | undefined) => void;
}) {
  return (
    <Field
      htmlFor={id}
      label={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            {icon}
          </span>
          <span className="text-base font-bold">{label}</span>
        </span>
      }
    >
      <Input
        id={id}
        type="date"
        min={min || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </Field>
  );
}

export function flightsStepValid(d: ReturnType<typeof useWizard>["draft"]): boolean {
  if (!d.inbound.date || !d.outbound.date) return false;
  return d.outbound.date > d.inbound.date;
}
