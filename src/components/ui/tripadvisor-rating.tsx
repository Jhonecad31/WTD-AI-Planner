import type { TripAdvisorRating } from "@/lib/itinerary-schema";

/**
 * Tripadvisor rating line: bubbles, score, review count and a link to the
 * listing, as Tripadvisor's display rules require. Renders nothing without data.
 */
export function TripAdvisorBadge({
  rating,
  locale,
  label,
}: {
  rating?: TripAdvisorRating;
  locale: string;
  /** "reviews on Tripadvisor" in the page language. */
  label: string;
}) {
  if (!rating) return null;
  const count = new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US").format(rating.reviews);
  return (
    <a
      href={rating.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink/75 hover:underline"
    >
      {rating.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={rating.imageUrl} alt="" className="h-4 w-auto" />
      ) : (
        <span className="flex gap-0.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => {
            const fill = Math.max(0, Math.min(1, rating.rating - i));
            return (
              <span
                key={i}
                className="relative h-3 w-3 overflow-hidden rounded-full border border-[#00aa6c]"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-[#00aa6c]"
                  style={{ width: `${fill * 100}%` }}
                />
              </span>
            );
          })}
        </span>
      )}
      <span className="tabular-nums">
        {rating.rating.toFixed(1)} · {count} {label}
      </span>
    </a>
  );
}
