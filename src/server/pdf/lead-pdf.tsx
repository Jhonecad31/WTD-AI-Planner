import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import type { LeadRecord } from "@/lib/lead-schema";
import type { ItineraryItem } from "@/lib/itinerary-schema";
import { effectiveZone, tripNights, type HotelZone } from "@/lib/trip-schema";
import { groupsFromTypes, typesFromGroups } from "@/lib/avoid";
import type { CatalogProduct } from "@/server/catalog/types";
import { brand } from "@/content/brand";

/**
 * The sales-team copy of a lead: everything the agent needs to quote and book
 * in Bokun without asking the traveler again. Always in English. The traveler
 * keeps receiving the branded itinerary from `trip-pdf.tsx`; this one is
 * operational: contact data, flights, hotel, budget, pax, one block per booking
 * with the Bokun ids, pricing categories and deep links, and every preference.
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
Font.registerHyphenationCallback((w) => [w]);

// ───────────────────────────── labels ─────────────────────────────

const ZONE_LABEL: Record<HotelZone, string> = {
  cancun: "Cancun",
  costa_mujeres: "Costa Mujeres",
  puerto_morelos: "Puerto Morelos",
  playa_del_carmen: "Playa del Carmen",
  riviera_maya: "Riviera Maya",
  puerto_aventuras: "Puerto Aventuras",
  tulum: "Tulum",
};

const INTEREST_LABEL: Record<string, string> = {
  adventure: "Adventure",
  cultural: "Culture & Mayan ruins",
  food: "Food & drinks",
  water: "Sea & snorkel",
  beach: "Beach",
  shopping: "Shopping",
  parks: "Theme parks",
  party: "Nightlife & party",
  couples: "Romantic",
  chill: "Wellness & relax",
};

const AVOID_GROUP_LABEL: Record<string, string> = {
  dolphins: "Dolphins & whale sharks",
  boats: "Boats (catamaran, speedboat, parasail)",
  snorkel: "Snorkel",
  atv: "ATV & horseback",
  cenotes: "Cenotes & caves",
  zipline: "Ziplines",
  ruins: "Mayan ruins",
  parks: "Theme parks",
  nightlife: "Nightlife & shows",
};

const SLOT_LABEL: Record<string, string> = {
  early: "before 4 pm",
  late: "after 4 pm",
  morning: "morning",
  afternoon: "afternoon",
  night: "night",
};

const CHILL_LABEL: Record<string, string> = {
  none: "none",
  one: "one chill day",
  two: "two chill days",
  alternate: "alternate tour / chill days",
};

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);

const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

// ───────────────────────────── view model ─────────────────────────────

export interface LeadPdfFlight {
  label: "Arrival" | "Departure";
  date: string;
  dateText: string;
  /** "14:35" | "before 4 pm" | "not given" */
  timeText: string;
  flightNumber: string | null;
  airline: string | null;
  airport: string | null;
  /** The traveler asked for a transfer on this leg. */
  transfer: boolean;
}

export interface LeadPdfPricingLine {
  pricingCategoryId: number;
  title: string;
  count: number;
  unitUsd: number;
  subtotalUsd: number;
}

export interface LeadPdfBooking {
  kind: "tour" | "transfer" | "restaurant";
  date: string;
  dateText: string;
  dayNumber: number;
  title: string;
  bokunId: number | null;
  startTime: string | null;
  startTimeId: number | null;
  durationMinutes: number | null;
  pickup: boolean;
  /** From the catalog: minutes before the start time the pickup happens. */
  pickupMinutesBefore: number | null;
  bookingCutoffHours: number | null;
  pricing: LeadPdfPricingLine[];
  priceTotalUsd: number;
  extranetUrl: string | null;
  siteUrl: string | null;
  /** The product was not found in the planner catalog (stale cache, excluded, unpublished). */
  inCatalog: boolean;
  /** Restaurants only. */
  cuisines: string[];
  priceLevel: number | null;
  priceEstimatePpUsd: number | null;
  note: string | null;
}

