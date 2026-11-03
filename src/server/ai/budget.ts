import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import type { Itinerary, ItineraryItem } from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty, round2 } from "./pricing";
import {
  fitsDay,
  hasYoungKids,
  isParty,
  isSeaTour,
  partyNightOk,
  scoreProduct,
  toItem,
} from "./rules";

/** Kinds of experience a title names, to avoid two days of the same thing. */
const EXPERIENCE_KINDS: [string, RegExp][] = [
  ["atv", /\batv\b|buggy|buggies|cuatrimoto/i],
  ["zipline", /zip-?line|tirolesa/i],
  ["cenote", /cenote/i],
  ["ruins", /ruin|ruinas|chich[eé]n|cob[aá]|tulum|ek balam/i],
  ["sea", /catamar[aá]n|sail|velero|yacht|yate|snorkel|isla mujeres/i],
  ["park", /xcaret|xel-?h[aá]|xplor|xenses|xavage/i],
  ["dolphin", /dolphin|delf[ií]n/i],
];
function experienceKinds(title: string): string[] {
  return EXPERIENCE_KINDS.filter(([, re]) => re.test(title)).map(([k]) => k);
}

/**
 * Budget guard after the engine (Claude is only *asked* to respect the budget).
 * While tours + transfers go over the traveler's budget, swap the priciest tour for a
 * cheaper one that still fits their interests, ages, party nights and weather. If no
 * swap helps, drop the priciest tour (the day becomes free), keeping at least one tour.
 * Transfers are never touched: the traveler asked for them. No traveler notice: this is
 * their first version of the plan; the agent sees the changes in `warnings`.
 * `avoid`: tours of earlier versions ("try another version"), used only if nothing else fits.
 */
export function fitBudget(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  avoid: number[] = [],
): Itinerary {
  const budgetTotal = request.budgetPerPerson * request.travelers.length;
  const days = itinerary.days.map((d) => ({ ...d, items: [...d.items] }));
  const warnings: string[] = [];
  const spent = () =>
    days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour" || i.kind === "transfer")
      .reduce((s, i) => s + i.priceTotalUsd, 0);
  const tours = () =>
    days.flatMap((d, index) =>
      d.items.filter((i) => i.kind === "tour").map((item) => ({ index, item })),
    );
  const price = (p: CatalogProduct) => priceProductForParty(p, request.travelers).priceTotalUsd;
  const opts = { preferPrivate: request.preferPrivate, youngKids: hasYoungKids(request) };
  const byId = new Map(products.map((p) => [p.bokunId, p]));
  const skip = new Set(avoid);

  // Each pass fixes one tour; skipping avoided tours can take a tour two smaller swaps.
  for (let guard = tours().length * 2; guard > 0 && spent() > budgetTotal; guard--) {
    const over = spent() - budgetTotal;
    const used = new Set(days.flatMap((d) => d.items.map((i) => i.bokunId)).filter(Boolean));
    const byPrice = tours().sort((a, b) => b.item.priceTotalUsd - a.item.priceTotalUsd);

    let swapped = false;
    for (const { index, item } of byPrice) {
      const d = days[index];
      const slot = { date: d.date, dayNumber: d.dayNumber, label: d.label };
      const badWeather = !!d.weather && d.weather.kind !== "good";
      const original = item.bokunId ? byId.get(item.bokunId) : undefined;
      // Interests only this tour covers in the trip: the swap should keep them.
      const others = tours()
        .filter((t) => t.item !== item)
        .flatMap((t) => (t.item.bokunId ? (byId.get(t.item.bokunId)?.interests ?? []) : []));
      const lost = (original?.interests ?? []).filter(
        (i) => request.interests.includes(i) && !others.includes(i),
      );
      const otherKinds = new Set(
        tours()
          .filter((t) => t.item !== item)
          .flatMap((t) => experienceKinds(t.item.title)),
      );
      const affordable = products
        .filter(
          (p) =>
            p.onSite &&
            (p.kind === "tour" || p.kind === "ticket") &&
            (p.priceFromUsd ?? 0) > 0 &&
            !used.has(p.bokunId) &&
            fitsAges(p, request.travelers) &&
            fitsDay(p, slot, request) &&
            (!isParty(p) || partyNightOk(days, index)) &&
            !(badWeather && (isSeaTour(p) || p.interests.includes("beach"))) &&
            price(p) < item.priceTotalUsd,
        )
        .map((p) => ({
          p,
          score: scoreProduct(p, request.interests, opts),
          cost: price(p),
          // Keeps what would otherwise vanish from the trip (e.g. the only ruins day).
          keepsLost: Number(p.interests.some((i) => lost.includes(i))),
          // A second ATV or cenote day reads as a repeat, whatever the interest tags say.
          fresh: Number(!experienceKinds(p.title).some((k) => otherKinds.has(k))),
          // Same kind of day as the tour it replaces (ruins for ruins, adventure for adventure).
          sameTheme: Number(p.interests.some((i) => original?.interests.includes(i))),
        }))
        .filter((x) => x.score > 0);
      if (!affordable.length) continue;
      const notAvoided = affordable.filter((x) => !skip.has(x.p.bokunId));
      const cheaper = notAvoided.length ? notAvoided : affordable;
      // Among swaps that bring the trip within budget: keep the interests only this tour
      // covered, same theme, best fit, then the one that uses most of the budget left. If no
      // single swap is enough, take the biggest saving (same priorities) and loop again.
      const fixes = cheaper.filter((x) => item.priceTotalUsd - x.cost >= over);
      const pick = fixes.length
        ? fixes.sort(
            (a, b) =>
              b.keepsLost - a.keepsLost ||
              b.fresh - a.fresh ||
              b.sameTheme - a.sameTheme ||
              b.score - a.score ||
              b.cost - a.cost,
          )[0]
        : cheaper.sort(
            (a, b) =>
              b.keepsLost - a.keepsLost ||
              b.fresh - a.fresh ||
              b.sameTheme - a.sameTheme ||
              a.cost - b.cost,
          )[0];
      // The old note described the old tour, so the new one starts without a note.
      const next: ItineraryItem = toItem(pick.p, request, slot);
      days[index] = {
        ...d,
        title: d.title === item.title ? pick.p.title : d.title,
        items: d.items.map((i) => (i === item ? next : i)),
      };
      warnings.push(
        `Over budget: swapped "${item.title}" (${item.priceTotalUsd} USD) for "${pick.p.title}" (${pick.cost} USD) on ${d.date}.`,
      );
      swapped = true;
      break;
    }
    if (swapped) continue;

    // No cheaper fit anywhere: drop the priciest tour, but never the last one.
    if (byPrice.length <= 1) break;
    const { index, item } = byPrice[0];
    days[index] = {
      ...days[index],
      items: days[index].items
        .filter((i) => i !== item)
        .concat({
          kind: "free",
          title: request.locale === "es" ? "Día libre" : "Free day",
          priceTotalUsd: 0,
          pricing: [],
          pickup: false,
        }),
    };
    warnings.push(
      `Over budget: removed "${item.title}" (${item.priceTotalUsd} USD) on ${days[index].date}; no cheaper tour fit.`,
    );
  }

  if (!warnings.length) return itinerary;
  warnings.push(`Budget guard: tours + transfers now ${round2(spent())} of ${budgetTotal} USD.`);
  return { ...itinerary, days, warnings: [...itinerary.warnings, ...warnings] };
}