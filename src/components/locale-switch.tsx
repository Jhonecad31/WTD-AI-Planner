"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { en: "EN", es: "ES" };

export function LocaleSwitch({ current }: { current: string }) {
  const pathname = usePathname();
  return (
    <div className="flex rounded-pill border border-black/10 p-0.5 text-xs font-semibold">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-current={l === current ? "true" : undefined}
          className={`relative after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] rounded-pill px-2.5 py-1 transition ${
            l === current ? "bg-primary text-white" : "text-brand-ink/70 hover:text-brand-ink"
          }`}
        >
          {LABELS[l] ?? l}
        </Link>
      ))}
    </div>
  );
}
