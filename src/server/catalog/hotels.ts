import type { HotelZone } from "@/lib/trip-schema";
import hotelsJson from "@/content/hotels.json";

/**
 * Hotel search over WhatToDo's own pickup list (~1,400 hotels), shipped as a static
 * JSON (`src/content/hotels.json`, built by `scripts/build-hotels.mjs`) so a search
 * never waits for the Bokun catalog — on Vercel a cold start used to sync the whole
 * catalog before answering the first keystroke.
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

type Entry = { key: string; option: HotelOption };
let index: Entry[] | null = null;

/** Builds the index once per process from the static list (or a custom list, for tests). */
export function hotelIndex(list: { name: string; city: string | null }[] = hotelsJson): Entry[] {
  if (list === hotelsJson && index) return index;
  const byName = new Map<string, HotelOption>();
  for (const h of list) {
    const name = h.name.trim();
    if (!name || byName.has(fold(name))) continue;
    byName.set(fold(name), { name, city: h.city || null, zone: zoneForPlace(h.city, name) });
  }
  const built = [...byName.entries()].map(([key, option]) => ({ key, option }));
  if (list === hotelsJson) index = built;
  return built;
}

/** Up to `limit` hotels whose name contains every word of the query (accent-insensitive). */
export function searchHotels(
  query: string,
  opts: { limit?: number; list?: { name: string; city: string | null }[] } = {},
): HotelOption[] {
  const limit = opts.limit ?? 8;
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = hotelIndex(opts.list).filter(({ key }) => words.every((w) => key.includes(w)));
  // Known city first, then names that start with the query, then shorter names.
  hits.sort(
    (a, b) =>
      Number(!!b.option.city) - Number(!!a.option.city) ||
      Number(b.key.startsWith(words[0])) - Number(a.key.startsWith(words[0])) ||
      a.key.length - b.key.length,
  );
  return hits.slice(0, limit).map((h) => h.option);
}
