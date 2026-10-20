import type { HotelZone } from "@/lib/trip-schema";
import type { CatalogProduct } from "./types";

/**
 * Hotel search built from Bokun pickup places: WhatToDo's own list of hotels it
 * picks up from (~1,400). No extra API, always in sync with the catalog.
 */

export interface HotelOption {
  name: string;
  city: string | null;
  zone: HotelZone | null;
}

export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

const CITY_ZONE: [RegExp, HotelZone][] = [
  [/playa mujeres|costa mujeres|punta sam/, "costa_mujeres"],
  [/puerto morelos/, "puerto_morelos"],
  [/puerto aventuras/, "puerto_aventuras"],
  [/akumal|xpu-?ha|playa paraiso|chemuyil|soliman|maroma|playa del secreto/, "riviera_maya"],
  [/playa del carmen|solidaridad|playacar/, "playa_del_carmen"],
  [/tulum/, "tulum"],
  [/cancun|hotel zone|zona hotelera|puerto juarez|bonfil/, "cancun"],
];

/** Zone for a pickup place from its city, falling back to words in its name. */
export function zoneForPlace(city: string | null, name: string): HotelZone | null {
  for (const text of [city ?? "", name]) {
    const f = fold(text);
    if (!f) continue;
    for (const [re, zone] of CITY_ZONE) if (re.test(f)) return zone;
  }
  return null;
}

let index: { key: string; option: HotelOption }[] | null = null;
let indexedFrom: CatalogProduct[] | null = null;

function buildIndex(products: CatalogProduct[]) {
  if (index && indexedFrom === products) return index;
  const byName = new Map<string, HotelOption>();
  for (const p of products) {
    for (const pp of p.pickupPlaces) {
      const name = pp.title?.trim();
      if (!name || byName.has(fold(name))) continue;
      byName.set(fold(name), { name, city: pp.city || null, zone: zoneForPlace(pp.city, name) });
    }
  }
  index = [...byName.entries()].map(([key, option]) => ({ key, option }));
  indexedFrom = products;
  return index;
}

/** Up to `limit` hotels whose name contains every word of the query (accent-insensitive). */
export function searchHotels(products: CatalogProduct[], query: string, limit = 8): HotelOption[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = buildIndex(products).filter(({ key }) => words.every((w) => key.includes(w)));
  // Known city first, then names that start with the query, then shorter names.
  hits.sort(
    (a, b) =>
      Number(!!b.option.city) - Number(!!a.option.city) ||
      Number(b.key.startsWith(words[0])) - Number(a.key.startsWith(words[0])) ||
      a.key.length - b.key.length,
  );
  return hits.slice(0, limit).map((h) => h.option);
}
