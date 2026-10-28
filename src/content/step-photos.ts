import type { StepId } from "@/components/plan/wizard-state";

/**
 * Photo shown at the top of the wizard sidebar (desktop) for each step.
 * Use a WhatToDo Bokun image (via `bokun()`) or a file in /public, e.g. "/steps/plane.webp".
 * Empty = falls back to the catalog photo (or the green panel without Bokun keys).
 */
const bokun = (id: string) => `https://imgcdn.bokun.tools/${id}?w=640&h=400`;

export const STEP_PHOTOS: Record<StepId, string> = {
  flights: "/steps/avion.webp", // TODO: add an airplane photo, e.g. "/steps/plane.webp"
  travelers: "/steps/familia.webp", // Couple on a sunset cruise
  preferences: "/steps/atv.webp", // Horseback & ATV jungle adventure
  stay:"/steps/hotel.webp", // Playa Paraíso
  restaurants:"/steps/restaurante.webp", // Beachside tacos
  itinerary: bokun("e429997f-2b78-4de4-a3fb-997995b2aa7b.jpg"), // Chichén Itzá
  contact: bokun("92d73fc5-41f7-4a62-ab4c-3727a561f9eb.jpeg"), // Holbox hammocks
};
