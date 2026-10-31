// Offer normalization, deduplication and candidate ranking for flyer data.
// Prices always come from provider records. This module never invents a
// price, a size, or an eligibility claim; it only classifies what exists.

export const GROCERY_MERCHANTS = new Set([
  "FreshCo",
  "Walmart",
  "Food Basics",
  "Giant Tiger",
  "No Frills",
  "Real Canadian Superstore",
  "Loblaws",
  "Zehrs",
  "Metro",
  "Sobeys",
  "Longos",
  "Longo's",
  "Adonis",
  "Your Independent Grocer",
  "Fortinos",
  "Healthy Planet",
  "Shoppers Drug Mart",
  "Rexall",
]);

// FreshCo Ontario "Lowest Price Guarantee" eligible competitors
// (data/policy/freshco.json, terms captured 2026-10-28). Only offers from
// these merchants can be labelled price-matchable at the Milton FreshCo.
export const FRESHCO_ONTARIO_COMPETITORS = new Set([
  "No Frills",
  "Food Basics",
  "Real Canadian Superstore",
  "Wal-Mart",
  "Walmart",
]);

export function freshCoEligible(offer) {
  return FRESHCO_ONTARIO_COMPETITORS.has(offer.merchant);
}

// Multi-store: eligibility against any store policy's competitor set.
// `competitors` is a Set of merchant names the selected store price-matches.
export function storeEligible(offer, competitors = FRESHCO_ONTARIO_COMPETITORS) {
  return competitors.has(offer.merchant);
}

const LB_PER_KG = 2.20462;

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[™®]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Seedless Oranges ... or Sweet Potatoes ..." covers two products at one
// price. Such a record can never be auto-matched to a single list item.
// An ampersand joins products the same way ("Coke & Pepsi"), while a lone
// "&" inside a fixed product name is rare in flyer data.
export function isMultiProductListing(name) {
  const text = String(name ?? "");
  return /\bor\b/i.test(text) || text.includes("&");
}

export function parsePriceBasis(offer) {
  const text = String(offer.priceText ?? "").toLowerCase();
  const name = String(offer.name ?? "").toLowerCase();
  if (/\/\s*lb|per lb|\blb\b/.test(text)) return { unit: "lb", raw: offer.priceText };
  if (/\/\s*kg|per kg/.test(text)) return { unit: "kg", raw: offer.priceText };
  if (/2\s*for/.test(text)) return { unit: "multi", raw: offer.priceText };
  if (/ea\.?|each/.test(text)) return { unit: "each", raw: offer.priceText };
  const bag = name.match(/(\d+(?:\.\d+)?)\s*lb bag/);
  if (bag) return { unit: "bag", weightLb: Number(bag[1]), raw: offer.priceText };
  return { unit: "item", raw: offer.priceText ?? null };
}

// Comparable per-lb price where it can be derived honestly, else null.
// Never compares across bases it cannot convert.
export function pricePerLb(offer) {
  const basis = parsePriceBasis(offer);
  const price = Number(offer.currentPrice);
  if (!Number.isFinite(price)) return null;
  if (basis.unit === "lb") return price;
  if (basis.unit === "kg") return price / LB_PER_KG;
  if (basis.unit === "bag" && basis.weightLb > 0) return price / basis.weightLb;
  return null;
}

export function dedupeOffers(offers) {
  const seen = new Map();
  for (const offer of offers) {
    const key = [
      offer.merchantId,
      normalizeText(offer.name),
      offer.currentPrice,
    ].join("|");
    if (!seen.has(key)) seen.set(key, offer);
  }
  return [...seen.values()];
}

