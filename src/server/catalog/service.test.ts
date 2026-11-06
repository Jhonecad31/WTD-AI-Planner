import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogSnapshot } from "./service";

/**
 * Cold-start behaviour: with no memory and an empty cache directory (what every
 * new Vercel instance looks like) the catalog must come from the snapshot in
 * the build, never from Bokun.
 */

const bokun = vi.hoisted(() => ({
  getActiveActivityIds: vi.fn(async () => {
    throw new Error("Bokun must not be called on a cold start");
  }),
  getActivity: vi.fn(),
  getPickupPlaces: vi.fn(),
}));
vi.mock("@/server/bokun/api", () => bokun);

let cacheDir: string;

async function loadService() {
  vi.resetModules();
  process.env.CATALOG_CACHE_DIR = cacheDir;
  return import("./service");
}

async function writeCacheFile(fetchedAt: string, bokunId: number) {
  const { bundledSnapshot } = await loadService();
  const base = bundledSnapshot()!;
  const snapshot: CatalogSnapshot = {
    ...base,
    fetchedAt,
    products: [{ ...base.products[0], bokunId, title: `cache ${bokunId}` }],
  };
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, "catalog.json"), JSON.stringify(snapshot));
}

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), "wtd-catalog-test-"));
  bokun.getActiveActivityIds.mockClear();
});
afterEach(() => {
  delete process.env.CATALOG_CACHE_DIR;
});

describe("getCatalog on a cold start", () => {
  it("serves the bundled snapshot without touching Bokun", async () => {
    const { getCatalog, getPlannerProducts, bundledSnapshot } = await loadService();
    const snapshot = await getCatalog();
    expect(snapshot).toBe(bundledSnapshot());
    expect(snapshot.scope).toBe("site");
    expect(snapshot.products.length).toBeGreaterThan(50);
    expect(snapshot.products.every((p) => p.onSite)).toBe(true);
    // Pickup places are expanded back into every product (hotel search needs them).
    expect(snapshot.products.some((p) => p.pickupPlaces.length > 100)).toBe(true);

    const planner = await getPlannerProducts();
    expect(planner.length).toBeGreaterThan(50);
    expect(bokun.getActiveActivityIds).not.toHaveBeenCalled();
  });

  it("prefers a fresher disk cache over the bundled snapshot", async () => {
    await writeCacheFile(new Date().toISOString(), 1);
    const { getCatalog } = await loadService();
    const snapshot = await getCatalog();
    expect(snapshot.products.map((p) => p.bokunId)).toEqual([1]);
    expect(bokun.getActiveActivityIds).not.toHaveBeenCalled();
  });

  it("prefers the bundled snapshot over an older disk cache", async () => {
    await writeCacheFile("2020-01-01T00:00:00.000Z", 1);
    const { getCatalog, bundledSnapshot } = await loadService();
    expect(await getCatalog()).toBe(bundledSnapshot());
    expect(bokun.getActiveActivityIds).not.toHaveBeenCalled();
  });

  it("still goes to Bokun for a scope nothing covers, or on forceRefresh", async () => {
    const { getCatalog } = await loadService();
    await expect(getCatalog({ scope: "all" })).rejects.toThrow(/Bokun must not be called/);
    await expect(getCatalog({ forceRefresh: true })).rejects.toThrow(/Bokun must not be called/);
    expect(bokun.getActiveActivityIds).toHaveBeenCalledTimes(2);
  });
});
