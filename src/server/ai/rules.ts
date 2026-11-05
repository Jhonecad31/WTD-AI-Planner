import type { CatalogProduct, Interest } from "@/server/catalog/types";
import { effectiveZone, type HotelZone, type TripRequest } from "@/lib/trip-schema";
import type { DayWeather, Itinerary, ItineraryDay, ItineraryItem } from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty, round2 } from "./pricing";
import { planDays, type DaySlot } from "@/lib/plan-days";
import { isPrivateTitle } from "@/lib/item-meta";
import { pickupCoverage } from "@/server/catalog/pickup";
import {
  commercialBoost,
  experienceTypes,
  mainExperience,
  primaryInterest,
  variety,
  zoneDistance,
  type Variety,
} from "@/server/catalog/experience";

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
  /** Tours of the previous version ("try another version"): used only when nothing else fits. */
  avoid?: number[];
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

/** Night life must be close to the hotel: nobody rides an hour back from a club. */
export const NIGHTLIFE_MAX_ZONES = 1;

/**
 * Whether a night-life product may go in this trip at all: only when the traveler asked
 * for "party" and the venue is within NIGHTLIFE_MAX_ZONES of the hotel (unknown area
 * passes). Where in the trip it goes is `partyNightOk`.
 */
export function partyAllowed(p: CatalogProduct, request: TripRequest): boolean {
  if (!isParty(p)) return true;
  if (!request.interests.includes("party")) return false;
  const steps = zoneDistance(p, effectiveZone(request));
  return steps === null || steps <= NIGHTLIFE_MAX_ZONES;
}

/** The traveler asked to skip this kind of experience (any of the tour's types). */
export function isAvoided(p: { title: string; bokunId?: number }, request: TripRequest): boolean {
  if (!request.avoidTypes?.length) return false;
  const skip = new Set(request.avoidTypes);
  return experienceTypes(p).some((t) => skip.has(t));
}

/**
 * Whether a product may go in this traveler's trip at all: not a kind they asked to
 * skip, and night life only when wanted and near the hotel. Every engine and guard
 * filters on this, so the wizard's "I'd rather skip" chips are a guarantee.
 */
/** An ATV park day is only for travelers who asked for adventure, rain or shine. */
export function wantsAtv(p: { title: string; bokunId?: number }, request: TripRequest): boolean {
  return mainExperience(p) !== "atv" || request.interests.includes("adventure");
}

export function allowedForTraveler(p: CatalogProduct, request: TripRequest): boolean {
  return (
    !isAvoided(p, request) &&
    wantsAtv(p, request) &&
    partyAllowed(p, request) &&
    // A tour that picks up along the coast but not from this hotel's zone can't be booked
    // with pickup for this traveler: off the menu.
    pickupCoverage(p, effectiveZone(request)) !== "not_here"
  );
}

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
/** Under this age, at most one tour of LONG_TOUR_MINUTES+ per trip (a hard rule, not a penalty). */
export const LONG_TOUR_KID_AGE = 6;
/** The tour budget may be exceeded by this much before the guard swaps or drops tours. */
export const BUDGET_TOLERANCE = 1.05;

export function isLongTour(p: { durationMinutes: number | null }): boolean {
  return (p.durationMinutes ?? 0) >= LONG_TOUR_MINUTES;
}

/**
 * With a child under LONG_TOUR_KID_AGE, a second 10 h+ day is never planned: one long
 * day trip is enough. `others` are the tours already in the trip.
 */
export function longTourOk(
  p: { durationMinutes: number | null },
  request: Pick<TripRequest, "travelers">,
  others: { durationMinutes?: number | null }[],
): boolean {
  if (!isLongTour(p)) return true;
  const youngest = Math.min(...request.travelers.map((t) => t.age));
  if (youngest >= LONG_TOUR_KID_AGE) return true;
  return !others.some((o) => (o.durationMinutes ?? 0) >= LONG_TOUR_MINUTES);
}

