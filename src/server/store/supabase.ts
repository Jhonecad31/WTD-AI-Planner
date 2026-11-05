import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LeadRecord, OutboundEmail } from "@/lib/lead-schema";
import type { LeadStore } from "./index";

/**
 * Production store: Postgres tables `leads` and `outbound_emails` plus the private
 * `lead-pdfs` bucket (see supabase/migrations/20261105120000_leads.sql). Uses the
 * service role key, so it must only ever run on the server.
 */

export const PDF_BUCKET = "lead-pdfs";

/** Row shapes as stored (snake_case); the app keeps camelCase records. */
export interface LeadRow {
  id: string;
  ref: string;
  token: string;
  created_at: string;
  status: LeadRecord["status"];
  name: string;
  email: string;
  phone: string | null;
  locale: LeadRecord["locale"];
  consent_at: string;
  request: LeadRecord["request"];
  itinerary: LeadRecord["itinerary"];
  engine: LeadRecord["engine"];
  total_usd: number | string;
  pdf_path: string | null;
  notes: string[];
  bokun_confirmation_codes: string[];
}

export interface EmailRow {
  id: string;
  lead_id: string;
  kind: OutboundEmail["kind"];
  to: string;
  reply_to: string | null;
  subject: string;
  html: string;
  text: string;
  attachments: OutboundEmail["attachments"];
  status: OutboundEmail["status"];
  provider: OutboundEmail["provider"];
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export function leadToRow(lead: LeadRecord): LeadRow {
  return {
    id: lead.id,
    ref: lead.ref,
    token: lead.token,
    created_at: lead.createdAt,
    status: lead.status,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    locale: lead.locale,
    consent_at: lead.consentAt,
    request: lead.request,
    itinerary: lead.itinerary,
    engine: lead.engine,
    total_usd: lead.totalUsd,
    pdf_path: lead.pdfPath,
    notes: lead.notes,
    bokun_confirmation_codes: lead.bokunConfirmationCodes,
  };
}

export function rowToLead(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    ref: row.ref,
    token: row.token,
    createdAt: row.created_at,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    locale: row.locale,
    consentAt: row.consent_at,
    request: row.request,
    itinerary: row.itinerary,
    engine: row.engine,
    totalUsd: Number(row.total_usd),
    pdfPath: row.pdf_path,
    notes: row.notes ?? [],
    bokunConfirmationCodes: row.bokun_confirmation_codes ?? [],
  };
}

export function emailToRow(email: OutboundEmail): EmailRow {
  return {
    id: email.id,
    lead_id: email.leadId,
    kind: email.kind,
    to: email.to,
    reply_to: email.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments,
    status: email.status,
    provider: email.provider,
    error: email.error,
    created_at: email.createdAt,
    sent_at: email.sentAt,
  };
}

export function rowToEmail(row: EmailRow): OutboundEmail {
  return {
    id: row.id,
    leadId: row.lead_id,
    kind: row.kind,
    to: row.to,
    replyTo: row.reply_to,
    subject: row.subject,
    html: row.html,
    text: row.text,
    attachments: row.attachments ?? [],
    status: row.status,
    provider: row.provider,
    error: row.error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

/** Only the columns a patch names, in snake_case. */
function leadPatch(patch: Partial<LeadRecord>): Partial<LeadRow> {
  const full = leadToRow({ ...emptyLead, ...patch });
  const keys: (keyof LeadRecord)[] = Object.keys(patch) as (keyof LeadRecord)[];
  const out: Partial<LeadRow> = {};
  for (const k of keys) {
    const col = LEAD_COLUMNS[k];
    if (col) (out as Record<string, unknown>)[col] = full[col];
  }
  return out;
}
const LEAD_COLUMNS: Record<keyof LeadRecord, keyof LeadRow> = {
  id: "id",
  ref: "ref",
  token: "token",
  createdAt: "created_at",
  status: "status",
  name: "name",
  email: "email",
  phone: "phone",
  locale: "locale",
  consentAt: "consent_at",
  request: "request",
  itinerary: "itinerary",
  engine: "engine",
  totalUsd: "total_usd",
  pdfPath: "pdf_path",
  notes: "notes",
  bokunConfirmationCodes: "bokun_confirmation_codes",
};
const emptyLead: LeadRecord = {
  id: "",
  ref: "",
  token: "",
  createdAt: "",
  status: "new",
  name: "",
  email: "",
  phone: null,
  locale: "en",
  consentAt: "",
  request: {} as LeadRecord["request"],
  itinerary: {} as LeadRecord["itinerary"],
  engine: null,
  totalUsd: 0,
  pdfPath: null,
  notes: [],
  bokunConfirmationCodes: [],
};

function emailPatch(patch: Partial<OutboundEmail>): Partial<EmailRow> {
  const out: Partial<EmailRow> = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.provider !== undefined) out.provider = patch.provider;
  if (patch.error !== undefined) out.error = patch.error;
  if (patch.sentAt !== undefined) out.sent_at = patch.sentAt;
  if (patch.subject !== undefined) out.subject = patch.subject;
  if (patch.html !== undefined) out.html = patch.html;
  if (patch.text !== undefined) out.text = patch.text;
  return out;
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`[supabase] ${what}: ${error?.message ?? "unknown error"}`);
}

export class SupabaseLeadStore implements LeadStore {
  constructor(private readonly client: SupabaseClient) {}

  static fromEnv(url: string, serviceRoleKey: string): SupabaseLeadStore {
    return new SupabaseLeadStore(
      createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
  }

  async createLead(lead: LeadRecord) {
    const { error } = await this.client.from("leads").insert(leadToRow(lead));
    if (error) fail("createLead", error);
  }

  async getLead(id: string) {
    const { data, error } = await this.client.from("leads").select("*").eq("id", id).maybeSingle();
    if (error) fail("getLead", error);
    return data ? rowToLead(data as LeadRow) : null;
  }

  async updateLead(id: string, patch: Partial<LeadRecord>) {
    const { data, error } = await this.client
      .from("leads")
      .update(leadPatch(patch))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) fail("updateLead", error);
    return data ? rowToLead(data as LeadRow) : null;
  }

  async listLeads(limit = 50) {
    const { data, error } = await this.client
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("listLeads", error);
    return (data as LeadRow[]).map(rowToLead);
  }

  async savePdf(leadId: string, bytes: Uint8Array) {
    const path = `${leadId}.pdf`;
    const { error } = await this.client.storage
      .from(PDF_BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) fail("savePdf", error);
    return path;
  }

  async readPdf(pdfPath: string) {
    const { data, error } = await this.client.storage.from(PDF_BUCKET).download(pdfPath);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async enqueueEmail(email: OutboundEmail) {
    const { error } = await this.client.from("outbound_emails").insert(emailToRow(email));
    if (error) fail("enqueueEmail", error);
  }

  async updateEmail(id: string, patch: Partial<OutboundEmail>) {
    const { error } = await this.client
      .from("outbound_emails")
      .update(emailPatch(patch))
      .eq("id", id);
    if (error) fail("updateEmail", error);
  }

  async listEmails(limit = 50) {
    const { data, error } = await this.client
      .from("outbound_emails")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("listEmails", error);
    return (data as EmailRow[]).map(rowToEmail);
  }

  async getEmail(id: string) {
    const { data, error } = await this.client
      .from("outbound_emails")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail("getEmail", error);
    return data ? rowToEmail(data as EmailRow) : null;
  }
}
