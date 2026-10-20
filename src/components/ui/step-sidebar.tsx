import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

export interface StepMeta {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
}

/**
 * Vertical step list (desktop) and horizontal icon strip (mobile) in one component.
 * Completed steps are clickable so travelers can go back and edit.
 */
export function StepSidebar({
  steps,
  current,
  onSelect,
  progressLabel,
  currentLabel,
}: {
  steps: StepMeta[];
  current: number;
  onSelect?: (index: number) => void;
  progressLabel: string;
  /** Shown next to the progress on mobile, where the step strip has icons only. */
  currentLabel?: string;
}) {
  const pct = Math.round((current / (steps.length - 1)) * 100);

  return (
    <nav aria-label={progressLabel}>
      {/* Progress */}
      <div className="mb-5 lg:mb-7">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-brand-ink/60">
            {progressLabel}
            {currentLabel ? (
              <span className="text-heading lg:hidden"> · {currentLabel}</span>
            ) : null}
          </span>
          <span className="text-primary">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-line">
          <div
            className="h-full rounded-pill bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(6, pct)}%` }}
          />
        </div>
      </div>

      {/* Desktop: vertical list */}
      <ol className="hidden lg:flex lg:flex-col">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const last = i === steps.length - 1;
          return (
            <li key={s.id} className="relative flex gap-4">
              {!last ? (
                <span
                  aria-hidden
                  className={`absolute left-[19px] top-10 h-[calc(100%-1.25rem)] w-0.5 rounded ${
                    done ? "bg-primary" : "bg-line"
                  }`}
                />
              ) : null}
              <button
                type="button"
                disabled={!done || !onSelect}
                onClick={() => onSelect?.(i)}
                aria-current={active ? "step" : undefined}
                className="group flex w-full items-start gap-4 rounded-card py-2 pr-2 text-left transition disabled:cursor-default enabled:hover:bg-brand-navy/[0.04]"
              >
                <span
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    active
                      ? "border-transparent bg-primary text-white shadow-md shadow-primary/30"
                      : done
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-white text-muted"
                  }`}
                >
                  {done ? <CheckIcon size={16} /> : s.icon}
                </span>
                <span className="min-w-0 pt-1.5">
                  <span
                    className={`block text-sm font-bold leading-tight ${
                      active ? "text-primary" : done ? "text-heading" : "text-muted"
                    }`}
                  >
                    {s.label}
                  </span>
                  {s.hint ? (
                    <span
                      className={`mt-0.5 block text-xs ${active ? "text-brand-ink/60" : "text-brand-ink/40"}`}
                    >
                      {s.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Mobile: horizontal icon strip */}
      <ol className="flex items-center lg:hidden">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const last = i === steps.length - 1;
          return (
            <li key={s.id} className={`flex items-center ${last ? "" : "flex-1"}`}>
              <button
                type="button"
                disabled={!done || !onSelect}
                onClick={() => onSelect?.(i)}
                aria-current={active ? "step" : undefined}
                aria-label={s.label}
                className={`relative flex h-9 w-9 shrink-0 after:absolute after:-inset-1 after:content-['']  items-center justify-center rounded-full border-2 transition-colors ${
                  active
                    ? "border-transparent bg-primary text-white shadow-md shadow-primary/30"
                    : done
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-white text-muted"
                }`}
              >
                {done ? (
                  <CheckIcon size={14} />
                ) : (
                  <span className="[&>svg]:h-4 [&>svg]:w-4">{s.icon}</span>
                )}
              </button>
              {!last ? (
                <span
                  aria-hidden
                  className={`mx-1 h-0.5 flex-1 rounded ${done ? "bg-primary" : "bg-line"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
