// Moose pick: the model chooses ONE best deal per item from an already
// vetted shortlist. Prices, merchants and eligibility all come from flyer
// data plus the captured store policy; the model only ranks and explains.
// The pick is accepted only when its dealId is in the shortlist — anything
// else falls back to the cheapest payable offer, never to invented data.
// Server-side only: the Baseten key never reaches the mobile bundle.
// Hackathon model ID must be exactly meta-models/muse-spark-open-1026.

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
export const BESTDEAL_MODEL = "meta-models/muse-spark-open-1026";

export const BESTDEAL_SYSTEM = [
  "You rank grocery flyer offers for a price-match shopper.",
  "Reply with JSON only: {\"dealId\": number, \"reason\": string}.",
  "The reason is one short shopper-facing sentence (max 20 words) using only the facts given.",
  "Never invent prices, merchants, brands or dates. Never pick a dealId outside the list.",
].join(" ");

export function buildBestDealPrompt(item, offers) {
  const lines = offers.map(
    (o) =>
      `- dealId ${o.dealId}: ${o.name} at ${o.merchant}, payable $${Number(o.payable).toFixed(2)} ${o.currency ?? "CAD"}` +
      `${o.basis ? ` (${o.basis})` : ""}, flyer valid to ${o.validTo}.`,
  );
  return [
    `The shopper wants "${item}". These flyer offers are all confirmed price-matchable.`,
    "Pick the single best deal considering payable price and value.",
    ...lines,
  ].join(" ");
}

export function parseBestDealPick(content, validIds) {
  const text = String(content ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!validIds.includes(parsed?.dealId)) return null;
  const reason = typeof parsed?.reason === "string" ? parsed.reason.trim().slice(0, 200) : "";
  if (!reason) return null;
  return { dealId: parsed.dealId, reason };
}

// Deterministic fallback: cheapest payable offer. Used when there is only
// one candidate (no model call needed) and whenever the model reply fails
// validation, so the UI always has an answer grounded in flyer data.
export function cheapestFallback(offers, item) {
  const sorted = [...offers].sort((a, b) => Number(a.payable) - Number(b.payable));
  const best = sorted[0];
  return {
    dealId: best.dealId,
    reason:
      offers.length === 1
        ? "Only price-matchable offer for this item."
        : `Lowest payable price for ${item}.`,
    fallback: true,
  };
}

export async function pickBestDeal(item, offers, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("BASETEN_API_KEY not configured");
  if (!Array.isArray(offers) || !offers.length) throw new Error("no candidate offers");
  if (offers.length === 1) {
    return { ...cheapestFallback(offers, item), fallback: true };
  }
  const res = await fetchImpl(BASETEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: BESTDEAL_MODEL,
      messages: [
        { role: "system", content: BESTDEAL_SYSTEM },
        { role: "user", content: buildBestDealPrompt(item, offers) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Baseten ${res.status}`);
  const data = await res.json();
  const pick = parseBestDealPick(
    data?.choices?.[0]?.message?.content ?? "",
    offers.map((o) => o.dealId),
  );
  if (!pick) return { ...cheapestFallback(offers, item), fallback: true };
  return { ...pick, fallback: false };
}
