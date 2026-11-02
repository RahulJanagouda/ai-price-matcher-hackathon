import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dedupeOffers,
  isMultiProductListing,
  isOwnBrandListing,
  normalizeOffer,
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
  assert.equal(isMultiProductListing("COKE & PEPSI SOFT DRINKS"), true);
});

test("pharmacy soda singles are searchable groceries", async () => {
  const { searchOffers } = await import("../src/offers.mjs");
  const offers = [
    {
      dealId: 1, query: "coca cola", postalCode: "L9E1X7", name: "COCA-COLA",
      merchant: "Rexall", currentPrice: 3.99, currency: "CAD", priceText: null,
      category: "Food", brandIds: [], validFrom: "2026-10-29T04:00:00+00:00",
      validTo: "2026-11-05T04:00:00+00:00", imageUrl: "https://example.com/x.jpg",
    },
  ];
  const result = searchOffers(offers, "coca cola", { now: new Date("2026-11-01T12:00:00Z") });
  assert.equal(result.confirmed.length, 1);
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
  assert.ok(!merchants.includes("Long & McQuade Musical Instruments"));
  assert.ok(!merchants.includes("IKEA"));
  // Juice is review-only, never a silent substitution for fruit.
  assert.ok(result.review.some((o) => /juice/i.test(o.name)));
  // The FreshCo oranges-or-sweet-potatoes record needs human review.
  assert.ok(result.review.some((o) => o.merchant === "FreshCo"));
  // The No Frills Farmer's Market bag is a store brand: review, not confirmed.
  assert.ok(!merchants.includes("No Frills"));
  assert.ok(
    result.review.some((o) => o.merchant === "No Frills" && /cashier call/.test(o.reviewReason)),
  );
  assert.ok(result.excludedCount >= 2);
});

test("pageImageUrl passes through when present, null otherwise", () => {
  const base = { dealId: 1, name: "x", merchant: "Walmart", merchantId: 1, currentPrice: 1, currency: "CAD", validFrom: "2026-10-22T04:00:00+00:00", validTo: "2026-10-29T03:59:59+00:00", imageUrl: "https://example.com/i.jpg" };
  assert.equal(normalizeOffer({ ...base }).pageImageUrl, null);
  assert.equal(normalizeOffer({ ...base, pageImageUrl: "not-a-url" }).pageImageUrl, null);
  assert.equal(
    normalizeOffer({ ...base, pageImageUrl: "https://example.com/page.jpg" }).pageImageUrl,
    "https://example.com/page.jpg",
  );
});

test("flyerId passes through when numeric, null otherwise", () => {
  const base = { dealId: 1, name: "x", merchant: "Walmart", merchantId: 1, currentPrice: 1, currency: "CAD", validFrom: "2026-10-22T04:00:00+00:00", validTo: "2026-10-29T03:59:59+00:00", imageUrl: "https://example.com/i.jpg" };
  assert.equal(normalizeOffer({ ...base }).flyerId, null);
  assert.equal(normalizeOffer({ ...base, flyerId: "8207199" }).flyerId, null);
  assert.equal(normalizeOffer({ ...base, flyerId: 8207199 }).flyerId, 8207199);
});

test("store-brand listings never confirm silently", () => {
  assert.equal(isOwnBrandListing("FARMER'S MARKET™ ORANGES, 3 LB BAG"), true);
  assert.equal(isOwnBrandListing("PC® ORANGE JUICE, 2.5 L"), true);
  assert.equal(isOwnBrandListing("NO NAME™ APPLE OR ORANGE JUICE BLENDS, 1.75 L"), true);
  assert.equal(isOwnBrandListing("COMPLIMENTS Orange Juice"), true);
  assert.equal(isOwnBrandListing("3 lb bagged seedless oranges"), false);
  assert.equal(isOwnBrandListing("6 pc chicken nuggets"), false); // piece count, not PC
  assert.equal(isOwnBrandListing("Tropicana Pure Premium orange juice 1.36 L"), false);
});

test("FreshCo eligibility: only Ontario-program competitors are matchable", () => {
  const result = searchOffers(fixture, "orange", { now: NOW });
  const byMerchant = new Map(result.confirmed.map((o) => [o.merchant, o.priceMatchAtFreshCo]));
  assert.equal(byMerchant.get("Real Canadian Superstore"), true);
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

test("Wal-Mart vs Walmart: policy spelling and flyer spelling both match", async () => {
  const { storeEligible, freshCoEligible } = await import("../src/offers.mjs");
  const policySet = new Set(["No Frills", "Food Basics", "Real Canadian Superstore", "Wal-Mart"]);
  assert.equal(storeEligible({ merchant: "Walmart" }, policySet), true);
  assert.equal(storeEligible({ merchant: "Wal-Mart" }, policySet), true);
  assert.equal(storeEligible({ merchant: "Giant Tiger" }, policySet), false);
  assert.equal(freshCoEligible({ merchant: "Walmart" }), true);
});

function groceryOffer(name, merchant = "Walmart", extra = {}) {
  return {
    dealId: Math.floor(Math.random() * 1e9), query: "test", postalCode: "L9E1X7", name,
    merchant, merchantId: 1, currentPrice: 2.99, currency: "CAD", priceText: null,
    category: "Food, Beverages & Tobacco > Food Items", brandIds: [],
    validFrom: "2026-10-22T04:00:00+00:00", validTo: "2026-11-05T04:00:00+00:00",
    imageUrl: "https://example.com/x.jpg", ...extra,
  };
}

test("every significant query word must match: seedless never confirms navel", () => {
  const offers = [groceryOffer("Navel oranges"), groceryOffer("Seedless oranges, 3 lb bag")];
  const result = searchOffers(offers, "seedless oranges", { now: NOW });
  assert.ok(!result.confirmed.some((o) => o.name === "Navel oranges"));
  assert.ok(result.confirmed.some((o) => o.name === "Seedless oranges, 3 lb bag"));
});

test("named brands must appear: tropicana never confirms oasis", () => {
  const offers = [groceryOffer("OASIS ORANGE JUICE, 1.5 L"), groceryOffer("Tropicana Pure Premium orange juice 1.36 L")];
  const result = searchOffers(offers, "tropicana orange juice", { now: NOW });
  assert.ok(!result.confirmed.some((o) => /oasis/i.test(o.name)));
});

test("stated sizes must match: 2 L milk never confirms a 1 L carton", () => {
  const offers = [groceryOffer("Milk 1 L"), groceryOffer("Milk 2 L")];
  const result = searchOffers(offers, "2 L milk", { now: NOW });
  assert.ok(result.confirmed.every((o) => o.name === "Milk 2 L"));
  assert.ok(result.confirmed.length >= 1);
});
