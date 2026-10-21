"use client";

import { useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { INTEREST_PHOTOS } from "@/content/interest-photos";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { openDatePicker } from "@/components/ui/field";
import { ArrowRightIcon, PlaneLandIcon, PlaneTakeoffIcon, UsersIcon } from "@/components/ui/icons";
import { todayIso } from "@/lib/format";
import { initialDraft, type WizardDraft } from "@/components/plan/wizard-state";

const STORAGE_KEY = "wtd-planner-draft-v1";
const noop = () => () => {};

/** Floating mini-form under the hero: seeds the wizard draft and jumps to /plan. */
export function QuickStart() {
  // Warm the browser cache for the wizard's interest photos while the visitor reads the landing.
  for (const src of Object.values(INTEREST_PHOTOS))
    if (src) preload(src, { as: "image", fetchPriority: "low" });
  const t = useTranslations("landing.quick");
  const router = useRouter();
  const today = useSyncExternalStore(
    noop,
    () => todayIso(),
    () => "",
  );
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [travelers, setTravelers] = useState(2);

  function go() {
    const draft: WizardDraft = {
      ...initialDraft,
      inbound: { date: arrival || undefined, source: "manual" },
      outbound: { date: departure || undefined, source: "manual" },
      travelers: Array.from({ length: travelers }, () => ({ age: 30 })),
    };
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    router.push("/plan");
  }

  const field =
    "w-full bg-transparent text-base font-semibold text-brand-ink outline-none placeholder:text-brand-ink/40";
  const cell = "flex items-center gap-3 px-4 py-3 sm:px-5";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="rounded-[20px] border border-line bg-white p-2 shadow-float"
    >
      <div className="grid divide-y divide-line sm:grid-cols-[1fr_1fr_auto_auto] sm:divide-x sm:divide-y-0">
        <label className={cell}>
          <PlaneLandIcon size={20} className="shrink-0 text-primary" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-bold text-brand-ink/50">{t("arrival")}</span>
            <input
              type="date"
              onClick={openDatePicker}
              min={today}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              className={field}
            />
          </span>
        </label>
        <label className={cell}>
          <PlaneTakeoffIcon size={20} className="shrink-0 text-primary" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-bold text-brand-ink/50">{t("departure")}</span>
            <input
              type="date"
              onClick={openDatePicker}
              min={arrival || today}
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className={field}
            />
          </span>
        </label>
        <label className={cell}>
          <UsersIcon size={20} className="shrink-0 text-primary" />
          <span className="flex flex-col">
            <span className="text-[11px] font-bold text-brand-ink/50">{t("travelers")}</span>
            <select
              value={travelers}
              onChange={(e) => setTravelers(Number(e.target.value))}
              className={`${field} pr-4`}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
        </label>
        <div className="flex items-center p-2">
          <Button type="submit" size="lg" className="w-full">
            {t("go")} <ArrowRightIcon size={18} />
          </Button>
        </div>
      </div>
      <p className="px-4 pb-1 pt-2 text-center text-xs text-brand-ink/50 sm:text-left">
        {t("hint")}
      </p>
    </form>
  );
}
