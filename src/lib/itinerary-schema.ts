import { z } from "zod";
import { CUISINES, ISO_DATE, HHMM } from "./trip-schema";

/**
 * The itinerary contract shared by the rules engine, the Claude engine, the UI,
 * the PDF and both emails. Every item refers to a real Bokun product by ID.
 */

export const TripAdvisorRatingSchema = z.object({
  rating: z.number().min(0).max(5),
  reviews: z.number().int().nonnegative(),
  url: z.string().url(),
  /** Tripadvisor's own bubble image (their display rules prefer it). */
  imageUrl: z.string().url().optional(),
});
export type TripAdvisorRating = z.infer<typeof TripAdvisorRatingSchema>;

export const ItineraryItemSchema = z.object({
  /**
   * tour / transfer: Bokun products with live prices.
   * restaurant: a Bokun restaurant page, reserved by the specialist; price is an estimate.
   * beach / shopping: free public places from src/content/places.ts.
   * rest: "relax at the hotel". free: chill day placeholder.
   */
  kind: z.enum(["tour", "transfer", "free", "restaurant", "beach", "shopping", "rest"]),
  /** Bokun activity id. Absent for free / beach / shopping / rest blocks. */
  bokunId: z.number().int().positive().optional(),
  title: z.string().min(1).max(160),
  /** "HH:mm" local. */
  startTime: z.string().regex(HHMM).optional(),
  /** Bokun startTimeId when the product has fixed departures. */
  startTimeId: z.number().int().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  /** Price for the whole party in USD (tours + transfers). 0 for free blocks. */
  priceTotalUsd: z.number().nonnegative(),
  /** Price breakdown by Bokun pricing category: id -> { title, count, unitUsd } */
  pricing: z
    .array(
      z.object({
        pricingCategoryId: z.number().int(),
        title: z.string(),
        count: z.number().int().positive(),
        unitUsd: z.number().nonnegative(),
      }),
    )
    .default([]),
  pickup: z.boolean().default(false),
  /** One or two sentences, in the traveler's language, why this fits them. */
  note: z.string().max(400).optional(),
  imageUrl: z.string().url().optional(),
  siteUrl: z.string().url().optional(),
  /** Restaurants: cuisines, price level 1–4 and estimated cost per person (not charged). */
  cuisines: z.array(z.enum(CUISINES)).optional(),
  priceLevel: z.number().int().min(1).max(4).optional(),
  priceEstimatePpUsd: z.number().nonnegative().optional(),
  /** Beach / shopping: place id and a maps link. */
  placeId: z.string().max(80).optional(),
  mapsUrl: z.string().url().optional(),
  /** Filled when TRIPADVISOR_API_KEY is set and the product is mapped. */
  tripadvisor: TripAdvisorRatingSchema.optional(),
});
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

/**
 * Weather for one trip day. `forecast` comes from Open-Meteo (next ~16 days);
 * `typical` is the monthly climate average and is never presented as a forecast.
 */
export const DayWeatherSchema = z.object({
  source: z.enum(["forecast", "typical"]),
  kind: z.enum(["good", "rainy", "windy"]),
  tMaxC: z.number(),
  tMinC: z.number(),
  /** 0–100. Forecast: max precipitation probability. Typical: share of rainy days. */
  rainChance: z.number().min(0).max(100).optional(),
  windKmh: z.number().nonnegative().optional(),
  /** WMO weather code (forecast only). */
  code: z.number().int().optional(),
});
export type DayWeather = z.infer<typeof DayWeatherSchema>;

export const ItineraryDaySchema = z.object({
  date: z.string().regex(ISO_DATE),
  /** 1-based day number of the trip. */
  dayNumber: z.number().int().positive(),
  label: z.enum(["arrival", "departure", "full", "chill"]),
  title: z.string().max(120),
  items: z.array(ItineraryItemSchema),
  weather: DayWeatherSchema.optional(),
  /** Customer-facing notices for this day (e.g. a tour moved or replaced for availability). */
  notices: z.array(z.string().max(400)).optional(),
});
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;

export const ItinerarySchema = z.object({
  version: z.literal(1).default(1),
  generatedBy: z.enum(["rules", "claude"]),
  locale: z.enum(["en", "es"]),
  summary: z.string().max(600),
  days: z.array(ItineraryDaySchema).min(1),
  totals: z.object({
    toursUsd: z.number().nonnegative(),
    transfersUsd: z.number().nonnegative(),
    totalUsd: z.number().nonnegative(),
    perPersonUsd: z.number().nonnegative(),
    budgetPerPersonUsd: z.number().nonnegative(),
    withinBudget: z.boolean(),
    /** Estimated dinner spend for the whole party (paid at the restaurants, not included above). */
    diningEstimateUsd: z.number().nonnegative().default(0),
  }),
  /** Shown to the traveler right after the greeting (e.g. activities not suited to kids). */
  introWarnings: z.array(z.string()).default([]),
  /** Shown when rain is forecast for most of the trip. */
  weatherNote: z.string().max(400).optional(),
  /** Shown when no restaurant matches the traveler's zone yet. */
  diningNote: z.string().max(300).optional(),
  /** Internal warnings (e.g. "no availability data for X"); shown to the agent, not the customer. */
  warnings: z.array(z.string()).default([]),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;
