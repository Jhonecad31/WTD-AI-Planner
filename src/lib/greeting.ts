import type { TripRequest } from "./trip-schema";

const TITLES = {
  en: { mr: "Mr.", ms: "Ms." },
  es: { mr: "Sr.", ms: "Sra." },
} as const;

/**
 * Personal opening line for the itinerary, PDF and customer email.
 * The courtesy title is only used when the traveler picked one; it is never
 * guessed from the name.
 */
export function greetingFor(
  request: Pick<TripRequest, "locale" | "travelerTitle">,
  name: string | undefined,
): string {
  const locale = request.locale;
  const first = name?.trim();
  const title = request.travelerTitle ? TITLES[locale][request.travelerTitle] : "";
  // A title without a name ("Sr.,") reads wrong: only use it next to the name.
  const who = first ? [title, first].filter(Boolean).join(" ") : "";
  if (locale === "es") {
    const body =
      "tu aventura en Cancún empieza aquí. Creamos un itinerario personalizado para que aproveches cada día.";
    return who ? `${who}, ${body}` : `Tu aventura en Cancún empieza aquí. ${body.split(". ")[1]}`;
  }
  const body =
    "your Cancún adventure starts here. We've created a personalized itinerary to help you make the most of every day.";
  return who ? `${who}, ${body}` : `Your Cancún adventure starts here. ${body.split(". ")[1]}`;
}
