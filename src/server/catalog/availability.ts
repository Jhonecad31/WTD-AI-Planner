import { getActivityAvailabilities } from "@/server/bokun/api";
import type { BokunAvailability } from "@/server/bokun/types";

/**
 * Live availability + prices for one product over a date range.
 * Read-only. Cached in memory for 15 minutes (Redis later, when deployed).
 */

export interface AvailabilitySlot {
  /** "yyyy-MM-dd" local date */
  date: string;
  startTimeId: number | null;
  /** "HH:mm" */
  time: string | null;
  seatsLeft: number | null; // null = unlimited
  soldOut: boolean;
  /** pricingCategoryId -> price per unit (USD) */
  pricesByCategory: Record<number, number>;
  defaultPrice: number | null;
  pickupPrice: number | null;
  minParticipants: number | null;
}

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; slots: AvailabilitySlot[] }>();

export function normalizeAvailability(a: BokunAvailability): AvailabilitySlot | null {
  // `localizedDate` is a display string ("Fri 11.Dec'26"); `date` is UTC midnight in ms.
  const date =
    typeof a.date === "number"
      ? new Date(a.date).toISOString().slice(0, 10)
      : a.localizedDate && /^\d{4}-\d{2}-\d{2}$/.test(a.localizedDate)
        ? a.localizedDate
        : null;
  if (!date) return null;
  const prices: Record<number, number> = {};
  for (const [k, v] of Object.entries(a.pricesByCategory ?? {})) {
    const id = Number(k);
    if (!Number.isNaN(id) && typeof v === "number") prices[id] = v;
  }
  return {
    date,
    startTimeId: a.startTimeId ?? null,
    time: a.startTime ?? null,
    seatsLeft: a.unlimitedAvailability ? null : (a.availabilityCount ?? 0),
    soldOut: Boolean(a.soldOut || a.unavailable),
    pricesByCategory: prices,
    defaultPrice: a.defaultPrice ?? null,
    pickupPrice: a.pickupPrice ?? null,
    minParticipants: a.minParticipants ?? null,
  };
}

export async function getAvailability(
  bokunId: number,
  start: string,
  end: string,
): Promise<AvailabilitySlot[]> {
  const key = `${bokunId}:${start}:${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.slots;

  const raw = await getActivityAvailabilities(bokunId, start, end);
  const slots = raw
    .map(normalizeAvailability)
    .filter((s): s is AvailabilitySlot => !!s)
    .sort((x, y) => `${x.date} ${x.time ?? ""}`.localeCompare(`${y.date} ${y.time ?? ""}`));
  cache.set(key, { at: Date.now(), slots });
  return slots;
}

/** Can `pax` people book this product on `date`? Returns the best open slot. */
export function findOpenSlot(
  slots: AvailabilitySlot[],
  date: string,
  pax: number,
): AvailabilitySlot | null {
  const sameDay = slots.filter((s) => s.date === date && !s.soldOut);
  return sameDay.find((s) => s.seatsLeft === null || s.seatsLeft >= pax) ?? null;
}

/** Total for a party given pricing-category counts, using slot prices. */
export function priceParty(slot: AvailabilitySlot, counts: Record<number, number>): number | null {
  let total = 0;
  for (const [idStr, n] of Object.entries(counts)) {
    const id = Number(idStr);
    const unit = slot.pricesByCategory[id];
    if (unit === undefined) return null;
    total += unit * n;
  }
  return Math.round(total * 100) / 100;
}
