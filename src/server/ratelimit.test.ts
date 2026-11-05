import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimitMemory } from "./ratelimit";

describe("rateLimit (in-memory fallback)", () => {
  beforeEach(() => resetRateLimitMemory());

  it("allows up to the limit per window and blocks after", async () => {
    const opts = { limit: 3, windowSec: 60 };
    expect((await rateLimit("t", "ip1", opts)).ok).toBe(true);
    expect((await rateLimit("t", "ip1", opts)).ok).toBe(true);
    expect((await rateLimit("t", "ip1", opts)).ok).toBe(true);
    const fourth = await rateLimit("t", "ip1", opts);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
    // Other keys and scopes are independent.
    expect((await rateLimit("t", "ip2", opts)).ok).toBe(true);
    expect((await rateLimit("other", "ip1", opts)).ok).toBe(true);
  });

  it("reads the client ip from proxy headers", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(clientIp(req)).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
