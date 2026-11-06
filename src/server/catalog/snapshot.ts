import type { CatalogScope, CatalogSnapshot } from "./service";
import type { CatalogProduct, PickupPlace } from "./types";

/**
 * Compact on-disk form of a catalog snapshot, used for the copy shipped inside
 * the build (`src/content/catalog-snapshot.json`).
 *
 * A "site" snapshot is ~2.6 MB as written by the sync, and ~80% of that is the
 * same ~1,600 pickup hotels repeated inside every product (there are only a
 * dozen distinct pickup lists). Here each place is stored once, each distinct
 * list once, and products point at a list by index: ~0.6 MB for the same data.
 * `expandSnapshot` restores the exact `CatalogSnapshot` shape the app consumes.
 */

export const SNAPSHOT_FORMAT = 1;

export type CompactProduct = Omit<CatalogProduct, "pickupPlaces"> & {
  /** Index into `pickupLists`. */
  pickupList: number;
};

export interface CompactCatalogSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  fetchedAt: string;
  source: "bokun";
  scope: CatalogScope;
  errors: CatalogSnapshot["errors"];
  /** Every distinct pickup place, once. */
  pickupPlaces: PickupPlace[];
  /** Every distinct pickup list as place ids, in Bokun order. */
  pickupLists: number[][];
  products: CompactProduct[];
}

export function compactSnapshot(snapshot: CatalogSnapshot): CompactCatalogSnapshot {
  const places = new Map<number, PickupPlace>();
  const lists: number[][] = [];
  const listIndex = new Map<string, number>();

  const products = snapshot.products.map(({ pickupPlaces, ...rest }) => {
    const ids = pickupPlaces.map((p) => p.id);
    for (const place of pickupPlaces) if (!places.has(place.id)) places.set(place.id, place);
    const key = ids.join(",");
    let index = listIndex.get(key);
    if (index === undefined) {
      index = lists.push(ids) - 1;
      listIndex.set(key, index);
    }
    return { ...rest, pickupList: index };
  });

  return {
    format: SNAPSHOT_FORMAT,
    fetchedAt: snapshot.fetchedAt,
    source: snapshot.source,
    scope: snapshot.scope,
    errors: snapshot.errors,
    pickupPlaces: [...places.values()],
    pickupLists: lists,
    products,
  };
}

export function expandSnapshot(compact: CompactCatalogSnapshot): CatalogSnapshot {
  if (compact.format !== SNAPSHOT_FORMAT) {
    throw new Error(`Unsupported catalog snapshot format ${String(compact.format)}`);
  }
  const places = new Map(compact.pickupPlaces.map((p) => [p.id, p]));
  const lists = compact.pickupLists.map((ids) =>
    ids.map((id) => places.get(id)).filter((p): p is PickupPlace => !!p),
  );
  const products: CatalogProduct[] = compact.products.map(({ pickupList, ...rest }) => ({
    ...rest,
    pickupPlaces: lists[pickupList] ?? [],
  }));
  return {
    fetchedAt: compact.fetchedAt,
    source: compact.source,
    scope: compact.scope,
    products,
    errors: compact.errors,
  };
}
