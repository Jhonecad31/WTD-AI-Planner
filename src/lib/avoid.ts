import type { ExperienceType } from "@/server/catalog/experience";

/**
 * "I'd rather skip…" chips in the preferences step. Each chip maps to the experience
 * types it rules out; the request stores the types, and every engine and guard filters
 * on them (`allowedForTraveler`), so this is a guarantee, unlike the free-text notes.
 */
export const AVOID_GROUPS = [
  "dolphins",
  "boats",
  "snorkel",
  "atv",
  "cenotes",
  "zipline",
  "ruins",
  "parks",
  "nightlife",
] as const;
export type AvoidGroup = (typeof AVOID_GROUPS)[number];

export const AVOID_TYPES: Record<AvoidGroup, ExperienceType[]> = {
  dolphins: ["dolphin", "whale_shark"],
  boats: ["catamaran", "speedboat", "boat", "parasail"],
  snorkel: ["snorkel"],
  atv: ["atv", "horseback"],
  cenotes: ["cenote", "cave"],
  zipline: ["zipline"],
  ruins: ["chichen", "tulum", "coba", "ek_balam", "ruins"],
  parks: ["xcaret", "xelha", "xplor", "xenses", "xavage", "jungala", "garrafon", "park"],
  nightlife: ["nightlife", "show"],
};

/** Groups whose every type is in the list (for showing the chips as selected). */
export function groupsFromTypes(types: readonly ExperienceType[]): AvoidGroup[] {
  const set = new Set(types);
  return AVOID_GROUPS.filter((g) => AVOID_TYPES[g].every((t) => set.has(t)));
}

export function typesFromGroups(groups: readonly AvoidGroup[]): ExperienceType[] {
  return [...new Set(groups.flatMap((g) => AVOID_TYPES[g]))];
}
