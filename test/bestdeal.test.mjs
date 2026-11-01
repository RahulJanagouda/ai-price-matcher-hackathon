import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BESTDEAL_MODEL,
  buildBestDealPrompt,
  cheapestFallback,
  BESTDEAL_SYSTEM,
  parseBestDealPick,
  pickBestDeal,
} from "../src/bestdeal.mjs";

const OFFERS = [
  { dealId: 11, name: "Navel oranges", merchant: "Real Canadian Superstore", payable: 2.0, currency: "CAD", basis: "$2/LB", validTo: "2026-10-29" },
  { dealId: 22, name: "3 lb bagged seedless oranges", merchant: "Giant Tiger", payable: 2.88, currency: "CAD", basis: null, validTo: "2026-10-28" },
];

test("bestdeal uses the exact hackathon model and grounded facts only", async () => {
  let seen = null;
  const fakeFetch = async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"dealId": 11, "reason": "Lowest payable price at a matchable store."}' } }],
      }),
    };
  };
  const out = await pickBestDeal("oranges", OFFERS, { apiKey: "bt-key", fetchImpl: fakeFetch });
  assert.equal(seen.body.model, "meta-models/muse-spark-open-1026");
  assert.equal(seen.body.model, BESTDEAL_MODEL);
  assert.match(seen.auth, /^Bearer \S+$/);
  assert.equal(seen.body.messages[0].role, "system");
  assert.match(seen.body.messages[1].content, /dealId 11/);
  assert.equal(out.dealId, 11);
  assert.equal(out.fallback, false);
  assert.ok(out.reason.length > 0);
});

test("bestdeal prompt never invents candidates", () => {
  const prompt = BESTDEAL_SYSTEM + " " + buildBestDealPrompt("oranges", OFFERS);
  assert.match(prompt, /dealId 11/);
  assert.match(prompt, /dealId 22/);
  assert.match(prompt, /Never pick a dealId outside the list/);
});

test("bestdeal rejects a pick outside the shortlist", () => {
  assert.equal(parseBestDealPick('{"dealId": 99, "reason": "Trust me."}', [11, 22]), null);
  assert.equal(parseBestDealPick("no json here", [11, 22]), null);
  const pick = parseBestDealPick('{"dealId": 22, "reason": "Bigger bag, better value."}', [11, 22]);
  assert.deepEqual(pick, { dealId: 22, reason: "Bigger bag, better value." });
});

test("bestdeal falls back to cheapest payable when the model strays", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"dealId": 99, "reason": "Trust me."}' } }] }),
  });
  const out = await pickBestDeal("oranges", OFFERS, { apiKey: "k", fetchImpl: fakeFetch });
  assert.deepEqual(out, { dealId: 11, reason: "Lowest payable price for oranges.", fallback: true });
});

test("bestdeal with one candidate skips the model call", async () => {
  let called = false;
  const out = await pickBestDeal("oranges", [OFFERS[0]], {
    apiKey: "k",
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });
  assert.equal(called, false);
  assert.deepEqual(out, {
    dealId: 11,
    reason: "Only price-matchable offer for this item.",
    fallback: true,
  });
});

test("bestdeal without a key fails closed", async () => {
  await assert.rejects(() => pickBestDeal("oranges", OFFERS, { apiKey: "" }), /not configured/);
  assert.throws(() => cheapestFallback([], "oranges"), TypeError);
});
