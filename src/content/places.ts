import type { HotelZone } from "@/lib/trip-schema";

/**
 * Public beaches and shopping spots the planner suggests on chill days and on
 * departure days with a night flight. Free to visit, not sold by WhatToDo.
 * EDIT FREELY: keep at least one beach and one shopping spot per zone.
 */
export interface Place {
  id: string;
  kind: "beach" | "shopping";
  name: string;
  zone: HotelZone;
  /** One short line, Spanish and English. */
  note: { es: string; en: string };
  mapsUrl: string;
}

const maps = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const PLACES: Place[] = [
  // Cancún
  {
    id: "playa-delfines",
    kind: "beach",
    name: "Playa Delfines",
    zone: "cancun",
    note: {
      es: "La playa pública más famosa de Cancún, con el mirador y el letrero.",
      en: "Cancún's best-known public beach, with the lookout and the big sign.",
    },
    mapsUrl: maps("Playa Delfines Cancún"),
  },
  {
    id: "playa-gaviota-azul",
    kind: "beach",
    name: "Playa Gaviota Azul",
    zone: "cancun",
    note: {
      es: "Arena blanca y mar turquesa en el corazón de la Zona Hotelera.",
      en: "White sand and turquoise water in the heart of the Hotel Zone.",
    },
    mapsUrl: maps("Playa Gaviota Azul Cancún"),
  },
  {
    id: "la-isla",
    kind: "shopping",
    name: "La Isla Cancún",
    zone: "cancun",
    note: {
      es: "Centro comercial frente a la laguna, con tiendas, restaurantes y acuario.",
      en: "Lagoon-side mall with shops, restaurants and an aquarium.",
    },
    mapsUrl: maps("La Isla Shopping Village Cancún"),
  },
  {
    id: "mercado-28",
    kind: "shopping",
    name: "Mercado 28",
    zone: "cancun",
    note: {
      es: "Artesanías y recuerdos mexicanos en el centro de Cancún.",
      en: "Mexican crafts and souvenirs in downtown Cancún.",
    },
    mapsUrl: maps("Mercado 28 Cancún"),
  },
  // Costa Mujeres
  {
    id: "playa-mujeres",
    kind: "beach",
    name: "Playa Mujeres",
    zone: "costa_mujeres",
    note: {
      es: "Playa amplia y tranquila, con vista a Isla Mujeres.",
      en: "Wide, quiet beach facing Isla Mujeres.",
    },
    mapsUrl: maps("Playa Mujeres Quintana Roo"),
  },
  {
    id: "puerto-cancun-mall",
    kind: "shopping",
    name: "Marina Town Center (Puerto Cancún)",
    zone: "costa_mujeres",
    note: {
      es: "Centro comercial moderno a unos minutos de Costa Mujeres.",
      en: "Modern mall a few minutes from Costa Mujeres.",
    },
    mapsUrl: maps("Marina Town Center Puerto Cancún"),
  },
  // Puerto Morelos
  {
    id: "playa-puerto-morelos",
    kind: "beach",
    name: "Playa de Puerto Morelos",
    zone: "puerto_morelos",
    note: {
      es: "Playa de pueblo pesquero junto al faro inclinado.",
      en: "Fishing-village beach next to the leaning lighthouse.",
    },
    mapsUrl: maps("Playa Puerto Morelos faro"),
  },
  {
    id: "mercado-artesanias-pm",
    kind: "shopping",
    name: "Mercado de Artesanías de Puerto Morelos",
    zone: "puerto_morelos",
    note: {
      es: "Puestos de artesanía local a pasos de la plaza principal.",
      en: "Local craft stalls steps from the main square.",
    },
    mapsUrl: maps("Mercado de Artesanías Puerto Morelos"),
  },
  // Playa del Carmen
  {
    id: "playa-mamitas",
    kind: "beach",
    name: "Playa Mamitas",
    zone: "playa_del_carmen",
    note: {
      es: "La playa con más ambiente de Playa del Carmen.",
      en: "Playa del Carmen's liveliest beach.",
    },
    mapsUrl: maps("Playa Mamitas Playa del Carmen"),
  },
  {
    id: "quinta-avenida",
    kind: "shopping",
    name: "Quinta Avenida",
    zone: "playa_del_carmen",
    note: {
      es: "La avenida peatonal con tiendas, cafés y artesanías.",
      en: "The pedestrian avenue with shops, cafés and crafts.",
    },
    mapsUrl: maps("Quinta Avenida Playa del Carmen"),
  },
  // Riviera Maya
  {
    id: "bahia-akumal",
    kind: "beach",
    name: "Bahía de Akumal",
    zone: "riviera_maya",
    note: {
      es: "Bahía tranquila, famosa por sus tortugas marinas.",
      en: "Calm bay famous for its sea turtles.",
    },
    mapsUrl: maps("Bahía de Akumal"),
  },
  {
    id: "quinta-avenida-rm",
    kind: "shopping",
    name: "Quinta Avenida (Playa del Carmen)",
    zone: "riviera_maya",
    note: {
      es: "La zona de compras más cercana en la Riviera Maya.",
      en: "The closest shopping area in the Riviera Maya.",
    },
    mapsUrl: maps("Quinta Avenida Playa del Carmen"),
  },
  // Puerto Aventuras
  {
    id: "playa-fatima",
    kind: "beach",
    name: "Playa Fátima",
    zone: "puerto_aventuras",
    note: {
      es: "Playa de aguas calmas junto a la marina.",
      en: "Calm-water beach next to the marina.",
    },
    mapsUrl: maps("Playa Fátima Puerto Aventuras"),
  },
  {
    id: "marina-puerto-aventuras",
    kind: "shopping",
    name: "Marina de Puerto Aventuras",
    zone: "puerto_aventuras",
    note: {
      es: "Tiendas y restaurantes alrededor de la marina.",
      en: "Shops and restaurants around the marina.",
    },
    mapsUrl: maps("Marina Puerto Aventuras"),
  },
  // Tulum
  {
    id: "playa-paraiso-tulum",
    kind: "beach",
    name: "Playa Paraíso",
    zone: "tulum",
    note: {
      es: "Una de las playas más bonitas de Tulum, cerca de las ruinas.",
      en: "One of Tulum's prettiest beaches, near the ruins.",
    },
    mapsUrl: maps("Playa Paraíso Tulum"),
  },
  {
    id: "aldea-zama",
    kind: "shopping",
    name: "Aldea Zamá",
    zone: "tulum",
    note: {
      es: "Boutiques, cafés y diseño local entre el pueblo y la playa.",
      en: "Boutiques, cafés and local design between town and beach.",
    },
    mapsUrl: maps("Aldea Zama Tulum"),
  },
];

export function placesFor(zone: HotelZone, kind: Place["kind"]): Place[] {
  return PLACES.filter((p) => p.zone === zone && p.kind === kind);
}
