import type { CatalogProduct } from "@/server/catalog/types";
import type { AvailabilitySlot } from "@/server/catalog/availability";
import type { TripRequest } from "@/lib/trip-schema";
import type { Itinerary, ItineraryItem } from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty } from "./pricing";
import { fitsDay, planDays, pickStartTime, scoreProduct, toItem } from "./rules";
import { validateAndRepair } from "./validate";
import { enrichItinerary } from "./enrich";

/** Re-validates an edited plan and re-applies dinners / beach / rest blocks. */
function finalize(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
): Itinerary {
  const clean = validateAndRepair(itinerary, request, products).itinerary;
  const enriched = enrichItinerary(clean, request, products, { arrangeParty: false });
  return validateAndRepair(enriched, request, products).itinerary;
}

/**
 * Traveler edits on a generated itinerary: move a tour to another day,
 * swap it for another product, or turn the day into a chill day.
 * Pure functions; the route handler supplies availability lookups.
 */

export type AvailabilityLookup = (bokunId: number, date: string) => Promise<AvailabilitySlot[]>;

export interface DayCheck {
  ok: boolean;
  /** "no_slots" = Bokun has no departure that day; "sold_out"; "fits" = day constraints */
  reason?: "no_slots" | "sold_out" | "does_not_fit" | "not_in_trip" | "unknown_product";
  slot?: AvailabilitySlot;
}

function freeItem(label: "chill" | "free"): ItineraryItem {
  return {
    kind: "free",
    title: label === "chill" ? "Chill day" : "Free day",
    priceTotalUsd: 0,
    pricing: [],
    pickup: false,
  };
}

/** Can this product run on `date` for this party? Uses live availability when Bokun has it. */
export async function checkDay(
  product: CatalogProduct,
  date: string,
  request: TripRequest,
  lookup: AvailabilityLookup,
): Promise<DayCheck> {
  const slot = planDays(request).find((d) => d.date === date);
  if (!slot) return { ok: false, reason: "not_in_trip" };
  if (!fitsDay(product, slot, request)) return { ok: false, reason: "does_not_fit" };

  const slots = await lookup(product.bokunId, date);
  const sameDay = slots.filter((s) => s.date === date);
  if (sameDay.length === 0) {
    // Products without dated departures (PASS / open tickets) report nothing; allow with a note.
    return product.bookingType === "PASS" ? { ok: true } : { ok: false, reason: "no_slots" };
  }
  const pax = request.travelers.length;
  const open = sameDay.find((s) => !s.soldOut && (s.seatsLeft === null || s.seatsLeft >= pax));
  return open ? { ok: true, slot: open } : { ok: false, reason: "sold_out" };
}

function replaceTourOnDay(
  itinerary: Itinerary,
  date: string,
  next: ItineraryItem | null,
): Itinerary {
  const days = itinerary.days.map((d) => {
    if (d.date !== date) return d;
    const transfers = d.items.filter((i) => i.kind === "transfer");
    const items = next
      ? [
          ...transfers.filter((t) => (t.startTime ?? "") <= (next.startTime ?? "99")),
          next,
          ...transfers.filter((t) => (t.startTime ?? "") > (next.startTime ?? "99")),
        ]
      : transfers.length
        ? transfers
        : [freeItem("chill")];
    const label = next
      ? d.label === "chill"
        ? "full"
        : d.label
      : d.label === "full"
        ? "chill"
        : d.label;
    const chillTitle = itinerary.locale === "es" ? "Día de descanso" : "Chill day";
    return { ...d, items, label, title: next ? next.title : chillTitle, notices: undefined };
  });
  return { ...itinerary, days };
}