export interface LeadPdfModel {
  ref: string;
  createdAt: string;
  engine: string;
  contact: { name: string; email: string; phone: string | null; language: string };
  trip: { nights: number; dateRange: string; luxuryTransfers: boolean };
  flights: { arrival: LeadPdfFlight; departure: LeadPdfFlight };
  hotel: {
    noHotel: boolean;
    name: string | null;
    zone: string | null;
    /** Zone used to plan pickups, beaches and restaurants (Cancun when no hotel yet). */
    planningZone: string;
  };
  pax: {
    total: number;
    adults: number;
    children: number;
    childAges: number[];
    named: { name: string; age: number }[];
    travelerTitle: string | null;
  };
  budget: {
    perPersonUsd: number;
    totalUsd: number;
    toursUsd: number;
    transfersUsd: number;
    itineraryTotalUsd: number;
    itineraryPerPersonUsd: number;
    /** itinerary total − budget total; negative = under budget. */
    diffUsd: number;
    withinBudget: boolean;
    diningEstimateUsd: number;
  };
  bookings: LeadPdfBooking[];
  dinners: LeadPdfBooking[];
  preferences: {
    interests: string[];
    avoid: string[];
    preferPrivate: boolean;
    chillDays: string;
    tourDays: string;
    restDates: string[];
    dining: { skip: boolean; cuisines: string[]; budgetPerMealUsd: number };
    notes: string | null;
  };
  summary: string;
  introWarnings: string[];
  systemWarnings: string[];
  dayNotices: { date: string; notices: string[] }[];
}

function flightModel(
  label: "Arrival" | "Departure",
  f: LeadRecord["request"]["inbound"],
  transfer: boolean,
): LeadPdfFlight {
  return {
    label,
    date: f.date,
    dateText: longDate(f.date),
    timeText: f.time ?? (f.slot ? (SLOT_LABEL[f.slot] ?? f.slot) : "not given"),
    flightNumber: f.flightNumber || null,
    airline: f.airline || null,
    airport: f.otherAirport || null,
    transfer,
  };
}

function bookingModel(
  item: ItineraryItem,
  day: { date: string; dayNumber: number },
  product: CatalogProduct | undefined,
): LeadPdfBooking {
  const kind = item.kind as "tour" | "transfer" | "restaurant";
  const bokunId = item.bokunId ?? null;
  return {
    kind,
    date: day.date,
    dateText: longDate(day.date),
    dayNumber: day.dayNumber,
    title: item.title,
    bokunId,
    startTime: item.startTime ?? null,
    startTimeId: item.startTimeId ?? null,
    durationMinutes: item.durationMinutes ?? null,
    pickup: item.pickup,
    pickupMinutesBefore: product?.pickupMinutesBefore ?? null,
    bookingCutoffHours: product?.bookingCutoffHours ?? null,
    pricing: item.pricing.map((p) => ({
      pricingCategoryId: p.pricingCategoryId,
      title: p.title,
      count: p.count,
      unitUsd: p.unitUsd,
      subtotalUsd: Math.round(p.count * p.unitUsd * 100) / 100,
    })),
    priceTotalUsd: item.priceTotalUsd,
    extranetUrl:
      product?.extranetUrl ?? (bokunId ? `https://extranet.bokun.io/experience/${bokunId}` : null),
    siteUrl: item.siteUrl ?? product?.siteUrl ?? null,
    inCatalog: !!product,
    cuisines: item.cuisines ?? [],
    priceLevel: item.priceLevel ?? null,
    priceEstimatePpUsd: item.priceEstimatePpUsd ?? null,
    note: item.note ?? null,
  };
}

