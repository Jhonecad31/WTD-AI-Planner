import { describe, expect, it } from "vitest";
import {
  areaOf,
  experienceTypes,
  mainExperience,
  primaryInterest,
  variety,
  zoneDistance,
} from "./experience";

const main = (title: string) => mainExperience({ title });

describe("experience types (real catalog titles)", () => {
  it("reads the main type from the first thing the title names", () => {
    expect(main("Chichen Itza Classic Cenote & Valladolid Tour")).toBe("chichen");
    expect(main("ATV, Ziplining & Cenote Tour at Extreme Adventure Eco Park")).toBe("atv");
    expect(
      main("Horseback Riding & ATV Jungle Adventure with Zipline, Cenote & Tequila Tasting"),
    ).toBe("atv");
    expect(main("Catamaran tour & Dolphin Swim")).toBe("dolphin");
    expect(main("Rio Secreto + Tulum Mayan Ruins")).toBe("tulum");
    expect(main("Rio Secreto Admission (With Optional Transportation)")).toBe("cave");
    expect(main("Isla Mujeres Premium Tour with Catamaran, Snorkeling & Beach Club")).toBe(
      "catamaran",
    );
    expect(main("5x1 Adventure: ATV, Snorkel, Cenote, Ziplines & Beach club")).toBe("atv");
    expect(main("Semi-private 3 waterfall Cenotes experience")).toBe("cenote");
    expect(main("3 Hidden Cenotes Experience & Puerto Morelos Reef Snorkeling")).toBe("cenote");
    expect(main("Cancun Snorkeling Tour: Turtles, Reef, Shipwreck & Marine Cenote (5 Spots)")).toBe(
      "snorkel",
    );
  });

  it("tells places apart that share words", () => {
    // "Tulum" and "Riviera Maya" in a dolphin title don't make it a ruins day.
    expect(main("Dolphin Discovery Tulum - Akumal")).toBe("dolphin");
    expect(main("Dolphin Discovery in Riviera Maya")).toBe("dolphin");
    // A beach club is a day at the beach, not a night out.
    expect(main("Mandala Beach Club")).toBe("beach_club");
    expect(main("Mandala Nightclub Cancun")).toBe("nightlife");
    expect(main("Coco Bongo Beach Party")).toBe("nightlife");
    // A lagoon speedboat ride is not a day trip to Bacalar.
    expect(main("Mangrove Jungle Speedboat Tour in Nichupte Lagoon")).toBe("speedboat");
    expect(main("Bacalar Lagoon Day Trip")).toBe("bacalar");
    expect(main("Xoximilco Cancun Mexican Party With Optional Transportation")).toBe("nightlife");
    expect(main("Cirque Du Soleil & Jungala Beyond")).toBe("show");
    expect(main("Jungala Beyond")).toBe("jungala");
  });

  it("lists every type a title names, main one first, families last", () => {
    expect(experienceTypes({ title: "ATV, Ziplining & Cenote Tour" })).toEqual([
      "atv",
      "cenote",
      "zipline",
    ]);
    expect(experienceTypes({ title: "Tulum, Coba, Playa del Carmen and Cenote Kuxtal" })).toEqual([
      "tulum",
      "coba",
      "cenote",
      "ruins",
    ]);
    expect(experienceTypes({ title: "Xelha All Inclusive" })).toEqual(["xelha", "park"]);
    expect(experienceTypes({ title: "Airport Transfer to Hotel Zone" })).toEqual([]);
  });
});

describe("primaryInterest", () => {
  it("maps the main type to the interest it stands for", () => {
    expect(primaryInterest({ title: "Chichén Itzá Deluxe Tour with Cenote & Valladolid" })).toBe(
      "cultural",
    );
    expect(primaryInterest({ title: "Ek Balam Mayan Traditions" })).toBe("cultural");
    expect(primaryInterest({ title: "Dolphin Discovery in Cancun (Hotel Zone)" })).toBe("water");
    expect(
      primaryInterest({ title: "ATV Jungle Adventure Zip-Line, Cenote & Tequila Tasting" }),
    ).toBe("adventure");
    expect(primaryInterest({ title: "Coco Bongo Cancun" })).toBe("party");
    expect(primaryInterest({ title: "Xcaret Plus Admission From Cancun" })).toBe("parks");
    expect(primaryInterest({ title: "Puerto Morelos: Beachside Tacos & Town Tour" })).toBe("food");
    expect(primaryInterest({ title: "Columbus Romantic Dinner Cruise at Sunset" })).toBe("couples");
    expect(primaryInterest({ title: "Cancun Glass Boat Sightseeing Cruise" })).toBe("water");
    expect(primaryInterest({ title: "Tour Holbox Essentials" })).toBe("water");
    expect(primaryInterest({ title: "Something with no known words" })).toBeNull();
  });
});

