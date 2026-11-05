import { describe, expect, it } from "vitest";
import type { LeadRecord, OutboundEmail } from "@/lib/lead-schema";
import { emailToRow, leadToRow, rowToEmail, rowToLead } from "./supabase";

const lead: LeadRecord = {
  id: "0b6f1a8e-1c1e-4a4a-9c6e-7d2f2c3b4a55",
  ref: "WTD-7K3M9",
  token: "tok",
  createdAt: "2026-11-05T10:00:00.000Z",
  status: "new",
  name: "Ana",
  email: "ana@example.com",
  phone: null,
  locale: "es",
  consentAt: "2026-11-05T10:00:00.000Z",
  request: { locale: "es" } as LeadRecord["request"],
  itinerary: { warnings: ["Variety: swapped x"] } as unknown as LeadRecord["itinerary"],
  engine: "claude",
  totalUsd: 884.5,
  pdfPath: null,
  notes: [],
  bokunConfirmationCodes: ["ABC123"],
};

describe("Supabase row mapping", () => {
  it("round-trips a lead, keeping the itinerary JSON (with the server warnings) intact", () => {
    const row = leadToRow(lead);
    expect(row.created_at).toBe(lead.createdAt);
    expect(row.total_usd).toBe(884.5);
    // Postgres numeric comes back as a string.
    expect(rowToLead({ ...row, total_usd: "884.50" })).toEqual(lead);
  });

  it("round-trips an outbound email", () => {
    const email: OutboundEmail = {
      id: "1b6f1a8e-1c1e-4a4a-9c6e-7d2f2c3b4a55",
      leadId: lead.id,
      kind: "agent",
      to: "sales@example.com",
      replyTo: "ana@example.com",
      subject: "[Lead] Ana",
      html: "<p>hi</p>",
      text: "hi",
      attachments: [{ filename: "trip.pdf", path: "x.pdf" }],
      status: "pending",
      provider: "db",
      error: null,
      createdAt: "2026-11-05T10:00:01.000Z",
      sentAt: null,
    };
    expect(rowToEmail(emailToRow(email))).toEqual(email);
  });
});
