import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getActiveActivityIds, getActivity, getPickupPlaces } from "@/server/bokun/api";
import { env } from "@/server/config/env";
import { interestsFor, isRestaurantUrl, normalizeActivity } from "./normalize";
import type { CatalogProduct } from "./types";
import siteLinks from "@/content/site-links.json";
import bundledSnapshotJson from "@/content/catalog-snapshot.json";
import { EXCLUDED_BOKUN_IDS } from "@/content/excluded-products";
import { expandSnapshot, type CompactCatalogSnapshot } from "./snapshot";

/**
 * Catalog loader. Three layers, freshest wins:
 *   1. process memory;
 *   2. a JSON cache on disk (`.cache/catalog.json`, `/tmp/wtd-cache` on Vercel),
 *      written by every sync (daily cron, /dev/catalog?refresh=1);
 *   3. the "site" snapshot shipped inside the build (`src/content/catalog-snapshot.json`,
 *      regenerated with `npm run catalog:snapshot`).
 * Bokun is only hit when none of them covers the requested scope: on Vercel each
 * new instance starts with 1 and 2 empty, and a full sync is hundreds of requests
 * (400 req/min limit), so no request ever waits for one.
 */

// On Vercel the project directory is read-only; /tmp is the only writable disk.
/*const CACHE_DIR =
  process.env.CATALOG_CACHE_DIR ??
  (process.env.VERCEL ? "/tmp/wtd-cache" : path.join(process.cwd(), ".cache"));*/
/*Actualizacion de envio para elinar en ENV*/
const CACHE_DIR =
  process.env.CATALOG_CACHE_DIR?.trim() ||
  (process.env.VERCEL ? "/tmp/wtd-cache" : path.join(process.cwd(), ".cache"));
const CACHE_FILE = path.join(CACHE_DIR, "catalog.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 6;

/** "site" = only products sold on whattodoincancun.com (what the planner needs); "all" = whole Bokun account. */
export type CatalogScope = "site" | "all";

export interface CatalogSnapshot {
  fetchedAt: string;
  source: "bokun";
  scope: CatalogScope;
  products: CatalogProduct[];
  errors: { bokunId: number; message: string }[];
}

const SITE_IDS = new Set(Object.keys(siteLinks as Record<string, unknown>).map(Number));

let memory: CatalogSnapshot | null = null;
let bundled: CatalogSnapshot | null | undefined;

/** The snapshot compiled into the build, or null when it is unusable. */
export function bundledSnapshot(): CatalogSnapshot | null {
  if (bundled !== undefined) return bundled;
  try {
    const snapshot = expandSnapshot(bundledSnapshotJson as unknown as CompactCatalogSnapshot);
    bundled = snapshot.products.length ? snapshot : null;
  } catch (e) {
    console.warn("[catalog] bundled snapshot unusable:", e instanceof Error ? e.message : e);
    bundled = null;
  }
  return bundled;
}

async function readCache(): Promise<CatalogSnapshot | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as CatalogSnapshot;
  } catch {
    return null;
  }
}

