/**
 * Country calling codes for the phone field of the contact step.
 * [ISO 3166-1 alpha-2, calling code]. Names and flags are derived from the ISO code,
 * so the list reads in the visitor's language without a translation table.
 */
export const DIAL_CODES: ReadonlyArray<readonly [iso: string, dial: string]> = [
  ["MX", "52"],
  ["US", "1"],
  ["CA", "1"],
  ["AR", "54"],
  ["AU", "61"],
  ["AT", "43"],
  ["BE", "32"],
  ["BZ", "501"],
  ["BO", "591"],
  ["BR", "55"],
  ["CL", "56"],
  ["CN", "86"],
  ["CO", "57"],
  ["CR", "506"],
  ["CU", "53"],
  ["CZ", "420"],
  ["DK", "45"],
  ["DO", "1"],
  ["EC", "593"],
  ["SV", "503"],
  ["FI", "358"],
  ["FR", "33"],
  ["DE", "49"],
  ["GR", "30"],
  ["GT", "502"],
  ["HN", "504"],
  ["HK", "852"],
  ["HU", "36"],
  ["IN", "91"],
  ["ID", "62"],
  ["IE", "353"],
  ["IL", "972"],
  ["IT", "39"],
  ["JM", "1"],
  ["JP", "81"],
  ["KR", "82"],
  ["MY", "60"],
  ["NL", "31"],
  ["NZ", "64"],
  ["NI", "505"],
  ["NO", "47"],
  ["PA", "507"],
  ["PY", "595"],
  ["PE", "51"],
  ["PH", "63"],
  ["PL", "48"],
  ["PT", "351"],
  ["PR", "1"],
  ["RO", "40"],
  ["RU", "7"],
  ["SA", "966"],
  ["SG", "65"],
  ["ZA", "27"],
  ["ES", "34"],
  ["SE", "46"],
  ["CH", "41"],
  ["TW", "886"],
  ["TH", "66"],
  ["TR", "90"],
  ["UA", "380"],
  ["AE", "971"],
  ["GB", "44"],
  ["UY", "598"],
  ["VE", "58"],
  ["VN", "84"],
];

/** Shown first: where most travelers come from. */
const PINNED = ["MX", "US", "CA"];

export interface DialOption {
  iso: string;
  /** Calling code without the plus sign, e.g. "52". */
  dial: string;
  /** e.g. "🇲🇽 México (+52)". */
  label: string;
}

function flag(iso: string): string {
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** The list for a locale: pinned countries first, the rest sorted by their localized name. */
export function dialOptions(locale: string): DialOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    /* very old browser: fall back to the ISO code */
  }
  const all = DIAL_CODES.map(([iso, dial]) => {
    const name = names?.of(iso) ?? iso;
    return { iso, dial, name, label: `${flag(iso)} ${name} (+${dial})` };
  });
  const pinned = PINNED.flatMap((iso) => all.filter((o) => o.iso === iso));
  const rest = all
    .filter((o) => !PINNED.includes(o.iso))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return [...pinned, ...rest].map(({ iso, dial, label }) => ({ iso, dial, label }));
}

/** Calling code for an ISO country, without the plus sign. */
export function dialFor(iso: string): string | null {
  return DIAL_CODES.find(([c]) => c === iso)?.[1] ?? null;
}
