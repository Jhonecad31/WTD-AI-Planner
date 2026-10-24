"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import AnimatedLoadingSkeleton from "@/components/ui/animated-loading-skeleton";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BeachIcon,
  BedIcon,
  CarIcon,
  ClockIcon,
  CompassIcon,
  ExternalIcon,
  FoodIcon,
  KeyIcon,
  PinIcon,
  ShoppingIcon,
  SunIcon,
  SwapIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { TripAdvisorBadge } from "@/components/ui/tripadvisor-rating";
import { Notice, NoticeGroup, type NoticeItem } from "@/components/ui/notice";
import { TripRequestSchema, type TripRequest } from "@/lib/trip-schema";
import type { Itinerary, ItineraryItem } from "@/lib/itinerary-schema";
import { formatDate, formatUsd } from "@/lib/format";
import { isPrivateTitle } from "@/lib/item-meta";
import { draftRestDates, useWizard } from "./wizard-state";
import { AlternativesPanel, TourOptions, editItinerary, reasonText } from "./itinerary-editor";
import { WeatherChip } from "./weather";
import { seasonNotes } from "@/lib/weather";
import { ScrollHint } from "./scroll-hint";
import { TripSummary } from "./trip-summary";

type GenerateResponse = {
  itinerary: Itinerary;
  engine: "rules" | "claude";
  fallbackReason?: string;
  /** True once the traveler changed a tour; "try another version" asks before discarding. */
  edited?: boolean;
  /** The trip request it was built from; a changed answer builds a new one. */
  requestKey?: string;
};

export function buildTripRequest(
  draft: ReturnType<typeof useWizard>["draft"],
  locale: string,
): TripRequest | null {
  const parsed = TripRequestSchema.safeParse({
    locale,
    inbound: draft.inbound,
    outbound: draft.outbound,
    hotel: { noHotel: !!draft.hotel.noHotel, zone: draft.hotel.zone, name: draft.hotel.name },
    transfers: {
      arrival: draft.transfers.arrival,
      departure: draft.transfers.departure,
      luxury: draft.transfers.luxury,
    },
    travelers: draft.travelers,
    travelerTitle: draft.travelerTitle,
    interests: draft.interests,
    preferPrivate: draft.preferPrivate,
    dining: draft.dining,
    chillDays: draft.chillDays,
    tourDays: draft.tourDays,
    restDates: draftRestDates(draft),
    budgetPerPerson: draft.budgetPerPerson,
    notes: draft.notes || undefined,
  });
  return parsed.success ? parsed.data : null;
}

/** "2 adultos × USD 126" from Bokun categories like "Adult RS" or "Transportation Price for Vehicle". */
function pricingLabel(p: ItineraryItem["pricing"][number], locale: string): string {
  const es = locale === "es";
  const n = p.count;
  const kinds: [RegExp, string, string, string, string][] = [
    [/vehic|veh[ií]culo|transport|van|car\b/i, "vehículo", "vehículos", "vehicle", "vehicles"],
    [/infant|baby|beb[eé]/i, "bebé", "bebés", "infant", "infants"],
    [/child|kid|ni[nñ]o|menor|youth|junior/i, "niño", "niños", "child", "children"],
    [/senior|mayor/i, "adulto mayor", "adultos mayores", "senior", "seniors"],
    [/adult/i, "adulto", "adultos", "adult", "adults"],
  ];
  const k = kinds.find(([re]) => re.test(p.title));
  const name = k ? (es ? (n === 1 ? k[1] : k[2]) : n === 1 ? k[3] : k[4]) : p.title;
  return `${n} ${name} × ${formatUsd(p.unitUsd, locale)}`;
}

