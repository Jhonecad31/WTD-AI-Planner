import { env } from "@/server/config/env";

/**
 * Fixed-window rate limit per key (usually the client IP). With Upstash Redis configured
 * (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) the counter is shared across
 * serverless instances; without it, an in-memory map (fine for local dev, and still a
 * brake on one instance). Never throws: if Redis is unreachable the request goes through.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Requests used in the current window, including this one. */
  count: number;
  limit: number;
  /** Seconds until the window resets. */
  retryAfterSec: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    if (memory.size > 10_000) memory.clear();
    return { ok: true, count: 1, limit, retryAfterSec: windowSec };
  }
  cur.count++;
  return {
    ok: cur.count <= limit,
    count: cur.count,
    limit,
    retryAfterSec: Math.ceil((cur.resetAt - now) / 1000),
  };
}

async function redisHit(
  key: string,
  limit: number,
  windowSec: number,
  url: string,
  token: string,
): Promise<RateLimitResult> {
  // INCR + EXPIRE (only when the key is new) in one pipeline call.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
      ["TTL", key],
    ]),
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const out = (await res.json()) as { result: number }[];
  const count = Number(out[0]?.result ?? 1);
  const ttl = Number(out[2]?.result ?? windowSec);
  return { ok: count <= limit, count, limit, retryAfterSec: ttl > 0 ? ttl : windowSec };
}

export async function rateLimit(
  scope: string,
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const fullKey = `rl:${scope}:${key}`;
  const e = env();
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await redisHit(
        fullKey,
        opts.limit,
        opts.windowSec,
        e.UPSTASH_REDIS_REST_URL,
        e.UPSTASH_REDIS_REST_TOKEN,
      );
    } catch (err) {
      console.warn("[ratelimit] Upstash unreachable, allowing request:", (err as Error).message);
      return { ok: true, count: 0, limit: opts.limit, retryAfterSec: opts.windowSec };
    }
  }
  return memoryHit(fullKey, opts.limit, opts.windowSec);
}

/** Client IP behind Vercel / proxies. */
export function clientIp(request: Request): string {
  const h = request.headers;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}

/** 429 with Retry-After for a limited request. */
export function tooMany(result: RateLimitResult, message: string): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}

/** Test helper. */
export function resetRateLimitMemory() {
  memory.clear();
}
