"use client";

import { fullDates, restDatesForPace, type Pace } from "@/lib/plan-days";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  HOTEL_ZONES,
  type Dining,
  type Flight,
  type HotelZone,
  type TripRequest,
} from "@/lib/trip-schema";
import type { Itinerary } from "@/lib/itinerary-schema";
import type { Interest } from "@/server/catalog/types";

/**
 * Wizard state lives on the client and survives reloads via sessionStorage.
 * It is intentionally "loose" (partial) until the final zod parse in `buildTripRequest`.
 */

export const STEPS = [
  "flights",
  "travelers",
  "preferences",
  "stay",
  "restaurants",
  "itinerary",
  "contact",
] as const;
export type StepId = (typeof STEPS)[number];

export interface TravelerDraft {
  age: number;
  name?: string;
}

export interface WizardDraft {
  step: StepId;
  inbound: Partial<Flight>;
  outbound: Partial<Flight>;
  hotel: { zone?: HotelZone; name?: string; noHotel?: boolean };
  /** `none` is UI-only ("I don't want transfers"); it keeps the other three off. */
  transfers: { arrival: boolean; departure: boolean; luxury: boolean; none?: boolean };
  travelers: TravelerDraft[];
  travelerTitle?: TripRequest["travelerTitle"];
  interests: Interest[];
  preferPrivate: boolean;
  dining: Dining;
  chillDays: TripRequest["chillDays"];
  tourDays: TripRequest["tourDays"];
  /** Pace card picked; "custom" once a day on the strip was toggled. */
  pace?: Pace | "custom";
  /** Rest days when pace is "custom". */
  restDates?: string[];
  budgetPerPerson: number;
  notes: string;
  /** Last generated itinerary (so going back/forward doesn't regenerate). */
  itinerary?: { itinerary: Itinerary; engine: "rules" | "claude"; fallbackReason?: string };
  contact?: { email: string; phone: string };
  /** Set once the lead was sent; shows the done screen on reload. */
  submitted?: { leadId: string; ref: string; pdfUrl: string };
}

/**
 * Rest days the itinerary should use: the custom picks (still inside the trip) or the
 * spread for the chosen pace. Undefined until dates exist or for old drafts without a pace.
 */
export function draftRestDates(d: WizardDraft): string[] | undefined {
  const from = d.inbound.date;
  const to = d.outbound.date;
  if (!from || !to || to <= from || !d.pace) return undefined;
  if (d.pace === "custom") {
    const valid = new Set(fullDates(from, to));
    return (d.restDates ?? []).filter((x) => valid.has(x));
  }
  return restDatesForPace(d.pace, from, to);
}

export const initialDraft: WizardDraft = {
  step: "flights",
  inbound: { source: "manual" },
  outbound: { source: "manual" },
  hotel: {},
  transfers: { arrival: false, departure: false, luxury: false },
  travelers: [{ age: 30 }, { age: 30 }],
  interests: [],
  preferPrivate: false,
  dining: { cuisines: [], budgetPerMeal: 40 },
  chillDays: "none",
  tourDays: "all",
  pace: "balanced",
  budgetPerPerson: 300,
  notes: "",
};

type Action =
  | { type: "patch"; patch: Partial<WizardDraft> }
  | { type: "goto"; step: StepId }
  | { type: "reset" };

function reducer(state: WizardDraft, action: Action): WizardDraft {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "goto":
      return { ...state, step: action.step };
    case "reset":
      return initialDraft;
  }
}

const STORAGE_KEY = "wtd-planner-draft-v1";

function readStoredDraft(): WizardDraft {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialDraft;
    const saved = { ...initialDraft, ...(JSON.parse(raw) as Partial<WizardDraft>) };
    // Drafts saved before the zone list changed may hold a zone that no longer exists.
    if (saved.hotel?.zone && !(HOTEL_ZONES as readonly string[]).includes(saved.hotel.zone)) {
      saved.hotel = { ...saved.hotel, zone: undefined };
    }
    return saved;
  } catch {
    return initialDraft;
  }
}

const Ctx = createContext<{
  draft: WizardDraft;
  patch: (patch: Partial<WizardDraft>) => void;
  goto: (step: StepId) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
} | null>(null);

const noopSubscribe = () => () => {};

/** True only after hydration, so the client-only subtree never mismatches the server HTML. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function HydratedProvider({ children }: { children: ReactNode }) {
  // Mounted only on the client (see WizardProvider), so reading storage here is safe.
  const [draft, dispatch] = useReducer(reducer, undefined, readStoredDraft);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* private mode etc. */
    }
  }, [draft]);

  const value = useMemo(() => {
    const idx = STEPS.indexOf(draft.step);
    return {
      draft,
      patch: (patch: Partial<WizardDraft>) => dispatch({ type: "patch", patch }),
      goto: (step: StepId) => dispatch({ type: "goto", step }),
      next: () => dispatch({ type: "goto", step: STEPS[Math.min(idx + 1, STEPS.length - 1)] }),
      back: () => dispatch({ type: "goto", step: STEPS[Math.max(idx - 1, 0)] }),
      reset: () => dispatch({ type: "reset" }),
    };
  }, [draft]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const isClient = useIsClient();
  // Next keeps visited pages alive (cacheComponents + <Activity>). A fresh visit to
  // /plan (e.g. from the landing quick-start) must re-read the saved draft instead
  // of resuming stale in-memory state; back/forward still restores it.
  const { bfcacheId } = useRouter();
  if (!isClient) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12" aria-busy>
        <div className="h-8 w-64 animate-pulse rounded-pill bg-black/5" />
        <div className="h-64 animate-pulse rounded-card bg-black/5" />
      </div>
    );
  }
  return <HydratedProvider key={bfcacheId}>{children}</HydratedProvider>;
}

export function useWizard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWizard must be used inside WizardProvider");
  return ctx;
}
