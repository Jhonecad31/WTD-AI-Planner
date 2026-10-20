import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertReadOnly, bokunRequest, BokunError } from "./client";

describe("assertReadOnly", () => {
  it("allows GET on activity endpoints", () => {
    expect(() => assertReadOnly("GET", "/activity.json/123")).not.toThrow();
    expect(() => assertReadOnly("GET", "/restapi/v2.0/availability/123")).not.toThrow();
  });

  it("allows only the search POST", () => {
    expect(() => assertReadOnly("POST", "/activity.json/search")).not.toThrow();
    expect(() => assertReadOnly("POST", "/activity.json/123")).toThrow(/read-only/);
    expect(() => assertReadOnly("PUT", "/restapi/v2.0/experience/1")).toThrow(/read-only/);
  });

  it("blocks every booking-related path, even GET", () => {
    for (const p of [
      "/cart.json/abc/activity",
      "/shopping-cart.json/session/abc",
      "/checkout.json/submit",
      "/booking.json/booking/XYZ",
    ]) {
      expect(() => assertReadOnly("GET", p)).toThrow(/read-only/);
      expect(() => assertReadOnly("POST", p)).toThrow(/read-only/);
    }
  });
});

describe("bokunRequest", () => {
  beforeEach(() => {
    process.env.BOKUN_ACCESS_KEY = "access";
    process.env.BOKUN_SECRET_KEY = "secret";
    process.env.BOKUN_BASE_URL = "https://api.bokun.io";
  });

  it("signs the request and parses JSON", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(String(url)).toBe("https://api.bokun.io/activity.json/5?lang=EN&currency=USD");
      expect(headers["X-Bokun-AccessKey"]).toBe("access");
      expect(headers["X-Bokun-Signature"]).toMatch(/=$/);
      expect(headers["X-Bokun-Date"]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      return new Response(JSON.stringify({ id: 5 }), { status: 200 });
    }) as unknown as typeof fetch;

    const data = await bokunRequest<{ id: number }>("/activity.json/5", {
      query: { lang: "EN", currency: "USD" },
      fetchImpl,
    });
    expect(data).toEqual({ id: 5 });
  });

  it("retries once on 429 then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response("", { status: 429, headers: { "Retry-After": "0" } });
      }
      return new Response(JSON.stringify([1, 2]), { status: 200 });
    }) as unknown as typeof fetch;

    const data = await bokunRequest<number[]>("/activity.json/active-ids", { fetchImpl });
    expect(data).toEqual([1, 2]);
    expect(calls).toBe(2);
  });

  it("throws BokunError with status and body on failure", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ message: "nope" }), { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(bokunRequest("/activity.json/1", { fetchImpl })).rejects.toMatchObject({
      name: "BokunError",
      status: 403,
      body: { message: "nope" },
    } satisfies Partial<BokunError>);
  });
});
