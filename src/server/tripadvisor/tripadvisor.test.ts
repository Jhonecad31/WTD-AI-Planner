import { describe, expect, it, vi } from "vitest";
import { fetchLocation, getRatings, tripadvisorEnabled } from "./index";

describe("tripadvisor", () => {
  it("parses a location's rating, reviews and link", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rating: "4.5",
            num_reviews: "1234",
            web_url: "https://www.tripadvisor.com/Restaurant_Review-d1",
            rating_image_url: "https://static.tacdn.com/img/4.5.svg",
          }),
        ),
    ) as unknown as typeof fetch;
    const r = await fetchLocation("1", { fetchImpl, key: "k", referer: "https://x.app" });
    expect(r).toEqual({
      rating: 4.5,
      reviews: 1234,
      url: "https://www.tripadvisor.com/Restaurant_Review-d1",
      imageUrl: "https://static.tacdn.com/img/4.5.svg",
    });
    const url = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("/location/1/details?key=k");
  });

  it("returns nothing without a key, on errors or on bad data", async () => {
    const never = vi.fn();
    expect(
      await fetchLocation("1", { fetchImpl: never as unknown as typeof fetch, key: "" }),
    ).toBeNull();
    expect(never).not.toHaveBeenCalled();
    const fail = vi.fn(async () => new Response("no", { status: 403 })) as unknown as typeof fetch;
    expect(await fetchLocation("1", { fetchImpl: fail, key: "k", referer: "x" })).toBeNull();
    const bad = vi.fn(
      async () => new Response(JSON.stringify({ rating: "n/a" })),
    ) as unknown as typeof fetch;
    expect(await fetchLocation("1", { fetchImpl: bad, key: "k", referer: "x" })).toBeNull();
  });

  it("stays dormant until a key and mappings exist", async () => {
    expect(tripadvisorEnabled()).toBe(false);
    expect(await getRatings([994813])).toEqual({});
  });
});
