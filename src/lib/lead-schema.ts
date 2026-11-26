import { z } from "zod";
import { TripRequestSchema, type TripRequest } from "./trip-schema";
import { ItinerarySchema, type Itinerary } from "./itinerary-schema";

/**
 * A usable phone in international form: starts with the country code (`+52 …`), only
 * digits, spaces and - ( ) . after it, and at least 8 digits in total.
 */
export function isValidPhone(value: string): boolean {
  const v = value.trim();
  return /^\+\d[\d\s().-]*$/.test(v) && v.replace(/\D/g, "").length >= 8;
}

/** The number without its country code, as typed in the second box: at least 6 digits. */
export function isValidLocalPhone(value: string): boolean {
  const v = value.trim();
  return /^[\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 6;
}

/** What the traveler types in step 6. */
export const LeadInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  // Required: the sales team books by phone/WhatsApp, so a lead without one is not actionable.
  phone: z.string().trim().max(30).refine(isValidPhone, {
    message: "A phone number with its country code (+52 …) is required",
  }),
  /** Country or city the traveler is from (free text). */
  origin: z.string().trim().min(2).max(80),
  consent: z.literal(true),
  locale: z.enum(["en", "es"]).default("en"),
});
export type LeadInput = z.infer<typeof LeadInputSchema>;

/** POST /api/lead body. */
export const LeadSubmissionSchema = z.object({
  lead: LeadInputSchema,
  request: TripRequestSchema,
  itinerary: ItinerarySchema,
  engine: z.enum(["rules", "claude"]).optional(),
});
export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>;

export type LeadStatus = "new" | "contacted" | "quoted" | "booked" | "lost";

export interface LeadRecord {
  id: string;
  /** Short human reference for emails/subjects, e.g. "WTD-4F7K2". */
  ref: string;
  /** Unguessable token for the public PDF link. */
  token: string;
  createdAt: string;
  status: LeadStatus;
  name: string;
  email: string;
  phone: string | null;
  /** Country or city the traveler is from (absent on records written before it existed). */
  origin?: string | null;
  locale: "en" | "es";
  consentAt: string;
  request: TripRequest;
  itinerary: Itinerary;
  engine: "rules" | "claude" | null;
  totalUsd: number;
  /** Local path of the traveler's itinerary PDF (dev only). */
  pdfPath: string | null;
  /** Local path of the sales-team lead PDF (dev only; absent on records written before it existed). */
  agentPdfPath?: string | null;
  notes: string[];
  bokunConfirmationCodes: string[];
}

export interface OutboundEmail {
  id: string;
  leadId: string;
  kind: "customer" | "agent";
  to: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; path: string }[];
  status: "pending" | "sent" | "failed";
  provider: "db" | "resend";
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}
