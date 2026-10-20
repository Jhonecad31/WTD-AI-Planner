import { describe, expect, it } from "vitest";
import { XCARET_PARK_RE } from "./normalize";

describe("Grupo Xcaret parks", () => {
  it("recognizes the parks by name", () => {
    for (const t of [
      "Xcaret Plus Admission From Cancun",
      "Xelha All Inclusive From Cancun",
      "Xel-Há Park",
      "Xplor Fuego",
      "Xoximilco Cancun Mexican Party",
      "Xenses Park",
    ])
      expect(XCARET_PARK_RE.test(t)).toBe(true);
    for (const t of ["Isla Mujeres Catamaran", "Extreme Buggy Adventure", "Xtreme ATV"])
      expect(XCARET_PARK_RE.test(t)).toBe(false);
  });
});
