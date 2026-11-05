"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { INTERESTS, type Interest } from "@/server/catalog/types";
import { formatUsd } from "@/lib/format";
import { Textarea } from "@/components/ui/field";
import { OptionCard } from "@/components/ui/option-card";
import {
  AdventureIcon,
  BeachIcon,
  ChillIcon,
  CouplesIcon,
  CultureIcon,
  FoodIcon,
  KeyIcon,
  ParkIcon,
  PartyIcon,
  ShoppingIcon,
  WaterIcon,
} from "@/components/ui/icons";
import { useWizard } from "./wizard-state";
import { Notice } from "@/components/ui/notice";
import { PacePicker } from "./pace-picker";
import { INTEREST_PHOTOS } from "@/content/interest-photos";
import { BudgetCard } from "./budget-card";
import { fullDates } from "@/lib/plan-days";
import { draftRestDates } from "./wizard-state";

/**
 * "Wellness & relax" has no tours behind it (the pace picker already covers rest days),
 * so it isn't offered: a traveler who picks it would get a plan that ignores it.
 */
const SELECTABLE_INTERESTS = INTERESTS.filter((i) => i !== "chill");

/** Typical tour price per person (catalog median ≈ USD 109), for the "fits ~N tours" hint. */
const TYPICAL_TOUR_PP_USD = 105;

const ICONS: Record<Interest, ReactNode> = {
  adventure: <AdventureIcon size={20} />,
  cultural: <CultureIcon size={20} />,
  food: <FoodIcon size={20} />,
  water: <WaterIcon size={20} />,
  beach: <BeachIcon size={20} />,
  shopping: <ShoppingIcon size={20} />,
  parks: <ParkIcon size={20} />,
  party: <PartyIcon size={20} />,
  couples: <CouplesIcon size={20} />,
  chill: <ChillIcon size={20} />,
};

const BUDGET_MIN = 100;
const BUDGET_MAX = 1000;
/** Typed amounts can go above the slider for bigger trips. */
const BUDGET_TYPED_MAX = 10000;
const BUDGET_STEP = 25;

export function StepPreferences() {
  const t = useTranslations("wizard.preferences");
  const locale = useLocale();
  const { draft, patch } = useWizard();

  const kids = draft.travelers.some((tr) => tr.age < 13);
  // How many tours the budget buys vs. how many tour days the pace leaves.
  const from = draft.inbound.date;
  const to = draft.outbound.date;
  const tourDays =
    from && to && to > from
      ? fullDates(from, to).length - (draftRestDates(draft)?.length ?? 0)
      : null;
  const toursThatFit = Math.floor(draft.budgetPerPerson / TYPICAL_TOUR_PP_USD);

  function toggle(i: Interest) {
    patch({
      interests: draft.interests.includes(i)
        ? draft.interests.filter((x) => x !== i)
        : [...draft.interests, i],
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
        <p className="mt-1 text-brand-ink/70">{t("subtitle")}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SELECTABLE_INTERESTS.map((i) => (
            <OptionCard
              key={i}
              selected={draft.interests.includes(i)}
              onSelect={() => toggle(i)}
              image={INTEREST_PHOTOS[i]}
              icon={ICONS[i]}
              title={t(`interests.${i}`)}
              compact
            />
          ))}
        </div>
        {kids && draft.interests.includes("party") ? (
          <Notice compact tone="warning" title={t("kidsPartyTitle")}>
            <p>{t("kidsParty")}</p>
          </Notice>
        ) : null}
        <OptionCard
          selected={draft.preferPrivate}
          onSelect={() => patch({ preferPrivate: !draft.preferPrivate })}
          icon={<KeyIcon size={20} />}
          title={t("private")}
          description={t("privateBody")}
          badge="+$"
          compact
        />
      </section>

      <PacePicker />

      <BudgetCard
        id="tour-budget"
        title={t("budgetTitle")}
        body={t("budgetBody")}
        value={draft.budgetPerPerson}
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        typedMax={BUDGET_TYPED_MAX}
        step={BUDGET_STEP}
        footnote={t("budgetTotal", {
          total: formatUsd(draft.budgetPerPerson * draft.travelers.length, locale),
          count: draft.travelers.length,
        })}
        hint={
          tourDays !== null && tourDays > 0
            ? {
                text:
                  toursThatFit >= tourDays
                    ? t("budgetFitsAll", { days: tourDays })
                    : t("budgetFits", { tours: Math.max(1, toursThatFit), days: tourDays }),
                tone: toursThatFit >= tourDays ? "ok" : "warn",
              }
            : undefined
        }
        onChange={(budgetPerPerson) => patch({ budgetPerPerson })}
      />

      <details className="group" open={!!draft.notes}>
        <summary className="cursor-pointer list-none text-sm font-bold text-primary hover:underline [&::-webkit-details-marker]:hidden">
          + {t("notes")}
        </summary>
        <Textarea
          id="notes"
          aria-label={t("notes")}
          maxLength={600}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          className="mt-3"
        />
      </details>
    </div>
  );
}

export function preferencesStepValid(d: ReturnType<typeof useWizard>["draft"]): boolean {
  return d.interests.length >= 1 && d.budgetPerPerson >= 50;
}
