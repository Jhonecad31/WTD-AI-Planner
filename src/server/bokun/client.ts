import { env, requireEnv } from "@/server/config/env";
import { bokunAuthHeaders } from "./signature";

/**
 * Minimal READ-ONLY Bokun REST client (v1 + v2 share auth).
 *
 * Allowed: any GET, and `POST /activity.json/search` (a search, writes nothing).
 * Forbidden by design: /cart.json, /checkout.json, /booking.json, /shopping-cart.json
 * and every v2 POST/PUT/DELETE. `assertReadOnly` enforces this at runtime so a
 * future mistake cannot turn into a reservation — the API key is read-only too.
 */

const WRITE_PATH_PREFIXES = [
  "/cart.json",
  "/shopping-cart.json",
  "/checkout.json",
  "/booking.json",
];
const ALLOWED_POST_PATHS = new Set(["/activity.json/search", "/route.json/check-availability"]);

export class BokunError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "BokunError";
  }
}

export function assertReadOnly(method: string, path: string): void {
  const m = method.toUpperCase();
  if (WRITE_PATH_PREFIXES.some((p) => path.startsWith(p))) {
    throw new Error(`Bokun client is read-only: ${path} is not allowed`);
  }
  if (m === "GET") return;
  if (m === "POST" && ALLOWED_POST_PATHS.has(path)) return;
  throw new Error(`Bokun client is read-only: ${m} ${path} is not allowed`);
}

type Query = Record<string, string | number | boolean | undefined>;

function withQuery(path: string, query?: Query): string {
  const url = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) url.set(k, String(v));
  }
  const qs = url.toString();
  return qs ? `${path}?${qs}` : path;
}

const MAX_RETRIES = 3;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export interface BokunRequestOptions {
  method?: "GET" | "POST";
  query?: Query;
  body?: unknown;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Performs a signed request. Path must start with "/" and exclude the host.
 * Retries on 429 honouring Retry-After (Bokun limit: 400 req/min per vendor).
 */
export async function bokunRequest<T>(path: string, opts: BokunRequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const pathOnly = path.split("?")[0];
  assertReadOnly(method, pathOnly);

  const accessKey = requireEnv("BOKUN_ACCESS_KEY", "Bokun");
  const secretKey = requireEnv("BOKUN_SECRET_KEY", "Bokun");
  const baseUrl = env().BOKUN_BASE_URL.replace(/\/$/, "");
  const pathWithQuery = withQuery(path, opts.query);
  const fetchImpl = opts.fetchImpl ?? fetch;

  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...bokunAuthHeaders({ accessKey, secretKey, method, pathWithQuery }),
    };
    if (method === "POST") headers["Content-Type"] = "application/json;charset=UTF-8";

    const res = await fetchImpl(`${baseUrl}${pathWithQuery}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
      cache: "no-store",
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      await sleep(Math.min(retryAfter, 30) * 1000);
      continue;
    }

    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }

    if (!res.ok) {
      throw new BokunError(
        `Bokun ${method} ${pathOnly} failed with ${res.status}`,
        res.status,
        json,
      );
    }
    return json as T;
  }
}

/** Common query params Bokun v1 accepts on most activity endpoints. */
export function defaultQuery(): Query {
  return { lang: "EN", currency: env().BOKUN_CURRENCY };
}
