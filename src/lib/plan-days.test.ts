import { describe, expect, it } from "vitest";
import { fullDates, planDays, restCountFor, restDatesForPace, spreadRest } from "./plan-days";

describe("trip pace", () => {
  const from = "2026-10-29";
  const to = "2026-11-03"; // 4 full days: Oct 30 – Nov 2

  it("lists the days between arrival and departure", () => {
    expect(fullDates(from, to)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(fullDates("2026-10-29", "2026-10-30")).toEqual([]);
  });

  it("maps each pace to a number of rest days", () => {
    expect([
      restCountFor("relaxed", 4),
      restCountFor("balanced", 4),
      restCountFor("intense", 4),
    ]).toEqual([2, 1, 0]);
    expect(restCountFor("balanced", 0)).toBe(0);
  });

  it("spreads rest days without repeats", () => {
    expect(spreadRest(["a", "b", "c", "d"], 2)).toHaveLength(2);
    const picked = spreadRest(["a", "b", "c", "d", "e", "f"], 3);
    expect(new Set(picked).size).toBe(3);
  });

  it("uses the exact rest days picked on the strip", () => {
    const rest = restDatesForPace("balanced", from, to);
    expect(rest).toHaveLength(1);
    const days = planDays({
      inbound: { date: from },
      outbound: { date: to },
      chillDays: "two",
      restDates: ["2026-11-02"],
    });
    expect(days.map((d) => d.label)).toEqual([
      "arrival",
      "full",
      "full",
      "full",
      "chill",
      "departure",
    ]);
  });
});
