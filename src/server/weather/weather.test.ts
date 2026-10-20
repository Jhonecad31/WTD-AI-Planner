import { describe, expect, it, vi } from "vitest";
import { classifyDay, seasonNotes, typicalWeather } from "@/lib/weather";
import { getTripWeather } from "./index";

describe("classifyDay", () => {
  it("flags rain by probability or storm code, then wind", () => {
    expect(classifyDay({ rainChance: 70 })).toBe("rainy");
    expect(classifyDay({ rainChance: 10, code: 95 })).toBe("rainy");
    expect(classifyDay({ rainChance: 10, windKmh: 40 })).toBe("windy");
    expect(classifyDay({ rainChance: 20, windKmh: 15, code: 1 })).toBe("good");
  });
});

describe("typicalWeather and seasons", () => {
  it("uses the month average and is never rainy", () => {
    const w = typicalWeather("2026-09-12");
    expect(w).toMatchObject({ source: "typical", kind: "good", tMaxC: 32 });
  });
  it("detects hurricane and sargassum seasons across months", () => {
    expect(seasonNotes("2026-12-20", "2027-01-05")).toEqual([]);
    expect(seasonNotes("2026-05-28", "2026-06-03")).toEqual(["hurricane", "sargassum"]);
    expect(seasonNotes("2026-11-10", "2026-11-14")).toEqual(["hurricane"]);
  });
});

function forecastResponse(dates: string[], rain: number[]) {
  return new Response(
    JSON.stringify({
      daily: {
        time: dates,
        weather_code: dates.map(() => 3),
        temperature_2m_max: dates.map(() => 30.4),
        temperature_2m_min: dates.map(() => 23.6),
        precipitation_probability_max: rain,
        wind_speed_10m_max: dates.map(() => 12),
      },
    }),
  );
}

describe("getTripWeather", () => {
  it("mixes forecast days with typical days beyond the window", async () => {
    const fetchImpl = vi.fn(async () =>
      forecastResponse(["2026-10-30", "2026-11-01"].slice(0, 2), [80, 10]),
    ) as unknown as typeof fetch;
    const days = await getTripWeather(
      { from: "2026-10-30", to: "2026-11-20", zone: "tulum" },
      { fetchImpl, today: "2026-10-20" },
    );
    expect(days["2026-10-30"]).toMatchObject({ source: "forecast", kind: "rainy", tMaxC: 30 });
    expect(days["2026-11-20"]).toMatchObject({ source: "typical" });
    expect(Object.keys(days)).toHaveLength(22);
    const url = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("start_date=2026-10-30");
    expect(url).toContain("end_date=2026-11-04");
  });

  it("falls back to typical weather when the forecast fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }));
    const days = await getTripWeather(
      { from: "2026-10-21", to: "2026-10-22", zone: "puerto_morelos" },
      { fetchImpl: fetchImpl as unknown as typeof fetch, today: "2026-10-20" },
    );
    expect(days["2026-10-21"].source).toBe("typical");
  });

  it("skips the network for trips beyond the forecast window", async () => {
    const fetchImpl = vi.fn();
    await getTripWeather(
      { from: "2027-02-01", to: "2027-02-03" },
      { fetchImpl: fetchImpl as unknown as typeof fetch, today: "2026-10-20" },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
