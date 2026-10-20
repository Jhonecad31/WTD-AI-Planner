import type { BokunActivity, BokunPhoto, BokunPickupPlace } from "@/server/bokun/types";
import type { CatalogProduct, Interest, PickupPlace, ProductKind } from "./types";
import siteLinks from "@/content/site-links.json";

const SITE_URL = "https://whattodoincancun.com";
const EXTRANET_URL = "https://extranet.bokun.io";

/** bokunId -> public page, built by `node scripts/build-site-links.mjs`. */
const SITE_LINKS = siteLinks as Record<string, { url: string; title: string }>;

export function siteUrlFor(bokunId: number, slug?: string | null): string | null {
  const known = SITE_LINKS[String(bokunId)]?.url;
  if (known) return known;
  return slug ? `${SITE_URL}/tour/${slug}/` : null;
}

/**
 * Maps Bokun's own activity categories + free text to the planner interests.
 * Order matters only for readability; a product can carry several interests.
 */
const CATEGORY_TO_INTEREST: Record<string, Interest[]> = {
  ADVENTURE: ["adventure"],
  ADRENALINE_AND_EXTREME: ["adventure"],
  ATV_OR_QUAD_TOUR: ["adventure"],
  JET_SKI_TOUR: ["adventure", "water"],
  PARAGLIDING: ["adventure"],
  CLIMBING: ["adventure"],
  CAVING: ["adventure"],
  HIKING: ["adventure"],
  HORSEBACK_RIDING: ["adventure"],
  OBSTACLE_COURSES: ["adventure"],
  THEME_PARKS: ["adventure"],
  AMUSEMENT_PARK: ["adventure"],
  WATER: ["water"],
  SNORKELING: ["water"],
  DIVING: ["water"],
  KAYAKING: ["water"],
  SAILING_OR_BOAT_TOUR: ["water", "couples"],
  MINI_CRUISE: ["water", "couples"],
  SUN_AND_BEACH: ["water", "chill"],
  DOLPHIN_OR_WHALEWATCHING: ["water"],
  FISHING: ["water"],
  SEA_ANGLING: ["water"],
  SURFING: ["water"],
  CULTURAL_AND_THEME_TOURS: ["cultural"],
  ARTS_AND_CULTURE: ["cultural"],
  MUSEUMS_AND_EXHIBITIONS: ["cultural"],
  SIGHTSEEING: ["cultural"],
  SIGHTSEEING_ATTRACTION: ["cultural"],
  CITY_TOURS: ["cultural"],
  WALKING_TOUR: ["cultural"],
  DAY_TRIPS_AND_EXCURSIONS: ["cultural"],
  PILGRIMAGE_OR_RELIGION: ["cultural"],
  EDUCATIONAL_TOUR: ["cultural"],
  CULINARY: ["food"],
  CLASSES_AND_WORKSHOPS: ["food", "cultural"],
  NIGHTLIFE: ["party"],
  SHOWS_AND_MUSICALS: ["party"],
  FESTIVAL: ["party"],
  LUXURY_AND_SPECIAL_OCCASIONS: ["couples"],
  WEDDING_AND_HONEYMOON: ["couples"],
  VIP_AND_EXCLUSIVE: ["couples"],
  SPA_AND_WELLNESS: ["chill", "couples"],
  PHOTOGRAPHY: ["couples", "cultural"],
};

/** Grupo Xcaret parks: Xcaret, Xel-Há, Xplor, Xoximilco, Xenses, Xavage, Xichén… */
export const XCARET_PARK_RE =
  /\bx(caret|el.?h[aá]|elha|plor|oximilco|enses|avage|ich[eé]n|enotes)(?![a-z])|grupo xcaret/i;

