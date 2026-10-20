/**
 * Planner-side catalog model. This is what the AI, the UI, the PDF and the
 * agent email consume. It is derived from Bokun and cached in the database.
 */

export const INTERESTS = [
  "adventure",
  "cultural",
  "food",
  "water",
  "beach",
  "shopping",
  "parks",
  "party",
  "couples",
  "chill",
] as const;
export type Interest = (typeof INTERESTS)[number];

export type ProductKind = "tour" | "transfer" | "ticket" | "restaurant" | "other";

export interface PricingCategory {
  /** Bokun pricingCategoryId — the agent needs this when booking manually. */
  id: number;
  title: string;
  ticketCategory: string; // ADULT, CHILD, INFANT, ...
  minAge: number | null;
  maxAge: number | null;
  isDefault: boolean;
}

export interface StartTime {
  id: number;
  /** "HH:mm" */
  time: string;
  label: string;
}

export interface PickupPlace {
  id: number;
  title: string;
  city: string | null;
}

export interface CatalogProduct {
  bokunId: number;
  title: string;
  slug: string | null;
  /** Best-effort public URL on whattodoincancun.com */
  siteUrl: string | null;
  /** True when the product has its own page on whattodoincancun.com (preferred by the AI). */
  onSite: boolean;
  /** Deep link for the sales agent */
  extranetUrl: string;
  kind: ProductKind;
  excerpt: string;
  description: string;
  interests: Interest[];
  bokunCategories: string[];
  keywords: string[];
  durationMinutes: number | null;
  durationText: string | null;
  isMultiDay: boolean;
  priceFromUsd: number | null;
  currency: string;
  pricingCategories: PricingCategory[];
  startTimes: StartTime[];
  bookingType: "PASS" | "DATE" | "DATE_AND_TIME" | null;
  pickupService: boolean;
  pickupMinutesBefore: number | null;
  pickupPlaces: PickupPlace[];
  imageUrl: string | null;
  imageUrls: string[];
  rating: number | null;
  reviewCount: number;
  minAge: number | null;
  difficulty: string | null;
  included: string | null;
  excluded: string | null;
  knowBeforeYouGo: string[];
  startLocation: { city: string | null; lat: number | null; lng: number | null } | null;
  bookingCutoffHours: number | null;
  published: boolean;
  lastModified: string | null;
}
