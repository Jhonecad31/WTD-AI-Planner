import Link from "next/link";
import { getCatalog, hasBokunCredentials } from "@/server/catalog/service";
import type { CatalogProduct } from "@/server/catalog/types";
import { areaOf, mainExperience, primaryInterest } from "@/server/catalog/experience";
import { interestsFor } from "@/server/catalog/normalize";

/**
 * Internal page (phase 1 deliverable): lists the real Bokun catalog so Andre can
 * verify what the planner sees. Not linked from the public site.
 */

// Always render at request time (reads the live catalog cache / Bokun).
export const instant = false;

function minutesToText(m: number | null) {
  if (!m) return null;
  if (m >= 24 * 60) return `${Math.round(m / (24 * 60))} days`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function ProductCard({ p }: { p: CatalogProduct }) {
  const plannable = p.onSite && (p.kind === "tour" || p.kind === "ticket");
  const type = mainExperience(p);
  const area = areaOf(p);
  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-black/5 bg-white shadow-sm">
      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-40 w-full bg-brand-gradient" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-brand-ink/60">
          <span className="rounded-pill bg-black/5 px-2 py-0.5 font-semibold uppercase tracking-wide">
            {p.kind}
          </span>
          {p.onSite ? (
            <span className="rounded-pill bg-brand-navy/10 px-2 py-0.5 font-semibold text-brand-navy">
              on site
            </span>
          ) : null}
          {p.rating ? (
            <span>
              ★ {p.rating.toFixed(1)} ({p.reviewCount.toLocaleString()})
            </span>
          ) : null}
          {p.durationMinutes ? <span>· {minutesToText(p.durationMinutes)}</span> : null}
        </div>
        {plannable ? (
          <div className="flex flex-wrap gap-1 text-xs">
            {type ? (
              <span className="rounded-pill bg-brand-navy/10 px-2 py-0.5 font-semibold text-brand-navy">
                {type} → {primaryInterest(p)}
              </span>
            ) : (
              <span
                className="rounded-pill bg-red-100 px-2 py-0.5 font-semibold text-red-800"
                title="The planner can't tell what kind of day this is: add it to src/content/experience-overrides.ts"
              >
                no type
              </span>
            )}
            <span className="rounded-pill bg-black/5 px-2 py-0.5 text-brand-ink/70">
              {area ?? "unknown area"}
            </span>
          </div>
        ) : null}
        <h3 className="text-base font-bold leading-snug">{p.title}</h3>
        <div className="flex flex-wrap gap-1">
          {p.interests.map((i) => (
            <span
              key={i}
              className="rounded-pill bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
            >
              {i}
            </span>
          ))}
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 pt-2 text-xs text-brand-ink/70">
          <dt>Bokun ID</dt>
          <dd className="font-mono">{p.bokunId}</dd>
          <dt>From</dt>
          <dd className="font-semibold text-brand-ink">
            {p.priceFromUsd ? `$${p.priceFromUsd} ${p.currency}` : "—"}
          </dd>
          <dt>Categories</dt>
          <dd>
            {p.pricingCategories
              .map((c) => `${c.title}${c.minAge !== null ? ` ${c.minAge}–${c.maxAge ?? "+"}` : ""}`)
              .join(", ") || "—"}
          </dd>
          <dt>Start times</dt>
          <dd>{p.startTimes.map((s) => s.time).join(", ") || "—"}</dd>
          <dt>Pickup</dt>
          <dd>{p.pickupService ? `yes (${p.pickupPlaces.length} places)` : "no"}</dd>
        </dl>
        <div className="flex gap-3 pt-2 text-xs font-semibold">
          {p.siteUrl ? (
            <a
              className="text-primary hover:underline"
              href={p.siteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Site page ↗
            </a>
          ) : null}
          <a
            className="text-brand-navy hover:underline"
            href={p.extranetUrl}
            target="_blank"
            rel="noreferrer"
          >
            Bokun extranet ↗
          </a>
        </div>
      </div>
    </article>
  );
}

export default async function DevCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    refresh?: string;
    kind?: string;
    interest?: string;
    site?: string;
    untyped?: string;
  }>;
}) {
  const params = await searchParams;

  if (!hasBokunCredentials()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24">
        <h1 className="text-2xl font-bold">Bokun catalog</h1>
        <p className="mt-4 text-brand-ink/80">
          Missing Bokun credentials. Add <code>BOKUN_ACCESS_KEY</code> and{" "}
          <code>BOKUN_SECRET_KEY</code> to <code>.env.local</code> (read-only key) and reload.
        </p>
      </main>
    );
  }

  let snapshot;
  let error: string | null = null;
  try {
    snapshot = await getCatalog({ forceRefresh: params.refresh === "1", scope: "all" });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24">
        <h1 className="text-2xl font-bold">Bokun catalog</h1>
        <p className="mt-4 rounded-card bg-red-50 p-4 text-sm text-red-800">{error}</p>
      </main>
    );
  }

  // Same tags the planner uses (re-tagged on load, see getPlannerProducts).
  const tagged = snapshot.products.map((p) => ({ ...p, interests: interestsFor(p) }));
  const untyped = tagged.filter(
    (p) => p.onSite && (p.kind === "tour" || p.kind === "ticket") && !mainExperience(p),
  );
  const products = tagged
    .filter((p) => !params.kind || p.kind === params.kind)
    .filter((p) => params.untyped !== "1" || untyped.includes(p))
    .filter((p) => !params.interest || p.interests.includes(params.interest as never))
    .filter((p) => params.site !== "1" || p.onSite)
    .sort(
      (a, b) => Number(b.onSite) - Number(a.onSite) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    );
  const onSiteCount = snapshot.products.filter((p) => p.onSite).length;

  const kinds = ["tour", "transfer", "ticket", "other"];
  const interests = [
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
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bokun catalog</h1>
          <p className="text-sm text-brand-ink/60">
            {snapshot.products.length} products ({onSiteCount} on the website,{" "}
            <Link
              className={untyped.length ? "font-semibold text-red-700 hover:underline" : ""}
              href="/dev/catalog?untyped=1"
            >
              {untyped.length} without a type
            </Link>
            ) · fetched {new Date(snapshot.fetchedAt).toLocaleString()} · {snapshot.errors.length}{" "}
            errors ·{" "}
            <Link className="text-primary hover:underline" href="/dev/catalog?refresh=1">
              refresh from Bokun
            </Link>
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link className="rounded-pill bg-black/5 px-3 py-1" href="/dev/catalog">
            all
          </Link>
          <Link
            className="rounded-pill bg-brand-navy px-3 py-1 text-white"
            href="/dev/catalog?site=1"
          >
            on website
          </Link>
          {kinds.map((k) => (
            <Link
              key={k}
              className="rounded-pill bg-black/5 px-3 py-1"
              href={`/dev/catalog?kind=${k}`}
            >
              {k}
            </Link>
          ))}
          {interests.map((i) => (
            <Link
              key={i}
              className="rounded-pill bg-primary/10 px-3 py-1 text-primary"
              href={`/dev/catalog?interest=${i}`}
            >
              {i}
            </Link>
          ))}
        </nav>
      </header>

      {snapshot.errors.length ? (
        <details className="mt-4 rounded-card bg-amber-50 p-3 text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">
            {snapshot.errors.length} products failed to load
          </summary>
          <ul className="mt-2 list-disc pl-5">
            {snapshot.errors.map((e) => (
              <li key={e.bokunId}>
                {e.bokunId}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.bokunId} p={p} />
        ))}
      </section>
    </main>
  );
}
