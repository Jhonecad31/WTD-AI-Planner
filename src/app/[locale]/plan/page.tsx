import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Wizard } from "@/components/plan/wizard";
import { WizardProvider } from "@/components/plan/wizard-state";
import { getPlannerProducts, hasBokunCredentials } from "@/server/catalog/service";

export const instant = false;
export const maxDuration = 60;

export async function generateMetadata() {
  const t = await getTranslations("wizard");
  return { title: `${t("title")} · WhatToDo` };
}

async function sidebarImage(): Promise<string | null> {
  if (!hasBokunCredentials()) return null;
  try {
    const products = await getPlannerProducts();
    const pick = products
      .filter((p) => p.imageUrl && /isla mujeres|cenote|catamaran|chichen/i.test(p.title))
      .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))[0];
    return pick?.imageUrl ?? null;
  } catch {
    return null;
  }
}

export default async function PlanPage() {
  const image = await sidebarImage();
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <WizardProvider>
          <Wizard sidebarImage={image} />
        </WizardProvider>
      </main>
    </>
  );
}
