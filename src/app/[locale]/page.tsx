import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { brand } from "@/content/brand";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QuickStart } from "@/components/landing/quick-start";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  ExternalIcon,
  CompassIcon,
  MapIcon,
  PinIcon,
  PlaneIcon,
  ShieldIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { formatUsd } from "@/lib/format";
import { getFeaturedProducts, getHeroImage, hasBokunCredentials } from "@/server/catalog/service";
import type { CatalogProduct } from "@/server/catalog/types";

export const instant = false;
export const maxDuration = 60;

function minutesText(m: number | null) {
  if (!m) return null;
  if (m >= 24 * 60) return `${Math.round(m / (24 * 60))}d`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

async function loadCatalog(): Promise<{ hero: string | null; featured: CatalogProduct[] }> {
  if (!hasBokunCredentials()) return { hero: null, featured: [] };
  try {
    const [hero, featured] = await Promise.all([getHeroImage(), getFeaturedProducts(8)]);
    return { hero, featured };
  } catch {
    return { hero: null, featured: [] };
  }
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const { hero, featured } = await loadCatalog();
  const steps = ["1", "2", "3", "4"] as const;
  const stepIcons = [PlaneIcon, UsersIcon, CompassIcon, MapIcon];
  const whyIcons = [StarIcon, UsersIcon, ShieldIcon, PinIcon];

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-surface">
        {/* Hero */}
        <section className="relative">
          <div className="relative overflow-hidden bg-brand-navy text-white">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                fetchPriority="high"
              />
            ) : (
              <div className="absolute inset-0 bg-primary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-16 sm:px-6 sm:pb-36 sm:pt-24 lg:pb-40 lg:pt-28">
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
                {t("title")}
              </h1>
              <div className="flex max-w-xl flex-col gap-1">
                <p className="text-lg font-semibold text-white/95 sm:text-xl">{t("subtitle")}</p>
                <p className="inline-flex items-start gap-2 text-sm text-white/85 sm:text-base">
                  <StarIcon size={16} className="mt-1 shrink-0 text-brand-lime-light" />
                  {t("award")}
                </p>
              </div>
              <ul className="flex max-w-xl flex-col gap-4">
                {(["1", "2", "3"] as const).map((k, i) => {
                  const Icon = [PinIcon, UsersIcon, StarIcon][i];
                  return (
                    <li key={k} className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur-sm">
                        <Icon size={20} />
                      </span>
                      <span>
                        <span className="block text-lg font-bold leading-tight">
                          {t.rich(`benefits.${k}.title`, {
                            big: (chunks) => (
                              <span className="text-[1.35em] leading-none text-brand-lime-light tabular-nums">
                                {chunks}
                              </span>
                            ),
                          })}
                        </span>
                        <span className="block text-sm text-white/85">
                          {t(`benefits.${k}.body`)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/plan"
                  className="inline-flex items-center gap-2 rounded-pill bg-primary px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-black/25 transition hover:bg-primary-hover"
                >
                  {t("cta")} <ArrowRightIcon size={18} />
                </Link>
              </div>
            </div>
          </div>
          {/* Floating quick-start */}
          <div className="relative mx-auto -mt-16 max-w-5xl px-4 sm:-mt-20 sm:px-6">
            <QuickStart />
          </div>
        </section>

        {/* Why is it free */}
        <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-6 sm:pt-20">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t("freeTitle")}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {(["1", "2"] as const).map((k) => (
              <li
                key={k}
                className="flex gap-4 rounded-card border border-line bg-white p-5 shadow-sm sm:p-6"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                  {k}
                </span>
                <div>
                  <h3 className="text-lg font-bold leading-snug">{t(`whyFree.${k}.title`)}</h3>
                  <p className="mt-1 text-brand-ink/70">{t(`whyFree.${k}.body`)}</p>
                  {k === "1" ? (
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {t("whyFree.optional")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Featured tours */}
        {featured.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold sm:text-4xl">{t("featuredTitle")}</h2>
                <p className="mt-2 text-brand-ink/70">{t("featuredBody")}</p>
              </div>
              <a
                href={brand.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                {t("viewAll")} <ExternalIcon size={14} />
              </a>
            </div>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((p) => (
                <li key={p.bokunId}>
                  <a
                    href={p.siteUrl ?? brand.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-card"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.imageUrl ?? ""}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {p.durationMinutes ? (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/90 px-2.5 py-1 text-xs font-bold text-heading backdrop-blur">
                          <ClockIcon size={12} /> {minutesText(p.durationMinutes)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="line-clamp-2 font-bold leading-snug">{p.title}</h3>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <span className="text-xs text-brand-ink/60">{t("perPerson")}</span>
                        <span className="text-lg font-bold text-primary">
                          {t("from", { price: formatUsd(p.priceFromUsd ?? 0, locale) })}
                        </span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* How it works: the same step rail the traveler meets on /plan */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-3xl font-bold sm:text-4xl">{t("howTitle")}</h2>
          <ol className="relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            <span
              aria-hidden
              className="absolute left-[22px] top-0 hidden h-full w-0.5 bg-primary/30 sm:block lg:left-0 lg:top-[22px] lg:h-0.5 lg:w-full"
            />
            {steps.map((n, i) => {
              const Icon = stepIcons[i];
              const last = i === steps.length - 1;
              return (
                <li key={n} className="relative flex gap-4 lg:flex-col lg:pr-8">
                  <span
                    className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${
                      last
                        ? "border-primary bg-primary text-white"
                        : "border-transparent bg-primary text-white shadow-md shadow-primary/30"
                    }`}
                  >
                    {last ? <CheckIcon size={18} /> : <Icon size={20} />}
                  </span>
                  <div className="lg:mt-5">
                    <h3 className="text-lg font-bold">{t(`steps.${n}.title`)}</h3>
                    <p className="mt-1 max-w-xs text-sm leading-relaxed text-brand-ink/70">
                      {t(`steps.${n}.body`)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Why + trust */}
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">{t("whyTitle")}</h2>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2">
                {(["1", "2", "3", "4"] as const).map((n, i) => {
                  const Icon = whyIcons[i];
                  return (
                    <li key={n} className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <Icon size={20} />
                      </span>
                      <div>
                        <h3 className="font-bold">{t(`why.${n}.title`)}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-brand-ink/70">
                          {t(`why.${n}.body`)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-[20px] bg-primary p-7 text-white shadow-card sm:p-9">
              <h2 className="text-2xl font-bold sm:text-3xl">{t("trustTitle")}</h2>
              <p className="mt-3 text-white/85">{t("trustBody")}</p>
              <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
                {brand.stats.map((s) => (
                  <span key={s.label} className="inline-flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-white">{s.value}</span>
                    {s.label}
                  </span>
                ))}
              </p>
              {brand.awards.length > 0 && (
                <div className="mt-7 border-t border-white/20 pt-6">
                  <p className="text-xs font-bold text-white/70">{t("awardsTitle")}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                    {brand.awards.map((a) => (
                      <li key={a.name} className="flex items-center gap-2 text-sm font-semibold">
                        {a.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.logo} alt="" className="h-8 object-contain" />
                        ) : (
                          <StarIcon size={16} className="text-star" />
                        )}
                        {a.name}
                        {a.year ? ` · ${a.year}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {brand.partners.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-bold text-white/70">{t("partnersTitle")}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
                    {brand.partners.map((p) => (
                      <li key={p.name}>
                        {p.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.logo}
                            alt={p.name}
                            className="h-8 object-contain brightness-0 invert"
                          />
                        ) : (
                          p.name
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <a
                href={brand.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-1 font-semibold text-white underline-offset-4 hover:underline"
              >
                whattodoincancun.com <ExternalIcon size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-primary" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center text-white sm:px-6 sm:py-28">
            <h2 className="text-3xl font-bold sm:text-5xl">{t("finalTitle")}</h2>
            <p className="max-w-xl text-lg text-white/85">{t("finalBody")}</p>
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 rounded-pill bg-primary px-8 py-4 text-lg font-bold text-white shadow-lg shadow-black/25 transition hover:bg-primary-hover"
            >
              {t("cta")} <ArrowRightIcon size={20} />
            </Link>
            <p className="mt-4 text-sm text-white/70">
              {t("sisterSites")}{" "}
              {brand.sisterSites.map((s, i) => (
                <span key={s.url}>
                  {i > 0 ? " · " : ""}
                  <a className="font-semibold text-white hover:underline" href={s.url}>
                    {s.name}
                  </a>
                </span>
              ))}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