function minutesText(m?: number) {
  if (!m) return null;
  if (m >= 24 * 60) return `${Math.round(m / (24 * 60))}d`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

/** One row of the day timeline: time rail on the left, card on the right. */
function TimelineItem({
  item,
  locale,
  last,
  actions,
}: {
  item: ItineraryItem;
  locale: string;
  last: boolean;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("wizard.itinerary");
  const tc = useTranslations("wizard.restaurants.cuisines");
  const light =
    item.kind === "free" ||
    item.kind === "rest" ||
    item.kind === "beach" ||
    item.kind === "shopping";
  const isTransfer = item.kind === "transfer";
  const isRestaurant = item.kind === "restaurant";
  const LightIcon =
    item.kind === "rest"
      ? BedIcon
      : item.kind === "beach"
        ? BeachIcon
        : item.kind === "shopping"
          ? ShoppingIcon
          : SunIcon;
  const badge = isTransfer ? t("transfer") : isRestaurant ? t("restaurant") : t("tour");
  return (
    <li className="relative flex gap-4 sm:gap-6">
      <div className="flex w-14 shrink-0 flex-col items-center sm:w-16">
        <span className="text-sm font-bold tabular-nums text-primary">
          {item.startTime && item.startTime !== "00:00" ? item.startTime : "—"}
        </span>
        <span
          className={`mt-1 h-3 w-3 rounded-full border-2 ${
            light ? "border-line bg-white" : "border-primary bg-primary"
          }`}
        />
        {!last ? <span className="mt-1 w-0.5 flex-1 rounded bg-line" /> : null}
      </div>

      {light ? (
        <div className="mb-4 flex flex-1 flex-col gap-3 rounded-card border border-dashed border-line bg-surface px-5 py-4">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <LightIcon size={20} />
            </span>
            <div className="flex flex-col gap-1">
              {item.kind === "beach" || item.kind === "shopping" ? (
                <span className="text-xs font-semibold text-brand-ink/55">{t(item.kind)}</span>
              ) : null}
              <p className="font-bold">{item.kind === "free" ? t("freeTitle") : item.title}</p>
              <p className="text-sm text-brand-ink/60">{item.note ?? t("freeBody")}</p>
              {item.mapsUrl ? (
                <a
                  href={item.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  {t("map")} <ExternalIcon size={12} />
                </a>
              ) : null}
            </div>
          </div>
          {actions}
        </div>
      ) : (
        <article className="mb-4 flex min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-white shadow-card sm:flex-row">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="h-40 w-full object-cover sm:h-auto sm:w-44"
              loading="lazy"
            />
          ) : (
            <div className="flex h-24 w-full items-center justify-center bg-gray-100 text-muted sm:h-auto sm:w-44">
              {isRestaurant ? <FoodIcon size={28} /> : <CarIcon size={28} />}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-brand-ink/60">
              <span
                className={`rounded-pill px-2 py-0.5 ${
                  isTransfer
                    ? "bg-gray-100 text-heading"
                    : isRestaurant
                      ? "bg-amber-50 text-amber-800"
                      : "bg-primary-soft text-primary"
                }`}
              >
                {badge}
              </span>
              {isRestaurant && item.cuisines?.length ? (
                <span>{item.cuisines.map((c) => tc(c)).join(" · ")}</span>
              ) : null}
              {isRestaurant && item.priceLevel ? (
                <span className="tracking-wide text-brand-ink/75">
                  {"$".repeat(item.priceLevel)}
                </span>
              ) : null}
              {item.durationMinutes ? (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon size={14} /> {minutesText(item.durationMinutes)}
                </span>
              ) : null}
              {item.pickup ? (
                <span className="inline-flex items-center gap-1">
                  <PinIcon size={14} /> {t("pickup")}
                </span>
              ) : null}
              {item.kind === "tour" && isPrivateTitle(item.title) ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <KeyIcon size={14} /> {t("private")}
                </span>
              ) : null}
            </div>
            <h4 className="text-base font-bold leading-snug">{item.title}</h4>
            <TripAdvisorBadge rating={item.tripadvisor} locale={locale} label={t("taReviews")} />
            {item.note ? (
              <p className="line-clamp-2 text-sm leading-relaxed text-brand-ink/75">{item.note}</p>
            ) : null}
            {isRestaurant ? (
              <div className="mt-auto flex flex-wrap items-end justify-end gap-2 pt-1">
                {item.priceEstimatePpUsd ? (
                  <p className="text-sm font-semibold text-brand-ink/75">
                    {t("restaurantEstimate", { price: formatUsd(item.priceEstimatePpUsd, locale) })}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
                <ul className="flex flex-wrap gap-1.5">
                  {item.pricing.map((p) => (
                    <li
                      key={p.pricingCategoryId}
                      className="rounded-pill bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
                    >
                      {pricingLabel(p, locale)}
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-bold text-primary">
                  {formatUsd(item.priceTotalUsd, locale)}
                </p>
              </div>
            )}
            {item.siteUrl ? (
              <a
                href={item.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                {t("details")} <ExternalIcon size={12} />
              </a>
            ) : null}
            {actions}
          </div>
        </article>
      )}
    </li>
  );
}

export function StepItinerary() {
  const t = useTranslations("wizard.itinerary");
  const te = useTranslations("wizard.itinerary.edit");
  const tn = useTranslations("wizard.itinerary.notices");
  const tw = useTranslations("wizard.weather");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { draft, back, patch } = useWizard();
  const request = buildTripRequest(draft, locale);
  const requestKey = request ? JSON.stringify(request) : undefined;
  // Reuse the saved itinerary only if the answers it was built from didn't change.
  const saved =
    draft.itinerary && draft.itinerary.requestKey === requestKey ? draft.itinerary : undefined;
  const [state, setState] = useState<{
    status: "idle" | "loading" | "done" | "error";
    data?: GenerateResponse;
    error?: string;
  }>(saved ? { status: "done", data: saved } : { status: "idle" });
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  /** `avoid`: tours of the current version, so "try another version" really changes the plan. */
  async function generate(avoid?: number[]) {
    if (!request) {
      setState({ status: "error", error: t("invalid") });
      return;
    }
    setState({ status: "loading" });
    setOptionsFor(null);
    setNotice(null);
    try {
      const r = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, avoid }),
      });
      const j = (await r.json()) as GenerateResponse & { error?: string };
      if (!r.ok || !j.itinerary) throw new Error(j.error ?? "error");
      const data = { ...j, requestKey };
      setState({ status: "done", data });
      patch({ itinerary: data });
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : t("failed") });
    }
  }

  useEffect(() => {
    if (state.status === "idle" && !started.current) {
      started.current = true;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const it = state.data?.itinerary;

  function anotherVersion() {
    const tours = it?.days.flatMap((d) =>
      d.items.filter((i) => i.kind === "tour" && i.bokunId).map((i) => i.bokunId as number),
    );
    void generate(tours);
  }

  async function applyEdit(
    action:
      | { type: "move"; bokunId: number; fromDate: string; toDate: string }
      | { type: "replace"; date: string; bokunId: number | null },
  ) {
    if (!it || !request || !state.data) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await editItinerary(request, it, action);
      if (r.ok) {
        const data = { ...state.data, itinerary: r.itinerary, edited: true };
        setState({ status: "done", data });
        patch({ itinerary: data });
        setOptionsFor(null);
        if (action.type === "move") {
          setNotice({ kind: "ok", text: te("moved", { date: formatDate(action.toDate, locale) }) });
        }
      } else {
        const date = action.type === "move" ? action.toDate : action.date;
        setNotice({ kind: "error", text: reasonText(te, r.check.reason, date, locale) });
      }
    } catch {
      setNotice({ kind: "error", text: t("failed") });
    } finally {
      setBusy(false);
    }
  }

  const tripNotices: NoticeItem[] = it
    ? [
        ...(it.introWarnings.length
          ? [
              {
                key: "kids",
                tone: "warning" as const,
                title: tn("kids"),
                body: (
                  <ul className="flex flex-col gap-1">
                    {it.introWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ),
              },
            ]
          : []),
        ...(it.weatherNote
          ? [
              {
                key: "rain",
                tone: "rain" as const,
                title: tn("rain"),
                body: <p>{it.weatherNote}</p>,
              },
            ]
          : []),
        ...(it.diningNote
          ? [
              {
                key: "dining",
                tone: "dining" as const,
                title: tn("dining"),
                body: <p>{it.diningNote}</p>,
              },
            ]
          : []),
        ...seasonNotes(it.days[0].date, it.days[it.days.length - 1].date).map((n) => ({
          key: n,
          tone: "info" as const,
          title: tn(n),
          body: <p>{tw(`season.${n}`)}</p>,
        })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
        </div>
      </header>

      {state.status === "loading" && (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <p className="font-semibold">{t("building")}</p>
            <p className="text-sm text-brand-ink/60">{t("buildingHint")}</p>
          </div>
          <AnimatedLoadingSkeleton label={t("building")} />
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">{state.error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="ghost" onClick={back}>
              <ArrowLeftIcon size={18} /> {tc("back")}
            </Button>
            <Button onClick={() => generate()}>{t("retry")}</Button>
          </div>
        </div>
      )}

      {it && state.status === "done" && (
        <>
          <TripSummary />

          <NoticeGroup notices={tripNotices} label={tn("group")} />

          <section className="overflow-hidden rounded-card bg-primary text-white shadow-card">
            <dl className="grid grid-cols-3 divide-x divide-white/15 py-4 sm:py-5">
              {(
                [
                  ["totalTours", it.totals.toursUsd, CompassIcon],
                  ["totalTransfers", it.totals.transfersUsd, CarIcon],
                  ["perPerson", it.totals.perPersonUsd, UsersIcon],
                ] as const
              ).map(([k, v, Icon]) => (
                <div key={k} className="flex flex-col items-center gap-1 px-2 text-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                    <Icon size={16} />
                  </span>
                  <dt className="text-xs font-semibold text-white/80">{t(k)}</dt>
                  <dd className="text-base font-bold tabular-nums sm:text-xl">
                    {formatUsd(v, locale)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mx-3 flex items-center justify-between gap-3 rounded-[14px] bg-white px-4 py-3 shadow-[0_4px_14px_rgb(0_0_0/0.12)] sm:mx-4 sm:px-6 sm:py-4">
              <span className="text-sm font-bold uppercase tracking-wide text-heading">
                {t("total")}
              </span>
              <span className="text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                {formatUsd(it.totals.totalUsd, locale)}
              </span>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <p
                className={`w-fit rounded-pill px-3 py-1 text-xs font-bold ${
                  it.totals.withinBudget ? "bg-white/20" : "bg-brand-deal"
                }`}
              >
                {it.totals.withinBudget
                  ? t("withinBudget", { budget: formatUsd(it.totals.budgetPerPersonUsd, locale) })
                  : t("overBudget", { budget: formatUsd(it.totals.budgetPerPersonUsd, locale) })}
              </p>
              {it.totals.diningEstimateUsd > 0 ? (
                <p className="text-sm text-white/85">
                  {t("diningEstimate", { total: formatUsd(it.totals.diningEstimateUsd, locale) })}
                </p>
              ) : null}
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-card border border-primary/25 bg-primary-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            {confirmRegen ? (
              <>
                <p role="alert" className="text-sm font-semibold text-heading">
                  {t("regenerateConfirm")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setConfirmRegen(false);
                      anotherVersion();
                    }}
                  >
                    <SwapIcon size={18} /> {t("regenerateYes")}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmRegen(false)}>
                    {t("regenerateNo")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-bold text-heading">{t("regenerateTitle")}</p>
                  <p className="text-sm text-brand-ink/70">{t("regenerateBody")}</p>
                </div>
                <Button
                  size="lg"
                  className="shrink-0"
                  onClick={() => (state.data?.edited ? setConfirmRegen(true) : anotherVersion())}
                  disabled={busy}
                >
                  <SwapIcon size={18} /> {t("regenerate")}
                </Button>
              </>
            )}
          </div>

          {notice ? (
            <p
              role="status"
              className={`rounded-card px-4 py-3 text-sm font-semibold ${
                notice.kind === "ok" ? "bg-primary-soft text-primary" : "bg-red-50 text-red-700"
              }`}
            >
              {notice.text}
            </p>
          ) : null}

          <ol className={`flex flex-col gap-2 ${busy ? "opacity-70" : ""}`} aria-busy={busy}>
            {it.days.map((d) => {
              const hasTour = d.items.some((i) => i.kind === "tour");
              return (
                <li key={d.date}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-primary/20 bg-white text-center shadow-md shadow-primary/15 sm:w-16">
                      <span className="w-full bg-primary py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                        {formatDate(d.date, locale, { weekday: undefined, day: undefined }).replace(
                          ".",
                          "",
                        )}
                      </span>
                      <span className="py-1 text-xl font-bold leading-none tabular-nums text-heading">
                        {formatDate(d.date, locale, { weekday: undefined, month: undefined })}
                      </span>
                    </span>
                    <div>
                      <h3 className="text-lg font-bold leading-tight first-letter:uppercase">
                        {formatDate(d.date, locale, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </h3>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-ink/60">
                        {d.title ? <span>{d.title}</span> : null}
                        {d.weather ? <WeatherChip weather={d.weather} /> : null}
                      </p>
                    </div>
                  </div>
                  {d.weather?.source === "forecast" && d.weather.kind !== "good" ? (
                    <div className="mb-3 sm:pl-[4.75rem]">
                      <Notice
                        compact
                        tone={d.weather.kind === "rainy" ? "rain" : "wind"}
                        title={tn(d.weather.kind === "rainy" ? "rainyDay" : "windyDay")}
                      />
                    </div>
                  ) : null}
                  {d.notices?.map((n) => (
                    <div key={n} className="mb-3 sm:pl-[4.75rem]">
                      <Notice compact tone="change" title={tn("change")}>
                        <p>{n}</p>
                      </Notice>
                    </div>
                  ))}
                  <ol className="ml-1">
                    {d.items.map((item, i) => (
                      <TimelineItem
                        key={`${d.date}-${i}`}
                        item={item}
                        locale={locale}
                        last={i === d.items.length - 1}
                        actions={
                          item.kind === "tour" ? (
                            <TourOptions
                              open={optionsFor === d.date}
                              onToggle={() => setOptionsFor(optionsFor === d.date ? null : d.date)}
                            >
                              {request ? (
                                <AlternativesPanel
                                  key={d.date}
                                  embedded
                                  request={request}
                                  itinerary={it}
                                  date={d.date}
                                  busy={busy}
                                  onPick={(bokunId) =>
                                    applyEdit({ type: "replace", date: d.date, bokunId })
                                  }
                                  onChill={() =>
                                    applyEdit({ type: "replace", date: d.date, bokunId: null })
                                  }
                                />
                              ) : null}
                            </TourOptions>
                          ) : (item.kind === "free" ||
                              item.kind === "beach" ||
                              item.kind === "shopping") &&
                            !hasTour &&
                            d.label !== "arrival" &&
                            d.label !== "departure" ? (
                            <div>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => setOptionsFor(optionsFor === d.date ? null : d.date)}
                              >
                                {te("addTour")}
                              </Button>
                            </div>
                          ) : null
                        }
                      />
                    ))}
                  </ol>
                  {optionsFor === d.date && request && !hasTour ? (
                    <div className="mb-6 sm:pl-16">
                      <AlternativesPanel
                        key={d.date}
                        request={request}
                        itinerary={it}
                        date={d.date}
                        busy={busy}
                        onClose={() => setOptionsFor(null)}
                        onPick={(bokunId) => applyEdit({ type: "replace", date: d.date, bokunId })}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <ScrollHint step={0} />
          {/* Not sticky: like the other steps, the buttons sit after the whole itinerary. */}
          <div className="-mx-4 flex items-center justify-between gap-3 border-t border-line px-4 py-4 sm:mx-0 sm:border-0 sm:px-0">
            <Button variant="ghost" onClick={back}>
              <ArrowLeftIcon size={18} /> {tc("back")}
            </Button>
            <Button size="lg" onClick={() => patch({ step: "contact" })} disabled={busy}>
              {t("looksGood")} <ArrowRightIcon size={18} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
