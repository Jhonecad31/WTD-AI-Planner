import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import {
  ItinerarySchema,
  type Itinerary,
  type ItineraryDay,
  type ItineraryItem,
} from "@/lib/itinerary-schema";
import { fitsAges, priceProductForParty, round2 } from "./pricing";
import { planDays, transferFor, withinBudget } from "./rules";

/**
 * Server-side guarantees that do not depend on which engine produced the plan:
 * - every bokunId exists in the planner catalog (on-site products only)
 * - every day is inside the trip, in order, with no duplicates
 * - prices are recomputed from the catalog (the model never sets prices)
 * - airport transfers are the zone's ride from `transferFor`
 * - totals and budget flag are recomputed
 * Returns the sanitized itinerary plus a list of what was fixed/dropped.
 */
export function validateAndRepair(
  raw: unknown,
  request: TripRequest,
  products: CatalogProduct[],
): { itinerary: Itinerary; fixes: string[] } {
  const parsed = ItinerarySchema.parse(raw);
  const fixes: string[] = [];
  const byId = new Map(products.filter((p) => p.onSite).map((p) => [p.bokunId, p]));
  const expectedDays = planDays(request);
  const expectedDates = new Set(expectedDays.map((d) => d.date));
  const zoneTransfer = transferFor(products, request);

  const seenTours = new Set<number>();
  const days: ItineraryDay[] = parsed.days
    .filter((d) => {
      if (!expectedDates.has(d.date)) {
        fixes.push(`Dropped day ${d.date}: outside the trip.`);
        return false;
      }
      return true;
    })
    .map((d) => {
      const slot = expectedDays.find((x) => x.date === d.date)!;
      const items = d.items.flatMap((item): ItineraryItem[] => {
        if (
          item.kind === "free" ||
          item.kind === "beach" ||
          item.kind === "shopping" ||
          item.kind === "rest"
        )
          return [{ ...item, priceTotalUsd: 0, pricing: [] }];
        if (!item.bokunId || !byId.has(item.bokunId)) {
          fixes.push(`Dropped "${item.title}" on ${d.date}: not a product on the website.`);
          return [];
        }
        const product = byId.get(item.bokunId)!;
        if (item.kind === "restaurant" || product.kind === "restaurant") {
          // Restaurants are suggestions reserved by the specialist: never priced, never a tour.
          if (item.kind !== "restaurant") {
            fixes.push(`Dropped restaurant "${product.title}" placed as a tour on ${d.date}.`);
            return [];
          }
          return [{ ...item, title: product.title, priceTotalUsd: 0, pricing: [] }];
        }
        if (item.kind === "tour") {
          if (seenTours.has(item.bokunId)) {
            fixes.push(`Dropped duplicate "${item.title}" on ${d.date}.`);
            return [];
          }
          seenTours.add(item.bokunId);
        }
        let p = byId.get(item.bokunId)!;
        if (p.kind === "transfer" && zoneTransfer && p.bokunId !== zoneTransfer.bokunId) {
          fixes.push(`Swapped transfer "${p.title}" on ${d.date} for "${zoneTransfer.title}".`);
          p = zoneTransfer;
        }
        if (!fitsAges(p, request.travelers)) {
          fixes.push(`Dropped "${item.title}" on ${d.date}: not suitable for the travelers' ages.`);
          return [];
        }
        const price = priceProductForParty(p, request.travelers);
        const st = item.startTimeId
          ? p.startTimes.find((s) => s.id === item.startTimeId)
          : p.startTimes.find((s) => s.time === item.startTime);
        return [
          {
            ...item,
            bokunId: p.bokunId,
            // Transfers keep their direction name ("hotel to airport"); one product covers both legs.
            title: p.kind === "transfer" && item.kind === "transfer" ? item.title : p.title,
            kind: p.kind === "transfer" ? ("transfer" as const) : ("tour" as const),
            priceTotalUsd: price.priceTotalUsd,
            pricing: price.pricing,
            startTime:
              item.kind === "transfer" ? item.startTime : noAllDayTime(st?.time ?? item.startTime),
            startTimeId: st?.id,
            durationMinutes: p.durationMinutes ?? item.durationMinutes,
            pickup: p.pickupService,
            imageUrl: p.imageUrl ?? undefined,
            siteUrl: p.siteUrl ?? undefined,
          },
        ];
      });
      return { ...d, dayNumber: slot.dayNumber, label: d.label ?? slot.label, items };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Fill any day the engine forgot.
  for (const slot of expectedDays) {
    if (!days.some((d) => d.date === slot.date)) {
      fixes.push(`Added missing day ${slot.date}.`);
      days.push({
        date: slot.date,
        dayNumber: slot.dayNumber,
        label: slot.label,
        title: "",
        items: [],
      });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  const all = days.flatMap((d) => d.items);
  const toursUsd = round2(
    all.filter((i) => i.kind === "tour").reduce((s, i) => s + i.priceTotalUsd, 0),
  );
  const transfersUsd = round2(
    all.filter((i) => i.kind === "transfer").reduce((s, i) => s + i.priceTotalUsd, 0),
  );
  const totalUsd = round2(toursUsd + transfersUsd);
  const perPersonUsd = round2(totalUsd / request.travelers.length);
  const diningEstimateUsd = round2(
    all
      .filter((i) => i.kind === "restaurant")
      .reduce((s, i) => s + (i.priceEstimatePpUsd ?? 0) * request.travelers.length, 0),
  );

  return {
    itinerary: {
      ...parsed,
      days,
      totals: {
        toursUsd,
        transfersUsd,
        totalUsd,
        perPersonUsd,
        budgetPerPersonUsd: request.budgetPerPerson,
        // The budget covers tours only; transfers are an extra the traveler opted into.
        withinBudget: withinBudget(toursUsd, request),
        diningEstimateUsd,
      },
      warnings: [...parsed.warnings, ...fixes],
    },
    fixes,
  };
}

/** Bokun reports "00:00" for all-day admissions: that's not a start time. */
function noAllDayTime(time?: string): string | undefined {
  return time === "00:00" ? undefined : time;
}
