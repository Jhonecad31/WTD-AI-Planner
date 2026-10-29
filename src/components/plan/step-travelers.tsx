"use client";

import { useTranslations } from "next-intl";
import { Field, Input } from "@/components/ui/field";
import { UsersIcon } from "@/components/ui/icons";
import { TRAVELER_TITLES } from "@/lib/trip-schema";
import { useWizard, type TravelerDraft } from "./wizard-state";

const ADULT_AGE = 30;
const CHILD_AGE = 8;

function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-xl font-semibold text-heading transition hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-line disabled:hover:text-heading";
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="font-bold">{label}</p>
        {hint ? <p className="text-xs text-brand-ink/55">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btn}
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`− ${label}`}
        >
          −
        </button>
        <span className="w-8 text-center text-2xl font-bold tabular-nums text-primary">
          {value}
        </span>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`+ ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function StepTravelers() {
  const t = useTranslations("wizard.travelers");
  const { draft, patch } = useWizard();
  const adults = draft.travelers.filter((x) => x.age >= 13);
  const children = draft.travelers.filter((x) => x.age < 13);

  function setCounts(nAdults: number, nChildren: number) {
    const a: TravelerDraft[] = adults.slice(0, nAdults);
    while (a.length < nAdults) a.push({ age: ADULT_AGE });
    const c: TravelerDraft[] = children.slice(0, nChildren);
    while (c.length < nChildren) c.push({ age: CHILD_AGE });
    patch({ travelers: [...a, ...c] });
  }

  function update(index: number, p: Partial<TravelerDraft>) {
    patch({ travelers: draft.travelers.map((x, i) => (i === index ? { ...x, ...p } : x)) });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
        <p className="mt-1 text-brand-ink/70">{t("subtitle")}</p>
      </header>

      {/* Lead traveler's name first, then how many people come. */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t("leadName")} htmlFor="lead-name" className="sm:col-span-2">
          <div className="flex gap-2">
            <div
              role="radiogroup"
              aria-label={t("titleLabel")}
              className="flex shrink-0 rounded-pill border border-black/15 bg-white p-1"
            >
              {/* Optional: tapping the selected title again clears it. */}
              {TRAVELER_TITLES.map((v) => {
                const selected = draft.travelerTitle === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ travelerTitle: selected ? undefined : v })}
                    className={`rounded-pill px-3 py-1.5 text-sm font-semibold transition ${
                      selected ? "bg-primary text-white" : "text-brand-ink/70 hover:text-primary"
                    }`}
                  >
                    {t(`titles.${v}`)}
                  </button>
                );
              })}
            </div>
            <Input
              id="lead-name"
              value={draft.travelers[0]?.name ?? ""}
              onChange={(e) => update(0, { name: e.target.value })}
              autoComplete="given-name"
            />
          </div>
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Counter
          label={t("adults")}
          value={adults.length}
          min={1}
          max={10}
          onChange={(v) => setCounts(v, children.length)}
        />
        <Counter
          label={t("children")}
          value={children.length}
          min={0}
          max={8}
          onChange={(v) => setCounts(adults.length, v)}
        />
      </section>

      {children.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-bold text-brand-ink/70">{t("agesTitle")}</h3>
          <div className="flex flex-wrap gap-3">
            {draft.travelers.map((tr, i) =>
              tr.age < 13 ? (
                <label
                  key={i}
                  className="flex items-center gap-2 rounded-pill border border-line bg-white py-1.5 pl-4 pr-2 text-sm font-semibold"
                >
                  {t("childAge", { n: children.indexOf(tr) + 1 })}
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={tr.age}
                    onChange={(e) =>
                      update(i, { age: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })
                    }
                    className="w-14 rounded-pill border border-line bg-surface px-2 py-1 text-center font-bold text-primary focus:border-primary focus:outline-none"
                  />
                </label>
              ) : null,
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {draft.travelers.length > 1 && (
          <details className="sm:col-span-2">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary">
              <UsersIcon size={16} /> {t("names")}{" "}
              <span className="font-normal text-brand-ink/50">· {t("namesHint")}</span>
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {draft.travelers.slice(1).map((tr, i) => (
                <Input
                  key={i + 1}
                  placeholder={t("traveler", { n: i + 2 })}
                  value={tr.name ?? ""}
                  onChange={(e) => update(i + 1, { name: e.target.value })}
                />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

export function travelersStepValid(d: ReturnType<typeof useWizard>["draft"]): boolean {
  return d.travelers.length >= 1;
}