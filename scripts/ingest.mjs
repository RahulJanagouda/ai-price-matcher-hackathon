// Controlled ingestion: run the selected Apify actor for our demo queries,
// save the normalized snapshot the backend serves. Scans never do this;
// they query the stored snapshot. Usage: node scripts/ingest.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...rest] = t.split("=");
    if (!process.env[k.trim()]) process.env[k.trim()] = rest.join("=").trim();
  }
}

const token = process.env.APIFY_TOKEN;
if (!token) throw new Error("APIFY_TOKEN missing (.env.local)");

const POSTAL_CODE = process.env.INGEST_POSTAL_CODE ?? "L9E1X7";
const QUERIES = (process.env.INGEST_QUERIES ??
  "milk,eggs,oranges,bread,chicken,rice,cheese,butter,apples,bananas,pasta,coffee")
  .split(",")
  .map((q) => q.trim())
  .filter(Boolean);
const MAX_PER_QUERY = Number(process.env.INGEST_MAX_PER_QUERY ?? 25);

const input = {
  postalCode: POSTAL_CODE,
  queries: QUERIES,
  maxItemsPerQuery: MAX_PER_QUERY,
  onlyWithPrice: true,
};

const url =
  "https://api.apify.com/v2/acts/gratifying_graph~canada-grocery-deals/run-sync-get-dataset-items";

console.log(`Ingesting ${QUERIES.length} queries for ${POSTAL_CODE} (max ${MAX_PER_QUERY}/query)…`);
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(input),
});
if (!res.ok) throw new Error(`Apify run ${res.status}: ${(await res.text()).slice(0, 300)}`);
const items = await res.json();
if (!Array.isArray(items)) throw new Error("unexpected Apify response");

const snapshot = {
  postalCode: POSTAL_CODE,
  queries: QUERIES,
  fetchedAt: new Date().toISOString(),
  count: items.length,
  offers: items,
};
mkdirSync(new URL("../data/snapshot/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../data/snapshot/offers.json", import.meta.url),
  JSON.stringify(snapshot, null, 2),
);
console.log(`Saved ${items.length} offers to data/snapshot/offers.json`);
