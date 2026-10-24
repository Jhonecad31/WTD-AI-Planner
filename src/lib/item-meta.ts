import type { ItineraryItem } from "./itinerary-schema";

/** Private tours carry "Private"/"Privado" in their Bokun title ("Semi-private" isn't). */
export function isPrivateTitle(title: string): boolean {
  return /(?<!semi[- ]?)\bprivate\b|(?<!semi[- ]?)\bprivad[oa]s?\b/i.test(title);
}

const CUISINE_LABEL: Record<string, { es: string; en: string }> = {
  mexican: { es: "Mexicana", en: "Mexican" },
  italian: { es: "Italiana", en: "Italian" },
  japanese: { es: "Japonesa", en: "Japanese" },
  asian: { es: "Asiática", en: "Asian" },
  greek: { es: "Griega", en: "Greek" },
  mediterranean: { es: "Mediterránea", en: "Mediterranean" },
  seafood: { es: "Mariscos", en: "Seafood" },
  steakhouse: { es: "Cortes", en: "Steakhouse" },
  latin: { es: "Latinoamericana", en: "Latin American" },
  international: { es: "Internacional", en: "International" },
};

/** One plain line under an item title: time, duration, cuisine or price. */
export function itemMeta(
  it: ItineraryItem,
  locale: "en" | "es",
  money: (n: number, l: string) => string,
): string {
  const es = locale === "es";
  if (it.kind === "restaurant") {
    return [
      it.startTime,
      it.cuisines?.map((c) => CUISINE_LABEL[c]?.[locale] ?? c).join(", "),
      it.priceLevel ? "$".repeat(it.priceLevel) : null,
      it.priceEstimatePpUsd
        ? `${es ? "aprox." : "about"} ${money(it.priceEstimatePpUsd, locale)} ${es ? "por persona" : "per person"}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (it.kind === "beach" || it.kind === "shopping" || it.kind === "rest" || it.kind === "free") {
    return [
      it.startTime,
      it.kind === "beach"
        ? es
          ? "Playa"
          : "Beach"
        : it.kind === "shopping"
          ? es
            ? "Compras"
            : "Shopping"
          : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    it.startTime,
    it.durationMinutes ? `${Math.round(it.durationMinutes / 60)}h` : null,
    money(it.priceTotalUsd, locale),
  ]
    .filter(Boolean)
    .join(" · ");
}
