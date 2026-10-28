"use client";

import { useLocale, useTranslations } from "next-intl";
import { CUISINES, type Cuisine } from "@/lib/trip-schema";
import { formatUsd } from "@/lib/format";
import { OptionCard } from "@/components/ui/option-card";
import { BanIcon, FoodIcon } from "@/components/ui/icons";
import { useWizard } from "./wizard-state";
import { BudgetCard } from "./budget-card";

const MEAL_MIN = 15;
const MEAL_MAX = 150;
const MEAL_STEP = 5;

/** Step 5 (optional): cuisine preferences and a per-meal budget for the nightly dinner pick. */
export function StepRestaurants() {
  const t = useTranslations("wizard.restaurants");
  const locale = useLocale();
  const { draft, patch } = useWizard();
  const { skip, cuisines, budgetPerMeal } = draft.dining;

  function toggle(c: Cuisine) {
    patch({
      dining: {
        ...draft.dining,
        cuisines: cuisines.includes(c) ? cuisines.filter((x) => x !== c) : [...cuisines, c],
      },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
      </header>

      {/* Optional step: travelers who'd rather choose their own dinners skip the picks. */}
      <OptionCard
        selected={!!skip}
        onSelect={() => patch({ dining: { ...draft.dining, skip: !skip } })}
        icon={<BanIcon size={20} />}
        title={t("skip")}
        description={t("skipBody")}
        compact
      />

      {skip ? null : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <OptionCard
              selected={cuisines.length === 0}
              onSelect={() => patch({ dining: { ...draft.dining, cuisines: [] } })}
              icon={<FoodIcon size={20} />}
              title={t("any")}
              compact
            />
            {CUISINES.map((c) => (
              <OptionCard
                key={c}
                selected={cuisines.includes(c)}
                onSelect={() => toggle(c)}
                title={t(`cuisines.${c}`)}
                compact
              />
            ))}
          </section>

          <BudgetCard
            id="meal-budget"
            title={t("budgetTitle")}
            value={budgetPerMeal}
            min={MEAL_MIN}
            max={MEAL_MAX}
            step={MEAL_STEP}
            footnote={t("budgetTotal", {
              total: formatUsd(budgetPerMeal * draft.travelers.length, locale),
              count: draft.travelers.length,
            })}
            onChange={(v) => patch({ dining: { ...draft.dining, budgetPerMeal: v } })}
          />
        </>
      )}
    </div>
  );
}

export function restaurantsStepValid(d: ReturnType<typeof useWizard>["draft"]): boolean {
  return !!d.dining.skip || d.dining.budgetPerMeal >= 10;
}