import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { LeadRecord } from "@/lib/lead-schema";
import { brand } from "@/content/brand";
import { weatherText } from "@/lib/weather";
import { greetingFor } from "@/lib/greeting";
import { itemMeta } from "@/lib/item-meta";

/**
 * Two emails for every lead:
 *  - CustomerTripEmail: clean, warm, branded; the PDF travels as an attachment.
 *  - AgentLeadEmail: operational, everything the sales agent needs to book in Bokun.
 */

const GREEN = "#15803d";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const font = "Nunito, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

const money = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);

const longDate = (iso: string, locale: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

export function CustomerTripEmail({
  lead,
  appUrl,
  pdfUrl,
  responseHours,
}: {
  lead: LeadRecord;
  appUrl: string;
  pdfUrl: string;
  responseHours: number;
}) {
  const { itinerary, request, locale } = lead;
  const es = locale === "es";
  const firstName = lead.name.split(" ")[0];
  const nights = Math.max(0, itinerary.days.length - 1);
  const greeting = greetingFor(request, firstName);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>
        {es
          ? `Tu itinerario en Cancún está listo, ${firstName}`
          : `Your Cancun itinerary is ready, ${firstName}`}
      </Preview>
      <Body style={{ margin: 0, backgroundColor: "#f6f7f8", fontFamily: font, color: INK }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "24px 12px" }}>
          <Section
            style={{
              backgroundColor: GREEN,
              borderRadius: 16,
              padding: "28px 28px 24px",
              color: "#fff",
            }}
          >
            <Heading
              as="h1"
              style={{ margin: "0 0 10px", fontSize: 22, lineHeight: 1.3, color: "#fff" }}
            >
              {greeting}
            </Heading>
            <Text
              style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#fff", opacity: 0.95 }}
            >
              {longDate(request.inbound.date, locale)} – {longDate(request.outbound.date, locale)} ·{" "}
              {nights} {es ? "noches" : "nights"} · {request.travelers.length}{" "}
              {es ? "viajeros" : "travelers"}
            </Text>
          </Section>

          {itinerary.introWarnings.length ? (
            <Section
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 16,
                padding: "16px 20px",
                marginTop: 12,
              }}
            >
              {itinerary.introWarnings.map((w, i) => (
                <Text
                  key={i}
                  style={{
                    margin: i ? "4px 0 0" : 0,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#78350f",
                    fontWeight: i ? 400 : 700,
                  }}
                >
                  {w}
                </Text>
              ))}
            </Section>
          ) : null}

          {itinerary.weatherNote ? (
            <Section
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: 16,
                padding: "14px 20px",
                marginTop: 12,
              }}
            >
              <Text style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#0c4a6e" }}>
                {itinerary.weatherNote}
              </Text>
            </Section>
          ) : null}

          <Section
            style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, marginTop: 12 }}
          >
            <Text style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.55 }}>
              {itinerary.summary}
            </Text>
            {itinerary.days.map((d) => (
              <Section
                key={d.date}
                style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12, marginTop: 12 }}
              >
                <Text style={{ margin: 0, fontSize: 12, color: MUTED, fontWeight: 600 }}>
                  {longDate(d.date, locale)}
                  {d.weather ? ` · ${weatherText(d.weather, locale)}` : ""}
                </Text>
                {(d.notices ?? []).map((n) => (
                  <Text
                    key={n}
                    style={{
                      margin: "8px 0 0",
                      padding: "8px 12px",
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: "#4c1d95",
                      backgroundColor: "#f5f3ff",
                      borderLeft: "3px solid #8b5cf6",
                      borderRadius: 6,
                    }}
                  >
                    {n}
                  </Text>
                ))}
                {d.items.map((it, i) => (
                  <table
                    key={i}
                    width="100%"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ marginTop: 10 }}
                  >
                    <tbody>
                      <tr>
                        {it.imageUrl ? (
                          <td width={96} style={{ verticalAlign: "top" }}>
                            <Img
                              src={it.imageUrl}
                              width={88}
                              height={66}
                              alt=""
                              style={{ borderRadius: 8, objectFit: "cover" }}
                            />
                          </td>
                        ) : null}
                        <td style={{ verticalAlign: "top" }}>
                          <Text
                            style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}
                          >
                            {it.kind === "free" ? (es ? "Día libre" : "Free day") : it.title}
                          </Text>
                          <Text style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>
                            {itemMeta(it, locale, money)}
                          </Text>
                          {it.note ? (
                            <Text style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45 }}>
                              {it.note}
                            </Text>
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </Section>
            ))}
            <Hr style={{ borderColor: LINE, margin: "18px 0" }} />
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td>
                    <Text style={{ margin: 0, fontSize: 13, color: MUTED }}>
                      {es ? "Total estimado" : "Estimated total"}
                    </Text>
                  </td>
                  <td align="right">
                    <Text style={{ margin: 0, fontSize: 20, fontWeight: 700, color: GREEN }}>
                      {money(itinerary.totals.totalUsd, locale)}
                    </Text>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <Text style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>
                      {money(itinerary.totals.perPersonUsd, locale)}{" "}
                      {es ? "por persona" : "per person"}
                    </Text>
                    {itinerary.totals.diningEstimateUsd > 0 ? (
                      <Text style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>
                        {es
                          ? `Cenas sugeridas: aprox. ${money(itinerary.totals.diningEstimateUsd, locale)} en total, se pagan en cada restaurante.`
                          : `Suggested dinners: about ${money(itinerary.totals.diningEstimateUsd, locale)} in total, paid at each restaurant.`}
                      </Text>
                    ) : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section
            style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, marginTop: 12 }}
          >
            <Heading as="h2" style={{ margin: "0 0 6px", fontSize: 18 }}>
              {es ? "¿Qué sigue?" : "What happens next"}
            </Heading>
            <Text style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
              {es
                ? `Un especialista de viajes de WhatToDo In Cancun te contactará en menos de ${responseHours} horas para confirmar disponibilidad y reservar todo por ti. Tu itinerario también va adjunto en PDF.`
                : `A WhatToDo In Cancun travel specialist will contact you within ${responseHours} hours to confirm availability and book everything for you. Your itinerary is also attached as a PDF.`}
            </Text>
            <Link
              href={pdfUrl}
              style={{
                display: "inline-block",
                marginTop: 14,
                backgroundColor: GREEN,
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                padding: "12px 20px",
                borderRadius: 999,
                textDecoration: "none",
              }}
            >
              {es ? "Descargar PDF" : "Download PDF"}
            </Link>
            <Text style={{ margin: "14px 0 0", fontSize: 12, color: MUTED }}>
              {es ? "Referencia" : "Reference"}: {lead.ref}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", padding: "20px 0 0" }}>
            <Text style={{ margin: 0, fontSize: 12, color: MUTED }}>
              {es ? "Itinerario por" : "Itinerary by"}
            </Text>
            <Img
              src={`${appUrl}/logo-PMC.svg`}
              width={120}
              style={{ margin: "6px auto 0" }}
            />
            <Text style={{ margin: "8px 0 0", fontSize: 11, color: MUTED }}>
              <Link href={brand.siteUrl} style={{ color: MUTED }}>
                whattodoincancun.com
              </Link>{" "}
              · {brand.salesEmail} · {brand.phone}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function AgentLeadEmail({
  lead,
  appUrl,
  pdfUrl,
  engine,
}: {
  lead: LeadRecord;
  appUrl: string;
  pdfUrl: string;
  engine: string | null;
}) {
  const { itinerary, request } = lead;
  const adults = request.travelers.filter((t) => t.age >= 13);
  const kids = request.travelers.filter((t) => t.age < 13);
  const bookable = itinerary.days.flatMap((d) =>
    d.items
      .filter((i) => i.kind === "tour" || i.kind === "transfer")
      .map((i) => ({ date: d.date, item: i })),
  );
  const dinners = itinerary.days.flatMap((d) =>
    d.items.filter((i) => i.kind === "restaurant").map((i) => ({ date: d.date, item: i })),
  );
  const slotText = (slot?: string) =>
    ({
      early: "before 4 pm",
      late: "after 4 pm",
      morning: "morning",
      afternoon: "afternoon",
      night: "night",
    })[slot ?? ""] ?? "";
  const th = {
    textAlign: "left" as const,
    fontSize: 11,
    color: MUTED,
    padding: "6px 8px",
    borderBottom: `1px solid ${LINE}`,
  };
  const td = {
    fontSize: 13,
    padding: "8px",
    borderBottom: `1px solid ${LINE}`,
    verticalAlign: "top" as const,
  };
  const mono = { fontFamily: "SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 };

  return (
    <Html lang="en">
      <Head />
      <Preview>{`[${lead.ref}] ${lead.name} · ${request.travelers.length} pax · ${money(itinerary.totals.totalUsd, "en")}`}</Preview>
      <Body style={{ margin: 0, backgroundColor: "#f6f7f8", fontFamily: font, color: INK }}>
        <Container style={{ maxWidth: 720, margin: "0 auto", padding: "20px 12px" }}>
          <Section
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 20,
              borderTop: `4px solid ${GREEN}`,
            }}
          >
            <Text style={{ margin: 0, fontSize: 12, color: MUTED }}>
              New planner lead · {lead.ref} · engine: {engine ?? "—"}
            </Text>
            <Heading as="h1" style={{ margin: "4px 0 12px", fontSize: 22 }}>
              {lead.name} — {request.travelers.length} pax —{" "}
              {money(itinerary.totals.totalUsd, "en")}
            </Heading>

            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={td}>
                    <b>Email</b>
                    <br />
                    <Link href={`mailto:${lead.email}`}>{lead.email}</Link>
                  </td>
                  <td style={td}>
                    <b>Phone</b>
                    <br />
                    {lead.phone ? (
                      <Link href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={td}>
                    <b>Language</b>
                    <br />
                    {lead.locale.toUpperCase()}
                  </td>
                </tr>
                <tr>
                  <td style={td}>
                    <b>Arrival</b>
                    <br />
                    {request.inbound.date} {request.inbound.time ?? slotText(request.inbound.slot)}{" "}
                    {request.inbound.flightNumber ?? ""}{" "}
                    {request.inbound.otherAirport ? `from ${request.inbound.otherAirport}` : ""}
                  </td>
                  <td style={td}>
                    <b>Departure</b>
                    <br />
                    {request.outbound.date}{" "}
                    {request.outbound.time ?? slotText(request.outbound.slot)}{" "}
                    {request.outbound.flightNumber ?? ""}{" "}
                    {request.outbound.otherAirport ? `to ${request.outbound.otherAirport}` : ""}
                  </td>
                  <td style={td}>
                    <b>Hotel</b>
                    <br />
                    {request.hotel.noHotel ? (
                      <b style={{ color: "#b45309" }}>
                        No hotel yet — confirm the area with the customer
                      </b>
                    ) : (
                      <>
                        {request.hotel.name || "—"}
                        <br />
                        <span style={{ color: MUTED, fontSize: 12 }}>{request.hotel.zone}</span>
                      </>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={td} colSpan={3}>
                    <b>Travelers</b>
                    <br />
                    {adults.length} adult{adults.length === 1 ? "" : "s"}
                    {kids.length
                      ? `, ${kids.length} child${kids.length === 1 ? "" : "ren"} (ages ${kids.map((k) => k.age).join(", ")})`
                      : ""}
                    {request.travelers.some((t) => t.name)
                      ? ` — ${request.travelers
                          .filter((t) => t.name)
                          .map((t) => `${t.name} (${t.age})`)
                          .join(", ")}`
                      : ""}
                    <br />
                    <span style={{ color: MUTED, fontSize: 12 }}>
                      Title: {request.travelerTitle ?? "none"} · Interests:{" "}
                      {request.interests.join(", ")}
                      {request.preferPrivate ? " (prefers private)" : ""} · Chill days:{" "}
                      {request.chillDays} · Dinner: {request.dining.cuisines.join(", ") || "any"},{" "}
                      {money(request.dining.budgetPerMeal, "en")}/pp per meal · Budget:{" "}
                      {money(request.budgetPerPerson, "en")}/pp · Transfers:{" "}
                      {[
                        request.transfers.arrival && "arrival",
                        request.transfers.departure && "departure",
                        request.transfers.luxury && "luxury",
                      ]
                        .filter(Boolean)
                        .join(", ") || "none"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <Heading as="h2" style={{ margin: "20px 0 8px", fontSize: 16 }}>
              Bookings to make in Bokun
            </Heading>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Time</th>
                  <th style={th}>Product</th>
                  <th style={th}>Bokun ID</th>
                  <th style={th}>Pax / category</th>
                  <th style={th}>Pickup</th>
                  <th style={th}>Price</th>
                </tr>
              </thead>
              <tbody>
                {bookable.map(({ date, item }, i) => (
                  <tr key={i}>
                    <td style={td}>{date}</td>
                    <td style={td}>{item.startTime ?? "—"}</td>
                    <td style={td}>
                      {item.title}
                      {item.bokunId ? (
                        <>
                          <br />
                          <Link
                            href={`https://extranet.bokun.io/experience/${item.bokunId}`}
                            style={{ fontSize: 12 }}
                          >
                            Open in Bokun extranet
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td style={{ ...td, ...mono }}>
                      {item.bokunId ?? "—"}
                      {item.startTimeId ? (
                        <>
                          <br />
                          <span style={{ color: MUTED }}>st {item.startTimeId}</span>
                        </>
                      ) : null}
                    </td>
                    <td style={td}>
                      {item.pricing
                        .map((p) => `${p.count} × ${p.title} [${p.pricingCategoryId}]`)
                        .join("; ") || "—"}
                    </td>
                    <td style={td}>{item.pickup ? "Yes" : "No"}</td>
                    <td style={td}>{money(item.priceTotalUsd, "en")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Text style={{ margin: "10px 0 0", fontSize: 13 }}>
              <b>Tours</b> {money(itinerary.totals.toursUsd, "en")} · <b>Transfers</b>{" "}
              {money(itinerary.totals.transfersUsd, "en")} · <b>Total</b>{" "}
              {money(itinerary.totals.totalUsd, "en")} ({money(itinerary.totals.perPersonUsd, "en")}{" "}
              pp, budget {money(request.budgetPerPerson, "en")} pp)
            </Text>

            {dinners.length ? (
              <>
                <Heading as="h2" style={{ margin: "20px 0 8px", fontSize: 16 }}>
                  Suggested restaurant reservations
                </Heading>
                <table width="100%" cellPadding={0} cellSpacing={0}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Time</th>
                      <th style={th}>Restaurant</th>
                      <th style={th}>Bokun ID</th>
                      <th style={th}>Party</th>
                      <th style={th}>Est. pp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dinners.map(({ date, item }, i) => (
                      <tr key={i}>
                        <td style={td}>{date}</td>
                        <td style={td}>{item.startTime ?? "—"}</td>
                        <td style={td}>
                          {item.title}
                          <br />
                          <span style={{ color: MUTED, fontSize: 12 }}>
                            {item.cuisines?.join(", ")}{" "}
                            {item.priceLevel ? "$".repeat(item.priceLevel) : ""}
                          </span>
                        </td>
                        <td style={{ ...td, ...mono }}>{item.bokunId ?? "—"}</td>
                        <td style={td}>{request.travelers.length}</td>
                        <td style={td}>
                          {item.priceEstimatePpUsd ? money(item.priceEstimatePpUsd, "en") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {itinerary.introWarnings.length ? (
              <>
                <Heading as="h2" style={{ margin: "20px 0 6px", fontSize: 16 }}>
                  Warnings shown to the customer
                </Heading>
                {itinerary.introWarnings.map((w, i) => (
                  <Text key={i} style={{ margin: "2px 0", fontSize: 13 }}>
                    {w}
                  </Text>
                ))}
              </>
            ) : null}

            {request.notes ? (
              <>
                <Heading as="h2" style={{ margin: "20px 0 6px", fontSize: 16 }}>
                  Customer notes
                </Heading>
                <Text
                  style={{
                    margin: 0,
                    fontSize: 13,
                    backgroundColor: "#fffbeb",
                    padding: 10,
                    borderRadius: 8,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {request.notes}
                </Text>
              </>
            ) : null}

            {itinerary.warnings.length ? (
              <>
                <Heading as="h2" style={{ margin: "20px 0 6px", fontSize: 16 }}>
                  System notes
                </Heading>
                {itinerary.warnings.map((w, i) => (
                  <Text key={i} style={{ margin: "0 0 2px", fontSize: 12, color: MUTED }}>
                    • {w}
                  </Text>
                ))}
              </>
            ) : null}

            <Hr style={{ borderColor: LINE, margin: "18px 0" }} />
            <Link
              href={pdfUrl}
              style={{
                display: "inline-block",
                backgroundColor: GREEN,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                padding: "10px 16px",
                borderRadius: 999,
                textDecoration: "none",
                marginRight: 8,
              }}
            >
              Customer PDF
            </Link>
            <Link
              href={`${appUrl}/dev/leads/${lead.id}`}
              style={{
                display: "inline-block",
                border: `1px solid ${LINE}`,
                color: INK,
                fontWeight: 700,
                fontSize: 13,
                padding: "10px 16px",
                borderRadius: 999,
                textDecoration: "none",
              }}
            >
              Open lead
            </Link>
            <Text style={{ margin: "14px 0 0", fontSize: 12, color: MUTED }}>
              Reply to this email to answer the customer directly (Reply-To is set to {lead.email}).
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
