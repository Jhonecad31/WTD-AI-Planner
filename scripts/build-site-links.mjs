// Crawls whattodoincancun.com's sitemap and maps each Bokun experience ID to its
// public page. Output: src/content/site-links.json  { "<bokunId>": { "url", "title" } }
// Run: node scripts/build-site-links.mjs
import { writeFile } from "node:fs/promises";

const SITE = "https://whattodoincancun.com";
const OUT = new URL("../src/content/site-links.json", import.meta.url);

const sitemap = await (await fetch(`${SITE}/sitemap-0.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => /\/(tour|transfers|party|restaurant)\//.test(u) && !u.includes("/es/"));

const decode = (t) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
const links = {};
let done = 0;
async function worker() {
  while (urls.length) {
    const url = urls.shift();
    try {
      const html = await (await fetch(url)).text();
      const ids = new Set([...html.matchAll(/experience-calendar\/(\d+)/g)].map((m) => m[1]));
      const title = decode(
        (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "")
          .replace(/\s*[|–-]\s*What To Do.*$/i, "")
          .trim(),
      );
      for (const id of ids) links[id] ??= { url, title };
    } catch (e) {
      console.error("skip", url, e.message);
    }
    if (++done % 20 === 0) console.error(`${done} pages`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const sorted = Object.fromEntries(Object.entries(links).sort(([a], [b]) => Number(a) - Number(b)));
await writeFile(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`wrote ${Object.keys(sorted).length} links to ${OUT.pathname}`);
