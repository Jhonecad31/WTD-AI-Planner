import type { CatalogProduct } from "@/server/catalog/types";
import { effectiveZone, type HotelZone, type TripRequest } from "@/lib/trip-schema";
import type {
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  TripAdvisorRating,
} from "@/lib/itinerary-schema";
import { RESTAURANTS, type RestaurantInfo } from "@/content/restaurants";
import { placesFor, type Place } from "@/content/places";
import { fitsAges, priceProductForParty } from "./pricing";
import { hasYoungKids, isParty, partyNightOk, scoreProduct, toItem } from "./rules";

/**
 * Deterministic trip rules applied after either engine picked the tours, so they
 * always hold even if Claude slips:
 *  - party nights only before a chill day or the departure day
 *  - arrival: dinner if landing before 4 pm, otherwise rest at the hotel
 *  - departure: beach or shopping on a night flight, never a tour
 *  - chill days: beach or shopping near the hotel
 *  - one dinner per night, matched to cuisine, budget, zone and kids; Grupo Anderson first
 *  - a warning after the greeting when kids travel and party/cultural was chosen
 */

const DINNER_TIME = "20:00";
const PLACE_TIME = "10:30";
const BUDGET_TOLERANCE = 1.15;
/** Variety fillers may go over the meal budget, but never past this multiple of it. */
const VARIETY_BUDGET_CAP = 1.5;

type Restaurant = { p: CatalogProduct; info: RestaurantInfo };

export function rankRestaurants(
  request: TripRequest,
  products: CatalogProduct[],
  ratings: Record<number, TripAdvisorRating> = {},
): Restaurant[] {
  const zone = effectiveZone(request);
  const kids = request.travelers.some((t) => t.age < 13);
  const wanted = request.dining.cuisines;
  const inZone = products
    .filter((p) => p.kind === "restaurant" && RESTAURANTS[p.bokunId])
    .map((p) => ({ p, info: RESTAURANTS[p.bokunId] }))
    .filter(({ info }) => info.zone === zone && (!kids || info.kidFriendly));
  const affordable = inZone.filter(
    ({ info }) => info.avgPerPersonUsd <= request.dining.budgetPerMeal * BUDGET_TOLERANCE,
  );
  // Keep at least a few places so the same restaurant doesn't repeat every night:
  // when few fit the budget, add the next closest-priced ones.
  const pool = [
    ...affordable,
    ...[...inZone]
      .filter(
        (r) =>
          !affordable.includes(r) &&
          r.info.avgPerPersonUsd <= request.dining.budgetPerMeal * VARIETY_BUDGET_CAP,
      )
      .sort((a, b) => a.info.avgPerPersonUsd - b.info.avgPerPersonUsd)
      .slice(0, Math.max(0, MIN_RESTAURANT_VARIETY - affordable.length)),
  ];
  const matches = (r: Restaurant) =>
    wanted.length === 0 || r.info.cuisines.some((c) => wanted.includes(c));
  return [...pool].sort(
    (a, b) =>
      Number(matches(b)) - Number(matches(a)) ||
      Number(b.info.group === "anderson") - Number(a.info.group === "anderson") ||
      (ratings[b.p.bokunId]?.rating ?? b.p.rating ?? 0) -
        (ratings[a.p.bokunId]?.rating ?? a.p.rating ?? 0) ||
      a.info.avgPerPersonUsd - b.info.avgPerPersonUsd,
  );
}

function restaurantItem({ p, info }: Restaurant): ItineraryItem {
  return {
    kind: "restaurant",
    bokunId: p.bokunId,
    title: p.title,
    startTime: DINNER_TIME,
    priceTotalUsd: 0,
    pricing: [],
    pickup: false,
    imageUrl: p.imageUrl ?? undefined,
    siteUrl: p.siteUrl ?? undefined,
    cuisines: info.cuisines,
    priceLevel: info.priceLevel,
    priceEstimatePpUsd: info.avgPerPersonUsd,
  };
}

function placeItem(place: Place, locale: "en" | "es"): ItineraryItem {
  return {
    kind: place.kind,
    title: place.name,
    startTime: PLACE_TIME,
    priceTotalUsd: 0,
    pricing: [],
    pickup: false,
    note: place.note[locale],
    placeId: place.id,
    mapsUrl: place.mapsUrl,
  };
}

function restItem(locale: "en" | "es"): ItineraryItem {
  const es = locale === "es";
  return {
    kind: "rest",
    title: es ? "Descanso en el hotel" : "Relax at your hotel",
    priceTotalUsd: 0,
    pricing: [],
    pickup: false,
    note: es
      ? "Llegas por la tarde: instálate, disfruta la alberca y recarga energía para mañana."
      : "You land in the afternoon: settle in, enjoy the pool and recharge for tomorrow.",
  };
}

