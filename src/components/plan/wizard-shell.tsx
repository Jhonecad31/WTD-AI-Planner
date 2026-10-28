"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { StepSidebar, type StepMeta } from "@/components/ui/step-sidebar";
import {
  CompassIcon,
  FoodIcon,
  HotelIcon,
  MailIcon,
  MapIcon,
  PlaneIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { ScrollHint } from "./scroll-hint";
import { STEP_PHOTOS } from "@/content/step-photos";
import { STEPS, type StepId } from "./wizard-state";

const ICONS: Record<StepId, ReactNode> = {
  flights: <PlaneIcon size={18} />,
  stay: <HotelIcon size={18} />,
  travelers: <UsersIcon size={18} />,
  preferences: <CompassIcon size={18} />,
  restaurants: <FoodIcon size={18} />,
  itinerary: <MapIcon size={18} />,
  contact: <MailIcon size={18} />,
};

export function WizardShell({
  current,
  onSelect,
  sidebarImage,
  children,
  footer,
}: {
  current: number;
  onSelect: (index: number) => void;
  /** Real photo from the catalog shown above the step list (desktop). */
  sidebarImage?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTranslations("wizard");
  const steps: StepMeta[] = STEPS.map((s) => ({
    id: s,
    label: t(`steps.${s}`),
    icon: ICONS[s],
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-0 py-0 sm:px-6 sm:py-8 lg:py-12">
      <div className="bg-white sm:overflow-hidden sm:rounded-[20px] sm:shadow-float lg:grid lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="border-b border-line bg-surface px-4 pb-4 pt-4 sm:px-6 lg:border-b-0 lg:border-r lg:px-7 lg:pb-8 lg:pt-7">
          <div className="relative mb-6 hidden h-36 overflow-hidden rounded-card lg:block">
            {sidebarImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sidebarImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-primary" />
            )}
            <div className="h-full w-full bg-primary" />
            {/* One photo per step (src/content/step-photos.ts), cross-fading as the traveler advances. */}
            {STEPS.map((s, i) => {
              const src = STEP_PHOTOS[s] || sidebarImage;
              if (!src) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s}
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
                    i === current ? "opacity-100" : "opacity-0"
                  }`}
                />
              );
            })}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-base font-bold leading-tight text-white">{t("title")}</p>
            </div>
          </div>
          <StepSidebar
            steps={steps}
            current={current}
            onSelect={onSelect}
            progressLabel={t("stepOf", { current: current + 1, total: steps.length })}
            currentLabel={steps[current]?.label}
          />
        </aside>

        {/* Content */}
        <div className="flex min-h-[60vh] flex-col">
          <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">{children}</div>
          {footer ? (
            <>
              <ScrollHint step={current} />
              {/* Not sticky: Continue sits at the end of the step so travelers scroll past every option. */}
              <div className="border-t border-line px-4 py-4 sm:px-8 lg:px-12 lg:pb-10 lg:pt-0">
                {footer}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
