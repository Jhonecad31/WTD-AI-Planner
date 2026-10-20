import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  // whattodoincancun.com uses "/" for English and "/es/" for Spanish.
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
