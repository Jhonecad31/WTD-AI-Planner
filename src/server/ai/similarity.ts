/**
 * What kind of experience a tour is, read from its title, so a trip doesn't repeat
 * the same thing (two ATV days, two cenote days, Xcaret and Xel-Há). Order matters:
 * the first kind a title matches is its main kind ("Chichén Itzá & Cenote" is ruins).
 */
const EXPERIENCE_KINDS: [string, RegExp][] = [
  ["park", /xcaret|xel-?h[aá]|xplor|xenses|xavage|xoximilco|jungala|garraf[oó]n|r[ií]o secreto/i],
  ["ruins", /ruin|ruinas|chich[eé]n|cob[aá]|tulum|ek balam/i],
  ["whale_shark", /whale shark|tibur[oó]n ballena/i],
  ["dolphin", /dolphin|delf[ií]n/i],
  ["nightlife", /night ?club|coco bongo|party|fiesta|madness|mandala/i],
  ["show", /cirque|show|joya|myst/i],
  ["day_trip", /holbox|bacalar|cozumel|coloradas|lagoon|laguna|kaan luum/i],
  ["atv", /\batv\b|buggy|buggies|cuatrimoto/i],
  ["catamaran", /catamar[aá]n|sail|velero|yacht|yate|isla mujeres/i],
  ["speedboat", /speedboat|jet ?ski|lancha|parasail/i],
  ["cenote", /cenote/i],
  ["zipline", /zip-?line|tirolesa/i],
  ["snorkel", /snorkel|reef|arrecife|turtle|tortuga/i],
  ["boat", /glass boat|clear ?boat|cruise|crucero/i],
  ["food", /taco|tequila|dinner|cena/i],
];

export function experienceKinds(p: { title: string }): string[] {
  return EXPERIENCE_KINDS.filter(([, re]) => re.test(p.title)).map(([k]) => k);
}

/**
 * How different a tour is from the ones already in the trip:
 * 2 = nothing in common, 1 = some overlap but a different main kind
 * (ATV with a cenote stop after a cenote day), 0 = the same kind of day again.
 */
export type Variety = 0 | 1 | 2;

export function variety(p: { title: string }, chosen: { title: string }[]): Variety {
  const kinds = experienceKinds(p);
  if (!kinds.length) return 2;
  let level: Variety = 2;
  for (const c of chosen) {
    const other = experienceKinds(c);
    if (other[0] === kinds[0]) return 0;
    if (kinds.some((k) => other.includes(k))) level = 1;
  }
  return level;
}
