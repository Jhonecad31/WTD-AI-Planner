import { z } from "zod";
import { INTERESTS } from "@/server/catalog/types";
import { EXPERIENCE_TYPES } from "@/server/catalog/experience";

/**
 * Shared (client + server) shape of what the traveler tells us in the wizard.
 * Everything the AI, PDF and emails need starts here.
 */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM = /^\d{2}:\d{2}$/;

export const FlightSchema = z.object({
  /** "yyyy-MM-dd" local date at CUN */
  date: z.string().regex(ISO_DATE),
  /** "HH:mm" local time at CUN. Optional: the planner now asks only for dates. */
  time: z.string().regex(HHMM).optional(),
  flightNumber: z.string().trim().max(10).optional(),
  airline: z.string().trim().max(80).optional(),
  /** Other end of the leg: origin for inbound, destination for outbound */
  otherAirport: z.string().trim().max(80).optional(),
  source: z.enum(["api", "manual"]).default("manual"),
  /**
   * Coarse time of day picked in the wizard (optional). Arrival: before/after 4 pm.
   * Departure: morning / afternoon / night. Drives the arrival- and departure-day rules.
   */
  slot: z.enum(["early", "late", "morning", "afternoon", "night"]).optional(),
});
export type Flight = z.infer<typeof FlightSchema>;

export const HOTEL_ZONES = [
  "cancun",
  "costa_mujeres",
  "puerto_morelos",
  "playa_del_carmen",
  "riviera_maya",
  "puerto_aventuras",
  "tulum",
] as const;
export type HotelZone = (typeof HOTEL_ZONES)[number];

export const TravelerSchema = z.object({
  /** Age in years; adults can leave it as 30 if they don't want to say */
  age: z.number().int().min(0).max(110),
  name: z.string().trim().max(60).optional(),
});

export const CHILL_OPTIONS = ["none", "one", "two", "alternate"] as const;
/** How many full days get a tour; the rest become beach / shopping days. */
export const TOUR_DAY_OPTIONS = ["all", "1", "2", "3", "4"] as const;
export const ARRIVAL_SLOTS = ["early", "late"] as const;
export const DEPARTURE_SLOTS = ["morning", "afternoon", "night"] as const;
export const TRAVELER_TITLES = ["mr", "ms"] as const;

export const CUISINES = [
  "mexican",
  "italian",
  "japanese",
  "asian",
  "greek",
  "mediterranean",
  "seafood",
  "steakhouse",
  "latin",
  "international",
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const DiningSchema = z.object({
  /** The traveler doesn't want us to plan dinners: no restaurants in the itinerary. */
  skip: z.boolean().default(false),
  /** Empty = no preference. */
  cuisines: z.array(z.enum(CUISINES)).max(CUISINES.length).default([]),
  /** USD per person per meal. */
  budgetPerMeal: z.number().int().min(10).max(500).default(40),
});
export type Dining = z.infer<typeof DiningSchema>;

export const TripRequestSchema = z.object({
  locale: z.enum(["en", "es"]).default("en"),
  inbound: FlightSchema,
  outbound: FlightSchema,
  hotel: z
    .object({
      /** The traveler hasn't booked a hotel yet: no zone, we plan from Cancun. */
      noHotel: z.boolean().default(false),
      zone: z.enum(HOTEL_ZONES).optional(),
      name: z.string().trim().max(120).optional(),
    })
    .refine((h) => h.noHotel || !!h.zone, {
      message: "Pick a zone or mark that you don't have a hotel yet",
      path: ["zone"],
    }),
  transfers: z.object({
    arrival: z.boolean().default(false),
    departure: z.boolean().default(false),
    luxury: z.boolean().default(false),
  }),
  travelers: z.array(TravelerSchema).min(1).max(12),
  /** Courtesy title for the lead traveler's greeting; absent = first name only. */
  travelerTitle: z.enum(TRAVELER_TITLES).optional(),
  interests: z.array(z.enum(INTERESTS)).min(1).max(INTERESTS.length),
  /** Kinds of experience the traveler asked to skip (dolphins, ATV…): a hard filter everywhere. */
  avoidTypes: z.array(z.enum(EXPERIENCE_TYPES)).max(EXPERIENCE_TYPES.length).optional(),
  /** Prefer private tours (usually pricier). */
  preferPrivate: z.boolean().default(false),
  chillDays: z.enum(CHILL_OPTIONS).default("none"),
  tourDays: z.enum(TOUR_DAY_OPTIONS).default("all"),
  /** Exact rest days picked on the day strip; overrides chillDays/tourDays when present. */
  restDates: z.array(z.string().regex(ISO_DATE)).max(60).optional(),
  /** Per person, USD, for the whole trip (tours + transfers) */
  budgetPerPerson: z.number().int().min(50).max(10000),
  dining: DiningSchema.default({ skip: false, cuisines: [], budgetPerMeal: 40 }),
  notes: z.string().trim().max(600).optional(),
});
export type TripRequest = z.infer<typeof TripRequestSchema>;

/** Zone used for weather, transfers, beaches and restaurants (Cancun when no hotel yet). */
export function effectiveZone(req: { hotel: { zone?: HotelZone } }): HotelZone {
  return req.hotel.zone ?? "cancun";
}

/** Nights between inbound and outbound dates (0 if same day or invalid). */
export function tripNights(req: { inbound: { date: string }; outbound: { date: string } }): number {
  const a = Date.parse(`${req.inbound.date}T00:00:00Z`);
  const b = Date.parse(`${req.outbound.date}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function countAdultsChildren(travelers: TripRequest["travelers"], adultFrom = 13) {
  const adults = travelers.filter((t) => t.age >= adultFrom).length;
  return { adults, children: travelers.length - adults };
}
