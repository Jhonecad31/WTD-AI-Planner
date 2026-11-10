import { env } from "@/server/config/env";
import { flags } from "@/server/config/flags";

/**
 * Deployment check: which integrations are configured. Never returns secret values,
 * only whether each variable is present, so it is safe to open in a browser.
 */
export async function GET() {
  const e = env();
  const has = (v: string) => v.trim().length > 0;
  const checks = {
    bokun: has(e.BOKUN_ACCESS_KEY) && has(e.BOKUN_SECRET_KEY),
    bokunChannel: has(e.BOKUN_BOOKING_CHANNEL_UUID),
    anthropic: has(e.ANTHROPIC_API_KEY),
    resend: has(e.RESEND_API_KEY),
    tripadvisor: has(e.TRIPADVISOR_API_KEY),
    supabase: has(e.NEXT_PUBLIC_SUPABASE_URL) && has(e.SUPABASE_SERVICE_ROLE_KEY),
  };
  const modes = {
    aiProvider: e.AI_PROVIDER,
    emailProvider: e.EMAIL_PROVIDER,
    /** What sendLeadEmails will really do: "resend" sends, "db" only keeps the outbox. */
    effectiveEmailProvider: flags.emailProvider(),
    emailFrom: e.EMAIL_FROM,
    appUrl: e.NEXT_PUBLIC_APP_URL,
    leadsTo: e.LEADS_TO ? "set" : "missing",
  };
  const missing = Object.entries(checks)
    .filter(([k, ok]) => !ok && ["bokun", "bokunChannel", "anthropic"].includes(k))
    .map(([k]) => k);
  return Response.json(
    {
      ok: missing.length === 0,
      missing,
      configured: checks,
      modes,
      hint:
        missing.length > 0
          ? "Add the variables listed in .env.example to Vercel → Settings → Environment Variables, then redeploy."
          : "All required integrations are configured.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