describe("variety", () => {
  it("scores how different a tour is from the trip so far", () => {
    const chosen = [{ title: "3 Hidden Cenotes Experience" }];
    expect(variety({ title: "Semi-private 3 waterfall Cenotes" }, chosen)).toBe(0);
    expect(variety({ title: "ATV, Ziplining & Cenote Tour" }, chosen)).toBe(1);
    expect(variety({ title: "Isla Mujeres Catamaran" }, chosen)).toBe(2);
    expect(variety({ title: "Unknown thing" }, chosen)).toBe(2);
  });

  it("treats the same product family as a repeat, but another site as a new day", () => {
    const chichen = [{ title: "Chichen Itza Classic Cenote & Valladolid Tour" }];
    expect(variety({ title: "Chichen Itza Deluxe Tour with Cenote & Valladolid" }, chichen)).toBe(
      0,
    );
    expect(variety({ title: "Tulum, Coba, Playa del Carmen and Cenote Kuxtal" }, chichen)).toBe(1);
    expect(variety({ title: "Ek Balam Mayan Traditions" }, chichen)).toBe(1);
    const dolphins = [{ title: "Dolphin Discovery Tulum - Akumal" }];
    expect(variety({ title: "Dolphin Discovery in Cozumel" }, dolphins)).toBe(0);
    expect(variety({ title: "Xelha All Inclusive" }, [{ title: "Xcaret Plus Admission" }])).toBe(1);
    expect(
      variety({ title: "Xcaret Tickets Admission" }, [{ title: "Xcaret Plus Admission" }]),
    ).toBe(0);
    expect(
      variety({ title: "Catamaran Isla Mujeres Tour with Snorkeling & Beach Club" }, [
        { title: "Isla Mujeres Premium Tour with Catamaran, Snorkeling & Beach Club" },
      ]),
    ).toBe(0);
  });
});

describe("areas along the coast", () => {
  it("reads where a tour happens from its title", () => {
    expect(areaOf({ title: "Catamaran Isla Mujeres Tour with Snorkeling & Beach Club" })).toBe(
      "cancun",
    );
    expect(areaOf({ title: "Dolphin Discovery Tulum - Akumal" })).toBe("tulum");
    expect(areaOf({ title: "Akumal Reef & Turtles Sanctuary from Riviera Maya" })).toBe(
      "puerto_aventuras",
    );
    expect(areaOf({ title: "Xcaret Tickets Admission From Cancun & Playa del Carmen" })).toBe(
      "playa_del_carmen",
    );
    expect(areaOf({ title: "Xelha All Inclusive From Cancun & Riviera Maya" })).toBe(
      "riviera_maya",
    );
    expect(areaOf({ title: "ATV, Ziplining & Cenote Tour at Extreme Adventure Eco Park" })).toBe(
      "puerto_morelos",
    );
    // A long drive from every zone.
    expect(areaOf({ title: "Chichen Itza Classic Cenote & Valladolid Tour" })).toBe("far");
    expect(areaOf({ title: "Tour Holbox Essentials" })).toBe("far");
    // Nothing known: no penalty.
    expect(areaOf({ title: "Mystery Jungle Experience" })).toBeNull();
  });

  it("counts hotel zones between the hotel and the tour", () => {
    const isla = { title: "Isla Mujeres Premium Catamaran" };
    expect(zoneDistance(isla, "cancun")).toBe(0);
    expect(zoneDistance(isla, "costa_mujeres")).toBe(1);
    expect(zoneDistance(isla, "tulum")).toBe(5);
    expect(zoneDistance({ title: "Chichen Itza Deluxe" }, "tulum")).toBe(3);
    expect(zoneDistance({ title: "Mystery Jungle Experience" }, "tulum")).toBeNull();
  });
});

describe("hand-set overrides", () => {
  it("fill in what the title doesn't say", () => {
    // 705158: Cenotes Adventuring, Puerto Morelos (the title names no place).
    const cenotes = { bokunId: 705158, title: "Semi-private 3 waterfall Cenotes experience" };
    expect(areaOf({ title: cenotes.title })).toBeNull();
    expect(areaOf(cenotes)).toBe("puerto_morelos");
    expect(mainExperience(cenotes)).toBe("cenote");
  });
});

describe("same kind of day by what the tours include", () => {
  it("treats an ATV park with cenote and ziplines as a repeat of the cenote park with ziplines", () => {
    const extreme = {
      bokunId: 670333,
      title: "ATV, Ziplining & Cenote Tour at Extreme Adventure Eco Park",
    };
    const cenotes = { bokunId: 705158, title: "Semi-private 3 waterfall Cenotes experience" };
    expect(experienceTypes(cenotes)).toContain("zipline");
    expect(variety(cenotes, [extreme])).toBe(0);
    expect(variety(extreme, [cenotes])).toBe(0);
    // A cenote stop on a ruins day is not an ATV day.
    const chichen = { bokunId: 670332, title: "Chichen Itza Classic Cenote & Valladolid Tour" };
    expect(variety(chichen, [extreme])).toBe(1);
    // Two different ruins with a cenote stop each: fine.
    const tulum = {
      bokunId: 796135,
      title: "Tulum, Coba, Playa del Carmen and Cenote Kuxtal Deluxe Tour",
    };
    expect(variety(tulum, [chichen])).toBe(1);
  });
});
