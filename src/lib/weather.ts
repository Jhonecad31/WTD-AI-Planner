import type { DayWeather } from "./itinerary-schema";

/**
 * Pure weather helpers shared by server and client: monthly climate for the
 * Cancun / Riviera Maya coast, day classification and seasonal notes.
 */

/** Monthly averages for Cancun (index 0 = January). rainChance = share of rainy days. */
export const TYPICAL_CLIMATE: ReadonlyArray<{ tMaxC: number; tMinC: number; rainChance: number }> =
  [
    { tMaxC: 28, tMinC: 20, rainChance: 25 },
    { tMaxC: 28, tMinC: 20, rainChance: 18 },
    { tMaxC: 30, tMinC: 21, rainChance: 14 },
    { tMaxC: 31, tMinC: 23, rainChance: 14 },
    { tMaxC: 32, tMinC: 24, rainChance: 22 },
    { tMaxC: 32, tMinC: 25, rainChance: 42 },
    { tMaxC: 32, tMinC: 25, rainChance: 33 },
    { tMaxC: 33, tMinC: 25, rainChance: 38 },
    { tMaxC: 32, tMinC: 24, rainChance: 52 },
    { tMaxC: 31, tMinC: 23, rainChance: 48 },
    { tMaxC: 29, tMinC: 22, rainChance: 33 },
    { tMaxC: 28, tMinC: 21, rainChance: 28 },
  ];

export const RAINY_CHANCE = 60;
export const WINDY_KMH = 35;
/** WMO codes for heavy rain, heavy showers and thunderstorms. */
const STORM_CODES = new Set([63, 65, 67, 81, 82, 95, 96, 99]);

export function classifyDay(w: {
  rainChance?: number;
  windKmh?: number;
  code?: number;
}): DayWeather["kind"] {
  if ((w.rainChance ?? 0) >= RAINY_CHANCE || (w.code !== undefined && STORM_CODES.has(w.code)))
    return "rainy";
  if ((w.windKmh ?? 0) >= WINDY_KMH) return "windy";
  return "good";
}

/**
 * Climate average for a date. Always "good": an average can't tell which
 * specific day will rain, so typical days never trigger rainy-day swaps.
 */
export function typicalWeather(isoDate: string): DayWeather {
  const month = Number(isoDate.slice(5, 7)) - 1;
  const c = TYPICAL_CLIMATE[month] ?? TYPICAL_CLIMATE[0];
  return { source: "typical", kind: "good", ...c };
}

export type SeasonNote = "hurricane" | "sargassum";

/** Hurricane season Jun–Nov; sargassum is most likely Apr–Sep. */
export function seasonNotes(fromIso: string, toIso: string): SeasonNote[] {
  const months = new Set<number>();
  let y = Number(fromIso.slice(0, 4));
  let m = Number(fromIso.slice(5, 7));
  const endY = Number(toIso.slice(0, 4));
  const endM = Number(toIso.slice(5, 7));
  for (let guard = 0; guard < 24 && (y < endY || (y === endY && m <= endM)); guard++) {
    months.add(m);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  const notes: SeasonNote[] = [];
  if ([6, 7, 8, 9, 10, 11].some((x) => months.has(x))) notes.push("hurricane");
  if ([4, 5, 6, 7, 8, 9].some((x) => months.has(x))) notes.push("sargassum");
  return notes;
}

const KIND_TEXT = {
  es: { good: "Buen clima", rainy: "Lluvia", windy: "Viento" },
  en: { good: "Fair", rainy: "Rain", windy: "Windy" },
} as const;
const SOURCE_TEXT = {
  es: { forecast: "pronóstico", typical: "clima típico" },
  en: { forecast: "forecast", typical: "typical climate" },
} as const;

/** Plain-text weather line for PDF and emails. */
export function weatherText(w: DayWeather, locale: "en" | "es"): string {
  const rain =
    w.source === "forecast" && w.rainChance !== undefined
      ? ` · ${locale === "es" ? "lluvia" : "rain"} ${w.rainChance}%`
      : "";
  return `${KIND_TEXT[locale][w.kind]} · ${w.tMaxC}° / ${w.tMinC}°${rain} · ${SOURCE_TEXT[locale][w.source]}`;
}
