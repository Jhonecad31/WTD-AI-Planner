import type { CatalogProduct, PricingCategory } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import type { ItineraryItem } from "@/lib/itinerary-schema";
import { PEOPLE_PER_PRICE } from "@/content/pricing-overrides";

/**
 * Assigns each traveler to a Bokun pricing category by age and prices the party.
 * Uses the catalog's "from" price for the default (adult) category; children are
 * estimated at 70% when the product has a child category but no live price yet.
 * Phase 3 uses this estimate; live availability prices refine it per date.
 */

const CHILD_RATIO = 0.7;
const INFANT_RATIO = 0;

export function categoryForAge(categories: PricingCategory[], age: number): PricingCategory | null {
  const byAge = categories.find(
    (c) => c.minAge !== null && c.maxAge !== null && age >= c.minAge && age <= c.maxAge,
  );
  if (byAge) return byAge;
  const def =
    categories.find((c) => c.isDefault) ?? categories.find((c) => c.ticketCategory === "ADULT");
  // Children with no matching band fall back to a CHILD category if one exists.
  if (age < 13) {
    const child = categories.find((c) => c.ticketCategory === "CHILD");
    if (child) return child;
  }
  return def ?? categories[0] ?? null;
}

export function estimateUnitPrice(
  product: CatalogProduct,
  category: PricingCategory | null,
): number {
  const base = product.priceFromUsd ?? 0;
  if (!category) return base;
  if (category.isDefault || category.ticketCategory === "ADULT") return base;
  if (category.ticketCategory === "INFANT") return base * INFANT_RATIO;
  if (category.ticketCategory === "CHILD" || category.ticketCategory === "TEENAGER") {
    return Math.round(base * CHILD_RATIO);
  }
  return base;
}

/**
 * Can every traveler join this product? False when the youngest is under the product's
 * minAge or when a traveler's age falls outside every pricing band (e.g. nightclubs
 * that only sell "Adult 18-99" tickets). Transfers are priced per vehicle, so they always fit.
 */
export function fitsAges(product: CatalogProduct, travelers: TripRequest["travelers"]): boolean {
  if (product.kind === "transfer") return true;
  const youngest = Math.min(...travelers.map((t) => t.age));
  if (product.minAge !== null && youngest < product.minAge) return false;
  const banded = product.pricingCategories.filter((c) => c.minAge !== null && c.maxAge !== null);
  if (banded.length === 0) return true;
  return travelers.every((t) =>
    banded.some((c) => t.age >= (c.minAge as number) && t.age <= (c.maxAge as number)),
  );
}

/** WhatToDo's airport transfers are priced per vehicle ("Transportation Price for Vehicle"). */
export function isPerVehicle(product: CatalogProduct): boolean {
  if (product.kind !== "transfer") return false;
  const cats = product.pricingCategories;
  if (cats.length === 0) return true;
  return cats.every((c) => /vehicle|veh[ií]culo|price for|per (car|van|unit)/i.test(c.title));
}

export function priceProductForParty(
  product: CatalogProduct,
  travelers: TripRequest["travelers"],
  livePrices?: Record<number, number>,
): Pick<ItineraryItem, "priceTotalUsd" | "pricing"> {
  if (isPerVehicle(product)) {
    const cat = product.pricingCategories.find((c) => c.isDefault) ?? product.pricingCategories[0];
    const unitUsd = round2((cat && livePrices?.[cat.id]) ?? product.priceFromUsd ?? 0);
    return {
      priceTotalUsd: unitUsd,
      pricing: cat ? [{ pricingCategoryId: cat.id, title: cat.title, count: 1, unitUsd }] : [],
    };
  }
  const counts = new Map<number, { cat: PricingCategory; count: number }>();
  const unknown: number[] = [];
  for (const t of travelers) {
    const cat = categoryForAge(product.pricingCategories, t.age);
    if (!cat) {
      unknown.push(t.age);
      continue;
    }
    const entry = counts.get(cat.id) ?? { cat, count: 0 };
    entry.count++;
    counts.set(cat.id, entry);
  }

  // Some tickets cover several people (shared ATV): charge each traveler their share.
  const share = PEOPLE_PER_PRICE[product.bokunId] ?? 1;
  const pricing = [...counts.values()].map(({ cat, count }) => {
    const live = livePrices?.[cat.id];
    const unitUsd = typeof live === "number" ? live : estimateUnitPrice(product, cat);
    return { pricingCategoryId: cat.id, title: cat.title, count, unitUsd: round2(unitUsd / share) };
  });

  // Products without pricing categories: charge the "from" price per traveler.
  const fallback = (unknown.length * (product.priceFromUsd ?? 0)) / share;
  const priceTotalUsd = round2(pricing.reduce((s, p) => s + p.unitUsd * p.count, 0) + fallback);
  return { priceTotalUsd, pricing };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}