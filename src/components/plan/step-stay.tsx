"use client";

import { useTranslations } from "next-intl";
import { HOTEL_ZONES } from "@/lib/trip-schema";
import { Field } from "@/components/ui/field";
import { OptionCard } from "@/components/ui/option-card";
import {
  BanIcon,
  BedIcon,
  CarIcon,
  HotelIcon,
  PinIcon,
  PlaneLandIcon,
  SparkleIcon,
} from "@/components/ui/icons";
import { recommendedZones } from "@/lib/zone-recommend";
import { useWizard } from "./wizard-state";
import { HotelSearch } from "./hotel-search";

export function StepStay() {
  const t = useTranslations("wizard.stay");
  const { draft, patch } = useWizard();
  const tr = draft.transfers;
  const { zone, noHotel } = draft.hotel;
  // Areas that fit the chosen activities go first, with a gold "recommended" badge.
  const recommended = recommendedZones(draft.interests);
  const zones = [...recommended, ...HOTEL_ZONES.filter((z) => !recommended.includes(z))];

  // Picking any transfer clears "no transfers", and vice versa.
  const setTransfer = (key: "arrival" | "departure" | "luxury") =>
    patch({ transfers: { ...tr, [key]: !tr[key], none: false } });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
      </header>

      {/* Hotel first: with a hotel picked, its area is filled in for them below. */}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">{t("hotel")}</h3>
        <div role="radiogroup" aria-label={t("hotel")} className="grid grid-cols-2 gap-3">
          <OptionCard
            role="radio"
            selected={noHotel === false}
            onSelect={() => patch({ hotel: { ...draft.hotel, noHotel: false } })}
            icon={<HotelIcon size={20} />}
            title={t("haveHotel")}
            compact
          />
          <OptionCard
            role="radio"
            selected={noHotel === true}
            onSelect={() => patch({ hotel: { zone: draft.hotel.zone, noHotel: true } })}
            icon={<BedIcon size={20} />}
            title={t("noHotel")}
            compact
          />
        </div>
        {noHotel === true ? (
          <p className="rounded-card bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
            {t("noHotelNote")}
          </p>
        ) : noHotel === false ? (
          <Field label={t("hotelSearchLabel")} htmlFor="hotel" className="max-w-md">
            <HotelSearch
              id="hotel"
              value={draft.hotel.name ?? ""}
              onChange={(name) => patch({ hotel: { ...draft.hotel, name } })}
              onPick={(h) =>
                patch({
                  hotel: {
                    ...draft.hotel,
                    name: h.name,
                    zone: h.zone ?? draft.hotel.zone ?? undefined,
                  },
                })
              }
            />
          </Field>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold">{t("zone")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => {
            const isRecommended = recommended.includes(z);
            return (
              <OptionCard
                key={z}
                role="radio"
                compact
                selected={zone === z}
                onSelect={() => patch({ hotel: { ...draft.hotel, zone: z } })}
                icon={<PinIcon size={18} />}
                title={t(`zones.${z}`)}
                description={
                  <span className="inline-flex items-center gap-1">
                    <PlaneLandIcon size={14} aria-hidden /> {t(`zoneHints.${z}`)}
                  </span>
                }
                badge={isRecommended ? t("recommended") : undefined}
                badgeTone="gold"
                highlight={isRecommended}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold">{t("transfersTitle")}</h3>
        <p className="mt-1 mb-4 text-sm text-brand-ink/70">{t("transfersBody")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            selected={tr.arrival}
            onSelect={() => setTransfer("arrival")}
            icon={<PlaneLandIcon size={20} />}
            title={t("arrivalTransfer")}
            compact
          />
          <OptionCard
            selected={tr.departure}
            onSelect={() => setTransfer("departure")}
            icon={<HotelIcon size={20} />}
            title={t("departureTransfer")}
            compact
          />
          <OptionCard
            selected={tr.luxury}
            onSelect={() => setTransfer("luxury")}
            icon={tr.luxury ? <SparkleIcon size={20} /> : <CarIcon size={20} />}
            title={t("luxury")}
            compact
          />
          <OptionCard
            selected={!!tr.none}
            onSelect={() =>
              patch({
                transfers: tr.none
                  ? { ...tr, none: false }
                  : { arrival: false, departure: false, luxury: false, none: true },
              })
            }
            icon={<BanIcon size={20} />}
            title={t("noTransfers")}
            compact
          />
        </div>
      </section>
    </div>
  );
}

export function stayStepValid(d: ReturnType<typeof useWizard>["draft"]): boolean {
  return !!d.hotel.zone || !!d.hotel.noHotel;
}
