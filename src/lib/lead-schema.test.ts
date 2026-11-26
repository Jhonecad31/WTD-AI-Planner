import { describe, expect, it } from "vitest";
import { LeadInputSchema, isValidLocalPhone, isValidPhone } from "./lead-schema";

const base = {
  name: "Ana García",
  email: "ana@example.com",
  phone: "+52 998 123 4567",
  origin: "Monterrey, México",
  consent: true,
  locale: "es",
};

describe("isValidPhone", () => {
  it("accepts numbers from any country with their code", () => {
    for (const p of ["+52 998 123 4567", "+1 305 555 0123", "+44 20 7946 0958", "+34 612-345-678"])
      expect(isValidPhone(p)).toBe(true);
  });
  it("rejects numbers without a country code, too short or with letters", () => {
    for (const p of ["998 123 4567", "+52", "+52 123", "+52 abc 1234567", ""])
      expect(isValidPhone(p)).toBe(false);
  });
});

describe("isValidLocalPhone", () => {
  it("wants at least 6 digits and no plus sign", () => {
    expect(isValidLocalPhone("998 123 4567")).toBe(true);
    expect(isValidLocalPhone("(305) 555-0123")).toBe(true);
    expect(isValidLocalPhone("12345")).toBe(false);
    expect(isValidLocalPhone("+52 998 123 4567")).toBe(false);
    expect(isValidLocalPhone("telefono")).toBe(false);
  });
});

describe("LeadInputSchema", () => {
  it("accepts a complete lead", () => {
    expect(LeadInputSchema.safeParse(base).success).toBe(true);
  });
  it.each(["name", "email", "phone", "origin"])("requires %s", (field) => {
    const rest: Record<string, unknown> = { ...base };
    delete rest[field];
    expect(LeadInputSchema.safeParse(rest).success).toBe(false);
    expect(LeadInputSchema.safeParse({ ...base, [field]: "" }).success).toBe(false);
  });
  it("rejects a phone without country code", () => {
    expect(LeadInputSchema.safeParse({ ...base, phone: "998 123 4567" }).success).toBe(false);
  });
});