const KEYWORD_RULES: { re: RegExp; interests: Interest[] }[] = [
  {
    re: /\b(atv|zip ?line|tirolesa|buggy|jungle|xplor|selvatica|adrenal)/i,
    interests: ["adventure"],
  },
  {
    re: /\b(cenote|snorkel|dive|scuba|catamaran|reef|turtle|whale shark|isla mujeres|cozumel|contoy|holbox|beach)/i,
    interests: ["water"],
  },
  {
    re: /\b(chich[eé]n|itz[aá]|tulum|cob[aá]|ek balam|ruins|ruinas|maya|mayan|museum|colonial|valladolid|xcaret)/i,
    interests: ["cultural"],
  },
  {
    re: /\b(food|gastro|tasting|taco|mezcal|tequila|cooking|dinner|wine|culinary)/i,
    interests: ["food"],
  },
  {
    re: /\b(coco bongo|party|nightclub|open bar|boat party|mandala|xoximilco|fiesta)/i,
    interests: ["party"],
  },
  {
    re: /\b(romantic|couple|honeymoon|sunset|private dinner|luxury|yacht)/i,
    interests: ["couples"],
  },
  { re: /\b(spa|temazcal|relax|wellness|massage|yoga|beach club)/i, interests: ["chill"] },
  { re: /\b(beach|playa)\b/i, interests: ["beach"] },
  // Grupo Xcaret theme parks.
  { re: XCARET_PARK_RE, interests: ["parks"] },
  { re: /\b(shopping|mall|market|mercado|outlet)\b/i, interests: ["shopping"] },
];

const TRANSFER_RE = /\b(transfer|transportation|shuttle|traslado|transporte)\b/i;
// Tours that merely *include* transportation ("… with Transportation", "Optional Transportation").
const NOT_TRANSFER_RE =
  /\b(tour|admission|ticket|tickets|cruise|snorkel|experience|show|party|lounge|with|optional|dinner|swim|dolphin|whale|&)\b/i;

/** Restaurant pages live under /restaurant/ on the site; Bokun calls them tours. */
export function isRestaurantUrl(url: string | null | undefined): boolean {
  return !!url && url.includes("/restaurant/");
}

export function detectKind(a: BokunActivity): ProductKind {
  if (a.productCategory === "TRANSPORT" || a.activityType === "TRANSPORT") return "transfer";
  const cats = a.activityCategories ?? [];
  if (cats.includes("TRANSFERS_AND_GROUND_TRANSPORT")) return "transfer";
  const title = a.title ?? "";
  if (TRANSFER_RE.test(title) && !NOT_TRANSFER_RE.test(title)) return "transfer";
  if (
    a.activityType === "ATTRACTION" ||
    cats.includes("SKIP_THE_LINE") ||
    cats.includes("TOURIST_PASS")
  ) {
    return "ticket";
  }
  if (
    a.activityType === "DAY_TOUR_OR_ACTIVITY" ||
    a.activityType === "MULTI_DAY_TOUR" ||
    a.activityType === "EVENT"
  ) {
    return "tour";
  }
  return "other";
}

export function detectInterests(a: BokunActivity): Interest[] {
  const set = new Set<Interest>();
  for (const c of a.activityCategories ?? []) {
    for (const i of CATEGORY_TO_INTEREST[c] ?? []) set.add(i);
  }
  if (detectKind(a) === "transfer") return [];
  const text = [a.title, a.excerpt, ...(a.keywords ?? [])].filter(Boolean).join(" ");
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) rule.interests.forEach((i) => set.add(i));
  }
  return [...set];
}

export function durationToMinutes(a: BokunActivity): number | null {
  if (a.durationMinutes || a.durationHours || a.durationDays) {
    return (a.durationDays ?? 0) * 24 * 60 + (a.durationHours ?? 0) * 60 + (a.durationMinutes ?? 0);
  }
  if (typeof a.duration === "number" && a.durationType) {
    const mult = a.durationType === "DAYS" ? 24 * 60 : a.durationType === "HOURS" ? 60 : 1;
    return a.duration * mult;
  }
  return null;
}

export function pickImage(p?: BokunPhoto, preferred = "large"): string | null {
  if (!p) return null;
  const derived = p.derived?.find((d) => d.name === preferred) ?? p.derived?.[0];
  return derived?.url ?? p.originalUrl ?? null;
}