/** Beach or shopping, following the traveler's interests, rotating through the zone's places. */
function placePicker(request: TripRequest, zone: HotelZone) {
  const wantsBeach = request.interests.includes("beach");
  const wantsShopping = request.interests.includes("shopping");
  const kinds: Place["kind"][] =
    wantsBeach && wantsShopping ? ["beach", "shopping"] : wantsShopping ? ["shopping"] : ["beach"];
  const lists: Record<Place["kind"], Place[]> = {
    beach: placesFor(zone, "beach"),
    shopping: placesFor(zone, "shopping"),
  };
  const counters: Record<string, number> = {};
  let turn = 0;
  const take = (kind: Place["kind"]): Place | null => {
    const list = lists[kind];
    if (!list.length) return null;
    const i = counters[kind] ?? 0;
    counters[kind] = i + 1;
    return list[i % list.length];
  };
  /** On a rainy day the beach is never suggested: shopping instead. */
  return (rainy = false): Place | null => {
    if (rainy) return take("shopping");
    for (let tries = 0; tries < kinds.length; tries++) {
      const place = take(kinds[turn++ % kinds.length]);
      if (place) return place;
    }
    return null;
  };
}

const productOf = (products: CatalogProduct[]) => {
  const byId = new Map(products.map((p) => [p.bokunId, p]));
  return (item: ItineraryItem) => (item.bokunId ? byId.get(item.bokunId) : undefined);
};

/**
 * Moves each party night to a full day followed by a chill or departure day by
 * swapping whole days. A party night with nowhere to go is replaced by the best
 * unused non-party tour that costs no more (or dropped).
 */
