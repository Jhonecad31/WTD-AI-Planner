import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

/**
 * Selectable card used for interests, hotel zones, transfers and chill days.
 * Single-select groups pass role="radio"; multi-select pass role="checkbox".
 */
export function OptionCard({
  selected,
  onSelect,
  role = "checkbox",
  icon,
  image,
  title,
  description,
  badge,
  badgeTone = "green",
  highlight = false,
  compact = false,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  role?: "checkbox" | "radio";
  icon?: ReactNode;
  image?: string | null;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  /** "gold" marks a recommendation. */
  badgeTone?: "green" | "gold";
  /** Gold outline for recommended options (when not selected). */
  highlight?: boolean;
  compact?: boolean;
  /** Option that can't apply right now (e.g. more tour days than the trip has). */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`group relative flex w-full flex-col overflow-hidden rounded-card border bg-white text-left transition-[border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        disabled
          ? "cursor-not-allowed border-line opacity-45"
          : selected
            ? "border-primary shadow-[0_0_0_1px_var(--color-primary),var(--shadow-card)]"
            : highlight
              ? "border-amber-300 shadow-sm hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-card"
              : "border-line shadow-sm hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card"
      }`}
    >
      {image ? (
        <div className="relative h-24 w-full overflow-hidden bg-gray-100 sm:h-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>
      ) : null}
      <div className={`flex items-start gap-3 pr-10 ${compact ? "p-3.5" : "p-4"}`}>
        {icon ? (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              selected ? "bg-primary text-white" : "bg-primary-soft text-primary"
            }`}
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-snug text-brand-ink">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-brand-ink/60">
              {description}
            </span>
          ) : null}
          {badge ? (
            <span
              className={`mt-2 inline-block rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                badgeTone === "gold"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-primary-soft text-primary"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </span>
      </div>
      <span
        aria-hidden
        className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
          selected
            ? "scale-100 border-primary bg-primary text-white"
            : "scale-90 border-black/15 bg-white/90 text-transparent"
        }`}
      >
        <CheckIcon size={14} />
      </span>
    </button>
  );
}