/** Pure: everything the PDF shows, resolved from the lead and the catalog. Unit-tested. */
export function buildLeadPdfModel(lead: LeadRecord, products: CatalogProduct[]): LeadPdfModel {
  const { request, itinerary } = lead;
  const byId = new Map(products.map((p) => [p.bokunId, p]));
  const travelers = request.travelers;
  const adults = travelers.filter((t) => t.age >= 13);
  const kids = travelers.filter((t) => t.age < 13);
  const nights = tripNights(request);

  const all = itinerary.days.flatMap((d) =>
    d.items
      .filter((i) => i.kind === "tour" || i.kind === "transfer" || i.kind === "restaurant")
      .map((i) => bookingModel(i, d, i.bokunId ? byId.get(i.bokunId) : undefined)),
  );

  const budgetTotal = request.budgetPerPerson * travelers.length;
  const avoidTypes = request.avoidTypes ?? [];
  const avoidGroups = groupsFromTypes(avoidTypes);
  const covered = new Set(typesFromGroups(avoidGroups));
  const avoid = [
    ...avoidGroups.map((g) => AVOID_GROUP_LABEL[g] ?? titleCase(g)),
    ...avoidTypes.filter((t) => !covered.has(t)).map((t) => (t === "atv" ? "ATV" : titleCase(t))),
  ];

  return {
    ref: lead.ref,
    createdAt: lead.createdAt,
    engine: lead.engine ?? "—",
    contact: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      language: lead.locale === "es" ? "Spanish (ES)" : "English (EN)",
    },
    trip: {
      nights,
      dateRange: `${longDate(request.inbound.date)} – ${longDate(request.outbound.date)}`,
      luxuryTransfers: request.transfers.luxury,
    },
    flights: {
      arrival: flightModel("Arrival", request.inbound, request.transfers.arrival),
      departure: flightModel("Departure", request.outbound, request.transfers.departure),
    },
    hotel: {
      noHotel: request.hotel.noHotel,
      name: request.hotel.noHotel ? null : request.hotel.name || null,
      zone: request.hotel.noHotel
        ? null
        : request.hotel.zone
          ? ZONE_LABEL[request.hotel.zone]
          : null,
      planningZone: ZONE_LABEL[effectiveZone(request)],
    },
    pax: {
      total: travelers.length,
      adults: adults.length,
      children: kids.length,
      childAges: kids.map((k) => k.age),
      named: travelers
        .filter((t): t is typeof t & { name: string } => !!t.name)
        .map((t) => ({ name: t.name, age: t.age })),
      travelerTitle: request.travelerTitle ?? null,
    },
    budget: {
      perPersonUsd: request.budgetPerPerson,
      totalUsd: budgetTotal,
      toursUsd: itinerary.totals.toursUsd,
      transfersUsd: itinerary.totals.transfersUsd,
      itineraryTotalUsd: itinerary.totals.totalUsd,
      itineraryPerPersonUsd: itinerary.totals.perPersonUsd,
      diffUsd: Math.round((itinerary.totals.totalUsd - budgetTotal) * 100) / 100,
      withinBudget: itinerary.totals.withinBudget,
      diningEstimateUsd: itinerary.totals.diningEstimateUsd,
    },
    bookings: all.filter((b) => b.kind !== "restaurant"),
    dinners: all.filter((b) => b.kind === "restaurant"),
    preferences: {
      interests: request.interests.map((i) => INTEREST_LABEL[i] ?? titleCase(i)),
      avoid,
      preferPrivate: request.preferPrivate,
      chillDays: CHILL_LABEL[request.chillDays] ?? request.chillDays,
      tourDays: request.tourDays === "all" ? "all full days" : `${request.tourDays} tour days`,
      restDates: request.restDates ?? [],
      dining: {
        skip: request.dining.skip,
        cuisines: request.dining.cuisines.map(titleCase),
        budgetPerMealUsd: request.dining.budgetPerMeal,
      },
      notes: request.notes?.trim() || null,
    },
    summary: itinerary.summary,
    introWarnings: itinerary.introWarnings,
    systemWarnings: itinerary.warnings,
    dayNotices: itinerary.days
      .filter((d) => d.notices?.length)
      .map((d) => ({ date: d.date, notices: d.notices ?? [] })),
  };
}

// ───────────────────────────── document ─────────────────────────────

const GREEN = "#15803d";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f6f7f8";
const AMBER = "#b45309";

const s = StyleSheet.create({
  page: { fontFamily: "Nunito", fontSize: 9.5, color: INK, padding: 36, paddingBottom: 48 },
  banner: {
    borderTopWidth: 4,
    borderTopColor: GREEN,
    paddingTop: 8,
    marginBottom: 12,
  },
  eyebrow: { fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  sub: { fontSize: 10, color: MUTED, marginTop: 2 },
  h2: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  row: { flexDirection: "row", gap: 8 },
  kv: { flex: 1, backgroundColor: SOFT, borderRadius: 6, padding: 8 },
  k: { fontSize: 7.5, color: MUTED, fontWeight: 600, textTransform: "uppercase" },
  v: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  vs: { fontSize: 8.5, color: MUTED, marginTop: 1 },
  warn: {
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    color: "#78350f",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    fontSize: 9,
    lineHeight: 1.4,
  },
  card: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 6,
    padding: 8,
    marginBottom: 7,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 10.5, fontWeight: 700, flex: 1, paddingRight: 8 },
  cardPrice: { fontSize: 11, fontWeight: 700, color: GREEN },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    color: GREEN,
    fontSize: 7.5,
    fontWeight: 700,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 999,
    marginBottom: 3,
  },
  mono: { fontFamily: "Courier", fontSize: 8.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  cell: { width: "50%", paddingRight: 8, marginTop: 3 },
  cellWide: { width: "100%", marginTop: 3 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 2,
    marginTop: 5,
  },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  th: { fontSize: 7.5, color: MUTED, fontWeight: 600, textTransform: "uppercase" },
  td: { fontSize: 9 },
  link: { color: "#1d4ed8", textDecoration: "underline", fontSize: 8.5 },
  note: { fontSize: 9, color: MUTED, marginTop: 3, lineHeight: 1.35 },
  bullet: { fontSize: 9, lineHeight: 1.4, marginBottom: 1 },
  notes: {
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    padding: 8,
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
  },
});

