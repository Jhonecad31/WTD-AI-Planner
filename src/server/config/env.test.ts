import { describe, expect, it } from "vitest";
import { cleanEnvValue } from "./env";

describe("cleanEnvValue", () => {
  it("removes the quotes a .env line leaves when pasted into Vercel", () => {
    expect(cleanEnvValue('"WhatToDo Planner <planner@sales.whattodoincancun.com>"')).toBe(
      "WhatToDo Planner <planner@sales.whattodoincancun.com>",
    );
    expect(cleanEnvValue("'resend'")).toBe("resend");
  });

  it("trims spaces and newlines, also inside the quotes", () => {
    expect(cleanEnvValue('  "abc "\n')).toBe("abc");
    expect(cleanEnvValue("re_key\n")).toBe("re_key");
  });

  it("leaves unquoted or unbalanced values alone", () => {
    expect(cleanEnvValue("WhatToDo Planner <planner@example.com>")).toBe(
      "WhatToDo Planner <planner@example.com>",
    );
    expect(cleanEnvValue('"Name" <a@b.com>')).toBe('"Name" <a@b.com>');
    expect(cleanEnvValue('"')).toBe('"');
    expect(cleanEnvValue("")).toBe("");
  });
});
