"use client";

import { useSyncExternalStore } from "react";
import { brand } from "@/content/brand";
import { ByWhatToDo } from "./by-whattodo";

// `new Date()` is not allowed during prerender; render the year on the client only.
const noopSubscribe = () => () => {};
function useYear(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => String(new Date().getFullYear()),
    () => "",
  );
}

export function SiteFooter() {
  const year = useYear();
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-brand-ink/60 sm:flex-row sm:px-6">
        <p className="flex items-center gap-3">
          © {year} <ByWhatToDo size="sm" />
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-4">
          <a
            className="inline-flex min-h-11 items-center hover:text-brand-ink"
            href={`mailto:${brand.salesEmail}`}
          >
            {brand.salesEmail}
          </a>
          <a
            className="inline-flex min-h-11 items-center hover:text-brand-ink"
            href={`tel:${brand.phone.replace(/\s/g, "")}`}
          >
            {brand.phone}
          </a>
          <a
            className="inline-flex min-h-11 items-center hover:text-brand-ink"
            href={brand.siteUrl}
            target="_blank"
            rel="noreferrer"
          >
            whattodoincancun.com
          </a>
        </p>
      </div>
    </footer>
  );
}
