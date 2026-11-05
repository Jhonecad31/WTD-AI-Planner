import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import type { Itinerary, ItineraryItem } from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty } from "./pricing";
import { variety } from "@/server/catalog/experience";
import {
  fitsDay,
  hasYoungKids,
  isParty,
  isSeaTour,
  lastIfAvoided,
  longTourOk,
  allowedForTraveler,
  partyNightOk,
  planDays,
  scoreOpts,
  scoreProduct,
  toItem,
} from "./rules";
import { checkDay, type AvailabilityLookup, type DayCheck } from "./edit";

/**
 * Live availability pass over a generated itinerary (read-only Bokun calls):
 * - tour with seats that day → keep it and use Bokun's real start time
 * - sold out / no departure that day → swap in the best available alternative
 *   that follows the same rules (ages, party nights, weather, budget)
 * - Bokun unreachable → keep the tour and flag it for the agent
 */

const LOOKUP_TIMEOUT_MS = 4000;
const MAX_ALTERNATIVES_CHECKED = 6;

export interface AvailabilityReport {
  checked: number;
  moved: number;
  replaced: number;
  unverified: number;
}

async function safeCheck(
  product: CatalogProduct,
  date: string,
  request: TripRequest,
  lookup: AvailabilityLookup,
): Promise<DayCheck | "error"> {
  try {
    return await Promise.race([
      checkDay(product, date, request, lookup),
      new Promise<"error">((resolve) => setTimeout(() => resolve("error"), LOOKUP_TIMEOUT_MS)),
    ]);
  } catch {
    return "error";
  }
}

function withSlot(item: ItineraryItem, check: DayCheck): ItineraryItem {
  if (!check.slot) return item;
  // Bokun reports "00:00" for all-day admissions (e.g. Xcaret): no fixed start time.
  const time = check.slot.time && check.slot.time !== "00:00" ? check.slot.time : undefined;
  return {
    ...item,
    startTime: time ?? (check.slot.time === "00:00" ? undefined : item.startTime),
    startTimeId: check.slot.startTimeId ?? item.startTimeId,
  };
}

