import type { ReactNode } from "react";

export function ChipToggle({
  selected,
  onToggle,
  children,
  icon,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold transition ${
        selected
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-black/15 bg-white text-brand-ink hover:border-primary/60"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function RadioPill<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-pill border px-4 py-2 text-sm font-semibold transition ${
            value === o.value
              ? "border-primary bg-primary text-white"
              : "border-black/15 bg-white text-brand-ink hover:border-primary/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
