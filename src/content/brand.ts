/**
 * Editable brand content for the "powered by WhatToDo" landing.
 * Andre can change numbers, awards and partners here without touching components.
 * TODO(Andre): replace placeholders marked with `?` before launch.
 */
export const brand = {
  name: "Plan My Cancun",
  poweredBy: "What To Do In Cancun",
  siteUrl: "https://whattodoincancun.com",
  /** Internal only: not shown to travelers (used in the sales-agent email). */
  whatsapp: {
    /** E.164 without "+" */
    number: "529981510474",
    defaultMessage:
      "Hi! I just built my trip itinerary with the WhatToDo planner and I'd like assistance to book it.",
  },
  phone: "+52 998 300 0040",
  salesEmail: "sales@whattodoincancun.com",
  /** Labels live in messages/{en,es}.json under `landing.whyPlan.stats.<id>`. */
  stats: [
    { id: "years", value: "10+" },
    { id: "travelers", value: "150,000+" },
    { id: "rating", value: "4.8" },
    { id: "tours", value: "100+" },
  ],
  awards: [
    // { name: "TripAdvisor Travelers' Choice", year: 2025, logo: "/awards/tripadvisor.svg" },
  ] as { name: string; year?: number; logo?: string }[],
  partners: [
    // { name: "Bokun", logo: "/partners/bokun.svg" },
  ] as { name: string; logo?: string }[],
  sisterSites: [
    { name: "What To Do In Mexico City", url: "https://whattodoinmexicocity.com" },
    { name: "Things To Do In Madrid", url: "https://thingstodoinmadrid.com" },
  ],
  social: {
    facebook: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    tripadvisor: "",
  },
} as const;

export type Brand = typeof brand;