/** Tours per person within the budget (with the tolerance). */
export function withinBudget(toursUsd: number, request: TripRequest): boolean {
  return round2(toursUsd / request.travelers.length) <= request.budgetPerPerson * BUDGET_TOLERANCE;
}

/** A tour whose main interest the traveler picked outranks one that only touches it. */
const MAIN_INTEREST_POINTS = 6;
const SECONDARY_INTEREST_POINTS = 1.5;
/**
 * Per hotel zone between the hotel and where the tour happens (Cancun → Tulum is 5).
 * Breaks ties toward nearby tours without ever beating a main-interest match.
 */
const ZONE_STEP_PENALTY = 0.75;

export interface ScoreOptions {
  preferPrivate?: boolean;
  youngKids?: boolean;
  /** Hotel zone: tours far down the coast rank lower. */
  zone?: HotelZone;
}

/** The scoring options every engine and guard should pass for a request. */
export function scoreOpts(request: TripRequest): ScoreOptions {
  return {
    preferPrivate: request.preferPrivate,
    youngKids: hasYoungKids(request),
    zone: effectiveZone(request),
  };
}

export function scoreProduct(
  p: CatalogProduct,
  interests: Interest[],
  opts: ScoreOptions = {},
): number {
  if (p.kind !== "tour" && p.kind !== "ticket") return -1;
  const overlap = p.interests.filter((i) => interests.includes(i));
  if (overlap.length === 0) return 0;
  // What the tour mainly is (ruins, ATV, dolphins…) counts far more than the tags it
  // also carries, so a 5-tag park doesn't beat a focused tour of the asked interest.
  const main = primaryInterest(p) ?? p.interests[0];
  const mainHit = interests.includes(main) ? MAIN_INTEREST_POINTS : 0;
  const secondary = overlap.filter((i) => i !== main).length * SECONDARY_INTEREST_POINTS;
  // No reviews means no rating yet (Bokun reports 0): treat as an average tour, not a bad one.
  const rating = p.reviewCount ? (p.rating ?? 4.5) : 4.5;
  const reviews = Math.log10((p.reviewCount ?? 0) + 1);
  // Small commercial priority among tours of the same interest (Chichén first).
  let score = mainHit + secondary + rating + reviews + commercialBoost(p);
  if (opts.preferPrivate && isPrivateTitle(p.title)) score += 3;
  if (opts.zone) {
    const steps = zoneDistance(p, opts.zone);
    // Distance weighs half when the tour picks up at the hotel (a long ride, but included);
    // in full when the traveler has to get to a marina or park on their own.
    const weight = pickupCoverage(p, opts.zone) === "included" ? 0.5 : 1;
    if (steps) score = Math.max(0.1, score - steps * ZONE_STEP_PENALTY * weight);
  }
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

/**
 * The airport transfer for the hotel's zone (luxury when asked). Both engines use it and
 * `validateAndRepair` enforces it, so a Riviera Maya trip never gets the Akumal ride.
 */
export function transferFor(
  products: CatalogProduct[],
  request: TripRequest,
): CatalogProduct | null {
  // Airport rides only: the VIP lounge and the Isla Mujeres ferry are "transfers" in Bokun too.
  const transfers = products.filter(
    (p) => p.kind === "transfer" && p.onSite && !/lounge|ferry/i.test(p.title),
  );
  if (!transfers.length) return null;
  const zoneWords: Record<string, RegExp> = {
    cancun: /hotel zone|zona hotelera|downtown|centro/i,
    costa_mujeres: /costa mujeres|playa mujeres/i,
    puerto_morelos: /puerto morelos/i,
    playa_del_carmen: /playa del carmen/i,
    riviera_maya: /playa para[ií]so|riviera/i,
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

/** Moves the avoided products to the end of a ranked list, keeping the order otherwise. */
export function lastIfAvoided<T>(list: T[], avoid: number[] | undefined, id: (x: T) => number) {
  if (!avoid?.length) return;
  const skip = new Set(avoid);
  const kept = list.filter((x) => !skip.has(id(x)));
  const later = list.filter((x) => skip.has(id(x)));
  list.splice(0, list.length, ...kept, ...later);
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

  // Candidate tours ranked by interest fit and reputation. Night life only when the
  // traveler asked for it, whatever other tags a bar crawl carries.
  const candidates = products
    .filter(
      (p) => p.onSite && (p.kind === "tour" || p.kind === "ticket") && (p.priceFromUsd ?? 0) > 0,
    )
    .filter((p) => fitsAges(p, request.travelers))
    .filter((p) => allowedForTraveler(p, request))
    .map((p) => ({
      p,
      score: scoreProduct(p, request.interests, scoreOpts(request)),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  lastIfAvoided(candidates, inputs.avoid, (x) => x.p.bokunId);
  // Beach / shopping have no tours: don't wait to "cover" them before repeating interests.
  const coverable = request.interests.filter((i) =>
    candidates.some(({ p }) => p.interests.includes(i)),
  );

  // Rainy-day picks may fall outside the chosen interests: WhatToDo's parks first.
  // Rainy days go to WhatToDo's own parks, but only the ones the traveler would want
  // anyway (ATV needs "adventure"); otherwise rain just rules out the sea tours.
  const rainyPool = products
    .filter((p) => p.onSite && p.kind === "tour" && (p.priceFromUsd ?? 0) > 0)
    .filter((p) => isRainyFavorite(p) && fitsAges(p, request.travelers))
    .filter((p) => allowedForTraveler(p, request))
    .filter((p) => scoreProduct(p, request.interests, scoreOpts(request)) > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  // Transfers first: they're a hard requirement and shrink the tour budget.
  const transferProduct =
    request.transfers.arrival || request.transfers.departure
      ? transferFor(products, request)
      : null;
  if ((request.transfers.arrival || request.transfers.departure) && !transferProduct) {
    warnings.push("No transfer product found in catalog for the requested zone.");
  }

  // The budget is for tours only: transfers are priced per vehicle and shown as an extra
  // ("+USD X") when the traveler picks them, so they never eat into the tour money.
  let spent = 0;
  const used = new Set<number>();
  const coveredInterests = new Set<Interest>();
  const days: ItineraryDay[] = [];
  /** Tours already in the trip, so no two days are the same kind of experience. */
  const chosen: CatalogProduct[] = [];

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
      // Rainy days go to WhatToDo's parks, unless that repeats the same kind of day.
      const rainyPick =
        w?.kind === "rainy"
          ? rainyPool.find((p) => variety(p, chosen) >= 1 && fitsHere(p))
          : undefined;
      // Variety: a tour with a different main kind than the trip's other days (Tulum after
      // Chichén is fine, a second dolphin swim is not); only when nothing else fits, the
      // same kind of day again. Within that, the best interest fit wins.
      const pickWith = (min: Variety) => {
        const varied = (p: CatalogProduct) =>
          variety(p, chosen) >= min && longTourOk(p, request, chosen);
        return (
          candidates.find(({ p }) => {
            if (!varied(p)) return false;
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
          candidates.find(({ p }) => varied(p) && !(badWeather && isSeaTour(p)) && fitsHere(p)) ??
          candidates.find(({ p }) => {
            if (!varied(p)) return false;
            if (used.has(p.bokunId) || !fitsDay(p, slot, request)) return false;
            if (!partyOk && isParty(p)) return false;
            if (inputs.isAvailable?.(p.bokunId, slot.date) === false) return false;
            return priceProductForParty(p, request.travelers).priceTotalUsd <= budgetTotal - spent;
          })
        );
      };
      const pick = (rainyPick ? { p: rainyPick } : undefined) ?? pickWith(1) ?? pickWith(0);

      if (pick) {
        const it = toItem(pick.p, request, slot);
        items.push(it);
        spent += it.priceTotalUsd;
        used.add(pick.p.bokunId);
        chosen.push(pick.p);
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
      withinBudget: withinBudget(toursUsd, request),
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
