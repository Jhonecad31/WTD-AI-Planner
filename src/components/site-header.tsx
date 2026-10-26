import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { brand } from "@/content/brand";
import { LocaleSwitch } from "./locale-switch";

export async function SiteHeader() {
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-PMC.png" alt="WhatToDo Logo" className="h-10 w-auto shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap text-[15px] font-bold leading-tight text-heading sm:text-lg">
              {brand.name}
            </span>
            {/* Offset to the right of the title on purpose. */}
            <span className="ml-3 whitespace-nowrap text-[10px] font-bold leading-tight text-muted sm:text-xs">
              powered by {brand.poweredBy}
            </span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3">
          <LocaleSwitch current={locale} />
        </nav>
      </div>
    </header>
  );
}
