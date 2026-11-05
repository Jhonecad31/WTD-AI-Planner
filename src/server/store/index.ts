import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { LeadRecord, OutboundEmail } from "@/lib/lead-schema";

/**
 * Persistence behind one small interface so the local file store can be swapped
 * for Supabase (Postgres + Storage) without touching routes or emails.
 *
 * Local dev: JSON files under `.data/` (git-ignored).
 */

export interface LeadStore {
  createLead(lead: LeadRecord): Promise<void>;
  getLead(id: string): Promise<LeadRecord | null>;
  updateLead(id: string, patch: Partial<LeadRecord>): Promise<LeadRecord | null>;
  listLeads(limit?: number): Promise<LeadRecord[]>;
  savePdf(leadId: string, bytes: Uint8Array): Promise<string>;
  readPdf(pdfPath: string): Promise<Uint8Array | null>;
  enqueueEmail(email: OutboundEmail): Promise<void>;
  updateEmail(id: string, patch: Partial<OutboundEmail>): Promise<void>;
  listEmails(limit?: number): Promise<OutboundEmail[]>;
  getEmail(id: string): Promise<OutboundEmail | null>;
}

const ROOT = path.join(process.cwd(), ".data");
const dirs = {
  leads: path.join(ROOT, "leads"),
  emails: path.join(ROOT, "emails"),
  pdf: path.join(ROOT, "pdf"),
};

async function ensureDirs() {
  await Promise.all(Object.values(dirs).map((d) => mkdir(d, { recursive: true })));
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function listJson<T extends { createdAt: string }>(dir: string, limit: number): Promise<T[]> {
  await ensureDirs();
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const loaded = await Promise.all(files.map((f) => readJson<T>(path.join(dir, f))));
  const items: T[] = [];
  for (const x of loaded) if (x) items.push(x);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** Only ids we generated (uuid) may be used to build file paths. */
const SAFE_ID = /^[0-9a-f-]{36}$/;
function fileFor(dir: string, id: string, ext = "json") {
  if (!SAFE_ID.test(id)) throw new Error("Invalid id");
  return path.join(dir, `${id}.${ext}`);
}

export class FileLeadStore implements LeadStore {
  async createLead(lead: LeadRecord) {
    await ensureDirs();
    await writeFile(fileFor(dirs.leads, lead.id), JSON.stringify(lead, null, 2));
  }
  async getLead(id: string) {
    if (!SAFE_ID.test(id)) return null;
    return readJson<LeadRecord>(fileFor(dirs.leads, id));
  }
  async updateLead(id: string, patch: Partial<LeadRecord>) {
    const current = await this.getLead(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await writeFile(fileFor(dirs.leads, id), JSON.stringify(next, null, 2));
    return next;
  }
  listLeads(limit = 50) {
    return listJson<LeadRecord>(dirs.leads, limit);
  }
  async savePdf(leadId: string, bytes: Uint8Array) {
    await ensureDirs();
    const file = fileFor(dirs.pdf, leadId, "pdf");
    await writeFile(file, bytes);
    return path.relative(ROOT, file);
  }
  async readPdf(pdfPath: string) {
    try {
      return new Uint8Array(await readFile(path.join(ROOT, pdfPath)));
    } catch {
      return null;
    }
  }
  async enqueueEmail(email: OutboundEmail) {
    await ensureDirs();
    await writeFile(fileFor(dirs.emails, email.id), JSON.stringify(email, null, 2));
  }
  async updateEmail(id: string, patch: Partial<OutboundEmail>) {
    const current = await this.getEmail(id);
    if (!current) return;
    await writeFile(fileFor(dirs.emails, id), JSON.stringify({ ...current, ...patch }, null, 2));
  }
  listEmails(limit = 50) {
    return listJson<OutboundEmail>(dirs.emails, limit);
  }
  async getEmail(id: string) {
    if (!SAFE_ID.test(id)) return null;
    return readJson<OutboundEmail>(fileFor(dirs.emails, id));
  }
}

let store: LeadStore | null = null;
/** Local JSON files. Production persistence lives in the team's own backend. */
export function getLeadStore(): LeadStore {
  store ??= new FileLeadStore();
  return store;
}

export function newId(): string {
  return randomUUID();
}

/** Short, readable reference: WTD-7K3M9 (no 0/O/1/I). */
export function newRef(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(5);
  return "WTD-" + [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export function newToken(): string {
  return randomBytes(18).toString("base64url");
}
