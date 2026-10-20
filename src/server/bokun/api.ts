import { bokunRequest, defaultQuery } from "./client";
import type {
  BokunActivity,
  BokunActivityQuery,
  BokunAvailability,
  BokunPlaces,
  BokunSearchResults,
  BokunTagGroup,
} from "./types";

/** Typed, read-only wrappers over the Bokun v1 endpoints the planner uses. */

export async function getActiveActivityIds(): Promise<number[]> {
  const res = await bokunRequest<{ suppliers?: { supplierId?: number; activityIds?: number[] }[] }>(
    "/activity.json/active-ids",
  );
  return (res.suppliers ?? []).flatMap((s) => s.activityIds ?? []);
}

export async function getActivity(id: number, lang = "EN"): Promise<BokunActivity> {
  return bokunRequest<BokunActivity>(`/activity.json/${id}`, {
    query: { ...defaultQuery(), lang },
  });
}

export async function getActivityAvailabilities(
  id: number,
  start: string,
  end: string,
  opts: { includeSoldOut?: boolean; lang?: string } = {},
): Promise<BokunAvailability[]> {
  return bokunRequest<BokunAvailability[]>(`/activity.json/${id}/availabilities`, {
    query: {
      ...defaultQuery(),
      lang: opts.lang ?? "EN",
      start,
      end,
      includeSoldOut: opts.includeSoldOut ?? false,
    },
  });
}

export async function getPickupPlaces(id: number): Promise<BokunPlaces> {
  return bokunRequest<BokunPlaces>(`/activity.json/${id}/pickup-places`, {
    query: defaultQuery(),
  });
}

export async function searchActivities(
  query: BokunActivityQuery,
  lang = "EN",
): Promise<BokunSearchResults> {
  return bokunRequest<BokunSearchResults>("/activity.json/search", {
    method: "POST",
    query: { ...defaultQuery(), lang },
    body: query,
  });
}

export async function getTagGroups(lang = "EN"): Promise<BokunTagGroup[]> {
  return bokunRequest<BokunTagGroup[]>("/tag.json/groups", { query: { lang } });
}

/** IDs of products modified in [fromDate, toDate). ISO date or datetime strings. */
export async function listUpdatedActivities(
  fromDate: string,
  toDate?: string,
): Promise<{ productId: number; updateTimestamp: string }[]> {
  const res = await bokunRequest<{
    updatedProducts?: { productId?: number; updateTimestamp?: string }[];
  }>("/activity.json/list-updated", { query: { fromDate, toDate } });
  return (res.updatedProducts ?? [])
    .filter((p) => typeof p.productId === "number")
    .map((p) => ({ productId: p.productId as number, updateTimestamp: p.updateTimestamp ?? "" }));
}
