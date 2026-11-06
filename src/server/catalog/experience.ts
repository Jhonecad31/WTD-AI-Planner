import type { Interest } from "./types";
import { EXPERIENCE_OVERRIDES } from "@/content/experience-overrides";

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

type Product = { title: string; bokunId?: number };

function overrideFor(p: Product) {
  return p.bokunId !== undefined ? EXPERIENCE_OVERRIDES[p.bokunId] : undefined;
}

/**
 * Every type the title names, main type first. Empty when the title says nothing.
 * A hand-set type (`content/experience-overrides.ts`) goes first.
 */
export function experienceTypes(p: Product): ExperienceType[] {
  const fromTitle = RULES.filter((r) => r.re.test(p.title)).map((r) => r.type);
  const o = overrideFor(p);
  const ordered = o?.type ? [o.type, ...fromTitle.filter((t) => t !== o.type)] : fromTitle;
  // What the tour also includes per its description (zipline at a cenote park, snorkel on
  // a dolphin day…): read once from Bokun and kept in the overrides file.
  const extra = (o?.activities ?? []).filter((t) => !ordered.includes(t));
  return [...ordered, ...extra];
}

/** Commercial priority points from the overrides (0 when none). */
export function commercialBoost(p: Product): number {
  return overrideFor(p)?.boost ?? 0;
}

/** The main type (first match) or null. */
export function mainExperience(p: Product): ExperienceType | null {
  return experienceTypes(p)[0] ?? null;
}

/**
 * The interest the main type stands for: Chichén → cultural, ATV → adventure, dolphins →
 * water… A hand-set interest list wins (its first entry is the main interest).
 */
export function primaryInterest(p: Product): Interest | null {
  const forced = overrideFor(p)?.interests?.[0];
  if (forced) return forced;
  const main = mainExperience(p);
  return main ? INTEREST_OF[main] : null;
}

/**
 * Where a tour happens along the coast, north to south, on the same scale as the
 * hotel zones. "far" = a long drive from every zone (Chichén Itzá, Holbox, Bacalar),
 * which counts as a fixed FAR_STEPS away. Null = unknown: no distance penalty.
 */
export const AREAS = [
  "costa_mujeres",
  "cancun",
  "puerto_morelos",
  "playa_del_carmen",
  "riviera_maya",
  "puerto_aventuras",
  "tulum",
] as const;
export type Area = (typeof AREAS)[number];
/** What a "far" day trip costs in hotel zones (about a 2-3 h drive each way). */
export const FAR_STEPS = 3;

const AREA_RULES: { area: Area | "far"; re: RegExp }[] = [
  {
    area: "far",
    re: /chich[eé]n|\bitz[aá]\b|ek ?balam|valladolid|holbox|chiquil[aá]|bacalar|coloradas|r[ií]o lagartos?|izamal|m[eé]rida/i,
  },
  { area: "tulum", re: /tulum|kaan ?luum|\bcob[aá]\b|casa tortuga/i },
  { area: "puerto_aventuras", re: /akumal|puerto aventuras/i },
  {
    area: "puerto_morelos",
    re: /puerto morelos|extreme adventur|cenotes? adventuring|ruta de los cenotes/i,
  },
  { area: "riviera_maya", re: /riviera maya|xel-?h[aá]|jungala|cirque|\bjoya\b|playa para[ií]so/i },
  {
    area: "playa_del_carmen",
    re: /playa del carmen|xcaret|xplor|xenses|xavage|r[ií]o secreto|cozumel/i,
  },
  {
    area: "cancun",
    re: /canc[uú]n|isla mujeres|hotel zone|zona hotelera|nichupt[eé]|coco bongo|mandala|vaquita|rakata|d'cave|garraf[oó]n|whale shark|xoximilco|madness|parasail|jet ?ski|columbus|glass ?boat|clear ?boat|baby dancer|\bmyst\b/i,
  },
];

export function areaOf(p: Product): Area | "far" | null {
  const forced = overrideFor(p)?.area;
  if (forced) return forced;
  return AREA_RULES.find((r) => r.re.test(p.title))?.area ?? null;
}

/** Zones apart between the hotel and the tour (0 = same area, far = FAR_STEPS); null when unknown. */
export function zoneDistance(p: Product, zone: Area): number | null {
  const area = areaOf(p);
  if (!area) return null;
  if (area === "far") return FAR_STEPS;
  return Math.abs(AREAS.indexOf(area) - AREAS.indexOf(zone));
}

/**
 * How different a tour is from the ones already in the trip:
 * 2 = nothing in common, 1 = some overlap but a different main type
 * (Tulum after Chichén, ATV with a cenote stop after a cenote day),
 * 0 = the same kind of day again (a second dolphin swim, Xcaret twice).
 */
export type Variety = 0 | 1 | 2;

const FAMILIES: ReadonlySet<ExperienceType> = new Set(["park", "ruins", "day_trip"]);
/** Named places: visiting the same one twice is a repeat whatever the day's headline. */
const PLACES: ReadonlySet<ExperienceType> = new Set([
  "chichen",
  "tulum",
  "coba",
  "ek_balam",
  "xcaret",
  "xelha",
  "xplor",
  "xenses",
  "xavage",
  "jungala",
  "garrafon",
  "holbox",
  "bacalar",
  "cozumel",
  "coloradas",
  "kaan_luum",
]);

/**
 * Two tours are the same kind of day when they share the main type, or when one's main
 * thing is part of the other and they share two or more activities ("ATV, zipline &
 * cenote" vs "Cenotes adventure with ziplines"), or when they share three. Chichén with
 * a cenote stop after Tulum with a cenote stop is not a repeat: one shared stop only.
 */
export function sameKindOfDay(a: Product, b: Product): boolean {
  // Hand-curated duplicates (the three Río Secreto combos, the two clear-boat rides).
  const fa = overrideFor(a)?.family;
  if (fa && fa === overrideFor(b)?.family) return true;
  const ta = experienceTypes(a);
  const tb = experienceTypes(b);
  if (!ta.length || !tb.length) return false;
  if (ta[0] === tb[0]) return true;
  const shared = ta.filter((t) => tb.includes(t) && !FAMILIES.has(t));
  // The same ruins or island twice (Tulum with Río Secreto after Tulum with Cobá): a repeat.
  if (shared.some((t) => PLACES.has(t))) return true;
  if (shared.length >= 3) return true;
  const mainInOther = tb.includes(ta[0]) || ta.includes(tb[0]);
  return mainInOther && shared.length >= 2;
}

export function variety(p: Product, chosen: Product[]): Variety {
  const types = experienceTypes(p);
  if (!types.length) return 2;
  let level: Variety = 2;
  for (const c of chosen) {
    if (sameKindOfDay(p, c)) return 0;
    const other = experienceTypes(c);
    if (types.some((t) => other.includes(t))) level = 1;
  }
  return level;
}
