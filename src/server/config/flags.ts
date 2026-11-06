import { env } from "./env";

/**
 * Feature flags. All read from the environment so behaviour can change
 * per deployment without code changes.
 */
export const flags = {
  /**
   * The email provider that will actually be used: `resend` when EMAIL_PROVIDER=resend
   * or when it is `auto` (the default) and RESEND_API_KEY is set; `db` (outbox only)
   * otherwise. Setting the key alone is enough to go live.
   */
  emailProvider: (): "db" | "resend" => {
    const e = env();
    const hasKey = e.RESEND_API_KEY.length > 0;
    if (e.EMAIL_PROVIDER === "db") return "db";
    if (hasKey) return "resend";
    if (e.EMAIL_PROVIDER === "resend") {
      console.warn(
        "[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is empty; emails stay in the outbox",
      );
    }
    return "db";
  },
  /** `rules` or `claude` (with automatic rules fallback). */
  aiProvider: () => env().AI_PROVIDER,
  /** Cloudflare Turnstile in front of AI generation and lead submission. */
  captchaEnabled: () => env().CAPTCHA_ENABLED,
} as const;
