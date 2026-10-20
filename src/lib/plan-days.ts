import type { ItineraryDay } from "./itinerary-schema";
import type { TripRequest } from "./trip-schema";
import { addDays } from "./format";

/**
 * Day skeleton of a trip: arrival, full, chill and departure days. Shared by the
 * planner engines (server) and the preferences step (browser) so the "your trip"
 * line shows exactly what the itinerary will use.
 */
export type DaySlot = { date: string; dayNumber: number; label: ItineraryDay["label"] };

export function planDays(request: {
  inbound: { date: string };
  outbound: { date: string };
  chillDays: TripRequest["chillDays"];
  tourDays?: TripRequest["tourDays"];
  /** Exact rest days the traveler picked; when set it replaces chillDays/tourDays. */
  restDates?: string[];
}): DaySlot[] {
  const { inbound, outbound, chillDays } = request;
  const days: DaySlot[] = [];
  let d = inbound.date;
  let n = 1;
  while (d <= outbound.date) {
    const label: DaySlot["label"] =
      d === inbound.date ? "arrival" : d === outbound.date ? "departure" : "full";
    days.push({ date: d, dayNumber: n++, label });
    d = addDays(d, 1);
  }

  // Chill days: only on full days, never arrival/departure.
  const full = days.filter((x) => x.label === "full");
  if (request.restDates) {
    const rest = new Set(request.restDates);
    for (const x of full) if (rest.has(x.date)) x.label = "chill";
    return days;
  }
  let chillCount = 0;
  if (chillDays === "one") chillCount = Math.min(1, full.length);
  if (chillDays === "two") chillCount = Math.min(2, full.length);
  if (chillDays === "alternate") chillCount = Math.floor(full.length / 2);
  if (chillCount > 0) {
    // Spread chill days evenly (e.g. middle of the trip, then quarters).
    const step = full.length / (chillCount + 1);
    const picked = new Set<number>();
    for (let i = 1; i <= chillCount; i++)
      picked.add(Math.min(full.length - 1, Math.round(i * step) - 1));
    for (const idx of picked) full[idx].label = "chill";
  }
  // Tour-day cap: extra full days become easy days, spread through the trip.
  if (request.tourDays && request.tourDays !== "all") {
    const cap = Number(request.tourDays);
    const remaining = days.filter((x) => x.label === "full");
    const extra = remaining.length - cap;
    if (extra > 0) {
      const keep = new Set<number>();
      const step = remaining.length / cap;
      for (let i = 0; i < cap; i++) keep.add(Math.min(remaining.length - 1, Math.floor(i * step)));
      remaining.forEach((d, i) => {
        if (!keep.has(i)) d.label = "chill";
      });
    }
  }
  return days;
}

/** Trip pace presets shown as three cards; each maps to a number of rest days. */
export const PACES = ["relaxed", "balanced", "intense"] as const;
export type Pace = (typeof PACES)[number];

/** Dates between arrival and departure (the days that can hold a tour). */
export function fullDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function restCountFor(pace: Pace, fullCount: number): number {
  if (pace === "intense" || fullCount === 0) return 0;
  if (pace === "relaxed") return Math.max(1, Math.floor(fullCount / 2));
  return fullCount >= 3 ? Math.max(1, Math.round(fullCount / 4)) : 1;
}

/** Spread `count` rest days evenly through the trip (middle first, then quarters). */
export function spreadRest(dates: string[], count: number): string[] {
  const n = Math.min(count, dates.length);
  if (n <= 0) return [];
  const step = dates.length / (n + 1);
  const picked = new Set<number>();
  for (let i = 1; i <= n; i++) {
    let idx = Math.min(dates.length - 1, Math.max(0, Math.round(i * step) - 1));
    while (picked.has(idx) && idx < dates.length - 1) idx++;
    picked.add(idx);
  }
  return [...picked].sort((a, b) => a - b).map((i) => dates[i]);
}

export function restDatesForPace(pace: Pace, from: string, to: string): string[] {
  const dates = fullDates(from, to);
  return spreadRest(dates, restCountFor(pace, dates.length));
}