export async function moveTour(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  args: { bokunId: number; fromDate: string; toDate: string },
  lookup: AvailabilityLookup,
): Promise<{ ok: true; itinerary: Itinerary } | { ok: false; check: DayCheck }> {
  const product = products.find((p) => p.bokunId === args.bokunId);
  if (!product) return { ok: false, check: { ok: false, reason: "unknown_product" } };
  const check = await checkDay(product, args.toDate, request, lookup);
  if (!check.ok) return { ok: false, check };

  const from = itinerary.days.find((d) => d.date === args.fromDate);
  const to = itinerary.days.find((d) => d.date === args.toDate);
  const moving = from?.items.find((i) => i.bokunId === args.bokunId && i.kind === "tour");
  if (!from || !to || !moving)
    return { ok: false, check: { ok: false, reason: "unknown_product" } };

  // Swap: whatever tour was on the target day goes back to the source day (if it fits there).
  const displaced = to.items.find((i) => i.kind === "tour");
  const slotTo = planDays(request).find((d) => d.date === args.toDate)!;
  const st = check.slot
    ? { time: check.slot.time ?? undefined, id: check.slot.startTimeId ?? undefined }
    : pickStartTime(product, slotTo);
  const movedItem: ItineraryItem = { ...moving, startTime: st.time, startTimeId: st.id };

  let next = replaceTourOnDay(itinerary, args.toDate, movedItem);
  let backfill: ItineraryItem | null = null;
  if (displaced?.bokunId) {
    const dp = products.find((p) => p.bokunId === displaced.bokunId);
    const slotFrom = planDays(request).find((d) => d.date === args.fromDate)!;
    if (dp && fitsDay(dp, slotFrom, request)) {
      const back = await checkDay(dp, args.fromDate, request, lookup);
      if (back.ok) {
        const bst = back.slot
          ? { time: back.slot.time ?? undefined, id: back.slot.startTimeId ?? undefined }
          : pickStartTime(dp, slotFrom);
        backfill = { ...displaced, startTime: bst.time, startTimeId: bst.id };
      }
    }
  }
  next = replaceTourOnDay(next, args.fromDate, backfill);
  return { ok: true, itinerary: finalize(next, request, products) };
}

export async function replaceTour(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  args: { date: string; bokunId: number | null },
  lookup: AvailabilityLookup,
): Promise<{ ok: true; itinerary: Itinerary } | { ok: false; check: DayCheck }> {
  if (args.bokunId === null) {
    return {
      ok: true,
      itinerary: finalize(replaceTourOnDay(itinerary, args.date, null), request, products),
    };
  }
  const product = products.find((p) => p.bokunId === args.bokunId);
  if (!product) return { ok: false, check: { ok: false, reason: "unknown_product" } };
  const check = await checkDay(product, args.date, request, lookup);
  if (!check.ok) return { ok: false, check };
  const slot = planDays(request).find((d) => d.date === args.date)!;
  const item = toItem(product, request, slot);
  if (check.slot) {
    item.startTime = check.slot.time ?? item.startTime;
    item.startTimeId = check.slot.startTimeId ?? item.startTimeId;
  }
  return {
    ok: true,
    itinerary: finalize(replaceTourOnDay(itinerary, args.date, item), request, products),
  };
}

export interface Alternative {
  bokunId: number;
  title: string;
  imageUrl: string | null;
  durationMinutes: number | null;
  priceTotalUsd: number;
  interests: string[];
  rating: number | null;
  available: boolean;
  startTime: string | null;
}

/** Other tours that could run on `date`, ranked by interest fit, with live availability. */
export async function alternativesForDay(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  date: string,
  lookup: AvailabilityLookup,
  limit = 8,
): Promise<Alternative[]> {
  const slot = planDays(request).find((d) => d.date === date);
  if (!slot) return [];
  const used = new Set(itinerary.days.flatMap((d) => d.items.map((i) => i.bokunId)));
  const current = itinerary.days
    .find((d) => d.date === date)
    ?.items.find((i) => i.kind === "tour")?.bokunId;
  const candidates = products
    .filter(
      (p) => p.onSite && (p.kind === "tour" || p.kind === "ticket") && (p.priceFromUsd ?? 0) > 0,
    )
    .filter((p) => !used.has(p.bokunId) || p.bokunId === current)
    .filter((p) => p.bokunId !== current)
    .filter((p) => fitsAges(p, request.travelers) && fitsDay(p, slot, request))
    .map((p) => ({ p, score: scoreProduct(p, request.interests) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 2);

  const checked = await Promise.all(
    candidates.slice(0, limit + 4).map(async ({ p }) => {
      const check = await checkDay(p, date, request, lookup).catch(
        () => ({ ok: false }) as DayCheck,
      );
      return { p, check };
    }),
  );
  return checked
    .sort((a, b) => Number(b.check.ok) - Number(a.check.ok))
    .slice(0, limit)
    .map(({ p, check }) => ({
      bokunId: p.bokunId,
      title: p.title,
      imageUrl: p.imageUrl,
      durationMinutes: p.durationMinutes,
      priceTotalUsd: priceProductForParty(p, request.travelers).priceTotalUsd,
      interests: p.interests,
      rating: p.rating,
      available: check.ok,
      startTime: check.slot?.time ?? p.startTimes[0]?.time ?? null,
    }));
}
