// Backend API (Cloudflare Worker shape; also runs under Node for local dev).
// Serves stored flyer offers. A user request never triggers a paid scrape:
// it queries the snapshot/live store selected by DATA_MODE.
//
// DATA_MODE=snapshot (default): bundled real ingested sample data.
// DATA_MODE=live: reserved for the live ingested store; returns 501 until
// ingestion is wired, rather than silently falling back to demo data.

import { searchOffers } from "../src/offers.mjs";
import snapshotData from "../data/snapshot/offers.json" with { type: "json" };
import fixtureData from "../fixtures/apify/orange-L9E2H4.sample.json" with { type: "json" };
import { parseGroceryList } from "../src/parse.mjs";
import { transcribeWav } from "../src/transcribe.mjs";
import { dictateList } from "../src/dictate.mjs";

let snapshotCache = null;
function loadSnapshot() {
  if (!snapshotCache) {
    // Bundled real ingested snapshot (refreshed by scripts/ingest.mjs).
    // Falls back to the sample fixture records if the snapshot is empty,
    // so the app still runs before the first ingestion.
    const offers = Array.isArray(snapshotData) ? snapshotData : snapshotData.offers;
    snapshotCache =
      Array.isArray(offers) && offers.length
        ? offers
        : fixtureData.map(({ _fixtureNote, ...offer }) => offer);
  }
  return snapshotCache;
}

const CORS_ORIGINS = [
  "https://moosecart.app",
  "https://www.moosecart.app",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

function corsHeaders(request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed =
    CORS_ORIGINS.includes(origin) || /\.pages\.dev$/.test(new URL(origin || "http://x").hostname);
  return allowed
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-max-age": "86400",
      }
    : {};
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(request) },
  });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const mode = env.DATA_MODE ?? "snapshot";

    if (url.pathname === "/health") {
      return json(request, { ok: true, dataMode: mode });
    }

    if (url.pathname === "/dictate" && request.method === "POST") {
      // Raw m4a/AAC recording from the app. Muse Spark Open (Baseten)
      // accepts m4a directly: one call transcribes and parses the list.
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.length) return json(request, { error: "missing audio" }, 400);
      try {
        const result = await dictateList(bytes, {
          apiKey: env.BASETEN_API_KEY,
          mime: request.headers.get("content-type") ?? "audio/mp4",
        });
        return json(request, result);
      } catch (e) {
        return json(request, { error: e instanceof Error ? e.message : "dictate failed" }, 502);
      }
    }

    if (url.pathname === "/transcribe" && request.method === "POST") {
      // Raw WAV upload from the mobile app (converted to WAV on device or
      // by the dev server before this point in production-shaped flows).
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.length) return json(request, { error: "missing audio" }, 400);
      try {
        const text = await transcribeWav(bytes, { apiKey: env.META_API_KEY });
        return json(request, { text });
      } catch (e) {
        return json(request, { error: e instanceof Error ? e.message : "transcribe failed" }, 502);
      }
    }

    if (url.pathname === "/parse" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(request, { error: "invalid JSON" }, 400);
      }
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text) return json(request, { error: "missing text" }, 400);
      try {
        const items = await parseGroceryList(text, { apiKey: env.META_API_KEY });
        return json(request, { items });
      } catch (e) {
        return json(request, { error: e instanceof Error ? e.message : "parse failed" }, 502);
      }
    }

    if (url.pathname === "/search") {
      const q = url.searchParams.get("q")?.trim();
      if (!q) return json(request, { error: "missing q" }, 400);
      if (mode === "live") {
        return json(request, { error: "live store not wired yet", dataMode: mode }, 501);
      }
      const offers = loadSnapshot();
      const result = searchOffers(offers, q);
      return json(request, { dataMode: mode, ...result });
    }

    return json(request, { error: "not found" }, 404);
  },
};