function toPickupPlace(p: BokunPickupPlace): PickupPlace | null {
  if (typeof p.id !== "number") return null;
  return { id: p.id, title: p.title ?? "", city: p.location?.city ?? null };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Converts a Bokun ActivityDto (+ optional pickup places) to the planner model. */
export function normalizeActivity(
  a: BokunActivity,
  extras: { pickupPlaces?: BokunPickupPlace[]; currency?: string } = {},
): CatalogProduct {
  const start = a.startPoints?.[0]?.location ?? a.location ?? null;
  const price =
    typeof a.nextDefaultPrice === "number" && a.nextDefaultPrice > 0 ? a.nextDefaultPrice : null;

  return {
    bokunId: a.id,
    title: (a.title ?? "").trim(),
    slug: a.slug ?? null,
    siteUrl: siteUrlFor(a.id, a.slug),
    onSite: Boolean(SITE_LINKS[String(a.id)]),
    extranetUrl: `${EXTRANET_URL}/experience/${a.id}`,
    kind: isRestaurantUrl(siteUrlFor(a.id, a.slug)) ? "restaurant" : detectKind(a),
    excerpt: (a.excerpt ?? "").trim(),
    description: (a.description ?? "").trim(),
    interests: detectInterests(a),
    bokunCategories: a.activityCategories ?? [],
    keywords: a.keywords ?? [],
    durationMinutes: durationToMinutes(a),
    durationText: a.durationText ?? null,
    isMultiDay: a.activityType === "MULTI_DAY_TOUR" || (a.durationDays ?? 0) > 1,
    priceFromUsd: price,
    currency: extras.currency ?? "USD",
    pricingCategories: (a.pricingCategories ?? [])
      .filter((c) => typeof c.id === "number" && !c.internalUseOnly)
      .map((c) => ({
        id: c.id as number,
        title: c.title ?? c.fullTitle ?? "",
        ticketCategory: c.ticketCategory ?? "OTHER",
        minAge: c.ageQualified ? (c.minAge ?? null) : null,
        maxAge: c.ageQualified ? (c.maxAge ?? null) : null,
        isDefault: c.defaultCategory ?? false,
      })),
    startTimes: (a.startTimes ?? [])
      .filter((s) => typeof s.id === "number")
      .map((s) => ({
        id: s.id as number,
        time: `${pad(s.hour ?? 0)}:${pad(s.minute ?? 0)}`,
        label: s.label ?? `${pad(s.hour ?? 0)}:${pad(s.minute ?? 0)}`,
      }))
      .sort((x, y) => x.time.localeCompare(y.time))
      // Bokun returns one entry per rate; keep the first per clock time.
      .filter((s, i, arr) => arr.findIndex((o) => o.time === s.time) === i),
    bookingType: a.bookingType ?? null,
    pickupService: a.pickupService ?? false,
    pickupMinutesBefore: a.pickupMinutesBefore ?? null,
    pickupPlaces: (extras.pickupPlaces ?? [])
      .map(toPickupPlace)
      .filter((p): p is PickupPlace => !!p),
    imageUrl: pickImage(a.keyPhoto) ?? pickImage(a.photos?.[0]),
    imageUrls: (a.photos ?? [])
      .map((p) => pickImage(p))
      .filter((u): u is string => !!u)
      .slice(0, 8),
    rating: a.reviewRating ?? null,
    reviewCount: a.reviewCount ?? 0,
    minAge: a.minAge ?? null,
    difficulty: a.difficultyLevel ?? null,
    included: a.included || null,
    excluded: a.excluded || null,
    knowBeforeYouGo: a.knowBeforeYouGoItems ?? [],
    startLocation: start
      ? { city: start.city ?? null, lat: start.latitude ?? null, lng: start.longitude ?? null }
      : null,
    bookingCutoffHours:
      a.bookingCutoffHours ?? (a.bookingCutoffDays ? a.bookingCutoffDays * 24 : null),
    published: a.published ?? true,
    lastModified: a.lastModified ?? null,
  };
}
