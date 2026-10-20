import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/config/env";
import { syncCatalogFromBokun } from "@/server/catalog/service";
import { refreshAllRatings } from "@/server/tripadvisor";

export const maxDuration = 60;

/**
 * Refreshes the Bokun catalog. Called by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`, or manually with the same header.
 * With no CRON_SECRET configured it only runs in local development.
 */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorized =
    secret.length > 0
      ? auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
      : process.env.NODE_ENV !== "production";
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "site";
  const t0 = Date.now();
  const snapshot = await syncCatalogFromBokun({ scope });
  const tripadvisorRatings = await refreshAllRatings();
  return Response.json({
    ok: true,
    scope,
    products: snapshot.products.length,
    onSite: snapshot.products.filter((p) => p.onSite).length,
    errors: snapshot.errors.length,
    tripadvisorRatings,
    ms: Date.now() - t0,
    fetchedAt: snapshot.fetchedAt,
  });
}
