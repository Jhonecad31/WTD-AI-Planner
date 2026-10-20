import { describe, expect, it } from "vitest";
import type { BokunActivity } from "@/server/bokun/types";
import {
  detectInterests,
  detectKind,
  durationToMinutes,
  normalizeActivity,
  siteUrlFor,
} from "./normalize";

const cenotes: BokunActivity = {
  id: 705158,
  title: "Cenotes Adventure: Zipline, ATV & Snorkel",
  slug: "cenotes-adventure",
  excerpt: "Jungle ATV ride, zipline and swim in two cenotes.",
  activityType: "DAY_TOUR_OR_ACTIVITY",
  bookingType: "DATE_AND_TIME",
  activityCategories: ["ADVENTURE", "SNORKELING"],
  durationType: "HOURS",
  duration: 6,
  nextDefaultPrice: 89,
  reviewRating: 4.9,
  reviewCount: 1437,
  pickupService: true,
  pickupMinutesBefore: 30,
  pricingCategories: [
    {
      id: 1,
      title: "Adult",
      ticketCategory: "ADULT",
      ageQualified: true,
      minAge: 13,
      maxAge: 99,
      defaultCategory: true,
    },
    { id: 2, title: "Child", ticketCategory: "CHILD", ageQualified: true, minAge: 4, maxAge: 12 },
    { id: 3, title: "Internal", ticketCategory: "OTHER", internalUseOnly: true },
  ],
  startTimes: [
    { id: 20, hour: 13, minute: 0, label: "13:00" },
    { id: 10, hour: 7, minute: 30, label: "07:30" },
  ],
  keyPhoto: {
    originalUrl: "https://img/orig.jpg",
    derived: [{ name: "large", url: "https://img/large.jpg" }],
  },
  startPoints: [{ location: { city: "Cancun", latitude: 21.1, longitude: -86.8 } }],
};

describe("normalizeActivity", () => {
  const p = normalizeActivity(cenotes, {
    pickupPlaces: [{ id: 9, title: "Hotel Zone", location: { city: "Cancun" } }],
  });

  it("maps identity, urls and kind", () => {
    expect(p.bokunId).toBe(705158);
    // 705158 is a real product on the site, so the crawled link wins over the Bokun slug
    expect(p.siteUrl).toBe("https://whattodoincancun.com/tour/cenotes-adventuring-tour/");
    expect(p.extranetUrl).toBe("https://extranet.bokun.io/experience/705158");
    expect(p.kind).toBe("tour");
  });

  it("derives interests from categories and text", () => {
    expect(p.interests).toEqual(expect.arrayContaining(["adventure", "water"]));
    expect(p.interests).not.toContain("party");
  });

  it("keeps pricing categories with ages, dropping internal ones", () => {
    expect(p.pricingCategories).toEqual([
      { id: 1, title: "Adult", ticketCategory: "ADULT", minAge: 13, maxAge: 99, isDefault: true },
      { id: 2, title: "Child", ticketCategory: "CHILD", minAge: 4, maxAge: 12, isDefault: false },
    ]);
  });

  it("sorts start times and formats HH:mm", () => {
    expect(p.startTimes.map((s) => s.time)).toEqual(["07:30", "13:00"]);
  });

  it("maps duration, price, image, pickup and location", () => {
    expect(p.durationMinutes).toBe(360);
    expect(p.priceFromUsd).toBe(89);
    expect(p.imageUrl).toBe("https://img/large.jpg");
    expect(p.pickupPlaces).toEqual([{ id: 9, title: "Hotel Zone", city: "Cancun" }]);
    expect(p.startLocation).toEqual({ city: "Cancun", lat: 21.1, lng: -86.8 });
  });
});

describe("helpers", () => {
  it("detects transfers", () => {
    expect(
      detectKind({
        id: 1,
        title: "Cancun Airport Transfer to Hotel Zone",
        productCategory: "TRANSPORT",
      }),
    ).toBe("transfer");
    expect(
      detectKind({
        id: 2,
        title: "Private Transportation Airport – Tulum",
        activityType: "DAY_TOUR_OR_ACTIVITY",
      }),
    ).toBe("transfer");
    expect(
      detectKind({ id: 4, title: "Private Transfer Apto Cancun", activityType: "TRANSPORT" }),
    ).toBe("transfer");
    expect(
      detectKind({
        id: 3,
        title: "Tulum Ruins Tour with Transportation",
        activityType: "DAY_TOUR_OR_ACTIVITY",
      }),
    ).toBe("tour");
  });

  it("does not treat tours that include transportation as transfers", () => {
    for (const title of [
      "Jolly Roger Pirate Ship Cruise & Dinner Show with Transportation From Cancun",
      "Xcaret Plus Admission From Cancun (Optional Transportation)",
      "Whale Shark Experience with Isla Mujeres Snorkel & Transportation",
    ]) {
      expect(detectKind({ id: 9, title, activityType: "DAY_TOUR_OR_ACTIVITY" })).not.toBe(
        "transfer",
      );
    }
    expect(
      detectKind({
        id: 10,
        title: "Airport Transfer Cancun Airport to Hotel Zone",
        activityType: "DAY_TOUR_OR_ACTIVITY",
      }),
    ).toBe("transfer");
  });

  it("detects cultural and party from keywords", () => {
    expect(detectInterests({ id: 1, title: "Chichen Itza & Valladolid" })).toContain("cultural");
    expect(detectInterests({ id: 2, title: "Coco Bongo Open Bar" })).toContain("party");
  });

  it("converts durations", () => {
    expect(durationToMinutes({ id: 1, durationHours: 2, durationMinutes: 30 })).toBe(150);
    expect(durationToMinutes({ id: 1, durationType: "DAYS", duration: 2 })).toBe(2880);
    expect(durationToMinutes({ id: 1 })).toBeNull();
  });
});

describe("siteUrlFor", () => {
  it("prefers the crawled site link over the Bokun slug", () => {
    expect(siteUrlFor(670332, "whatever")).toBe(
      "https://whattodoincancun.com/tour/chichen-itza-tour/",
    );
  });
  it("falls back to the Bokun slug, then null", () => {
    expect(siteUrlFor(1, "my-tour")).toBe("https://whattodoincancun.com/tour/my-tour/");
    expect(siteUrlFor(1, null)).toBeNull();
  });
});
