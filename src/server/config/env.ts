import { z } from "zod";

/**
 * Server-only environment. Import this module only from server code
 * (route handlers, server components, src/server/*). Never from client components.
 *
 * Validation is lazy so that `next build` and unit tests don't need real keys.
 */
const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  LEADS_TO: z.string().default("sales@whattodoincancun.com"),
  NEXT_PUBLIC_RESPONSE_TIME_HOURS: z.coerce.number().int().positive().default(24),

  /**
   * auto = send through Resend whenever RESEND_API_KEY is set, otherwise keep the
   * emails in the outbox; db / resend force one or the other.
   */
  EMAIL_PROVIDER: z.enum(["auto", "db", "resend"]).default("auto"),
  /** rules = deterministic engine, claude = Claude API with rules fallback */
  AI_PROVIDER: z.enum(["rules", "claude"]).default("claude"),
  CAPTCHA_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  BOKUN_BASE_URL: z.string().url().default("https://api.bokun.io"),
  BOKUN_ACCESS_KEY: z.string().default(""),
  BOKUN_SECRET_KEY: z.string().default(""),
  BOKUN_BOOKING_CHANNEL_UUID: z.string().default(""),
  BOKUN_CURRENCY: z.string().default("USD"),

  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  ANTHROPIC_WORKSPACE_ID: z.string().default(""),

  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("WhatToDo Planner <planner@sales.whattodoincancun.com>"),

  TURNSTILE_SITE_KEY: z.string().default(""),
  TURNSTILE_SECRET_KEY: z.string().default(""),
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),

  CRON_SECRET: z.string().default(""),

  /** Tripadvisor Content API. Empty = ratings hidden everywhere. */
  TRIPADVISOR_API_KEY: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Values pasted into a hosting dashboard often carry a trailing newline or spaces,
 * which break HMAC signatures and HTTP headers, so they are trimmed. They also often
 * keep the quotes from a .env line (`EMAIL_FROM="Name <a@b.com>"`): dotenv strips
 * those locally but Vercel stores them as typed, and Resend then rejects the `from`.
 * One matching pair of wrapping quotes is removed.
 */
export function cleanEnvValue(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1).trim();
  }
  return v;
}

export function env(): Env {
  if (cached) return cached;
  const trimmed = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, typeof v === "string" ? cleanEnvValue(v) : v]),
  );
  const parsed = schema.safeParse(trimmed);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Throws a clear error when a required key for a feature is missing. */
export function requireEnv<K extends keyof Env>(key: K, feature: string): NonNullable<Env[K]> {
  const value = env()[key];
  if (value === "" || value === undefined || value === null) {
    throw new Error(`${feature} needs ${key} to be set in .env.local`);
  }
  return value as NonNullable<Env[K]>;
}