export function placePartyNights(
  days: ItineraryDay[],
  request: TripRequest,
  products: CatalogProduct[],
): ItineraryDay[] {
  const out = days.map((d) => ({ ...d, items: [...d.items] }));
  const product = productOf(products);
  const tourOf = (d: ItineraryDay) => d.items.find((i) => i.kind === "tour");
  const isPartyDay = (d: ItineraryDay) => {
    const t = tourOf(d);
    const p = t && product(t);
    return !!p && isParty(p);
  };

  for (let i = 0; i < out.length; i++) {
    if (!isPartyDay(out[i]) || partyNightOk(out, i)) continue;
    const j = out.findIndex(
      (d, k) => k !== i && d.label === "full" && partyNightOk(out, k) && !isPartyDay(d),
    );
    if (j >= 0) {
      const a = out[i];
      const b = out[j];
      out[i] = { ...a, title: b.title, items: b.items };
      out[j] = { ...b, title: a.title, items: a.items };
      i = -1; // re-scan after a swap
      continue;
    }
    // Nowhere to put it: swap in a calm alternative.
    const party = tourOf(out[i])!;
    const used = new Set(out.flatMap((d) => d.items.map((x) => x.bokunId)).filter(Boolean));
    const alt = products
      .filter(
        (p) =>
          p.onSite &&
          (p.kind === "tour" || p.kind === "ticket") &&
          !isParty(p) &&
          !used.has(p.bokunId) &&
          !p.isMultiDay &&
          fitsAges(p, request.travelers) &&
          priceProductForParty(p, request.travelers).priceTotalUsd <= party.priceTotalUsd,
      )
      .map((p) => ({
        p,
        s: scoreProduct(p, request.interests, {
          preferPrivate: request.preferPrivate,
          youngKids: hasYoungKids(request),
        }),
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)[0]?.p;
    const slot = { date: out[i].date, dayNumber: out[i].dayNumber, label: out[i].label };
    out[i] = {
      ...out[i],
      title: alt ? alt.title : out[i].title,
      items: out[i].items
        .filter((x) => x !== party)
        .concat(alt ? [toItem(alt, request, slot)] : []),
    };
  }
  return out;
}

/** When the forecast shows rain on most of the trip, say beaches aren't a good idea. */
export function rainyTripNote(days: ItineraryDay[], locale: "en" | "es"): string | undefined {
  const rainy = days.filter((d) => d.weather?.source === "forecast" && d.weather.kind === "rainy");
  if (rainy.length < 2 || rainy.length < Math.ceil(days.length * 0.7)) return undefined;
  return locale === "es"
    ? "Se pronostica lluvia casi toda tu estancia. No recomendamos ir a la playa con lluvia: por eso te sugerimos compras, cenotes y parques como Extreme Adventure."
    : "Rain is forecast for most of your stay. We don't recommend the beach in the rain, so we suggest shopping, cenotes and parks like Extreme Adventure instead.";
}

/**
 * Neutral one-liners shown under "Traveling with kids". The Chichén Itzá line only
 * appears when the plan actually includes a Chichén tour.
 */
const MIN_RESTAURANT_VARIETY = 5;
/** The first dinner starts at one of the top few picks, so every trip doesn't open with the same place. */
const FIRST_DINNER_SPREAD = 3;

/** Stable per trip (same dates, same plan), different across trips. */
function tripSeed(request: TripRequest): number {
  const key = `${request.inbound.date ?? ""}|${request.outbound.date ?? ""}|${request.travelers.length}`;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function transferTitle(label: "arrival" | "departure", locale: "en" | "es"): string {
  if (locale === "es")
    return label === "arrival"
      ? "Traslado del aeropuerto a tu hotel"
      : "Traslado de tu hotel al aeropuerto";
  return label === "arrival"
    ? "Transfer from the airport to your hotel"
    : "Transfer from your hotel to the airport";
}

export function kidWarnings(request: TripRequest, days: ItineraryDay[] = []): string[] {
  const kids = request.travelers.some((t) => t.age < 13);
  if (!kids) return [];
  const es = request.locale === "es";
  const lines: string[] = [];
  if (request.interests.includes("party"))
    lines.push(
      es
        ? "Coco Bongo y los centros nocturnos no admiten menores; no los incluimos."
        : "Coco Bongo and night clubs don't admit minors; we left them out.",
    );
  const chichen = days.some((d) =>
    d.items.some((i) => i.kind === "tour" && /chich[eé]n/i.test(i.title)),
  );
  if (chichen)
    lines.push(
      es
        ? "Chichén Itzá es un día de unas 12 horas; puede ser pesado para niños."
        : "Chichén Itzá is a ~12-hour day; it can be tiring for kids.",
    );
  return lines;
}

function dayTitle(day: ItineraryDay, items: ItineraryItem[], locale: "en" | "es"): string {
  const es = locale === "es";
  const place = items.find((i) => i.kind === "beach" || i.kind === "shopping");
  if (day.label === "arrival")
    return items.some((i) => i.kind === "restaurant")
      ? es
        ? "Llegada y cena"
        : "Arrival and dinner"
      : es
        ? "Llegada y descanso"
        : "Arrival and rest";
  if (day.label === "chill" && place)
    return place.kind === "shopping"
      ? es
        ? "Día de compras"
        : "Shopping day"
      : es
        ? "Día de playa"
        : "Beach day";
  if (day.label === "departure")
    return place
      ? es
        ? "Último día: " + place.title
        : "Last day: " + place.title
      : es
        ? "Día de salida"
        : "Departure day";
  return day.title;
}

export function enrichItinerary(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  opts: { arrangeParty?: boolean; ratings?: Record<number, TripAdvisorRating> } = {},
): Itinerary {
  const locale = request.locale;
  const zone = effectiveZone(request);
  const product = productOf(products);
  // "Don't plan my dinners": no restaurants and no note about missing picks.
  const skipDining = request.dining.skip;
  const restaurants = skipDining ? [] : rankRestaurants(request, products, opts.ratings);
  // Rotate through the ranked list (no repeats until every place was used), starting at a
  // per-trip offset among the top picks instead of always at the first one.
  let nextRestaurant = restaurants.length
    ? tripSeed(request) % Math.min(restaurants.length, FIRST_DINNER_SPREAD)
    : 0;
  const dinner = () =>
    restaurants.length ? restaurantItem(restaurants[nextRestaurant++ % restaurants.length]) : null;
  const nextPlace = placePicker(request, zone);

  // Manual edits keep the traveler's own day order.
  const arranged =
    opts.arrangeParty === false
      ? itinerary.days
      : placePartyNights(itinerary.days, request, products);

  const days = arranged.map((day) => {
    // Drop blocks a previous enrichment added, so this is safe to run twice.
    const base = day.items.filter(
      (i) => i.kind === "tour" || i.kind === "transfer" || i.kind === "free",
    );
    // One Bokun product covers both legs; name each leg by its direction.
    const transfers = base
      .filter((i) => i.kind === "transfer")
      .map((i) =>
        day.label === "arrival" || day.label === "departure"
          ? { ...i, title: transferTitle(day.label, locale) }
          : i,
      );
    // Bokun reports "00:00" for all-day admissions: no fixed start time.
    const tours = base
      .filter((i) => i.kind === "tour")
      .map((i) => (i.startTime === "00:00" ? { ...i, startTime: undefined } : i));
    const items: ItineraryItem[] = [];

    if (day.label === "arrival") {
      items.push(...transfers);
      const d = request.inbound.slot === "early" ? dinner() : null;
      items.push(d ?? restItem(locale));
    } else if (day.label === "departure") {
      if (request.outbound.slot === "night") {
        const place = nextPlace(day.weather?.kind === "rainy");
        if (place) items.push(placeItem(place, locale));
      }
      items.push(...transfers);
    } else if (day.label === "chill") {
      const place = nextPlace(day.weather?.kind === "rainy");
      if (place) items.push(placeItem(place, locale));
      else items.push(...base.filter((i) => i.kind === "free"));
      const d = dinner();
      if (d) items.push(d);
    } else {
      items.push(...tours, ...base.filter((i) => i.kind === "free" && !tours.length));
      const partyNight = tours.some((t) => {
        const p = product(t);
        return !!p && isParty(p);
      });
      if (!partyNight) {
        const d = dinner();
        if (d) items.push(d);
      }
    }
    return { ...day, items, title: dayTitle(day, items, locale) };
  });

  const es = locale === "es";
  return {
    ...itinerary,
    days,
    introWarnings: kidWarnings(request, days),
    weatherNote: rainyTripNote(days, locale),
    diningNote:
     
      restaurants.length || skipDining || skipDining
          ? undefined
          : es
            ? "Todavía no tenemos restaurantes recomendados en tu zona; tu especialista te sugerirá los mejores."
            : "We don't have restaurant picks in your area yet; your specialist will suggest the best ones.",
  };
}
