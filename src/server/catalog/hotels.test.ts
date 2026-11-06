import { describe, expect, it } from "vitest";
import { fold, searchHotels, zoneForPlace } from "./hotels";

const list = [
  { name: "Hyatt Ziva Cancún", city: "Cancun" },
  { name: "Grand Hyatt Playa del Carmen", city: "Playa del Carmen" },
  { name: "Dreams Tulum", city: null },
  { name: "Secrets Akumal", city: "Akumal" },
  { name: "Hyatt Ziva Cancún", city: "Cancun" },
];

describe("hotel search", () => {
  it("folds accents and case", () => {
    expect(fold("  Cancún ")).toBe("cancun");
  });
  it("maps cities and names to zones", () => {
    expect(zoneForPlace("Playa Mujeres", "x")).toBe("costa_mujeres");
    expect(zoneForPlace("Akumal", "x")).toBe("riviera_maya");
    expect(zoneForPlace(null, "Dreams Tulum")).toBe("tulum");
    expect(zoneForPlace("", "Somewhere")).toBeNull();
  });
  it("matches every word, accent-insensitive, deduplicated", () => {
    const hits = searchHotels("hyatt cancun", { list });
    expect(hits).toEqual([{ name: "Hyatt Ziva Cancún", city: "Cancun", zone: "cancun" }]);
    expect(searchHotels("hyatt", { list }).map((h) => h.name)).toHaveLength(2);
    expect(searchHotels("", { list })).toEqual([]);
  });
  it("searches the shipped list without touching the catalog", () => {
    const hits = searchHotels("hyatt");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => fold(h.name).includes("hyatt"))).toBe(true);
  });
});
