import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/server/config/env";
import { flags } from "@/server/config/flags";
import { getPlannerProducts } from "@/server/catalog/service";
import { effectiveZone, type TripRequest } from "@/lib/trip-schema";
import type { DayWeather, Itinerary, TripAdvisorRating } from "@/lib/itinerary-schema";
import { getTripWeather } from "@/server/weather";
import type { CatalogProduct } from "@/server/catalog/types";
import { buildRulesItinerary } from "./rules";
import { draftToItinerary, generateWithClaude } from "./claude";
import { validateAndRepair } from "./validate";
import { enrichItinerary } from "./enrich";
import { fitBudget } from "./budget";
import { verifyAvailability } from "./availability-check";
import { getAvailability } from "@/server/catalog/availability";
import { getRatings, withTripAdvisor } from "@/server/tripadvisor";

export interface GenerateResult {
  itinerary: Itinerary;
  engine: "rules" | "claude";
  /** Why we ended up on rules when claude was requested (for the admin panel). */
  fallbackReason?: string;
  usage?: { inputTokens: number; outputTokens: number; cacheRead: number };
}

export async function generateItinerary(
  request: TripRequest,
  opts: { avoid?: number[] } = {},
): Promise<GenerateResult> {
  const [products, weather] = await Promise.all([
    getPlannerProducts(),
    getTripWeather({
      from: request.inbound.date,
      to: request.outbound.date,
      zone: effectiveZone(request),
    }),
  ]);
  // Tripadvisor ratings (cached; empty without a key) break ties between similar picks.
  const ratings = await getRatings(products.map((p) => p.bokunId));
  const result = await generateWithEngines(request, products, weather, ratings, opts.avoid);
  // Trip rules (dinners, beach/shopping, arrival/departure, party nights), then re-total.
  // Weather goes on first so rainy days swap the beach for shopping.
  // The engine is only asked to respect the budget: enforce it before the seats check,
  // so any tour swapped in here is verified in Bokun too.
  const withinBudget = fitBudget(
    withWeather(result.itinerary, weather),
    request,
    products,
    opts.avoid,
  );
  const enriched = enrichItinerary(withinBudget, request, products, {
    ratings,
  });
  // Live seats check in Bokun; swap sold-out tours, then re-apply dinners/places if anything changed.
  const { itinerary: verified, report } = await verifyAvailability(
    enriched,
    request,
    products,
    (bokunId, date) => getAvailability(bokunId, date, date),
    opts.avoid,
  );
  const settled =
    report.replaced || report.moved
      ? enrichItinerary(verified, request, products, { arrangeParty: false, ratings })
      : verified;
  const { itinerary } = validateAndRepair(settled, request, products);
  return { ...result, itinerary: await withTripAdvisor(withWeather(itinerary, weather)) };
}

/** Copies each day's weather onto the final itinerary (validation rebuilds days). */
function withWeather(itinerary: Itinerary, weather: Record<string, DayWeather>): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.map((d) => (weather[d.date] ? { ...d, weather: weather[d.date] } : d)),
  };
}

async function generateWithEngines(
  request: TripRequest,
  products: CatalogProduct[],
  weather: Record<string, DayWeather>,
  ratings: Record<number, TripAdvisorRating>,
  avoid?: number[],
): Promise<GenerateResult> {
  const wantClaude = flags.aiProvider() === "claude" && !!env().ANTHROPIC_API_KEY;

  if (wantClaude) {
    try {
      const { draft, usage } = await generateWithClaude(request, products, {
        weather,
        ratings,
        avoid,
      });
      const { itinerary } = validateAndRepair(
        draftToItinerary(draft, request, products),
        request,
        products,
      );
      return {
        itinerary,
        engine: "claude",
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheRead: usage.cache_read_input_tokens ?? 0,
        },
      };
    } catch (e) {
      const reason =
        e instanceof Anthropic.APIError
          ? `Anthropic ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);
      console.warn("[ai] Claude failed, falling back to rules:", reason);
      const { itinerary } = validateAndRepair(
        buildRulesItinerary({ request, products, weather, avoid }),
        request,
        products,
      );
      return { itinerary, engine: "rules", fallbackReason: reason };
    }
  }

  const { itinerary } = validateAndRepair(
    buildRulesItinerary({ request, products, weather, avoid }),
    request,
    products,
  );
  return {
    itinerary,
    engine: "rules",
    fallbackReason: flags.aiProvider() === "claude" ? "ANTHROPIC_API_KEY not set" : undefined,
  };
}