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
          <img width="80%" src="/logo-PMC.svg" alt="WhatToDo Logo" className="h-16 w-auto shrink-0" />
        </Link>
        <nav className="flex shrink-0 items-center gap-3">
          <LocaleSwitch current={locale} />
        </nav>
      </div>
    </header>
  );
}
