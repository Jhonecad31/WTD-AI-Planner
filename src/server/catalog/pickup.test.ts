import { describe, expect, it } from "vitest";
import { pickupCoverage, pickupZones, zoneOfPickupCity } from "./pickup";

const places = (...cities: string[]) => cities.map((city, id) => ({ id, title: city, city }));

describe("pickup zones", () => {
  it("maps Bokun pickup cities to hotel zones and ignores the rest", () => {
    expect(zoneOfPickupCity("Cancún")).toBe("cancun");
    expect(zoneOfPickupCity("Hotel Zone")).toBe("cancun");
    expect(zoneOfPickupCity("Playa Mujeres")).toBe("costa_mujeres");
    expect(zoneOfPickupCity("Playa Maroma")).toBe("riviera_maya");
    expect(zoneOfPickupCity("Akumal")).toBe("puerto_aventuras");
    expect(zoneOfPickupCity("Tulum Beach")).toBe("tulum");
    expect(zoneOfPickupCity("Bacalar")).toBeNull();
    expect(zoneOfPickupCity("?")).toBeNull();
  });

  it("tells included pickup from 'not from here' and 'get there yourself'", () => {
    const ekBalam = {
      kind: "tour" as const,
      pickupService: true,
      pickupPlaces: places("Cancun", "?"),
    };
    expect(pickupZones(ekBalam)).toEqual(["cancun"]);
    expect(pickupCoverage(ekBalam, "cancun")).toBe("included");
    expect(pickupCoverage(ekBalam, "tulum")).toBe("not_here");
    const marina = { kind: "tour" as const, pickupService: false, pickupPlaces: [] };
    expect(pickupCoverage(marina, "tulum")).toBe("self");
    const odd = { kind: "tour" as const, pickupService: true, pickupPlaces: places("Bacalar") };
    expect(pickupCoverage(odd, "cancun")).toBe("unknown");
    const ride = { kind: "transfer" as const, pickupService: true, pickupPlaces: [] };
    expect(pickupCoverage(ride, "tulum")).toBe("included");
  });
});
