import { render } from "@react-email/components";
import { createElement } from "react";
import { env } from "@/server/config/env";
import { flags } from "@/server/config/flags";
import { getLeadStore, newId } from "@/server/store";
import type { LeadRecord, OutboundEmail } from "@/lib/lead-schema";
import { AgentLeadEmail, CustomerTripEmail } from "./templates";

/**
 * EmailProvider: `db` stores rendered emails (visible in /dev/outbox) and never sends;
 * `resend` sends through Resend. Both leave a row in the outbox for the panel.
 */

export interface EmailProvider {
  readonly name: "db" | "resend";
  /*send(email: OutboundEmail): Promise<{ ok: true; id?: string } | { ok: false; error: string }>;*/
  /*Actualice este export para poder generar el PDF desde memoria saltando el paso de guardarlo antes
  para un mejor funcionamiento*/ 
  send(
  email: OutboundEmail,
  pdfBytes?: Uint8Array,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
}

const dbProvider: EmailProvider = {
  name: "db",
  async send() {
    return { ok: true };
  },
};

/*function resendProvider(): EmailProvider {
  return {
    name: "resend",
    async send(email) {
      const { Resend } = await import("resend");
      const client = new Resend(env().RESEND_API_KEY);
      const store = getLeadStore();
      const attachments = await Promise.all(
        email.attachments.map(async (a) => ({
          filename: a.filename,
          content: Buffer.from((await store.readPdf(a.path)) ?? new Uint8Array()),
        })),
      );
      const { data, error } = await client.emails.send({
        from: env().EMAIL_FROM,
        to: email.to,
        replyTo: email.replyTo ?? undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id };
    },
  };
}*/
/*Ocultamos la version de resendprovider para el envio directo de resent */

function resendProvider(): EmailProvider {
  return {
    name: "resend",

    async send(email, pdfBytes) {
      const { Resend } = await import("resend");
      const client = new Resend(env().RESEND_API_KEY);

      const attachments = pdfBytes
        ? [
            {
              filename:
                email.attachments[0]?.filename ?? "WhatToDo-itinerary.pdf",
              content: Buffer.from(pdfBytes),
            },
          ]
        : [];

      const { data, error } = await client.emails.send({
        from: env().EMAIL_FROM,
        to: email.to,
        replyTo: email.replyTo ?? undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments,
      });

      if (error) return { ok: false, error: error.message };

      return { ok: true, id: data?.id };
    },
  };
}

export function getEmailProvider(): EmailProvider {
  return flags.emailProvider() === "resend" && env().RESEND_API_KEY ? resendProvider() : dbProvider;
}

async function renderBoth(node: React.ReactElement) {
  const html = await render(node);
  const text = await render(node, { plainText: true });
  return { html, text };
}

export function pdfUrlFor(lead: LeadRecord): string {
  return `${env().NEXT_PUBLIC_APP_URL}/api/lead/${lead.id}/pdf?t=${lead.token}`;
}

/** Builds, stores and (if enabled) sends the customer + agent emails for a lead. */
/*export async function sendLeadEmails(lead: LeadRecord): Promise<OutboundEmail[]> {*/
/*Actualizamos el promise para evitar el duplicado y mejorar el envio*/
export async function sendLeadEmails(
  lead: LeadRecord,
  pdfBytes?: Uint8Array,
): Promise<OutboundEmail[]> {

  const e = env();
  const provider = getEmailProvider();
  const store = getLeadStore();
  const appUrl = e.NEXT_PUBLIC_APP_URL;
  const pdfUrl = pdfUrlFor(lead);
  const attachments = lead.pdfPath
    ? [{ filename: `WhatToDo-itinerary-${lead.ref}.pdf`, path: lead.pdfPath }]
    : [];
  const es = lead.locale === "es";

  const customer = await renderBoth(
    createElement(CustomerTripEmail, {
      lead,
      appUrl,
      pdfUrl,
      responseHours: e.NEXT_PUBLIC_RESPONSE_TIME_HOURS,
    }),
  );
  const agent = await renderBoth(
    createElement(AgentLeadEmail, { lead, appUrl, pdfUrl, engine: lead.engine }),
  );

  const nights = Math.max(0, lead.itinerary.days.length - 1);
  const adults = lead.request.travelers.filter((t) => t.age >= 13).length;
  const kids = lead.request.travelers.length - adults;
  const now = new Date().toISOString();

  const emails: OutboundEmail[] = [
    {
      id: newId(),
      leadId: lead.id,
      kind: "customer",
      to: lead.email,
      replyTo: e.LEADS_TO,
      subject: es
        ? `Tu itinerario en Cancún está listo · ${lead.ref}`
        : `Your Cancun itinerary is ready · ${lead.ref}`,
      ...customer,
      attachments,
      status: "pending",
      provider: provider.name,
      error: null,
      createdAt: now,
      sentAt: null,
    },
    {
      id: newId(),
      leadId: lead.id,
      kind: "agent",
      to: e.LEADS_TO,
      replyTo: lead.email,
      subject: `[Lead ${lead.ref}] ${lead.name} · ${nights} nights · ${adults} adult${adults === 1 ? "" : "s"}${kids ? ` + ${kids} kid${kids === 1 ? "" : "s"}` : ""} · $${Math.round(lead.itinerary.totals.totalUsd)} USD`,
      ...agent,
      attachments,
      status: "pending",
      provider: provider.name,
      error: null,
      createdAt: now,
      sentAt: null,
    },
  ];

  /*for (const email of emails) {
    await store.enqueueEmail(email);
    if (provider.name === "db") continue; // dev: stays pending, visible in the outbox
    const result = await provider.send(email);
    const patch: Partial<OutboundEmail> = result.ok
      ? { status: "sent", sentAt: new Date().toISOString() }
      : { status: "failed", error: result.error };
    Object.assign(email, patch);
    await store.updateEmail(email.id, patch);
  }*/
 /*Con esto evitamos archivos locales y todo se envia directo con almacenamiento temporal0*/
 for (const email of emails) {
  // En desarrollo conservamos el comportamiento actual del outbox.
  // En Vercel no escribimos archivos locales.
  if (process.env.VERCEL !== "1") {
    await store.enqueueEmail(email);
  }

  if (provider.name === "db") continue;

  const result = await provider.send(email, pdfBytes);

  const patch: Partial<OutboundEmail> = result.ok
    ? { status: "sent", sentAt: new Date().toISOString() }
    : { status: "failed", error: result.error };

  Object.assign(email, patch);

  if (process.env.VERCEL !== "1") {
    await store.updateEmail(email.id, patch);
  }
}
  return emails;
}
