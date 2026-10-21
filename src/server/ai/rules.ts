import type { CatalogProduct, Interest } from "@/server/catalog/types";
import { effectiveZone, type TripRequest } from "@/lib/trip-schema";
import type { DayWeather, Itinerary, ItineraryDay, ItineraryItem } from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty, round2 } from "./pricing";
import { planDays, type DaySlot } from "@/lib/plan-days";

export { planDays, type DaySlot } from "@/lib/plan-days";

/**
 * Deterministic itinerary builder. Works with no AI key and is the safety net
 * when Claude fails. Claude reuses `planDays`, `scoreProduct` and the validators.
 */

export interface PlanInputs {
  request: TripRequest;
  products: CatalogProduct[];
  /** Optional per-product availability check: (bokunId, date) -> open? */
  isAvailable?: (bokunId: number, date: string) => boolean | undefined;
  /** Optional weather per date; rainy/windy days avoid sea tours, rainy days favor Extreme Adventure. */
  weather?: Record<string, DayWeather>;
}

/**
 * WhatToDo's own parks, the go-to plan on a rainy day so the trip doesn't lose
 * a tour: Extreme Adventuring (ATV, buggies) and Cenote Adventuring.
 */
export const RAINY_FAVORITE_RE = /extreme adventur|extreme buggy|cenotes? adventuring/i;
export function isRainyFavorite(p: { title: string; siteUrl?: string | null }): boolean {
  return RAINY_FAVORITE_RE.test(p.title) || /cenotes?-adventuring/i.test(p.siteUrl ?? "");
}

/** Night-life products (Coco Bongo, party boats…). */
export function isParty(p: { interests: Interest[] }): boolean {
  return p.interests.includes("party");
}

const PRIVATE_RE = /\bprivate\b|\bprivad[oa]s?\b/i;
export function hasYoungKids(request: Pick<TripRequest, "travelers">): boolean {
  return request.travelers.some((t) => t.age < 12);
}

const SEA_RE =
  /catamaran|catamar[aá]n|boat|barco|lancha|snorkel|sail|velero|yacht|yate|whale shark|tibur[oó]n ballena|isla mujeres|contoy|cozumel|holbox|parasail|scuba|div(e|ing)|buceo|fishing|pesca|reef|arrecife|jet ?ski|speedboat|swim with/i;
/** Tours on open water. A cenote tour is not a sea tour unless it also names a boat or reef. */
export function isSeaTour(p: { title: string }): boolean {
  if (!SEA_RE.test(p.title)) return false;
  if (
    /cenote/i.test(p.title) &&
    !/catamaran|boat|reef|arrecife|isla|whale|sail|yacht|yate/i.test(p.title)
  )
    return false;
  return true;
}

/** Tours this long (Chichén Itzá day trips) are hard on young kids. */
export const LONG_TOUR_MINUTES = 10 * 60;

export function scoreProduct(
  p: CatalogProduct,
  interests: Interest[],
  opts: { preferPrivate?: boolean; youngKids?: boolean } = {},
): number {
  if (p.kind !== "tour" && p.kind !== "ticket") return -1;
  const overlap = p.interests.filter((i) => interests.includes(i)).length;
  if (overlap === 0) return 0;
  // No reviews means no rating yet (Bokun reports 0): treat as an average tour, not a bad one.
  const rating = p.reviewCount ? (p.rating ?? 4.5) : 4.5;
  const reviews = Math.log10((p.reviewCount ?? 0) + 1);
  let score = overlap * 3 + rating + reviews;
  if (opts.preferPrivate && PRIVATE_RE.test(p.title)) score += 3;
  // Very long day trips rank last with young kids (still allowed if nothing else fits).
  if (opts.youngKids && (p.durationMinutes ?? 0) >= LONG_TOUR_MINUTES)
    score = Math.max(0.1, score - 6);
  return score;
}

/**
 * Arrival and departure days never get a tour: arrival is a restaurant or rest at
 * the hotel, departure is the transfer (plus beach or shopping on a night flight).
 * Those blocks are added by `enrichItinerary`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function fitsDay(p: CatalogProduct, slot: DaySlot, _request?: TripRequest): boolean {
  if (p.isMultiDay) return false;
  // Chill days only take a tour when the traveler adds one by hand (the engine never does).
  return slot.label === "full" || slot.label === "chill";
}

/** A party night must be followed by a chill day or the departure day. */
export function partyNightOk(slots: { label: DaySlot["label"] }[], index: number): boolean {
  const next = slots[index + 1];
  return !!next && (next.label === "chill" || next.label === "departure");
}

export function pickStartTime(p: CatalogProduct, slot: DaySlot): { time?: string; id?: number } {
  if (!p.startTimes.length) return {};
  // Prefer a morning departure, afternoon on arrival days.
  const sorted = [...p.startTimes].sort((a, b) => a.time.localeCompare(b.time));
  const pick = slot.label === "arrival" ? sorted[sorted.length - 1] : sorted[0];
  return { time: pick.time, id: pick.id };
}

