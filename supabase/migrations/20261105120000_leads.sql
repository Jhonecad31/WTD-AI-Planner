-- Leads, outbound emails and the PDF bucket for the planner.
-- Run with `supabase db push` (local) or paste into the SQL editor of the project.
-- The public never writes here: every write goes through the API routes with the
-- service role key, so RLS is on with no policies (service role bypasses it).

create table if not exists public.leads (
  id uuid primary key,
  ref text not null unique,
  token text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'booked', 'lost')),
  name text not null,
  email text not null,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'es')),
  consent_at timestamptz not null,
  -- What the traveler answered in the wizard (TripRequest) and the plan they saw (Itinerary,
  -- including the server's `warnings`, which tell the agent what was corrected and why).
  request jsonb not null,
  itinerary jsonb not null,
  engine text check (engine in ('rules', 'claude')),
  total_usd numeric(10, 2) not null default 0,
  pdf_path text,
  notes jsonb not null default '[]'::jsonb,
  bokun_confirmation_codes jsonb not null default '[]'::jsonb
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_status_idx on public.leads (status);

create table if not exists public.outbound_emails (
  id uuid primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null check (kind in ('customer', 'agent')),
  "to" text not null,
  reply_to text,
  subject text not null,
  html text not null,
  text text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider text not null check (provider in ('db', 'resend')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists outbound_emails_lead_idx on public.outbound_emails (lead_id);
create index if not exists outbound_emails_created_at_idx on public.outbound_emails (created_at desc);

alter table public.leads enable row level security;
alter table public.outbound_emails enable row level security;

-- Private bucket for the traveler PDFs; served through /api/lead/{id}/pdf?t=token.
insert into storage.buckets (id, name, public)
values ('lead-pdfs', 'lead-pdfs', false)
on conflict (id) do nothing;
