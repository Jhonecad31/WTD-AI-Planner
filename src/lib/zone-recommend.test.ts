import { describe, expect, it } from "vitest";
import { recommendedZones } from "./zone-recommend";

describe("recommendedZones", () => {
  it("suggests lively areas for party, food and adventure", () => {
    expect(recommendedZones(["party", "food", "adventure"])).toEqual([
      "cancun",
      "playa_del_carmen",
      "tulum",
    ]);
  });
  it("suggests quiet areas for rest", () => {
    expect(recommendedZones(["chill"])).toEqual(["riviera_maya", "costa_mujeres"]);
  });
  it("lists the stronger side first and nothing without signals", () => {
    expect(recommendedZones(["chill", "couples", "food"])[0]).toBe("riviera_maya");
    expect(recommendedZones(["cultural", "water"])).toEqual([]);
  });
});
