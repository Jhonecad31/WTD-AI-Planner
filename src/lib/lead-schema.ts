import { z } from "zod";
import { TripRequestSchema, type TripRequest } from "./trip-schema";
import { ItinerarySchema, type Itinerary } from "./itinerary-schema";

/** What the traveler types in step 6. */
export const LeadInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
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
  locale: "en" | "es";
  consentAt: string;
  request: TripRequest;
  itinerary: Itinerary;
  engine: "rules" | "claude" | null;
  totalUsd: number;
  pdfPath: string | null;
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
