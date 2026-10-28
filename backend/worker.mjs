// Backend API (Cloudflare Worker shape; also runs under Node for local dev).
// Serves stored flyer offers. A user request never triggers a paid scrape:
// it queries the snapshot/live store selected by DATA_MODE.
//
// DATA_MODE=snapshot (default): bundled real ingested sample data.
// DATA_MODE=live: reserved for the live ingested store; returns 501 until
// ingestion is wired, rather than silently falling back to demo data.

import { readFileSync } from "node:fs";
import { searchOffers } from "../src/offers.mjs";
import { parseGroceryList } from "../src/parse.mjs";

let snapshotCache = null;
function loadSnapshot() {
  if (!snapshotCache) {
    const url = new URL("../fixtures/apify/orange-L9E2H4.sample.json", import.meta.url);
    const raw = JSON.parse(readFileSync(url, "utf8"));
    snapshotCache = raw.map(({ _fixtureNote, ...offer }) => offer);
  }
  return snapshotCache;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const mode = env.DATA_MODE ?? "snapshot";

    if (url.pathname === "/health") {
      return json({ ok: true, dataMode: mode });
    }

    if (url.pathname === "/parse" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text) return json({ error: "missing text" }, 400);
      try {
        const items = await parseGroceryList(text, { apiKey: env.META_API_KEY });
        return json({ items });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "parse failed" }, 502);
      }
    }

    if (url.pathname === "/search") {
      const q = url.searchParams.get("q")?.trim();
      if (!q) return json({ error: "missing q" }, 400);
      if (mode === "live") {
        return json({ error: "live store not wired yet", dataMode: mode }, 501);
      }
      const offers = loadSnapshot();
      const result = searchOffers(offers, q);
      return json({ dataMode: mode, ...result });
    }

    return json({ error: "not found" }, 404);
  },
};
