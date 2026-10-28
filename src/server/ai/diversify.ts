import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import type { Itinerary } from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty } from "./pricing";
import {
  fitsDay,
  hasYoungKids,
  isParty,
  isSeaTour,
  partyNightOk,
  scoreProduct,
  toItem,
} from "./rules";
import { variety } from "./similarity";

/**
 * Variety guard after the engine (Claude is only *asked* for it): walking the trip in
 * date order, a tour that repeats the kind of an earlier day (a second cenote or ATV
 * day, Xel-Há after Xcaret) is swapped for the best-fitting tour that's more different,
 * within the budget, ages, party nights and weather. Tours with only a small overlap
 * are swapped only for one with nothing in common. If nothing fits, the tour stays.
 */
export function diversify(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  /** Tours of the previous version ("try another version"): never swapped back in. */
  avoid: number[] = [],
): Itinerary {
  const budgetTotal = request.budgetPerPerson * request.travelers.length;
  const days = itinerary.days.map((d) => ({ ...d, items: [...d.items] }));
  const byId = new Map(products.map((p) => [p.bokunId, p]));
  const opts = { preferPrivate: request.preferPrivate, youngKids: hasYoungKids(request) };
  const price = (p: CatalogProduct) => priceProductForParty(p, request.travelers).priceTotalUsd;
  const warnings: string[] = [];
  const chosen: { title: string }[] = [];

  for (const [index, d] of days.entries()) {
    const item = d.items.find((i) => i.kind === "tour");
    if (!item) continue;
    const level = variety(item, chosen);
    if (level === 2) {
      chosen.push(item);
      continue;
    }
    const used = new Set([
      ...avoid,
      ...days.flatMap((x) => x.items.map((i) => i.bokunId)).filter((id) => id !== undefined),
    ]);
    const spentElsewhere = days
      .flatMap((x) => x.items)
      .filter((i) => (i.kind === "tour" || i.kind === "transfer") && i !== item)
      .reduce((s, i) => s + i.priceTotalUsd, 0);
    const slot = { date: d.date, dayNumber: d.dayNumber, label: d.label };
    const badWeather = !!d.weather && d.weather.kind !== "good";
    const original = item.bokunId ? byId.get(item.bokunId) : undefined;
    const better = products
      .filter(
        (p) =>
          p.onSite &&
          (p.kind === "tour" || p.kind === "ticket") &&
          (p.priceFromUsd ?? 0) > 0 &&
          !used.has(p.bokunId) &&
          fitsAges(p, request.travelers) &&
          fitsDay(p, slot, request) &&
          (!isParty(p) || partyNightOk(days, index)) &&
          !(badWeather && isSeaTour(p)) &&
          spentElsewhere + price(p) <= budgetTotal &&
          variety(p, chosen) > level,
      )
      .map((p) => ({
        p,
        level: variety(p, chosen),
        score: scoreProduct(p, request.interests, opts),
        // Same kind of interest as the tour it replaces (adventure for adventure).
        sameTheme: Number(p.interests.some((i) => original?.interests.includes(i))),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.level - a.level || b.sameTheme - a.sameTheme || b.score - a.score);
    const pick = better[0];
    if (!pick) {
      chosen.push(item);
      continue;
    }
    // The old note and day title described the old tour.
    days[index] = {
      ...d,
      title: pick.p.title,
      items: d.items.map((i) => (i === item ? toItem(pick.p, request, slot) : i)),
    };
    chosen.push(pick.p);
    warnings.push(
      `Variety: swapped "${item.title}" on ${d.date} for "${pick.p.title}" (too similar to an earlier day).`,
    );
  }

  if (!warnings.length) return itinerary;
  return { ...itinerary, days, warnings: [...itinerary.warnings, ...warnings] };
}
