// Builds the static hotel list the wizard's hotel field searches: every pickup place
// of the products the planner can recommend (the ones with a page on the site).
// Reads the local catalog cache so the request path never has to touch Bokun.
// Output: src/content/hotels.json  [{ "name", "city" }]
// Run:    node scripts/build-hotels.mjs   (after the catalog was synced to .cache/catalog.json)
import { readFile, writeFile } from "node:fs/promises";

const CACHE = new URL("../.cache/catalog.json", import.meta.url);
const OUT = new URL("../src/content/hotels.json", import.meta.url);

const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

const { products } = JSON.parse(await readFile(CACHE, "utf8"));
const byName = new Map();
for (const p of products) {
  if (!p.onSite) continue;
  for (const pp of p.pickupPlaces ?? []) {
    const name = pp.title?.trim();
    if (!name || byName.has(fold(name))) continue;
    byName.set(fold(name), { name, city: pp.city?.trim() || null });
  }
}
const hotels = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
await writeFile(OUT, JSON.stringify(hotels, null, 2) + "\n");
console.log(`wrote ${hotels.length} hotels to ${OUT.pathname}`);
