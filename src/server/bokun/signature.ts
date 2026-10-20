import { createHmac } from "node:crypto";

/**
 * Bokun REST authentication (shared by v1 and v2).
 * Docs: bokun.dev → "Configuring the platform for API usage and authentication".
 *
 * String to sign = date + accessKey + METHOD + pathWithQuery
 * Signature      = Base64( HMAC-SHA1( secretKey, stringToSign ) )
 */

/** Formats a Date as `yyyy-MM-dd HH:mm:ss` in UTC, as Bokun requires. */
export function formatBokunDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ` +
    `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}`
  );
}

export function buildStringToSign(
  date: string,
  accessKey: string,
  method: string,
  pathWithQuery: string,
): string {
  return `${date}${accessKey}${method.toUpperCase()}${pathWithQuery}`;
}

export function signBokunRequest(params: {
  date: string;
  accessKey: string;
  secretKey: string;
  method: string;
  pathWithQuery: string;
}): string {
  const stringToSign = buildStringToSign(
    params.date,
    params.accessKey,
    params.method,
    params.pathWithQuery,
  );
  return createHmac("sha1", params.secretKey).update(stringToSign, "utf8").digest("base64");
}

export function bokunAuthHeaders(params: {
  accessKey: string;
  secretKey: string;
  method: string;
  pathWithQuery: string;
  now?: Date;
}): Record<string, string> {
  const date = formatBokunDate(params.now ?? new Date());
  return {
    "X-Bokun-Date": date,
    "X-Bokun-AccessKey": params.accessKey,
    "X-Bokun-Signature": signBokunRequest({ ...params, date }),
  };
}
