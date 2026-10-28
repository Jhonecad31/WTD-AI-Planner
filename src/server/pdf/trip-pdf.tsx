/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer images have no alt prop */
import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Itinerary, ItineraryItem } from "@/lib/itinerary-schema";
import type { TripRequest } from "@/lib/trip-schema";
import { brand } from "@/content/brand";
import { weatherText } from "@/lib/weather";
import { greetingFor } from "@/lib/greeting";
import { itemMeta } from "@/lib/item-meta";

/**
 * The traveler's itinerary as a printable PDF, in the WhatToDo look:
 * Nunito, green accents, real tour photos. Rendered server-side.
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Nunito",
  fonts: [
    { src: path.join(FONT_DIR, "Nunito-Light.ttf"), fontWeight: 300 },
    { src: path.join(FONT_DIR, "Nunito-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Nunito-Bold.ttf"), fontWeight: 700 },
  ],
});
// Don't hyphenate words; keeps titles readable.
Font.registerHyphenationCallback((w) => [w]);

const GREEN = "#15803d";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f6f7f8";

const s = StyleSheet.create({
  page: { fontFamily: "Nunito", fontSize: 10.5, color: INK, paddingBottom: 56 },
  cover: { height: 300, position: "relative", backgroundColor: GREEN },
  coverImg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 300,
    objectFit: "cover",
  },
  coverShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
    backgroundColor: "#000",
    opacity: 0.45,
  },
  coverText: { position: "absolute", left: 40, right: 40, bottom: 32, color: "#fff" },
  coverTitle: { fontSize: 28, fontWeight: 700, lineHeight: 1.1 },
  coverSub: { fontSize: 12, marginTop: 6, opacity: 0.9 },
  body: { paddingHorizontal: 40, paddingTop: 24 },
  h2: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row", gap: 12 },
  kv: { flex: 1, backgroundColor: SOFT, borderRadius: 8, padding: 10 },
  k: { fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase" },
  v: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  summary: { marginTop: 14, fontSize: 11, lineHeight: 1.45 },
  totals: { marginTop: 16, flexDirection: "row", gap: 10 },
  totalBox: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 10 },
  totalBig: { fontSize: 14, fontWeight: 700, color: GREEN },
  day: { marginTop: 18 },
  dayHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  dateTile: { width: 34, borderWidth: 1, borderColor: GREEN, borderRadius: 6, overflow: "hidden" },
  dateMonth: {
    backgroundColor: GREEN,
    color: "#fff",
    fontSize: 7,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
    paddingVertical: 1.5,
  },
  dateDay: { fontSize: 13, fontWeight: 700, textAlign: "center", paddingVertical: 2 },
  notice: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 9,
    marginBottom: 8,
  },
  dayTitle: { fontSize: 13, fontWeight: 700 },
  dayDate: { fontSize: 9.5, color: MUTED },
  item: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  itemImg: { width: 110, height: 86, objectFit: "cover" },
  itemBody: { flex: 1, padding: 8 },
  itemMeta: { fontSize: 8.5, color: MUTED, marginBottom: 2 },
  itemTitle: { fontSize: 11, fontWeight: 700 },
  itemNote: { fontSize: 9.5, marginTop: 3, lineHeight: 1.35 },
  itemPrice: { fontSize: 11, fontWeight: 700, color: GREEN, marginTop: 4 },
  free: {
    borderWidth: 1,
    borderColor: LINE,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: SOFT,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 8.5,
    color: MUTED,
  },
  logo: { height: 22 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    color: GREEN,
    fontSize: 8.5,
    fontWeight: 700,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
});

const money = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);

const monthShort = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", { month: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(".", "");

const longDate = (iso: string, locale: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

const T = {
  en: {
    trip: "Your Cancun itinerary",
    prepared: "Prepared for",
    arrival: "Arrival",
    departure: "Departure",
    travelers: "Travelers",
    stay: "Stay",
    tours: "Tours",
    transfers: "Transfers",
    total: "Total",
    perPerson: "Per person",
    free: "Free day",
    freeBody: "Nothing planned: pool, beach, rest.",
    pickup: "Hotel pickup",
    tour: "Tour",
    transfer: "Transfer",
    restaurant: "Restaurant",
    slots: {
      early: "before 4 pm",
      late: "after 4 pm",
      morning: "morning",
      afternoon: "afternoon",
      night: "night",
    } as Record<string, string>,
    reserve: "Your specialist makes the reservation.",
    tbd: "To be decided",
    dining: (v: string) => `Suggested dinners: about ${v} in total, paid at each restaurant.`,
    nights: (n: number) => `${n} night${n === 1 ? "" : "s"}`,
    by: "Itinerary by",
    next: "A WhatToDo travel specialist will contact you to confirm and book every experience. Prices are per booking date and subject to availability.",
    ref: "Reference",
  },
  es: {
    trip: "Tu itinerario en Cancún",
    prepared: "Preparado para",
    arrival: "Llegada",
    departure: "Salida",
    travelers: "Viajeros",
    stay: "Hospedaje",
    tours: "Tours",
    transfers: "Traslados",
    total: "Total",
    perPerson: "Por persona",
    free: "Día libre",
    freeBody: "Nada planeado: alberca, playa, descanso.",
    pickup: "Recogida en hotel",
    tour: "Tour",
    transfer: "Traslado",
    restaurant: "Restaurante",
    slots: {
      early: "antes de las 4 pm",
      late: "después de las 4 pm",
      morning: "mañana",
      afternoon: "tarde",
      night: "noche",
    } as Record<string, string>,
    reserve: "Tu especialista hace la reservación.",
    tbd: "Por definir",
    dining: (v: string) => `Cenas sugeridas: aprox. ${v} en total, se pagan en cada restaurante.`,
    nights: (n: number) => `${n} noche${n === 1 ? "" : "s"}`,
    by: "Itinerario por",
    next: "Un especialista de viajes de WhatToDo te contactará para confirmar y reservar cada experiencia. Los precios dependen de la fecha y están sujetos a disponibilidad.",
    ref: "Referencia",
  },
};

function Item({ item, locale }: { item: ItineraryItem; locale: "en" | "es" }) {
  const t = T[locale];
  if (
    item.kind === "free" ||
    item.kind === "rest" ||
    item.kind === "beach" ||
    item.kind === "shopping"
  ) {
    const meta = itemMeta(item, locale, money);
    return (
      <View style={s.free} wrap={false}>
        {meta && item.kind !== "free" ? <Text style={s.itemMeta}>{meta}</Text> : null}
        <Text style={{ fontWeight: 700 }}>{item.kind === "free" ? t.free : item.title}</Text>
        <Text style={{ fontSize: 9.5, color: MUTED }}>{item.note ?? t.freeBody}</Text>
      </View>
    );
  }
  if (item.kind === "restaurant") {
    return (
      <View style={s.item} wrap={false}>
        {item.imageUrl ? <Image src={item.imageUrl} style={s.itemImg} /> : null}
        <View style={s.itemBody}>
          <Text style={s.pill}>{t.restaurant}</Text>
          <Text style={s.itemMeta}>{itemMeta(item, locale, money)}</Text>
          <Text style={s.itemTitle}>{item.title}</Text>
          <Text style={s.itemNote}>{t.reserve}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.item} wrap={false}>
      {item.imageUrl ? <Image src={item.imageUrl} style={s.itemImg} /> : null}
      <View style={s.itemBody}>
        <Text style={s.pill}>{item.kind === "transfer" ? t.transfer : t.tour}</Text>
        <Text style={s.itemMeta}>
          {[
            item.startTime,
            item.durationMinutes ? `${Math.round(item.durationMinutes / 60)}h` : null,
            item.pickup ? t.pickup : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
        <Text style={s.itemTitle}>{item.title}</Text>
        {item.note ? <Text style={s.itemNote}>{item.note}</Text> : null}
        <Text style={s.itemPrice}>
          {money(item.priceTotalUsd, locale)}
          <Text style={{ color: MUTED, fontWeight: 300 }}>
            {"  "}
            {item.pricing.map((p) => `${p.count} × ${p.title}`).join(", ")}
          </Text>
        </Text>
      </View>
    </View>
  );
}

export function TripPdf({
  name,
  ref,
  request,
  itinerary,
  logoPath,
  heroImage,
}: {
  name: string;
  ref: string;
  request: TripRequest;
  itinerary: Itinerary;
  logoPath: string;
  heroImage: string | null;
}) {
  const locale = itinerary.locale;
  const t = T[locale];
  const nights = Math.max(0, itinerary.days.length - 1);
  const adults = request.travelers.filter((x) => x.age >= 13).length;
  const kids = request.travelers.length - adults;

  return (
    <Document title={`${t.trip} · ${name}`} author={brand.poweredBy} language={locale}>
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          {heroImage ? <Image src={heroImage} style={s.coverImg} /> : null}
          <View style={s.coverShade} />
          <View style={s.coverText}>
            <Text style={{ fontSize: 10, opacity: 0.85 }}>{t.prepared}</Text>
            <Text style={s.coverTitle}>{name}</Text>
            <Text style={s.coverSub}>
              {t.trip} · {longDate(request.inbound.date, locale)} –{" "}
              {longDate(request.outbound.date, locale)} · {t.nights(nights)}
            </Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.row}>
            <View style={s.kv}>
              <Text style={s.k}>{t.arrival}</Text>
              <Text style={s.v}>
                {request.inbound.date}
                {request.inbound.time
                  ? ` · ${request.inbound.time}`
                  : request.inbound.slot
                    ? ` · ${t.slots[request.inbound.slot]}`
                    : ""}
                {request.inbound.flightNumber ? ` · ${request.inbound.flightNumber}` : ""}
              </Text>
            </View>
            <View style={s.kv}>
              <Text style={s.k}>{t.departure}</Text>
              <Text style={s.v}>
                {request.outbound.date}
                {request.outbound.time
                  ? ` · ${request.outbound.time}`
                  : request.outbound.slot
                    ? ` · ${t.slots[request.outbound.slot]}`
                    : ""}
                {request.outbound.flightNumber ? ` · ${request.outbound.flightNumber}` : ""}
              </Text>
            </View>
            <View style={s.kv}>
              <Text style={s.k}>{t.travelers}</Text>
              <Text style={s.v}>
                {adults} + {kids}
              </Text>
            </View>
          </View>
          <Text style={[s.summary, { fontWeight: 700 }]}>
            {greetingFor(request, name.split(" ")[0])}
          </Text>
          {itinerary.introWarnings.length ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#fde68a",
                backgroundColor: "#fffbeb",
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
              }}
            >
              {itinerary.introWarnings.map((w, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 9.5,
                    color: "#78350f",
                    fontWeight: i ? 300 : 700,
                    lineHeight: 1.4,
                  }}
                >
                  {w}
                </Text>
              ))}
            </View>
          ) : null}
          {itinerary.weatherNote ? (
            <View style={[s.notice, { borderLeftColor: "#0ea5e9", backgroundColor: "#f0f9ff" }]}>
              <Text style={{ fontSize: 9.5, color: "#0c4a6e", lineHeight: 1.4 }}>
                {itinerary.weatherNote}
              </Text>
            </View>
          ) : null}
          <Text style={s.summary}>{itinerary.summary}</Text>
          <View style={s.totals}>
            <View style={s.totalBox}>
              <Text style={s.k}>{t.tours}</Text>
              <Text style={s.totalBig}>{money(itinerary.totals.toursUsd, locale)}</Text>
            </View>
            <View style={s.totalBox}>
              <Text style={s.k}>{t.transfers}</Text>
              <Text style={s.totalBig}>{money(itinerary.totals.transfersUsd, locale)}</Text>
            </View>
            <View style={s.totalBox}>
              <Text style={s.k}>{t.perPerson}</Text>
              <Text style={s.totalBig}>{money(itinerary.totals.perPersonUsd, locale)}</Text>
            </View>
            <View style={s.totalBox}>
              <Text style={s.k}>{t.total}</Text>
              <Text style={s.totalBig}>{money(itinerary.totals.totalUsd, locale)}</Text>
            </View>
          </View>
          {itinerary.totals.diningEstimateUsd > 0 ? (
            <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 8 }}>
              {t.dining(money(itinerary.totals.diningEstimateUsd, locale))}
            </Text>
          ) : null}
          {itinerary.diningNote ? (
            <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 8 }}>
              {itinerary.diningNote}
            </Text>
          ) : null}

          {itinerary.days.map((d) => (
            <View key={d.date} style={s.day} wrap={false}>
              <View style={s.dayHead}>
                <View style={s.dateTile}>
                  <Text style={s.dateMonth}>{monthShort(d.date, locale)}</Text>
                  <Text style={s.dateDay}>{Number(d.date.slice(8))}</Text>
                </View>
                <View>
                  <Text style={s.dayTitle}>{longDate(d.date, locale)}</Text>
                  <Text style={s.dayDate}>
                    {d.title}
                    {d.weather ? `${d.title ? "  ·  " : ""}${weatherText(d.weather, locale)}` : ""}
                  </Text>
                </View>
              </View>
              {(d.notices ?? []).map((n, i) => (
                <View
                  key={i}
                  style={[s.notice, { borderLeftColor: "#8b5cf6", backgroundColor: "#f5f3ff" }]}
                >
                  <Text style={{ fontSize: 9.5, color: "#4c1d95", lineHeight: 1.4 }}>{n}</Text>
                </View>
              ))}
              {d.items.map((item, i) => (
                <Item key={i} item={item} locale={locale} />
              ))}
            </View>
          ))}

          <Text style={{ marginTop: 16, fontSize: 9.5, color: MUTED, lineHeight: 1.4 }}>
            {t.next}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {t.ref}: {ref}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text>{t.by}</Text>
            <Image src={logoPath} style={s.logo} />
          </View>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderTripPdf(args: {
  name: string;
  ref: string;
  request: TripRequest;
  itinerary: Itinerary;
}): Promise<Uint8Array> {
  const logoPath = path.join(process.cwd(), "public", "logo-PMC.svg");
  const heroImage =
    args.itinerary.days.flatMap((d) => d.items).find((i) => i.kind === "tour" && i.imageUrl)
      ?.imageUrl ?? null;
  const buf = await renderToBuffer(<TripPdf {...args} logoPath={logoPath} heroImage={heroImage} />);
  return new Uint8Array(buf);
}
