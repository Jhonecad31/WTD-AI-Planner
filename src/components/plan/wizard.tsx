"use client";

import { useEffect } from "react";
import { preload } from "react-dom";
import { INTEREST_PHOTOS } from "@/content/interest-photos";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/icons";
import { STEPS, useWizard, type WizardDraft } from "./wizard-state";
import { WizardShell } from "./wizard-shell";
import { StepFlights, flightsStepValid } from "./step-flights";
import { StepStay, stayStepValid } from "./step-stay";
import { StepTravelers, travelersStepValid } from "./step-travelers";
import { StepPreferences, preferencesStepValid } from "./step-preferences";
import { StepRestaurants, restaurantsStepValid } from "./step-restaurants";
import { StepItinerary } from "./step-itinerary";
import { StepContact } from "./step-contact";

const validators: Record<string, (d: WizardDraft) => boolean> = {
  flights: flightsStepValid,
  stay: stayStepValid,
  travelers: travelersStepValid,
  preferences: preferencesStepValid,
  restaurants: restaurantsStepValid,
};

export function Wizard({ sidebarImage }: { sidebarImage?: string | null }) {
  // Start fetching the interest photos on step 1 so the preferences step shows them instantly.
  for (const src of Object.values(INTEREST_PHOTOS)) if (src) preload(src, { as: "image" });
  const t = useTranslations("wizard");
  const tc = useTranslations("common");
  const { draft, next, back, goto, patch } = useWizard();
  const index = STEPS.indexOf(draft.step);
  const valid = validators[draft.step]?.(draft) ?? true;
  // The itinerary and contact steps render their own navigation.
  const ownNav = draft.step === "itinerary" || draft.step === "contact";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [draft.step]);

  return (
    <WizardShell
      current={index}
      onSelect={(i) => goto(STEPS[i])}
      sidebarImage={sidebarImage}
      footer={
        ownNav ? null : (
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={back} disabled={index === 0}>
              <ArrowLeftIcon size={18} /> {tc("back")}
            </Button>
            {draft.returnTo === "itinerary" ? (
              // Came from "Edit" on the itinerary: go straight back (it rebuilds if answers changed).
              <Button
                size="lg"
                onClick={() => patch({ step: "itinerary", returnTo: undefined })}
                disabled={!valid}
              >
                {t("backToItinerary")}
                <ArrowRightIcon size={18} />
              </Button>
            ) : (
              <Button size="lg" onClick={next} disabled={!valid}>
                {draft.step === "restaurants" ? t("preferences.generate") : tc("next")}
                <ArrowRightIcon size={18} />
              </Button>
            )}
          </div>
        )
      }
    >
      {draft.step === "flights" && <StepFlights />}
      {draft.step === "stay" && <StepStay />}
      {draft.step === "travelers" && <StepTravelers />}
      {draft.step === "preferences" && <StepPreferences />}
      {draft.step === "restaurants" && <StepRestaurants />}
      {draft.step === "itinerary" && <StepItinerary />}
      {draft.step === "contact" && <StepContact />}
    </WizardShell>
  );
}
