import type { Interest } from "@/server/catalog/types";

/**
 * Fixed photos for the interest cards, picked with the team from WhatToDo's own
 * Bokun images. Served at card size so they load fast, and preloaded from step 1.
 */
const img = (id: string) => `https://imgcdn.bokun.tools/${id}?w=480&h=320`;

export const INTEREST_PHOTOS: Partial<Record<Interest, string>> = {
  adventure: img("f1fcc592-ed66-420c-8b82-07053e9e2f00.jpeg"), // Horseback Riding & ATV Jungle Adventure
  cultural: img("e429997f-2b78-4de4-a3fb-997995b2aa7b.jpg"), // Chichén Itzá
  food: img("1bdd6e7d-72d9-40a1-884a-e2a176b42b32.jpeg"), // Beachside Tacos
  water: img("badf1f18-8839-4dcb-b57c-31b2e28d9035.jpeg"), // Reef snorkeling
  beach: img("5da3a4da-db71-4b31-9283-9b6ce6049a61.jpeg"), // Playa Paraíso
  shopping: img("19fb3205-1459-4a39-89b0-cc00d022f6e7.jpg"), // Quinta Avenida
  parks: img("984dbeb5-4292-476c-bd05-647e87b439bc.jpeg"), // Xcaret
  party: img("dd39a29c-361b-4746-9938-04506130b813.jpeg"), // D'Cave Nightclub
  couples: img("3cf00f72-eebc-4ff6-b171-f20af4f32a4f.jpg"), // Sunset cruise
  chill: img("92d73fc5-41f7-4a62-ab4c-3727a561f9eb.jpeg"), // Holbox hammocks
};
