import { describe, expect, it } from "vitest";
import { findOpenSlot, normalizeAvailability, priceParty } from "./availability";

const raw = {
  date: Date.UTC(2026, 11, 10),
  localizedDate: "Thu 10.Dec'26",
  startTimeId: 10,
  startTime: "07:30",
  availabilityCount: 6,
  unlimitedAvailability: false,
  soldOut: false,
  pricesByCategory: { "1": 89, "2": 59 },
  defaultPrice: 89,
  pickupPrice: 0,
  minParticipants: 2,
};

describe("availability", () => {
  it("normalizes a Bokun slot", () => {
    expect(normalizeAvailability(raw)).toEqual({
      date: "2026-12-10",
      startTimeId: 10,
      time: "07:30",
      seatsLeft: 6,
      soldOut: false,
      pricesByCategory: { 1: 89, 2: 59 },
      defaultPrice: 89,
      pickupPrice: 0,
      minParticipants: 2,
    });
  });

  it("derives the date from epoch ms, ignoring Bokun's display string", () => {
    expect(
      normalizeAvailability({ date: Date.UTC(2026, 11, 25), localizedDate: "Fri 25.Dec'26" })?.date,
    ).toBe("2026-12-25");
    expect(normalizeAvailability({ localizedDate: "2026-12-26" })?.date).toBe("2026-12-26");
    expect(normalizeAvailability({ localizedDate: "Fri 25.Dec'26" })).toBeNull();
  });

  it("finds an open slot with enough seats", () => {
    const slots = [
      normalizeAvailability({ ...raw, availabilityCount: 1 })!,
      normalizeAvailability({ ...raw, startTimeId: 20, startTime: "13:00" })!,
      normalizeAvailability({ ...raw, date: Date.UTC(2026, 11, 11), unlimitedAvailability: true })!,
    ];
    expect(findOpenSlot(slots, "2026-12-10", 3)?.startTimeId).toBe(20);
    expect(findOpenSlot(slots, "2026-12-11", 50)?.date).toBe("2026-12-11");
    expect(findOpenSlot(slots, "2026-12-12", 1)).toBeNull();
  });

  it("prices a party by pricing category", () => {
    const s = normalizeAvailability(raw)!;
    expect(priceParty(s, { 1: 2, 2: 1 })).toBe(237);
    expect(priceParty(s, { 1: 2, 99: 1 })).toBeNull();
  });
});
