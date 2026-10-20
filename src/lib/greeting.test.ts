import { describe, expect, it } from "vitest";
import { greetingFor } from "./greeting";

describe("greetingFor", () => {
  it("uses the chosen title and name", () => {
    expect(greetingFor({ locale: "en", travelerTitle: "mr" }, "André")).toBe(
      "Mr. André, your Cancún adventure starts here. We've created a personalized itinerary to help you make the most of every day.",
    );
    expect(greetingFor({ locale: "es", travelerTitle: "ms" }, "Ana")).toMatch(
      /^Sra\. Ana, tu aventura en Cancún empieza aquí\./,
    );
  });
  it("never adds a title that wasn't picked, and drops it without a name", () => {
    expect(greetingFor({ locale: "en" }, "Sam")).toMatch(/^Sam, your Cancún adventure/);
    expect(greetingFor({ locale: "es", travelerTitle: "mr" }, "  ")).toBe(
      "Tu aventura en Cancún empieza aquí. Creamos un itinerario personalizado para que aproveches cada día.",
    );
  });
});
