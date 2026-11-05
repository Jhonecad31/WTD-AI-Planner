"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { formatUsd } from "@/lib/format";

/**
 * Green budget block with a typed amount and a slider. Used for the tour budget
 * (per person, whole trip) and the restaurant budget (per person, per meal).
 */
export function BudgetCard({
  id,
  title,
  body,
  value,
  min,
  max,
  step,
  typedMax,
  footnote,
  hint,
  onChange,
}: {
  id: string;
  title: string;
  body?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Highest amount that can be typed; the slider stops at `max` and reads "max+". */
  typedMax?: number;
  /** Line under the amount, e.g. "About USD 600 for 2 travelers". */
  footnote?: string;
  /** Highlighted line, e.g. how many tours the budget buys vs. the tour days. */
  hint?: { text: string; tone: "ok" | "warn" };
  onChange: (value: number) => void;
}) {
  const locale = useLocale();
  const ceiling = typedMax ?? max;
  const pct = Math.min(100, ((value - min) / (max - min)) * 100);
  const set = (v: number) =>
    onChange(Math.max(min, Math.min(ceiling, Math.round(v / step) * step)));
  // What the traveler is typing. Clamping on every keystroke made the field jump to `min`
  // when emptied and glue the next digit onto it; clamp once they're done instead.
  const [typed, setTyped] = useState<string | null>(null);
  const commit = () => {
    if (typed === null) return;
    set(Number(typed) || min);
    setTyped(null);
  };

  return (
    <section className="rounded-card bg-primary p-6 text-white shadow-card" aria-labelledby={id}>
      <h3 id={id} className="text-lg font-bold">
        {title}
      </h3>
      {body ? <p className="mt-1 text-sm text-white/80">{body}</p> : null}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <label className="flex items-center gap-1 text-5xl font-bold tabular-nums">
          <span aria-hidden>$</span>
          <input
            type="number"
            min={min}
            max={ceiling}
            step={step}
            value={typed ?? value}
            onChange={(e) => {
              setTyped(e.target.value);
              // Keep the slider and totals live while typing, without forcing the text.
              const n = Number(e.target.value);
              if (n >= min && n <= ceiling) onChange(n);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            aria-label={title}
            className="w-40 rounded-card border border-white/30 bg-white/10 px-3 py-1 text-white outline-none focus:border-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </label>
        {footnote ? <span className="text-sm text-white/85">{footnote}</span> : null}
      </div>
      {hint ? (
        <p
          className={`mt-4 flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold ${
            hint.tone === "warn" ? "bg-white text-primary" : "bg-white/15 text-white"
          }`}
        >
          <span aria-hidden>{hint.tone === "warn" ? "⚠︎" : "✓"}</span>
          {hint.text}
        </p>
      ) : null}
      <input
        type="range"
        className="budget-slider mt-6 w-full"
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={title}
        aria-valuetext={formatUsd(value, locale)}
        style={{
          background: `linear-gradient(to right, #fff ${pct}%, rgba(255,255,255,0.3) ${pct}%)`,
        }}
      />
      <div className="mt-2 flex justify-between text-xs text-white/70">
        <span>{formatUsd(min, locale)}</span>
        <span>{formatUsd(max, locale)}+</span>
      </div>
    </section>
  );
}