async function writeCache(snapshot: CatalogSnapshot) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(snapshot), "utf8");
  } catch (e) {
    // Memory still holds the snapshot; a read-only disk must not break the request.
    console.warn("[catalog] could not persist cache:", e instanceof Error ? e.message : e);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Fetches every active product from Bokun and normalizes it. Read-only. */
export async function syncCatalogFromBokun(
  opts: { limit?: number; scope?: CatalogScope } = {},
): Promise<CatalogSnapshot> {
  const scope = opts.scope ?? "site";
  const active = await getActiveActivityIds();
  // Site products first: they are what the planner recommends and what we must have fast.
  const ordered = [
    ...active.filter((id) => SITE_IDS.has(id)),
    ...(scope === "all" ? active.filter((id) => !SITE_IDS.has(id)) : []),
  ];
  const selected = opts.limit ? ordered.slice(0, opts.limit) : ordered;
  const errors: CatalogSnapshot["errors"] = [];
  const currency = env().BOKUN_CURRENCY;

  const products = await mapWithConcurrency(selected, CONCURRENCY, async (id) => {
    try {
      const activity = await getActivity(id);
      let pickupPlaces: Awaited<ReturnType<typeof getPickupPlaces>>["pickupPlaces"] = [];
      if (activity.pickupService) {
        try {
          pickupPlaces = (await getPickupPlaces(id)).pickupPlaces ?? [];
        } catch {
          pickupPlaces = [];
        }
      }
      return normalizeActivity(activity, { pickupPlaces, currency });
    } catch (e) {
      errors.push({ bokunId: id, message: e instanceof Error ? e.message : String(e) });
      return null;
    }
  });

  const snapshot: CatalogSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "bokun",
    scope,
    // `published` in Bokun means "listed on the marketplace", not "sellable";
    // active-ids already returns only bookable products, so keep them all.
    products: products.filter((p): p is CatalogProduct => !!p),
    errors,
  };
  memory = snapshot;
  await writeCache(snapshot);
  return snapshot;
}

/**
 * Returns the freshest catalog available without calling Bokun (memory, disk
 * cache or the snapshot in the build); syncs from Bokun only when none covers
 * `scope` or on `forceRefresh`. A snapshot older than a day is still served,
 * with a warning: refreshing is the cron's job, never a visitor's request.
 */
export async function getCatalog(
  opts: { forceRefresh?: boolean; scope?: CatalogScope } = {},
): Promise<CatalogSnapshot> {
  const scope = opts.scope ?? "site";
  const covers = (s: CatalogSnapshot) => s.scope === "all" || s.scope === scope;
  if (!opts.forceRefresh) {
    if (memory && covers(memory)) return memory;
    const candidates = [await readCache(), bundledSnapshot()].filter(
      (s): s is CatalogSnapshot => !!s && covers(s) && Number.isFinite(Date.parse(s.fetchedAt)),
    );
    const freshest = candidates.sort(
      (a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt),
    )[0];
    if (freshest) {
      if (Date.now() - Date.parse(freshest.fetchedAt) > CACHE_TTL_MS) {
        console.warn(
          `[catalog] serving a catalog fetched ${freshest.fetchedAt}; the daily cron or ` +
            "`npm run catalog:snapshot` refreshes it",
        );
      }
      memory = freshest;
      return freshest;
    }
  }
  return syncCatalogFromBokun({ scope });
}

export function hasBokunCredentials(): boolean {
  const e = env();
  return Boolean(e.BOKUN_ACCESS_KEY && e.BOKUN_SECRET_KEY);
}

/**
 * What the planner (AI, wizard, emails) is allowed to recommend.
 * Decision (Oct 2026): only products that have a page on whattodoincancun.com,
 * minus the ones in `EXCLUDED_BOKUN_IDS`.
 * The rest of the Bokun marketplace stays visible in /dev/catalog only.
 */
export async function getPlannerProducts(): Promise<CatalogProduct[]> {
  const { products } = await getCatalog();
  // Caches written before restaurants had their own kind still say "tour".
  return (
    products
      .filter((p) => p.onSite && !EXCLUDED_BOKUN_IDS.has(p.bokunId))
      .map((p) =>
        p.kind !== "restaurant" && isRestaurantUrl(p.siteUrl)
          ? { ...p, kind: "restaurant" as const }
          : p,
      )
      // Interests are re-tagged on load, so a cache written by an older tagger
      // (looser keywords, no "parks", no main interest) plans like a fresh sync.
      .map((p) => ({ ...p, interests: interestsFor(p) }))
  );
}

/** A wide, scenic photo for hero backgrounds. */
export async function getHeroImage(): Promise<string | null> {
  const products = await getPlannerProducts();
  const pick =
    products.find(
      (p) => p.imageUrl && /isla mujeres.*catamaran|catamaran.*isla mujeres/i.test(p.title),
    ) ?? products.find((p) => p.imageUrl && /cenote|tulum|chichen/i.test(p.title));
  return pick?.imageUrl ?? null;
}