/** Section title that never ends a page on its own. */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <View minPresenceAhead={90}>
      <Text style={s.h2}>{children}</Text>
    </View>
  );
}

function KV({
  k,
  v,
  sub,
  small,
}: {
  k: string;
  v: string;
  sub?: string | null;
  /** Long values without spaces (emails) in a smaller size so they fit the card. */
  small?: boolean;
}) {
  return (
    <View style={s.kv}>
      <Text style={s.k}>{k}</Text>
      <Text style={small ? [s.v, { fontSize: 8.5 }] : s.v}>{v}</Text>
      {sub ? <Text style={s.vs}>{sub}</Text> : null}
    </View>
  );
}

function Field({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <View style={wide ? s.cellWide : s.cell}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.td}>{v}</Text>
    </View>
  );
}

function FlightBox({ f }: { f: LeadPdfFlight }) {
  const details = [
    f.flightNumber,
    f.airline,
    f.airport ? (f.label === "Arrival" ? `from ${f.airport}` : `to ${f.airport}`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <KV
      k={f.label}
      v={`${f.dateText} · ${f.timeText}`}
      sub={`${details || "No flight details"} · Transfer: ${f.transfer ? "requested" : "no"}`}
    />
  );
}

function Booking({ b, pax }: { b: LeadPdfBooking; pax: number }) {
  const isDinner = b.kind === "restaurant";
  const pickupText = !b.pickup
    ? "No"
    : b.pickupMinutesBefore
      ? `Yes · ${b.pickupMinutesBefore} min before start`
      : "Yes";
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.pill}>
        {b.kind === "transfer" ? "TRANSFER" : isDinner ? "RESTAURANT" : "TOUR"} · DAY {b.dayNumber}{" "}
        · {b.dateText.toUpperCase()}
      </Text>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{b.title}</Text>
        <Text style={s.cardPrice}>
          {isDinner
            ? b.priceEstimatePpUsd
              ? `~${money(b.priceEstimatePpUsd)} pp`
              : "—"
            : money(b.priceTotalUsd)}
        </Text>
      </View>
      <View style={s.grid}>
        <Field k="Start time" v={b.startTime ?? "not fixed"} />
        <Field
          k="Bokun ID / start time ID"
          v={`${b.bokunId ?? "—"}${b.startTimeId ? ` / st ${b.startTimeId}` : ""}`}
        />
        {isDinner ? (
          <>
            <Field k="Party" v={`${pax} pax`} />
            <Field
              k="Cuisine / price level"
              v={`${b.cuisines.map(titleCase).join(", ") || "—"}${b.priceLevel ? ` · ${"$".repeat(b.priceLevel)}` : ""}`}
            />
          </>
        ) : (
          <>
            <Field k="Pickup" v={pickupText} />
            <Field
              k="Duration / cutoff"
              v={`${b.durationMinutes ? `${Math.round((b.durationMinutes / 60) * 10) / 10}h` : "—"}${b.bookingCutoffHours ? ` · book ≥ ${b.bookingCutoffHours}h before` : ""}`}
            />
          </>
        )}
      </View>
      {!isDinner ? (
        <>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 3 }]}>Pricing category</Text>
            <Text style={[s.th, { flex: 1.2 }]}>Category ID</Text>
            <Text style={[s.th, { flex: 0.6, textAlign: "right" }]}>Qty</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Unit</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Subtotal</Text>
          </View>
          {b.pricing.length ? (
            b.pricing.map((p) => (
              <View key={p.pricingCategoryId} style={s.tableRow}>
                <Text style={[s.td, { flex: 3 }]}>{p.title}</Text>
                <Text style={[s.mono, { flex: 1.2 }]}>{p.pricingCategoryId}</Text>
                <Text style={[s.td, { flex: 0.6, textAlign: "right" }]}>{p.count}</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{money(p.unitUsd)}</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{money(p.subtotalUsd)}</Text>
              </View>
            ))
          ) : (
            <Text style={s.note}>No price breakdown: quote in Bokun.</Text>
          )}
        </>
      ) : null}
      <View style={[s.row, { marginTop: 5, gap: 14 }]}>
        {b.extranetUrl ? (
          <Link src={b.extranetUrl} style={s.link}>
            Open in Bokun extranet
          </Link>
        ) : null}
        {b.siteUrl ? (
          <Link src={b.siteUrl} style={s.link}>
            Product page on whattodoincancun.com
          </Link>
        ) : null}
      </View>
      {!b.inCatalog && b.bokunId ? (
        <Text style={[s.note, { color: AMBER }]}>
          Not in the planner catalog right now: check the product is still active in Bokun.
        </Text>
      ) : null}
      {b.note ? <Text style={s.note}>“{b.note}”</Text> : null}
    </View>
  );
}

