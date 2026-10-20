import { env } from "./env";

/**
 * Feature flags. All read from the environment so behaviour can change
 * per deployment without code changes.
 */
export const flags = {
  /** `db` stores rendered emails in outbound_emails (dev); `resend` sends them. */
  emailProvider: () => env().EMAIL_PROVIDER,
  /** `rules` or `claude` (with automatic rules fallback). */
  aiProvider: () => env().AI_PROVIDER,
  /** Cloudflare Turnstile in front of AI generation and lead submission. */
  captchaEnabled: () => env().CAPTCHA_ENABLED,
} as const;
