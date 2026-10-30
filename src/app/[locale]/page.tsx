import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { brand } from "@/content/brand";
import { BEST_RATED, BEST_RATED_ALL_URL } from "@/content/best-rated";
import { WHY_PLAN_PHOTO } from "@/content/why-plan";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QuickStart } from "@/components/landing/quick-start";
import { formatUsd } from "@/lib/format";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ExternalIcon,
  CompassIcon,
  MapIcon,
  PinIcon,
  PlaneIcon,
  SlidersIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { getHeroImage, hasBokunCredentials } from "@/server/catalog/service";

export const instant = false;
export const maxDuration = 60;

async function loadHero(): Promise<string | null> {
  if (!hasBokunCredentials()) return null;
  try {
    return await getHeroImage();
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const hero = await loadHero();
  const steps = ["1", "2", "3", "4"] as const;
  const stepIcons = [PlaneIcon, UsersIcon, CompassIcon, MapIcon];
  const whyBenefits = [
    { id: "curated", Icon: StarIcon },
    { id: "experts", Icon: UsersIcon },
    { id: "tailored", Icon: SlidersIcon },
    { id: "allInOne", Icon: PinIcon },
  ] as const;
  const statIcons = { years: CalendarIcon, travelers: UsersIcon, rating: StarIcon, tours: PinIcon };

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-surface">
        {/* Hero */}
        <section className="relative">
          <div className="relative overflow-hidden bg-brand-navy text-white">
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
  src="/hero-top.webp"
  alt=""
  className="absolute inset-0 h-full w-full object-cover"
  fetchPriority="high"
/>
            
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-16 sm:px-6 sm:pb-36 sm:pt-24 lg:pb-40 lg:pt-28">
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
                {t("title")}
              </h1>
              <div className="flex max-w-xl flex-col gap-1">
                <p className="text-lg font-semibold text-white/95 sm:text-xl">{t("subtitle")}</p>
              
              </div>
              {/* Stacked on phones/tablets, one row from lg (desktop) up. */}
              <ul className="flex max-w-xl flex-col gap-4 lg:max-w-none lg:flex-row lg:gap-8">
                {(["1", "2", "3"] as const).map((k, i) => {
                  const Icon = [PinIcon, UsersIcon, StarIcon][i];
                  return (
                    <li key={k} className="flex items-start gap-3 lg:flex-1">
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
            </div>
          </div>
          {/* Floating quick-start */}
          <div className="relative mx-auto -mt-16 max-w-5xl px-4 sm:-mt-20 sm:px-6">
            <QuickStart />
          </div>
        </section>

        {/* How it works: the same step rail the traveler meets on /plan */}
        <section id="how" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t("howTitle")}</h2>
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
                  {/* Mobile only: connects this circle to the next one across the gap-8. */}
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute -bottom-8 left-[21px] top-11 w-0.5 bg-primary/30 sm:hidden"
                    />
                  )}
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

        {/* Why is it free */}
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20">
          {/*Secccion de espacio para no colapsar todo el contenido*/}
        </section>



        {/* Why plan with What To Do In Cancun: benefits (left) + photo with trust stats (right) */}
        <section className="pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto grid max-w-6xl gap-10 bg-white px-4 py-12 sm:rounded-[28px] sm:border sm:border-line/70 sm:p-8 sm:shadow-card lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:p-10">
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-wide text-primary">
                {t("whyPlan.eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-[1.1] text-brand-ink sm:text-4xl lg:text-5xl">
                {t("whyPlan.title", { brand: brand.poweredBy })}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-ink/70 sm:text-lg">
                {t("whyPlan.body")}
              </p>
              <ul className="mt-8 grid gap-3 min-[360px]:grid-cols-2 sm:gap-4">
                {whyBenefits.map(({ id, Icon }) => (
                  <li
                    key={id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:gap-4 sm:p-5 lg:flex-col xl:flex-row"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:h-14 sm:w-14">
                      <Icon size={24} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug text-brand-ink">
                        {t(`whyPlan.benefits.${id}.title`)}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-brand-ink/65">
                        {t(`whyPlan.benefits.${id}.body`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Photo on top (phones/tablets) or behind the card (desktop) */}
            <div className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] lg:justify-end lg:p-3 lg:pt-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={WHY_PLAN_PHOTO.src}
                srcSet={WHY_PLAN_PHOTO.srcSet}
                sizes="(min-width: 1024px) 540px, (min-width: 640px) 90vw, 100vw"
                width={WHY_PLAN_PHOTO.width}
                height={WHY_PLAN_PHOTO.height}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[16/9] w-full object-cover sm:aspect-[2/1] lg:absolute lg:inset-0 lg:aspect-auto lg:h-full"
              />
              <div className="relative -mt-6 rounded-[20px] bg-primary-deep p-5 text-white shadow-float sm:p-7 lg:mt-0 lg:p-5 xl:p-7">
                <h3 className="text-xl font-bold leading-snug sm:text-2xl">
                  <span className="lg:hidden">
                    {t("whyPlan.trustTitleShort", { brand: brand.poweredBy })}
                  </span>
                  <span className="hidden lg:inline">
                    {t("whyPlan.trustTitle", { brand: brand.poweredBy })}
                  </span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">
                  <span className="lg:hidden">{t("whyPlan.trustBodyShort")}</span>
                  <span className="hidden lg:inline">{t("whyPlan.trustBody")}</span>
                </p>
                <dl className="mt-5 grid gap-px overflow-hidden bg-white/15 min-[360px]:grid-cols-2">
                  {brand.stats.map((s) => {
                    const Icon = statIcons[s.id];
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2.5 bg-primary-deep py-3 min-[360px]:even:pl-3 min-[360px]:odd:pr-2 sm:gap-3 sm:min-[360px]:even:pl-4 sm:min-[360px]:odd:pr-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white sm:h-12 sm:w-12 lg:h-10 lg:w-10 xl:h-12 xl:w-12">
                          <Icon size={18} />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <dt className="order-2 text-xs leading-snug text-white/80 sm:text-sm">
                            {t(`whyPlan.stats.${s.id}`)}
                          </dt>
                          <dd className="order-1 flex flex-wrap items-center gap-x-2 text-lg font-bold leading-tight sm:text-2xl lg:text-xl xl:text-[1.75rem]">
                            {s.value}
                            {s.id === "rating" && (
                              <span
                                role="img"
                                aria-label={t("whyPlan.ratingLabel", { value: s.value })}
                                className="inline-flex text-star"
                              >
                                {[0, 1, 2, 3, 4].map((i) => (
                                  <StarIcon key={i} size={14} />
                                ))}
                              </span>
                            )}
                          </dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </div>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
