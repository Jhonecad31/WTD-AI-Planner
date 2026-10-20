import type { HotelZone } from "@/lib/trip-schema";
import type { DayWeather } from "@/lib/itinerary-schema";
import { addDays } from "@/lib/format";
import { classifyDay, typicalWeather } from "@/lib/weather";

/**
 * Trip weather from Open-Meteo (free, no API key). Dates within the forecast
 * window get a real forecast; later dates get the monthly climate average.
 * Never throws: any upstream problem falls back to typical weather.
 */

export const ZONE_COORDS: Record<HotelZone, { lat: number; lon: number }> = {
  cancun: { lat: 21.1352, lon: -86.7468 },
  costa_mujeres: { lat: 21.242, lon: -86.806 },
  puerto_morelos: { lat: 20.8477, lon: -86.8755 },
  playa_del_carmen: { lat: 20.6296, lon: -87.0739 },
  riviera_maya: { lat: 20.396, lon: -87.316 },
  puerto_aventuras: { lat: 20.499, lon: -87.229 },
  tulum: { lat: 20.2114, lon: -87.4654 },
};

const FORECAST_DAYS = 16;
const TIMEOUT_MS = 3000;
const CACHE_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; days: Record<string, DayWeather> }>();

/** Today's date in Cancun (UTC-5, no DST). */
export function cancunToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cancun" }).format(now);
}

type OpenMeteoDaily = {
  daily?: {
    time: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
  };
};

async function fetchForecast(
  zone: HotelZone,
  start: string,
  end: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, DayWeather>> {
  const key = `${zone}|${start}|${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.days;

  const { lat, lon } = ZONE_COORDS[zone] ?? ZONE_COORDS.cancun;
  const qs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    timezone: "America/Cancun",
    start_date: start,
    end_date: end,
  });
  const res = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${qs}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as OpenMeteoDaily;
  const d = json.daily;
  const days: Record<string, DayWeather> = {};
  d?.time.forEach((date, i) => {
    const tMax = d.temperature_2m_max?.[i];
    const tMin = d.temperature_2m_min?.[i];
    if (tMax == null || tMin == null) return;
    const rainChance = d.precipitation_probability_max?.[i] ?? undefined;
    const windKmh = d.wind_speed_10m_max?.[i] ?? undefined;
    const code = d.weather_code?.[i] ?? undefined;
    days[date] = {
      source: "forecast",
      kind: classifyDay({ rainChance, windKmh, code }),
      tMaxC: Math.round(tMax),
      tMinC: Math.round(tMin),
      rainChance: rainChance ?? undefined,
      windKmh: windKmh !== undefined ? Math.round(windKmh) : undefined,
      code,
    };
  });
  cache.set(key, { at: Date.now(), days });
  return days;
}

/** One entry per date from `from` to `to` inclusive. */
export async function getTripWeather(
  opts: { from: string; to: string; zone?: HotelZone },
  deps: { fetchImpl?: typeof fetch; today?: string } = {},
): Promise<Record<string, DayWeather>> {
  const zone = opts.zone ?? "cancun";
  const today = deps.today ?? cancunToday();
  const lastForecast = addDays(today, FORECAST_DAYS - 1);
  const start = opts.from > today ? opts.from : today;
  const end = opts.to < lastForecast ? opts.to : lastForecast;

  let forecast: Record<string, DayWeather> = {};
  if (start <= end) {
    try {
      forecast = await fetchForecast(zone, start, end, deps.fetchImpl ?? fetch);
    } catch (e) {
      console.warn("[weather] forecast unavailable, using typical climate:", (e as Error).message);
    }
  }

  const out: Record<string, DayWeather> = {};
  for (let d = opts.from, guard = 0; d <= opts.to && guard < 60; d = addDays(d, 1), guard++) {
    out[d] = forecast[d] ?? typicalWeather(d);
  }
  return out;
}
