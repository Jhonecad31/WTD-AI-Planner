import type { ReactNode } from "react";
import {
  AlertIcon,
  ChevronIcon,
  CloudRainIcon,
  FoodIcon,
  InfoIcon,
  SwapIcon,
  WindIcon,
} from "@/components/ui/icons";

/** Eye-catching callout for itinerary notices (kids, weather, availability changes…). */
const TONES = {
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-950",
    dot: "bg-amber-400 text-white",
    Icon: AlertIcon,
  },
  rain: {
    box: "border-sky-300 bg-sky-50 text-sky-950",
    dot: "bg-sky-500 text-white",
    Icon: CloudRainIcon,
  },
  wind: {
    box: "border-slate-300 bg-slate-100 text-slate-900",
    dot: "bg-slate-500 text-white",
    Icon: WindIcon,
  },
  change: {
    box: "border-violet-300 bg-violet-50 text-violet-950",
    dot: "bg-violet-500 text-white",
    Icon: SwapIcon,
  },
  dining: {
    box: "border-orange-300 bg-orange-50 text-orange-950",
    dot: "bg-orange-400 text-white",
    Icon: FoodIcon,
  },
  info: {
    box: "border-primary/30 bg-primary-soft text-heading",
    dot: "bg-primary text-white",
    Icon: InfoIcon,
  },
} as const;

export type NoticeTone = keyof typeof TONES;

export function Notice({
  tone,
  title,
  children,
  compact = false,
}: {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const single = !children;
  const { box, dot, Icon } = TONES[tone];
  return (
    <div
      role="note"
      className={`flex ${single ? "items-center" : "items-start"} gap-3 rounded-card border ${box} ${
        compact ? "px-3 py-2.5" : "px-4 py-3.5"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${dot} ${
          compact ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        <Icon size={compact ? 16 : 19} />
      </span>
      <div className="flex min-w-0 flex-col gap-1 text-sm leading-relaxed">
        <p className={`font-bold ${compact ? "text-sm" : "text-base"}`}>{title}</p>
        {children}
      </div>
    </div>
  );
}

export interface NoticeItem {
  key: string;
  tone: NoticeTone;
  title: string;
  body?: ReactNode;
}

/**
 * Trip-level notices folded into one row ("Good to know (3)") so the plan starts
 * near the top. A single notice is shown directly.
 */
export function NoticeGroup({ notices, label }: { notices: NoticeItem[]; label: string }) {
  if (!notices.length) return null;
  if (notices.length === 1) {
    const [n] = notices;
    return (
      <Notice compact tone={n.tone} title={n.title}>
        {n.body}
      </Notice>
    );
  }
  const { box, dot, Icon } = TONES[notices[0].tone];
  return (
    <details className="group">
      <summary
        className={`flex cursor-pointer list-none items-center gap-3 rounded-card border px-3 py-2.5 [&::-webkit-details-marker]:hidden ${box}`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dot}`}>
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-bold">
            {label} ({notices.length})
          </span>
          <span className="block truncate opacity-75">
            {notices.map((n) => n.title).join(" · ")}
          </span>
        </span>
        <ChevronIcon size={18} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {notices.map((n) => (
          <Notice key={n.key} compact tone={n.tone} title={n.title}>
            {n.body}
          </Notice>
        ))}
      </div>
    </details>
  );
}
