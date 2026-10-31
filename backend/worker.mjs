// Backend API (Cloudflare Worker shape; also runs under Node for local dev).
// Serves stored flyer offers. A user request never triggers a paid scrape:
// it queries the snapshot/live store selected by DATA_MODE.
//
// DATA_MODE=snapshot (default): bundled real ingested sample data.
// DATA_MODE=live: reserved for the live ingested store; returns 501 until
// ingestion is wired, rather than silently falling back to demo data.

import { FRESHCO_ONTARIO_COMPETITORS, searchOffers } from "../src/offers.mjs";
import snapshotData from "../data/snapshot/offers.json" with { type: "json" };
import fixtureData from "../fixtures/apify/orange-L9E2H4.sample.json" with { type: "json" };
import { parseGroceryList } from "../src/parse.mjs";
import { transcribeWav } from "../src/transcribe.mjs";
import { dictateList } from "../src/dictate.mjs";
import { seeGroceries } from "../src/see.mjs";
import storesData from "../data/policy/stores.json" with { type: "json" };
import freshcoPolicy from "../data/policy/freshco.json" with { type: "json" };

// Store policies by store id. Only stores with a captured policy can rank
// offers as matchable; others 400 until their policy file lands.
const STORE_POLICIES = {
  "freshco-milton": {
    competitors: new Set(freshcoPolicy.policy.eligibleCompetitorsOntario),
    beatCents: freshcoPolicy.policy.beatByCents ?? 1,
    chain: "FreshCo",
  },
};

function storePolicy(storeId) {
  if (!storeId) return { competitors: FRESHCO_ONTARIO_COMPETITORS, beatCents: 1, chain: "FreshCo" };
  const entry = (storesData.stores ?? []).find((s) => s.id === storeId);
  if (!entry?.enabled) return null;
  return STORE_POLICIES[storeId] ?? null;
}

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

    if (url.pathname === "/see" && request.method === "POST") {
      // Grocery photo from the app. Muse Spark Open (Baseten) describes
      // what it sees and returns structured items; the app confirms with
      // the shopper before pricing anything against flyer data.
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.length) return json(request, { error: "missing photo" }, 400);
      try {
        const result = await seeGroceries(bytes, {
          apiKey: env.BASETEN_API_KEY,
          mime: request.headers.get("content-type") ?? "image/jpeg",
        });
        return json(request, result);
      } catch (e) {
        return json(request, { error: e instanceof Error ? e.message : "see failed" }, 502);
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
        const items = await parseGroceryList(text, { apiKey: env.BASETEN_API_KEY });
        return json(request, { items });
      } catch (e) {
        return json(request, { error: e instanceof Error ? e.message : "parse failed" }, 502);
      }
    }

    if (url.pathname === "/stores") {
      return json(request, { stores: storesData.stores });
    }

    if (url.pathname === "/search") {
      const q = url.searchParams.get("q")?.trim();
      if (!q) return json(request, { error: "missing q" }, 400);
      if (mode === "live") {
        return json(request, { error: "live store not wired yet", dataMode: mode }, 501);
      }
      const policy = storePolicy(url.searchParams.get("store"));
      if (!policy) return json(request, { error: "unknown or unsupported store" }, 400);
      const offers = loadSnapshot();
      const result = searchOffers(offers, q, { competitors: policy.competitors });
      return json(request, { dataMode: mode, beatCents: policy.beatCents, chain: policy.chain, ...result });
    }

    return json(request, { error: "not found" }, 404);
  },
};