function transferFor(products: CatalogProduct[], request: TripRequest): CatalogProduct | null {
  const transfers = products.filter((p) => p.kind === "transfer" && p.onSite);
  if (!transfers.length) return null;
  const zoneWords: Record<string, RegExp> = {
    cancun: /hotel zone|zona hotelera|downtown|centro/i,
    costa_mujeres: /costa mujeres|playa mujeres/i,
    puerto_morelos: /puerto morelos/i,
    playa_del_carmen: /playa del carmen/i,
    riviera_maya: /akumal|playa para[ií]so|riviera/i,
    puerto_aventuras: /aventuras|akumal/i,
    tulum: /tulum/i,
  };
  const zoneRe = zoneWords[effectiveZone(request)];
  const luxury = request.transfers.luxury;
  const ranked = transfers
    .map((p) => {
      let s = 0;
      if (zoneRe?.test(p.title)) s += 5;
      if (/airport|aeropuerto|apto/i.test(p.title)) s += 3;
      if (luxury === /luxury|vip|premium|deluxe/i.test(p.title)) s += 2;
      if (p.priceFromUsd) s += 1;
      return { p, s };
    })
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.p ?? null;
}

export function toItem(
  p: CatalogProduct,
  request: TripRequest,
  slot: DaySlot,
  note?: string,
): ItineraryItem {
  const price = priceProductForParty(p, request.travelers);
  const st = pickStartTime(p, slot);
  return {
    kind: p.kind === "transfer" ? "transfer" : "tour",
    bokunId: p.bokunId,
    title: p.title,
    startTime: st.time,
    startTimeId: st.id,
    durationMinutes: p.durationMinutes ?? undefined,
    priceTotalUsd: price.priceTotalUsd,
    pricing: price.pricing,
    pickup: p.pickupService,
    note,
    imageUrl: p.imageUrl ?? undefined,
    siteUrl: p.siteUrl ?? undefined,
  };
}

