import { describe, expect, it } from "vitest";
import { bokunAuthHeaders, formatBokunDate, signBokunRequest } from "./signature";

// Worked example from Bokun's official authentication docs.
const DOC_EXAMPLE = {
  date: "2013-11-09 14:33:46",
  accessKey: "de235a6a15c340b6b1e1cb5f3687d04a",
  secretKey: "23e2c7da7f7048e5b46f96bc91324800",
  method: "POST",
  pathWithQuery: "/activity.json/search?lang=EN&currency=ISK",
  expectedSignature: "XrOiTYa9Y34zscnLCsAEh8ieoyo=",
};

describe("Bokun signature", () => {
  it("matches the example in the official documentation", () => {
    expect(signBokunRequest(DOC_EXAMPLE)).toBe(DOC_EXAMPLE.expectedSignature);
  });

  it("uppercases the HTTP method", () => {
    expect(signBokunRequest({ ...DOC_EXAMPLE, method: "post" })).toBe(
      DOC_EXAMPLE.expectedSignature,
    );
  });

  it("formats dates as yyyy-MM-dd HH:mm:ss in UTC", () => {
    expect(formatBokunDate(new Date("2013-11-09T14:33:46Z"))).toBe("2013-11-09 14:33:46");
    expect(formatBokunDate(new Date("2026-01-05T03:07:09Z"))).toBe("2026-01-05 03:07:09");
  });

  it("builds the three auth headers", () => {
    const headers = bokunAuthHeaders({
      accessKey: DOC_EXAMPLE.accessKey,
      secretKey: DOC_EXAMPLE.secretKey,
      method: DOC_EXAMPLE.method,
      pathWithQuery: DOC_EXAMPLE.pathWithQuery,
      now: new Date("2013-11-09T14:33:46Z"),
    });
    expect(headers).toEqual({
      "X-Bokun-Date": DOC_EXAMPLE.date,
      "X-Bokun-AccessKey": DOC_EXAMPLE.accessKey,
      "X-Bokun-Signature": DOC_EXAMPLE.expectedSignature,
    });
  });
});
