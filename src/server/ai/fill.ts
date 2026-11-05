import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import type { Itinerary } from "@/lib/itinerary-schema";
import { variety } from "@/server/catalog/experience";
import { fitsAges, priceProductForParty } from "./pricing";
import {
  fitsDay,
  isParty,
  isRainyFavorite,
  isSeaTour,
  lastIfAvoided,
  partyAllowed,
  partyNightOk,
  scoreOpts,
  scoreProduct,
  toItem,
} from "./rules";

/**
 * Gap filler after the engine: a "full" day is a tour day (the pace picker turned the
 * rest into chill days), so a full day the engine left without a tour gets the best
 * matching candidate that still fits: the traveler's interests, a kind of day the
 * trip doesn't have yet, ages, party nights, weather, zone and the remaining budget.
 * Claude tends to under-fill long trips; the rules engine never does. When nothing
 * fits (budget gone, every matching tour used) the day stays free.
 */
export function fillEmptyDays(
  itinerary: Itinerary,
  request: TripRequest,
  products: CatalogProduct[],
  /** Tours of the previous version ("try another version"): used only if nothing else fits. */
  avoid: number[] = [],
): Itinerary {
  const budgetTotal = request.budgetPerPerson * request.travelers.length;
  const days = itinerary.days.map((d) => ({ ...d, items: [...d.items] }));
  const opts = scoreOpts(request);
  const price = (p: CatalogProduct) => priceProductForParty(p, request.travelers).priceTotalUsd;
  const warnings: string[] = [];
  // Tours only: transfers are paid on top of the budget.
  const spent = () =>
    days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .reduce((s, i) => s + i.priceTotalUsd, 0);
  const rainyAhead = days.some((d) => d.weather?.kind === "rainy");

  for (const [index, d] of days.entries()) {
    if (d.label !== "full" || d.items.some((i) => i.kind === "tour")) continue;
    const used = new Set(days.flatMap((x) => x.items.map((i) => i.bokunId)).filter(Boolean));
    const chosen = days.flatMap((x) => x.items).filter((i) => i.kind === "tour");
    const remaining = budgetTotal - spent();
    const slot = { date: d.date, dayNumber: d.dayNumber, label: d.label };
    const w = d.weather;
    const badWeather = !!w && w.kind !== "good";
    const ranked = products
      .filter(
        (p) =>
          p.onSite &&
          (p.kind === "tour" || p.kind === "ticket") &&
          (p.priceFromUsd ?? 0) > 0 &&
          !used.has(p.bokunId) &&
          fitsAges(p, request.travelers) &&
          fitsDay(p, slot, request) &&
          partyAllowed(p, request) &&
          (!isParty(p) || partyNightOk(days, index)) &&
          !(badWeather && isSeaTour(p)) &&
          // Keep WhatToDo's parks for the rainy days of the trip.
          !(rainyAhead && w?.kind !== "rainy" && isRainyFavorite(p)) &&
          variety(p, chosen) > 0 &&
          price(p) <= remaining,
      )
      .map((p) => ({ p, score: scoreProduct(p, request.interests, opts) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    lastIfAvoided(ranked, avoid, (x) => x.p.bokunId);
    const pick = ranked[0];
    if (!pick) continue;
    days[index] = {
      ...d,
      title: pick.p.title,
      items: [toItem(pick.p, request, slot), ...d.items.filter((i) => i.kind !== "free")],
    };
    warnings.push(`Filled ${d.date} (no tour from the engine) with "${pick.p.title}".`);
  }

  if (!warnings.length) return itinerary;
  return { ...itinerary, days, warnings: [...itinerary.warnings, ...warnings] };
}