export function buildRulesItinerary(inputs: PlanInputs): Itinerary {
  const { request, products } = inputs;
  const budgetTotal = request.budgetPerPerson * request.travelers.length;
  const warnings: string[] = [];
  const slots = planDays(request);

  // Candidate tours ranked by interest fit and reputation.
  const candidates = products
    .filter(
      (p) => p.onSite && (p.kind === "tour" || p.kind === "ticket") && (p.priceFromUsd ?? 0) > 0,
    )
    .filter((p) => fitsAges(p, request.travelers))
    .map((p) => ({
      p,
      score: scoreProduct(p, request.interests, {
        preferPrivate: request.preferPrivate,
        youngKids: hasYoungKids(request),
      }),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  // Beach / shopping have no tours: don't wait to "cover" them before repeating interests.
  const coverable = request.interests.filter((i) =>
    candidates.some(({ p }) => p.interests.includes(i)),
  );

  // Rainy-day picks may fall outside the chosen interests: WhatToDo's parks first.
  const rainyPool = products
    .filter((p) => p.onSite && p.kind === "tour" && (p.priceFromUsd ?? 0) > 0)
    .filter((p) => isRainyFavorite(p) && fitsAges(p, request.travelers))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  // Transfers first: they're a hard requirement and shrink the tour budget.
  const transferProduct =
    request.transfers.arrival || request.transfers.departure
      ? transferFor(products, request)
      : null;
  if ((request.transfers.arrival || request.transfers.departure) && !transferProduct) {
    warnings.push("No transfer product found in catalog for the requested zone.");
  }

  // Reserve the transfer money up front so tours never push the party over budget.
  const transferUnit = transferProduct
    ? priceProductForParty(transferProduct, request.travelers).priceTotalUsd
    : 0;
  const transferLegs = (request.transfers.arrival ? 1 : 0) + (request.transfers.departure ? 1 : 0);
  let spent = transferProduct ? transferUnit * transferLegs : 0;
  const used = new Set<number>();
  const coveredInterests = new Set<Interest>();
  const days: ItineraryDay[] = [];

  // Keep Extreme Adventure for rainy days when the forecast shows any.
  const rainyDaysAhead = slots.filter((x) => inputs.weather?.[x.date]?.kind === "rainy").length;

  for (const [slotIndex, slot] of slots.entries()) {
    const items: ItineraryItem[] = [];
    const w = inputs.weather?.[slot.date];
    const partyOk = partyNightOk(slots, slotIndex);

    if (slot.label === "arrival" && request.transfers.arrival && transferProduct) {
      // No flight time: the agent schedules the pickup when booking.
      items.push({
        ...toItem(transferProduct, request, slot),
        startTime: undefined,
        startTimeId: undefined,
      });
    }

    if (slot.label !== "chill") {
      // Prefer products covering an interest not yet covered, within remaining budget.
      const remaining = budgetTotal - spent;
      const badWeather = !!w && w.kind !== "good";
      const fitsHere = (p: CatalogProduct) =>
        !used.has(p.bokunId) &&
        (partyOk || !isParty(p)) &&
        fitsDay(p, slot, request) &&
        inputs.isAvailable?.(p.bokunId, slot.date) !== false &&
        priceProductForParty(p, request.travelers).priceTotalUsd <= remaining;
      const rainyPick = w?.kind === "rainy" ? rainyPool.find((p) => fitsHere(p)) : undefined;
      const pick =
        (rainyPick ? { p: rainyPick } : undefined) ??
        candidates.find(({ p }) => {
          if (used.has(p.bokunId)) return false;
          if (badWeather && isSeaTour(p)) return false;
          if (!partyOk && isParty(p)) return false;
          if (rainyDaysAhead > 0 && w?.kind !== "rainy" && isRainyFavorite(p)) return false;
          if (!fitsDay(p, slot, request)) return false;
          const avail = inputs.isAvailable?.(p.bokunId, slot.date);
          if (avail === false) return false;
          const cost = priceProductForParty(p, request.travelers).priceTotalUsd;
          if (cost > remaining) return false;
          const fresh = p.interests.some(
            (i) => request.interests.includes(i) && !coveredInterests.has(i),
          );
          return fresh || coverable.every((i) => coveredInterests.has(i));
        }) ??
        candidates.find(({ p }) => !(badWeather && isSeaTour(p)) && fitsHere(p)) ??
        candidates.find(({ p }) => {
          if (used.has(p.bokunId) || !fitsDay(p, slot, request)) return false;
          if (!partyOk && isParty(p)) return false;
          if (inputs.isAvailable?.(p.bokunId, slot.date) === false) return false;
          return priceProductForParty(p, request.travelers).priceTotalUsd <= budgetTotal - spent;
        });

      if (pick) {
        const it = toItem(pick.p, request, slot);
        items.push(it);
        spent += it.priceTotalUsd;
        used.add(pick.p.bokunId);
        pick.p.interests.forEach((i) => request.interests.includes(i) && coveredInterests.add(i));
      } else if (slot.label === "full") {
        items.push({
          kind: "free",
          title: "Free day",
          priceTotalUsd: 0,
          pricing: [],
          pickup: false,
        });
      }
    } else {
      items.push({
        kind: "free",
        title: "Chill day",
        priceTotalUsd: 0,
        pricing: [],
        pickup: false,
      });
    }

    if (slot.label === "departure" && request.transfers.departure && transferProduct) {
      items.push({
        ...toItem(transferProduct, request, slot),
        startTime: undefined,
        startTimeId: undefined,
      });
    }

    days.push({
      date: slot.date,
      dayNumber: slot.dayNumber,
      label: slot.label,
      title: defaultDayTitle(slot, items, request.locale),
      items,
      ...(w ? { weather: w } : {}),
    });
  }

  const toursUsd = round2(
    days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .reduce((s, i) => s + i.priceTotalUsd, 0),
  );
  const transfersUsd = round2(
    days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "transfer")
      .reduce((s, i) => s + i.priceTotalUsd, 0),
  );
  const totalUsd = round2(toursUsd + transfersUsd);
  const perPersonUsd = round2(totalUsd / request.travelers.length);

  return {
    version: 1,
    generatedBy: "rules",
    locale: request.locale,
    summary: defaultSummary(request, days),
    days,
    totals: {
      toursUsd,
      transfersUsd,
      totalUsd,
      perPersonUsd,
      budgetPerPersonUsd: request.budgetPerPerson,
      withinBudget: perPersonUsd <= request.budgetPerPerson,
      diningEstimateUsd: 0,
    },
    introWarnings: [],
    warnings,
  };
}

function defaultDayTitle(slot: DaySlot, items: ItineraryItem[], locale: "en" | "es"): string {
  const es = locale === "es";
  if (slot.label === "arrival") return es ? "Llegada a Cancún" : "Arrival in Cancun";
  if (slot.label === "departure") return es ? "Día de salida" : "Departure day";
  if (slot.label === "chill") return es ? "Día de descanso" : "Chill day";
  const tour = items.find((i) => i.kind === "tour");
  return tour ? tour.title : es ? "Día libre" : "Free day";
}

function defaultSummary(request: TripRequest, days: ItineraryDay[]): string {
  const tours = days.flatMap((d) => d.items).filter((i) => i.kind === "tour").length;
  const nights = Math.max(0, days.length - 1);
  return request.locale === "es"
    ? `${nights} noches en Cancún con ${tours} experiencias elegidas para ustedes.`
    : `${nights} nights in Cancun with ${tours} experiences picked for you.`;
}
