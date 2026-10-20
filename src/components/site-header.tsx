import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { brand } from "@/content/brand";
import { LocaleSwitch } from "./locale-switch";
import { ByWhatToDo } from "./by-whattodo";

export async function SiteHeader() {
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2">
          <span className="h-7 w-7 shrink-0 rounded-full bg-primary sm:h-8 sm:w-8" aria-hidden />
          <span className="whitespace-nowrap text-[15px] font-bold text-heading sm:text-lg">
            {brand.name}
          </span>
        </Link>
        <span className="inline-flex shrink-0 sm:hidden">
          <ByWhatToDo size="sm" />
        </span>
        <span className="hidden sm:inline-flex">
          <ByWhatToDo size="md" />
        </span>
        <nav className="flex shrink-0 items-center gap-3">
          <LocaleSwitch current={locale} />
        </nav>
      </div>
    </header>
  );
}
