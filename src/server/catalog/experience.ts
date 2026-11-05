import type { Interest } from "./types";

/**
 * What kind of experience a tour is, read from its title. Shared by the catalog
 * tagging (the main type decides the tour's main interest) and by the planner
 * engines (a trip never repeats the same kind of day: two ATV days, two dolphin
 * swims, two Chichén Itzá variants).
 *
 * Order matters: the first type a title matches is its MAIN type, so
 * "Chichén Itzá & Cenote" is Chichén, "ATV, Zipline & Cenote" is ATV and
 * "Catamaran & Dolphin Swim" is dolphins. Places get their own type (Chichén,
 * Tulum, Cobá; Xcaret, Xel-Há, Xplor; Holbox, Bacalar…) because visiting two
 * different sites is not a repeat; the family types at the end ("ruins", "park",
 * "day_trip") only add a secondary link between them.
 */
export const EXPERIENCE_TYPES = [
  "romantic",
  "show",
  "nightlife",
  "whale_shark",
  "dolphin",
  "xcaret",
  "xelha",
  "xplor",
  "xenses",
  "xavage",
  "jungala",
  "garrafon",
  "chichen",
  "tulum",
  "coba",
  "ek_balam",
  "holbox",
  "bacalar",
  "cozumel",
  "coloradas",
  "kaan_luum",
  "cave",
  "atv",
  "horseback",
  "catamaran",
  "parasail",
  "speedboat",
  "cenote",
  "zipline",
  "snorkel",
  "boat",
  "beach_club",
  "food",
  "spa",
  // Families: never the main type when a more specific one matched.
  "park",
  "ruins",
  "day_trip",
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

const RULES: { type: ExperienceType; re: RegExp; interest: Interest }[] = [
  { type: "romantic", re: /romantic|rom[aá]ntic|honeymoon|luna de miel/i, interest: "couples" },
  { type: "show", re: /cirque|\bshow\b|\bjoya\b|\bmyst\b/i, interest: "party" },
  {
    type: "nightlife",
    re: /night ?club|coco bongo|\bparty\b|fiesta|madness|open bar|antro/i,
    interest: "party",
  },
  { type: "whale_shark", re: /whale shark|tibur[oó]n ballena/i, interest: "water" },
  { type: "dolphin", re: /dolphin|delf[ií]n/i, interest: "water" },
  { type: "xcaret", re: /xcaret/i, interest: "parks" },
  { type: "xelha", re: /xel-?h[aá]/i, interest: "parks" },
  { type: "xplor", re: /xplor/i, interest: "parks" },
  { type: "xenses", re: /xenses/i, interest: "parks" },
  { type: "xavage", re: /xavage/i, interest: "parks" },
  { type: "jungala", re: /jungala/i, interest: "parks" },
  { type: "garrafon", re: /garraf[oó]n/i, interest: "parks" },
  { type: "chichen", re: /chich[eé]n|\bitz[aá]\b/i, interest: "cultural" },
  { type: "tulum", re: /tulum/i, interest: "cultural" },
  { type: "coba", re: /\bcob[aá]\b/i, interest: "cultural" },
  { type: "ek_balam", re: /ek ?balam/i, interest: "cultural" },
  { type: "holbox", re: /holbox/i, interest: "water" },
  { type: "bacalar", re: /bacalar/i, interest: "water" },
  { type: "cozumel", re: /cozumel/i, interest: "water" },
  { type: "coloradas", re: /coloradas|r[ií]o lagartos?/i, interest: "water" },
  { type: "kaan_luum", re: /kaan ?luum/i, interest: "water" },
  { type: "cave", re: /r[ií]o secreto|\bcaves?\b|caverna|gruta/i, interest: "adventure" },
  { type: "atv", re: /\batv\b|buggy|buggies|cuatrimoto/i, interest: "adventure" },
  { type: "horseback", re: /horseback|a caballo|cabalgata/i, interest: "adventure" },
  {
    type: "catamaran",
    re: /catamar[aá]n|\bsail|velero|yacht|yate|isla mujeres/i,
    interest: "water",
  },
  { type: "parasail", re: /parasail/i, interest: "adventure" },
  {
    type: "speedboat",
    re: /speed ?boat|jet ?ski|lancha|moto acu[aá]tica/i,
    interest: "adventure",
  },
  // "Marine cenote" on a reef snorkel is a snorkel stop, not a cenote day.
  { type: "cenote", re: /(?<!marine )cenote/i, interest: "water" },
  { type: "zipline", re: /zip-?lin|tirolesa/i, interest: "adventure" },
  {
    type: "snorkel",
    re: /snorkel|\breef\b|arrecife|turtle|tortuga|scuba|\bdiv(e|ing)\b|buceo/i,
    interest: "water",
  },
  {
    type: "boat",
    re: /glass ?boat|clear ?boat|cruise|crucero|boat ride|paseo en barco/i,
    interest: "water",
  },
  { type: "beach_club", re: /beach club|club de playa/i, interest: "beach" },
  {
    type: "food",
    re: /\btacos?\b|tequila|mezcal|dinner|\bcena\b|culinary|gastro|cooking|tasting/i,
    interest: "food",
  },
  { type: "spa", re: /\bspa\b|temazcal|massage|masaje|yoga|wellness/i, interest: "chill" },
  // Families.
  {
    type: "park",
    re: /xcaret|xel-?h[aá]|xplor|xenses|xavage|jungala|garraf[oó]n|\bparks?\b|parque/i,
    interest: "parks",
  },
  {
    type: "ruins",
    re: /\bruins?\b|ruinas|chich[eé]n|\bitz[aá]\b|tulum|\bcob[aá]\b|ek ?balam|valladolid|zona arqueol/i,
    interest: "cultural",
  },
  {
    type: "day_trip",
    re: /holbox|bacalar|cozumel|coloradas|kaan ?luum|contoy|day trip|excursi[oó]n/i,
    interest: "water",
  },
];

const INTEREST_OF: Record<ExperienceType, Interest> = Object.fromEntries(
  RULES.map((r) => [r.type, r.interest]),
) as Record<ExperienceType, Interest>;

/** Every type the title names, main type first. Empty when the title says nothing. */
export function experienceTypes(p: { title: string }): ExperienceType[] {
  return RULES.filter((r) => r.re.test(p.title)).map((r) => r.type);
}

/** The main type (first match) or null. */
export function mainExperience(p: { title: string }): ExperienceType | null {
  return experienceTypes(p)[0] ?? null;
}

/** The interest the main type stands for: Chichén → cultural, ATV → adventure, dolphins → water… */
export function primaryInterest(p: { title: string }): Interest | null {
  const main = mainExperience(p);
  return main ? INTEREST_OF[main] : null;
}

/**
 * How different a tour is from the ones already in the trip:
 * 2 = nothing in common, 1 = some overlap but a different main type
 * (Tulum after Chichén, ATV with a cenote stop after a cenote day),
 * 0 = the same kind of day again (a second dolphin swim, Xcaret twice).
 */
export type Variety = 0 | 1 | 2;

export function variety(p: { title: string }, chosen: { title: string }[]): Variety {
  const types = experienceTypes(p);
  if (!types.length) return 2;
  let level: Variety = 2;
  for (const c of chosen) {
    const other = experienceTypes(c);
    if (other[0] === types[0]) return 0;
    if (types.some((t) => other.includes(t))) level = 1;
  }
  return level;
}
