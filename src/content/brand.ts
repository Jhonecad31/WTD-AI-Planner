/**
 * Editable brand content for the "powered by WhatToDo" landing.
 * Andre can change numbers, awards and partners here without touching components.
 * TODO(Andre): replace placeholders marked with `?` before launch.
 */
export const brand = {
  name: "My Cancun Plan AI",
  poweredBy: "WhatToDo In Cancun",
  siteUrl: "https://whattodoincancun.com",
  /** Internal only: not shown to travelers (used in the sales-agent email). */
  whatsapp: {
    /** E.164 without "+" */
    number: "529981510474",
    defaultMessage:
      "Hi! I just built my trip itinerary with the WhatToDo planner and I'd like to book it.",
  },
  phone: "+52 998 300 0040",
  salesEmail: "sales@whattodoincancun.com",
  stats: [
    { value: "?", label: "years in Cancun" },
    { value: "?", label: "travelers served" },
    { value: "?", label: "average rating" },
    { value: "?", label: "tours & experiences" },
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