export async function verifyAvailability(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  lookup: AvailabilityLookup,
  avoid?: number[],
): Promise<{ itinerary: Itinerary; report: AvailabilityReport }> {
  const byId = new Map(products.map((p) => [p.bokunId, p]));
  const slots = planDays(request);
  const budgetTotal = request.budgetPerPerson * request.travelers.length;
  const es = request.locale === "es";
  const report: AvailabilityReport = { checked: 0, moved: 0, replaced: 0, unverified: 0 };
  const warnings: string[] = [];
  const days = itinerary.days.map((d) => ({ ...d, items: [...d.items] }));
  const notify = (i: number, text: string) => {
    days[i] = { ...days[i], notices: [...(days[i].notices ?? []), text] };
  };
  const used = new Set(days.flatMap((d) => d.items.map((i) => i.bokunId)).filter(Boolean));

  // 1) Check every chosen tour in parallel.
  const tourDays = days
    .map((d, index) => ({ d, index, item: d.items.find((i) => i.kind === "tour") }))
    .filter((x): x is { d: (typeof days)[number]; index: number; item: ItineraryItem } => !!x.item);
  const results = await Promise.all(
    tourDays.map(async ({ item, d }) => {
      const p = item.bokunId ? byId.get(item.bokunId) : undefined;
      return p ? safeCheck(p, d.date, request, lookup) : ("error" as const);
    }),
  );

  // 2) Fix the days that failed, one by one (alternatives depend on what's already used).
  for (const [k, { d, index, item }] of tourDays.entries()) {
    const result = results[k];
    report.checked++;
    if (result === "error") {
      report.unverified++;
      warnings.push(
        `Availability not verified for "${item.title}" on ${d.date} (Bokun did not answer).`,
      );
      continue;
    }
    // A swap with an earlier day may already have moved this tour (and verified it).
    const current = days[index].items.find((i) => i.kind === "tour");
    if (!current || current.bokunId !== item.bokunId) continue;
    if (result.ok) {
      days[index].items = days[index].items.map((i) => (i === current ? withSlot(i, result) : i));
      continue;
    }

    // First try moving it to another tour day of the trip where it does run.
    const product = byId.get(item.bokunId!)!;
    const bad = (i: number) => !!days[i].weather && days[i].weather!.kind !== "good";
    let moved = false;
    for (const other of tourDays) {
      if (other.index === index) continue;
      const otherItem = days[other.index].items.find((i) => i.kind === "tour");
      const otherProduct = otherItem?.bokunId ? byId.get(otherItem.bokunId) : undefined;
      if (!otherItem || !otherProduct) continue;
      if (isParty(product) && !partyNightOk(days, other.index)) continue;
      if (isParty(otherProduct) && !partyNightOk(days, index)) continue;
      if ((isSeaTour(product) && bad(other.index)) || (isSeaTour(otherProduct) && bad(index)))
        continue;
      const here = await safeCheck(product, days[other.index].date, request, lookup);
      if (here === "error" || !here.ok) continue;
      const there = await safeCheck(otherProduct, d.date, request, lookup);
      if (there === "error" || !there.ok) continue;
      const titleHere = days[index].title;
      days[index] = {
        ...days[index],
        title: days[other.index].title,
        items: days[index].items.map((i) => (i === current ? withSlot(otherItem, there) : i)),
      };
      days[other.index] = {
        ...days[other.index],
        title: titleHere,
        items: days[other.index].items.map((i) => (i === otherItem ? withSlot(current, here) : i)),
      };
      report.moved++;
      // No notice for the traveler: this is their first look at the plan, so "we moved it"
      // only confuses. The agent still sees it in `warnings`.
      warnings.push(
        `"${item.title}" doesn't run on ${d.date}; swapped days with "${otherItem.title}" (${days[other.index].date}).`,
      );
      moved = true;
      break;
    }
    if (moved) continue;

    // Find a replacement with seats.
    const spentElsewhere = days
      .flatMap((x) => x.items)
      .filter((i) => i.kind === "tour" && i !== item)
      .reduce((s, i) => s + i.priceTotalUsd, 0);
    const slot = slots.find((s) => s.date === d.date);
    const otherTours = days.flatMap((x) => x.items).filter((i) => i.kind === "tour" && i !== item);
    const partyOk = partyNightOk(days, index);
    const badWeather = !!d.weather && d.weather.kind !== "good";
    const ranked = products
      .filter(
        (p) =>
          p.onSite &&
          (p.kind === "tour" || p.kind === "ticket") &&
          (p.priceFromUsd ?? 0) > 0 &&
          !used.has(p.bokunId) &&
          fitsAges(p, request.travelers) &&
          (!slot || fitsDay(p, slot, request)) &&
          allowedForTraveler(p, request) &&
          (!isParty(p) || partyOk) &&
          !(badWeather && isSeaTour(p)) &&
          // Never a repeat of another day; the day goes free before that.
          variety(p, otherTours) > 0 &&
          longTourOk(p, request, otherTours) &&
          spentElsewhere + priceProductForParty(p, request.travelers).priceTotalUsd <= budgetTotal,
      )
      .map((p) => ({
        p,
        score: scoreProduct(p, request.interests, scoreOpts(request)),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    lastIfAvoided(ranked, avoid, (x) => x.p.bokunId);
    const candidates = ranked.slice(0, MAX_ALTERNATIVES_CHECKED);

    let replacement: { p: CatalogProduct; check: DayCheck } | null = null;
    for (const { p } of candidates) {
      const check = await safeCheck(p, d.date, request, lookup);
      if (check !== "error" && check.ok) {
        replacement = { p, check };
        break;
      }
    }

    const why =
      result.reason === "sold_out"
        ? es
          ? "ya no tenía lugares"
          : "was sold out"
        : es
          ? "no sale ese día"
          : "doesn't run that day";
    if (replacement && slot) {
      const next = withSlot(toItem(replacement.p, request, slot), replacement.check);
      days[index] = {
        ...days[index],
        title: replacement.p.title,
        items: days[index].items.map((i) => (i === item ? next : i)),
      };
      used.add(replacement.p.bokunId);
      // Same as a move: the traveler never saw the original pick, so no notice.
      report.replaced++;
      warnings.push(
        `"${item.title}" on ${d.date} ${result.reason}; replaced by "${replacement.p.title}".`,
      );
    } else {
      // Nothing with seats: leave the day free (dinner and places are re-added later).
      days[index] = {
        ...days[index],
        items: days[index].items
          .filter((i) => i !== item)
          .concat({
            kind: "free",
            title: es ? "Día libre" : "Free day",
            priceTotalUsd: 0,
            pricing: [],
            pickup: false,
          }),
      };
      notify(
        index,
        es
          ? `"${item.title}" ${why} y no encontramos otro tour con lugares; tu especialista te propondrá opciones.`
          : `"${item.title}" ${why} and we found no other tour with seats; your specialist will suggest options.`,
      );
      report.replaced++;
      warnings.push(
        `"${item.title}" on ${d.date} ${result.reason}; no available alternative, day left free.`,
      );
    }
  }

  return {
    itinerary: { ...itinerary, days, warnings: [...itinerary.warnings, ...warnings] },
    report,
  };
}
