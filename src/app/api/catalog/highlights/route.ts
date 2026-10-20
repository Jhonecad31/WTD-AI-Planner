import { getPlannerProducts } from "@/server/catalog/service";
import { INTERESTS, type CatalogProduct } from "@/server/catalog/types";
import { INTEREST_PHOTOS } from "@/content/interest-photos";
import { HOTEL_ZONES } from "@/lib/trip-schema";

export const instant = false;
export const maxDuration = 60;

/**
 * Lightweight visuals for the wizard: one real photo per interest and per hotel zone,
 * plus "from" prices for airport transfers by zone. Read from the cached catalog.
 */

/** Photo picks per zone (transfer matching uses the same words). */
const ZONE_WORDS: Record<string, RegExp> = {
  cancun: /hotel zone|downtown/i,
  costa_mujeres: /costa mujeres|playa mujeres/i,
  puerto_morelos: /puerto morelos/i,
  playa_del_carmen: /playa del carmen/i,
  riviera_maya: /akumal|playa para[ií]so|riviera/i,
  puerto_aventuras: /puerto aventuras|aventuras/i,
  tulum: /tulum/i,
};
/** Scenic tours to illustrate zones that have no tour named after them. */
const ZONE_PHOTO_FALLBACK: Record<string, RegExp> = {
  cancun: /catamaran|isla mujeres|nichupte|lagoon/i,
  costa_mujeres: /whale shark|contoy|catamaran/i,
  riviera_maya: /akumal|turtle|cenote/i,
  puerto_aventuras: /akumal|turtle/i,
};
// Posters and tickets (no landscape) make poor zone photos.
const BAD_PHOTO = /colores|ticket|admission|lounge|show/i;
/** Preferred subjects per interest so the photo reads as that interest at a glance. */
const INTEREST_PHOTO: Record<string, RegExp> = {
  adventure: /atv|zip|jungle/i,
  cultural: /chichen|tulum|coba|ruins|valladolid/i,
  food: /taco|food|culinary|cooking|gastro|street food|tequila tasting/i,
  water: /snorkel|catamaran|reef|whale/i,
  party: /xoximilco|coco bongo|party/i,
  couples: /romantic|sunset|dinner cruise/i,
  chill: /xelha|spa|temazcal|beach club/i,
  beach: /beach club|beachside|beach taco|playa/i,
  shopping: /town tour|downtown|5th av|quinta|market|mercado|shopping/i,
};

/**
 * Hand-picked interest photos (WhatToDo's own Bokun images), chosen with the team so
 * cards don't change when reviews or the catalog change. Automatic picks below are
 * only a fallback for a new interest without a fixed photo.
 */

// Known marketing posters uploaded as a product's key photo (checked by image id).
const BAD_IMAGE_IDS = ["76ea6cf9-0bfe-4aa2-b3ed-e786ddaaf3eb"];
const badImage = (url: string | null) => !!url && BAD_IMAGE_IDS.some((id) => url.includes(id));

/** Best-reviewed product in `list` whose photo hasn't been used yet, so cards don't repeat. */
const usedImages = new Set<string>();
function best(list: CatalogProduct[]): CatalogProduct | undefined {
  const sorted = [...list].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  const fresh = sorted.find((p) => p.imageUrl && !usedImages.has(p.imageUrl)) ?? sorted[0];
  if (fresh?.imageUrl) usedImages.add(fresh.imageUrl);
  return fresh;
}

export async function GET() {
  usedImages.clear();
  let products: CatalogProduct[] = [];
  try {
    products = await getPlannerProducts();
  } catch {
    products = [];
  }
  const withImage = products.filter((p) => p.imageUrl && !badImage(p.imageUrl));

  const scenic = withImage.filter((x) => x.kind === "tour" && !BAD_PHOTO.test(x.title));
  // Scarce interests pick first so they don't lose their only photo to a broader card.
  const pickOrder = [...INTERESTS].sort(
    (a, b) => Number(b === "shopping" || b === "beach") - Number(a === "shopping" || a === "beach"),
  );
  const picked = Object.fromEntries(
    pickOrder.map((i) => {
      const pool = scenic.filter((x) => x.interests.includes(i));
      // Beach and shopping have few tagged tours: fall back to any scenic tour whose title fits.
      const p =
        best(pool.filter((x) => INTEREST_PHOTO[i]?.test(x.title))) ??
        best(pool) ??
        best(scenic.filter((x) => INTEREST_PHOTO[i]?.test(x.title)));
      return [i, p ? { image: p.imageUrl, title: p.title } : null];
    }),
  );
  const interests = Object.fromEntries(
    INTERESTS.map((i) => [
      i,
      INTEREST_PHOTOS[i] ? { image: INTEREST_PHOTOS[i], title: i } : picked[i],
    ]),
  );

  const zones = Object.fromEntries(
    HOTEL_ZONES.map((z) => {
      const p =
        best(scenic.filter((x) => ZONE_WORDS[z].test(x.title))) ??
        (ZONE_PHOTO_FALLBACK[z]
          ? best(scenic.filter((x) => ZONE_PHOTO_FALLBACK[z].test(x.title)))
          : undefined);
      return [z, p ? { image: p.imageUrl } : null];
    }),
  );

  const transfers = Object.fromEntries(
    HOTEL_ZONES.map((z) => {
      const list = products.filter(
        (x) => x.kind === "transfer" && /airport/i.test(x.title) && ZONE_WORDS[z].test(x.title),
      );
      const standard = list.filter((x) => !/deluxe|luxury|vip/i.test(x.title));
      const deluxe = list.filter((x) => /deluxe|luxury|vip/i.test(x.title));
      const min = (l: CatalogProduct[]) =>
        l.length ? Math.min(...l.map((x) => x.priceFromUsd ?? Infinity)) : null;
      return [z, { from: min(standard), deluxeFrom: min(deluxe) }];
    }),
  );

  const hero = best(withImage.filter((x) => /isla mujeres|cenote|catamaran/i.test(x.title)));

  return Response.json(
    { interests, zones, transfers, hero: hero?.imageUrl ?? null },
    { headers: { "Cache-Control": "no-cache" } },
  );
}
