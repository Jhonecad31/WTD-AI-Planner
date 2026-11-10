// Writes the catalog snapshot that ships inside the build:
//   src/content/catalog-snapshot.json   (compact form, see src/server/catalog/snapshot.ts)
//
// On Vercel every new instance starts with an empty memory and an empty /tmp, so
// without this file the first request of each instance had to pull the whole
// catalog from Bokun (hundreds of requests). getCatalog() uses this file as the
// fallback when there is no fresher cache; the daily cron only refreshes it.
//
// Run:
//   node scripts/build-catalog-snapshot.mjs            compacts .cache/catalog.json
//                                                      (or $CATALOG_CACHE_DIR/catalog.json)
//   node scripts/build-catalog-snapshot.mjs --sync     fetches the catalog from Bokun first
//                                                      (needs BOKUN_* in .env.local)
//   node scripts/build-catalog-snapshot.mjs --from <catalog.json>
//
// Re-run it (and commit the result) whenever products change on
// whattodoincancun.com, so a cold instance never plans with an old catalog.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The Bokun client uses TypeScript parameter properties, which Node only
// accepts with type transforms on: re-run under that flag when it is missing.
const FLAGS = ["--experimental-transform-types", "--disable-warning=ExperimentalWarning"];
if (!process.execArgv.includes(FLAGS[0])) {
  const { status } = spawnSync(
    process.execPath,
    [...process.execArgv, ...FLAGS, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(status ?? 1);
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = new URL("../src/", import.meta.url);
const OUT = path.join(ROOT, "src/content/catalog-snapshot.json");

const args = process.argv.slice(2);
const sync = args.includes("--sync");
const fromArg = args[args.indexOf("--from") + 1];
const from =
  args.includes("--from") && fromArg
    ? path.resolve(fromArg)
    : path.join(process.env.CATALOG_CACHE_DIR?.trim() || path.join(ROOT, ".cache"), "catalog.json");

// The app's TypeScript modules use the `@/` alias, extension-less imports and a
// JSON import; Node strips types itself, this teaches it the rest.
registerHooks({
  resolve(specifier, context, next) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = new URL(spec.slice(2), SRC).href;
    if (/^(\.{1,2}\/|file:)/.test(spec) && !/\.[a-z]+$/i.test(spec)) {
      const base = spec.startsWith("file:") ? spec : new URL(spec, context.parentURL).href;
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(fileURLToPath(base + ext))) {
          spec = base + ext;
          break;
        }
      }
    }
    const resolved = next(spec, context);
    if (resolved.url.endsWith(".json")) return { ...resolved, importAttributes: { type: "json" } };
    if (resolved.url.endsWith(".ts")) return { ...resolved, format: "module-typescript" };
    return resolved;
  },
});

const envFile = path.join(ROOT, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { compactSnapshot } = await import("../src/server/catalog/snapshot.ts");

let snapshot;
if (sync) {
  const { syncCatalogFromBokun } = await import("../src/server/catalog/service.ts");
  console.error("syncing the site catalog from Bokun…");
  snapshot = await syncCatalogFromBokun({ scope: "site" });
} else {
  if (!existsSync(from)) {
    console.error(`no catalog at ${from}; run with --sync (needs BOKUN_* keys) or --from <file>`);
    process.exit(1);
  }
  snapshot = JSON.parse(await readFile(from, "utf8"));
}

// Only what the planner recommends ships in the build; "all" stays in /tmp and /dev/catalog.
const site = {
  ...snapshot,
  scope: "site",
  products: snapshot.products.filter((p) => p.onSite),
};
if (!site.products.length) {
  console.error("the snapshot has no on-site products; refusing to write an empty file");
  process.exit(1);
}

const compact = compactSnapshot(site);
const json = JSON.stringify(compact, null, 1) + "\n";
await writeFile(OUT, json);
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(
  `wrote ${site.products.length} products (${compact.pickupPlaces.length} pickup places, ` +
    `${compact.pickupLists.length} pickup lists) fetched ${site.fetchedAt} to ${path.relative(ROOT, OUT)}: ` +
    `${kb(Buffer.byteLength(json))} (plain snapshot: ${kb(Buffer.byteLength(JSON.stringify(site)))})`,
);
