"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ArrowLeftIcon, CheckIcon, MailIcon } from "@/components/ui/icons";
import { brand } from "@/content/brand";
import { formatDate, formatUsd } from "@/lib/format";
import { useWizard } from "./wizard-state";
import { buildTripRequest } from "./step-itinerary";

type Done = { leadId: string; ref: string; pdfUrl: string | null };

export function StepContact() {
  const t = useTranslations("wizard.contact");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { draft, back, patch, reset } = useWizard();
  const [name, setName] = useState(draft.travelers[0]?.name ?? "");
  const [email, setEmail] = useState(draft.contact?.email ?? "");
  const [phone, setPhone] = useState(draft.contact?.phone ?? "");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(draft.submitted ?? null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const hours = Number(process.env.NEXT_PUBLIC_RESPONSE_TIME_HOURS ?? 24);

  const request = buildTripRequest(draft, locale);
  const itinerary = draft.itinerary?.itinerary;
  // Errors appear only after the first send attempt, next to the field that needs fixing.
  const [tried, setTried] = useState(false);
  const errors = {
    name: name.trim().length >= 2 ? null : t("errorName"),
    email: /\S+@\S+\.\S+/.test(email) ? null : t("errorEmail"),
    consent: consent ? null : t("errorConsent"),
  };
  const valid = !errors.name && !errors.email && !errors.consent;
  const canSend = !!request && !!itinerary && valid && !sending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!canSend || !request || !itinerary) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lead: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            consent: true,
            locale,
          },
          request,
          itinerary,
          engine: draft.itinerary?.engine,
        }),
      });
      const j = (await r.json()) as Partial<Done> & { error?: string };
      if (!r.ok || !j.leadId || !j.ref) throw new Error(j.error ?? t("failed"));
      const result = { leadId: j.leadId, ref: j.ref, pdfUrl: j.pdfUrl ?? null };
      setDone(result);
      patch({ submitted: result, contact: { email: email.trim(), phone: phone.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSending(false);
    }
  }

  // The PDF is rendered on demand from the itinerary the wizard holds: production has
  // no disk to keep a copy, so there is no stored file to link to.
  async function downloadPdf(ref: string) {
    if (!request || !itinerary) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const r = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Traveler", ref, request, itinerary }),
      });
      if (!r.ok) throw new Error(t("downloadFailed"));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `WhatToDo-itinerary-${ref}.pdf`;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : t("downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/30">
          <CheckIcon size={30} />
        </span>
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">{t("doneTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-brand-ink/70">
            {t("doneBody", { email, hours })}
          </p>
          <p className="mt-2 text-sm text-muted">
            {t("reference")}: <span className="font-bold text-heading">{done.ref}</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => downloadPdf(done.ref)} disabled={downloading}>
            {downloading ? t("downloading") : t("download")}
          </Button>
          <Button variant="secondary" size="lg" onClick={reset}>
            {t("again")}
          </Button>
        </div>
        {downloadError ? (
          <p className="rounded-card bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {downloadError}
          </p>
        ) : null}
        <p className="text-xs text-muted">
          {brand.salesEmail} · {brand.phone}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-bold sm:text-3xl">{t("title")}</h2>
        <p className="mt-1 text-brand-ink/70">{t("subtitle")}</p>
      </header>

      {itinerary ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
          <span>{t("recapDays", { count: itinerary.days.length })}</span>
          <span aria-hidden>·</span>
          <span>
            {t("recapTours", {
              count: itinerary.days.flatMap((d) => d.items).filter((i) => i.kind === "tour").length,
            })}
          </span>
          <span aria-hidden>·</span>
          <span>{formatUsd(itinerary.totals.totalUsd, locale)}</span>
          <span aria-hidden>·</span>
          <span>
            {formatDate(itinerary.days[0].date, locale, { weekday: undefined })} –{" "}
            {formatDate(itinerary.days[itinerary.days.length - 1].date, locale, {
              weekday: undefined,
            })}
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} htmlFor="lead-name" error={tried ? errors.name : null}>
          <Input
            id="lead-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field label={t("email")} htmlFor="lead-email" error={tried ? errors.email : null}>
          <Input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
          />
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} htmlFor="lead-phone">
          <Input
            id="lead-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+1 555 123 4567"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-card border ${tried && errors.consent ? "border-red-300 bg-red-50" : "border-line bg-surface"} px-4 py-3 text-sm`}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          />
          <span>{t("consent")}</span>
        </label>
        {tried && errors.consent ? (
          <p className="text-xs font-semibold text-red-600">{errors.consent}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-card bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={back} disabled={sending}>
          <ArrowLeftIcon size={18} /> {tc("back")}
        </Button>
        <Button type="submit" size="lg" disabled={sending}>
          <MailIcon size={18} /> {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}
