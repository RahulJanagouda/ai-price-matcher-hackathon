import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dedupeOffers,
  isMultiProductListing,
  parsePriceBasis,
  pricePerLb,
  searchOffers,
} from "../src/offers.mjs";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/apify/orange-L9E2H4.sample.json", import.meta.url), "utf8"),
);
// Fixture was fetched 2026-10-27; evaluate validity at that moment.
const NOW = new Date("2026-10-27T12:00:00Z");

test("duplicate flyer records collapse", () => {
  const dup = { ...fixture[2] };
  const out = dedupeOffers([fixture[2], dup, fixture[3]]);
  assert.equal(out.length, 2);
});

test("multi-product listing is detected", () => {
  assert.equal(isMultiProductListing(fixture[0].name), true);
  assert.equal(isMultiProductListing(fixture[3].name), false);
});

test("price basis and per-lb derivation", () => {
  assert.equal(parsePriceBasis(fixture[4]).unit, "lb");
  assert.equal(pricePerLb(fixture[4]), 2);
  const bag = pricePerLb(fixture[5]); // $4.99 / 3 lb bag
  assert.ok(Math.abs(bag - 4.99 / 3) < 1e-9);
  assert.equal(pricePerLb(fixture[1]), null); // juice bottle: no weight claim
});

test("search for 'orange' confirms fruit only, never the amp or the juice", () => {
  const result = searchOffers(fixture, "orange", { now: NOW });
  const merchants = result.confirmed.map((o) => o.merchant);
  assert.ok(merchants.includes("Giant Tiger"));
  assert.ok(merchants.includes("No Frills"));
  assert.ok(!merchants.includes("Long & McQuade Musical Instruments"));
  assert.ok(!merchants.includes("IKEA"));
  // Juice is review-only, never a silent substitution for fruit.
  assert.ok(result.review.some((o) => /juice/i.test(o.name)));
  // The FreshCo oranges-or-sweet-potatoes record needs human review.
  assert.ok(result.review.some((o) => o.merchant === "FreshCo"));
  assert.ok(result.excludedCount >= 2);
});

test("FreshCo eligibility: only Ontario-program competitors are matchable", () => {
  const result = searchOffers(fixture, "orange", { now: NOW });
  const byMerchant = new Map(result.confirmed.map((o) => [o.merchant, o.priceMatchAtFreshCo]));
  assert.equal(byMerchant.get("No Frills"), true);
  assert.equal(byMerchant.get("Giant Tiger"), false);
  // An eligible competitor outranks an ineligible one for the pick.
  assert.equal(result.confirmed[0].priceMatchAtFreshCo, true);
});

test("unrelated items never match: milk gets no oranges", () => {
  const result = searchOffers(fixture, "milk", { now: NOW });
  assert.equal(result.confirmed.length, 0);
  assert.equal(result.review.length, 0);
});

test("search for 'orange juice' intends juice", () => {
  const result = searchOffers(fixture, "orange juice", { now: NOW });
  assert.equal(result.intent, "juice");
  assert.ok(result.confirmed.some((o) => o.merchant === "Walmart"));
});