/** Heading + first card never split across pages (cards themselves don't wrap). */
function BookingList({
  title,
  items,
  pax,
  empty,
}: {
  title: string;
  items: LeadPdfBooking[];
  pax: number;
  empty: string;
}) {
  const [first, ...rest] = items;
  return (
    <>
      <View wrap={false}>
        <Text style={s.h2}>{title}</Text>
        {first ? <Booking b={first} pax={pax} /> : <Text style={s.note}>{empty}</Text>}
      </View>
      {rest.map((b, i) => (
        <Booking key={i} b={b} pax={pax} />
      ))}
    </>
  );
}

export function LeadPdf({ m }: { m: LeadPdfModel }) {
  const over = m.budget.diffUsd > 0;
  return (
    <Document title={`Lead ${m.ref} · ${m.contact.name}`} author={brand.poweredBy} language="en">
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>
            Sales copy · planner lead · {m.ref} · engine: {m.engine}
          </Text>
          <Text style={s.title}>
            {m.contact.name} — {m.pax.total} pax — {money(m.budget.itineraryTotalUsd)}
          </Text>
          <Text style={s.sub}>
            {m.trip.dateRange} · {m.trip.nights} night{m.trip.nights === 1 ? "" : "s"} · submitted{" "}
            {m.createdAt.slice(0, 16).replace("T", " ")} UTC
          </Text>
        </View>

        {m.introWarnings.map((w, i) => (
          <Text key={i} style={s.warn}>
            {w}
          </Text>
        ))}

        <H2>Contact</H2>
        <View style={s.row}>
          <KV k="Name" v={m.contact.name} />
          <KV k="Email" v={m.contact.email} small={m.contact.email.length > 22} />
          <KV k="Phone" v={m.contact.phone ?? "—"} />
          <KV k="Language" v={m.contact.language} sub={`Ref ${m.ref}`} />
        </View>

        <H2>Flights & transfers</H2>
        <View style={s.row}>
          <FlightBox f={m.flights.arrival} />
          <FlightBox f={m.flights.departure} />
        </View>
        {m.trip.luxuryTransfers ? (
          <Text style={[s.note, { color: INK }]}>Luxury transfers requested.</Text>
        ) : null}

        <H2>Hotel</H2>
        {m.hotel.noHotel ? (
          <Text style={s.warn}>
            No hotel yet — confirm the area with the customer. The itinerary was planned from{" "}
            {m.hotel.planningZone}.
          </Text>
        ) : (
          <View style={s.row}>
            <KV k="Hotel" v={m.hotel.name ?? "Name not given"} />
            <KV k="Zone" v={m.hotel.zone ?? "—"} sub={`Planning zone: ${m.hotel.planningZone}`} />
          </View>
        )}

        <H2>Travelers</H2>
        <View style={s.row}>
          <KV k="Total" v={`${m.pax.total} pax`} />
          <KV k="Adults (13+)" v={String(m.pax.adults)} />
          <KV
            k="Children"
            v={String(m.pax.children)}
            sub={m.pax.childAges.length ? `Ages ${m.pax.childAges.join(", ")}` : null}
          />
          <KV k="Title" v={m.pax.travelerTitle ? titleCase(m.pax.travelerTitle) : "none"} />
        </View>
        {m.pax.named.length ? (
          <Text style={s.note}>
            Names: {m.pax.named.map((t) => `${t.name} (${t.age})`).join(", ")}
          </Text>
        ) : null}

        <H2>Budget</H2>
        <View style={s.row}>
          <KV
            k="Budget per person"
            v={money(m.budget.perPersonUsd)}
            sub={`${money(m.budget.totalUsd)} for ${m.pax.total} pax`}
          />
          <KV
            k="Itinerary total"
            v={money(m.budget.itineraryTotalUsd)}
            sub={`${money(m.budget.itineraryPerPersonUsd)} per person`}
          />
          <KV
            k="Tours / transfers"
            v={money(m.budget.toursUsd)}
            sub={`Transfers ${money(m.budget.transfersUsd)}`}
          />
          <KV
            k={over ? "Over budget" : "Under budget"}
            v={`${over ? "+" : "−"}${money(Math.abs(m.budget.diffUsd))}`}
            sub={m.budget.withinBudget ? "Tours within budget" : "Tours exceed budget"}
          />
        </View>
        {m.budget.diningEstimateUsd > 0 ? (
          <Text style={s.note}>
            Dinners estimated at {money(m.budget.diningEstimateUsd)} for the party, paid at each
            restaurant (not in the total above).
          </Text>
        ) : null}

        <BookingList
          title={`Bookings to make in Bokun (${m.bookings.length})`}
          items={m.bookings}
          pax={m.pax.total}
          empty="No tours or transfers in this itinerary."
        />
        {m.dinners.length ? (
          <BookingList
            title={`Restaurant reservations (${m.dinners.length})`}
            items={m.dinners}
            pax={m.pax.total}
            empty=""
          />
        ) : null}

        <H2>Preferences</H2>
        <View style={s.grid}>
          <Field k="Interests" v={m.preferences.interests.join(", ") || "—"} wide />
          <Field k="Wants to skip" v={m.preferences.avoid.join(", ") || "nothing"} wide />
          <Field
            k="Private tours"
            v={m.preferences.preferPrivate ? "Prefers private" : "No preference"}
          />
          <Field k="Chill days" v={m.preferences.chillDays} />
          <Field k="Tour days" v={m.preferences.tourDays} />
          <Field
            k="Rest dates"
            v={m.preferences.restDates.length ? m.preferences.restDates.join(", ") : "—"}
          />
          <Field
            k="Dinners"
            v={
              m.preferences.dining.skip
                ? "Doesn't want dinners planned"
                : `${m.preferences.dining.cuisines.join(", ") || "Any cuisine"} · ${money(m.preferences.dining.budgetPerMealUsd)} pp per meal`
            }
            wide
          />
        </View>

        <H2>Customer notes</H2>
        <Text style={s.notes}>{m.preferences.notes ?? "No notes."}</Text>

        {m.dayNotices.length ? (
          <>
            <H2>Notices shown to the customer</H2>
            {m.dayNotices.flatMap((d) =>
              d.notices.map((n, i) => (
                <Text key={`${d.date}-${i}`} style={s.bullet}>
                  • {d.date}: {n}
                </Text>
              )),
            )}
          </>
        ) : null}

        <H2>Itinerary summary (as sent to the customer)</H2>
        <Text style={[s.bullet, { color: MUTED }]}>{m.summary}</Text>

        {m.systemWarnings.length ? (
          <>
            <H2>System notes</H2>
            {m.systemWarnings.map((w, i) => (
              <Text key={i} style={[s.bullet, { color: MUTED }]}>
                • {w}
              </Text>
            ))}
          </>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            Lead {m.ref} · {brand.poweredBy} · internal, do not forward to the customer
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Sales-team PDF: `WhatToDo-lead-<ref>.pdf`. */
export async function renderLeadPdf(
  lead: LeadRecord,
  products: CatalogProduct[],
): Promise<Uint8Array> {
  const buf = await renderToBuffer(<LeadPdf m={buildLeadPdfModel(lead, products)} />);
  return new Uint8Array(buf);
}
