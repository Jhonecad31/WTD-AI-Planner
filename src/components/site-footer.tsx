"use client";

import { useSyncExternalStore, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { brand } from "@/content/brand";
import { GlobeIcon, MailIcon, PhoneIcon } from "@/components/ui/icons";
import { FacebookLogo, InstagramLogo, TikTokLogo, WebsiteLogo } from "@/components/ui/social-icons";

// `new Date()` is not allowed during prerender; render the year on the client only.
const noopSubscribe = () => () => {};
function useYear(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => String(new Date().getFullYear()),
    () => "",
  );
}

const SOCIAL: { label: string; url: string; Logo: ComponentType<{ size?: number }> }[] = [
  { label: "Facebook", url: brand.social.facebook, Logo: FacebookLogo },
  { label: "Instagram", url: brand.social.instagram, Logo: InstagramLogo },
  { label: "TikTok", url: brand.social.tiktok, Logo: TikTokLogo },
  { label: "whattodoincancun.com", url: brand.social.website, Logo: WebsiteLogo },
];

const contactLink =
  "inline-flex min-h-10 items-center gap-2.5 text-brand-ink/70 transition hover:text-primary";

export function SiteFooter() {
  const year = useYear();
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[minmax(0,26rem)_auto_auto] lg:justify-start lg:gap-16">
        {/* Brand: same lockup as the navbar, larger */}
        <div className="md:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-PMC.svg" alt="WhatToDo Logo" className="h-20 w-auto shrink-0" />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-ink/65">{t("tagline")}</p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{t("contact")}</h2>
          <ul className="mt-3 text-sm">
            <li>
              <a className={contactLink} href={`mailto:${brand.salesEmail}`}>
                <MailIcon size={18} className="shrink-0 text-primary" />
                <span className="sr-only">{t("email")}: </span>
                {brand.salesEmail}
              </a>
            </li>
            <li>
              <a className={contactLink} href={`tel:${brand.phone.replace(/\s/g, "")}`}>
                <PhoneIcon size={18} className="shrink-0 text-primary" />
                <span className="sr-only">{t("phone")}: </span>
                {brand.phone}
              </a>
            </li>
            <li>
              <a className={contactLink} href={brand.siteUrl} target="_blank" rel="noreferrer">
                <GlobeIcon size={18} className="shrink-0 text-primary" />
                <span className="sr-only">{t("website")}: </span>
                whattodoincancun.com
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{t("follow")}</h2>
          <ul className="mt-4 flex gap-3">
            {SOCIAL.map(({ label, url, Logo }) => (
              <li key={label}>
                {/* Without a URL the logo still shows (no link) until one is added in brand.ts. */}
                <a
                  href={url || undefined}
                  target={url ? "_blank" : undefined}
                  rel={url ? "noreferrer" : undefined}
                  aria-label={label}
                  title={label}
                  className="flex h-11 w-11 items-center justify-center rounded-full shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <Logo size={44} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line bg-surface">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-brand-ink/60 sm:px-6 lg:text-left">
          © {year} {brand.poweredBy}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
