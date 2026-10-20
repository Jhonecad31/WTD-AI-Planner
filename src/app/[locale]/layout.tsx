import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "@/styles/globals.css";

// Same Nunito files whattodoincancun.com serves from /fonts.
const nunito = localFont({
  variable: "--font-nunito",
  display: "swap",
  src: [
    { path: "../../../public/fonts/Nunito-Light.ttf", weight: "300", style: "normal" },
    { path: "../../../public/fonts/Nunito-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../../public/fonts/Nunito-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
