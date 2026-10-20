import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/config/env";
import { TRIPADVISOR_LOCATIONS } from "@/content/tripadvisor";
import type { Itinerary, TripAdvisorRating } from "@/lib/itinerary-schema";

/**
 * Tripadvisor Content API ratings. Dormant until TRIPADVISOR_API_KEY is set and
 * products are mapped in src/content/tripadvisor.ts. Never throws and never
 * blocks an itinerary: missing data simply isn't shown.
 */

const API = "https://api.content.tripadvisor.com/api/v1/location";
const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 3000;
const CACHE_DIR =
  process.env.CATALOG_CACHE_DIR ??
  (process.env.VERCEL ? "/tmp/wtd-cache" : path.join(process.cwd(), ".cache"));
const CACHE_FILE = path.join(CACHE_DIR, "tripadvisor.json");

type Entry = { at: number; rating: TripAdvisorRating | null };
let memory: Record<string, Entry> | null = null;

async function load(): Promise<Record<string, Entry>> {
  if (memory) return memory;
  try {
    memory = JSON.parse(await readFile(CACHE_FILE, "utf8")) as Record<string, Entry>;
  } catch {
    memory = {};
  }
  return memory;
}

async function save() {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(memory ?? {}), "utf8");
  } catch {
    /* read-only disk: keep the in-memory cache */
  }
}

export function tripadvisorEnabled(): boolean {
  return env().TRIPADVISOR_API_KEY.length > 0 && Object.keys(TRIPADVISOR_LOCATIONS).length > 0;
}

export async function fetchLocation(
  locationId: string,
  deps: { fetchImpl?: typeof fetch; key?: string; referer?: string } = {},
): Promise<TripAdvisorRating | null> {
  const key = deps.key ?? env().TRIPADVISOR_API_KEY;
  if (!key) return null;
  try {
    const res = await (deps.fetchImpl ?? fetch)(
      `${API}/${encodeURIComponent(locationId)}/details?key=${encodeURIComponent(key)}&language=en&currency=USD`,
      {
        headers: { accept: "application/json", referer: deps.referer ?? env().NEXT_PUBLIC_APP_URL },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      rating?: string;
      num_reviews?: string;
      web_url?: string;
      rating_image_url?: string;
    };
    const rating = Number(d.rating);
    const reviews = Number(d.num_reviews);
    if (!Number.isFinite(rating) || !d.web_url) return null;
    return {
      rating,
      reviews: Number.isFinite(reviews) ? reviews : 0,
      url: d.web_url,
      ...(d.rating_image_url ? { imageUrl: d.rating_image_url } : {}),
    };
  } catch {
    return null;
  }
}

/** Ratings for the given Bokun ids (cached 24 h). Unmapped ids are skipped. */
export async function getRatings(
  bokunIds: number[],
  opts: { force?: boolean } = {},
): Promise<Record<number, TripAdvisorRating>> {
  if (!tripadvisorEnabled()) return {};
  const cache = await load();
  const out: Record<number, TripAdvisorRating> = {};
  let dirty = false;
  await Promise.all(
    [...new Set(bokunIds)].map(async (id) => {
      const loc = TRIPADVISOR_LOCATIONS[id];
      if (!loc) return;
      const hit = cache[loc];
      if (!opts.force && hit && Date.now() - hit.at < TTL_MS) {
        if (hit.rating) out[id] = hit.rating;
        return;
      }
      const rating = await fetchLocation(loc);
      cache[loc] = { at: Date.now(), rating };
      dirty = true;
      if (rating) out[id] = rating;
    }),
  );
  if (dirty) await save();
  return out;
}

/** Refreshes every mapped listing (called by the daily cron). */
export async function refreshAllRatings(): Promise<number> {
  const ratings = await getRatings(Object.keys(TRIPADVISOR_LOCATIONS).map(Number), { force: true });
  return Object.keys(ratings).length;
}

/** Adds Tripadvisor ratings to tours and restaurants that have one. */
export async function withTripAdvisor(itinerary: Itinerary): Promise<Itinerary> {
  if (!tripadvisorEnabled()) return itinerary;
  const ids = itinerary.days.flatMap((d) =>
    d.items
      .filter((i) => (i.kind === "tour" || i.kind === "restaurant") && i.bokunId)
      .map((i) => i.bokunId!),
  );
  const ratings = await getRatings(ids);
  return {
    ...itinerary,
    days: itinerary.days.map((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.bokunId && ratings[i.bokunId] ? { ...i, tripadvisor: ratings[i.bokunId] } : i,
      ),
    })),
  };
}