export function isCurrentlyValid(offer, now = new Date()) {
  const from = new Date(offer.validFrom);
  const to = new Date(offer.validTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
  return from <= now && now <= to;
}

// Coarse product class from the flyer name. The provider category field is
// not trusted (a guitar amp arrived categorised as Food), so the name and
// merchant decide.
export function classifyOffer(offer) {
  const name = normalizeText(offer.name);
  if (!GROCERY_MERCHANTS.has(offer.merchant)) return "non-grocery";
  if (/juice/.test(name)) return "juice";
  if (/pepper/.test(name)) return "peppers";
  if (/pumpkin|mandarin|lemon|honey|pop\b|fanta|crush/.test(name)) return "other-produce";
  if (/orange|navel/.test(name)) return "fruit";
  return "other";
}

// What form of product a list item is asking for.
export function queryIntent(query) {
  const q = normalizeText(query);
  if (/juice/.test(q)) return "juice";
  if (/pepper/.test(q)) return "peppers";
  return "fruit";
}

const STOPWORDS = new Set(["a", "an", "the", "of", "and", "or", "fresh"]);

function stem(token) {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

// A candidate must actually be about the queried product. Class equality
// alone is not enough: "milk" must never match oranges just because both
// fall in a broad produce class.
export function queryRelevant(query, offer) {
  const queryTokens = normalizeText(query)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
  const nameTokens = new Set(normalizeText(offer.name).split(" ").map(stem));
  return queryTokens.some((t) => nameTokens.has(t));
}

export function normalizeOffer(offer) {
  return {
    dealId: offer.dealId,
    name: offer.name,
    merchant: offer.merchant,
    merchantId: offer.merchantId,
    currentPrice: offer.currentPrice,
    originalPrice: offer.originalPrice ?? null,
    currency: offer.currency,
    priceBasis: parsePriceBasis(offer),
    pricePerLb: pricePerLb(offer),
    saleStory: offer.saleStory ?? null,
    validFrom: offer.validFrom,
    validTo: offer.validTo,
    imageUrl: offer.imageUrl,
    source: offer.source,
    priceMatchAtFreshCo: freshCoEligible(offer),
  };
}

// Rank stored offers for one list item.
// Returns confirmed candidates (safe to count), review-only candidates
// (ambiguous; need the user), and a count of excluded records (noise).
// Confirmed candidates sort by per-lb price where derivable, then by
// absolute price within the same basis. Different bases are never merged
// into a single "cheapest" claim.
export function searchOffers(
  offers,
  query,
  { now = new Date(), competitors = FRESHCO_ONTARIO_COMPETITORS } = {},
) {
  const intent = queryIntent(query);
  const deduped = dedupeOffers(offers);
  const confirmed = [];
  const review = [];
  let excluded = 0;

  for (const offer of deduped) {
    const cls = classifyOffer(offer);
    if (cls === "non-grocery" || !isCurrentlyValid(offer, now) || !queryRelevant(query, offer)) {
      excluded += 1;
      continue;
    }
    const normalized = { ...normalizeOffer(offer), priceMatchable: storeEligible(offer, competitors) };
    // Different product form than asked for (orange juice when the item is
    // oranges; orange peppers when the item is oranges): review-only, never
    // a silent substitution. Any other relevant grocery offer can confirm.
    const formMismatch =
      (cls === "juice" && intent !== "juice") ||
      (cls === "peppers" && intent !== "peppers") ||
      (cls === "fruit" && (intent === "juice" || intent === "peppers"));
    if (formMismatch) {
      review.push({ ...normalized, reviewReason: `different product form (${cls})` });
      continue;
    }
    if (isMultiProductListing(offer.name)) {
      review.push({ ...normalized, reviewReason: "multi-product listing at one price" });
      continue;
    }
    confirmed.push(normalized);
  }

  // Store-eligible competitors first: a cheaper offer the home store will
  // not match is not the user's best price-match target.
  confirmed.sort((a, b) => {
    if (a.priceMatchable !== b.priceMatchable) return a.priceMatchable ? -1 : 1;
    if (a.pricePerLb != null && b.pricePerLb != null) return a.pricePerLb - b.pricePerLb;
    if (a.pricePerLb != null) return -1;
    if (b.pricePerLb != null) return 1;
    return a.currentPrice - b.currentPrice;
  });

  return { query, intent, confirmed, review, excludedCount: excluded };
}
