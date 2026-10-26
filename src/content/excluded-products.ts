/**
 * Products the planner must never recommend even though Bokun still lists them as
 * active (e.g. no longer sold). Excluded from the AI and the editor's alternatives.
 */
export const EXCLUDED_BOKUN_IDS = new Set<number>([
  // Xcaret Plus Admission: inactive product.
  714415,
]);
