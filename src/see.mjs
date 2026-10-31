// Grocery photo understanding in one call via Muse Spark Open on Baseten.
// The phone sends JPEG/PNG bytes; the model describes what it sees and
// returns structured items. Prices never come from here: the caller prices
// the confirmed items against flyer data afterwards.
// Server-side only: the Baseten key never reaches the mobile bundle.

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
export const SEE_MODEL = "meta-models/muse-spark-open-1026";

const PROMPT = [
  "Look at this grocery photo. Describe what you see, then return JSON only:",
  '{"seen": string, "items": [{"name": string, "quantity": number|null, "unit": string|null}]}',
  '"seen" is one short sentence a shopper would recognise.',
  "List each distinct grocery product once with a generic name (no brand",
  "invention). Skip people, carts, shelves and packaging text. If no grocery",
  "product is visible, return an empty items array. No prose outside the JSON.",
].join(" ");

export async function seeGroceries(photoBytes, { apiKey, mime = "image/jpeg", fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("BASETEN_API_KEY not configured");
  const base64 = Buffer.from(photoBytes).toString("base64");
  const res = await fetchImpl(BASETEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SEE_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Baseten ${res.status}`);
  const data = await res.json();
  const { extractJson } = await import("./dictate.mjs");
  const parsed = extractJson(data?.choices?.[0]?.message?.content ?? "");
  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      quantity: typeof i.quantity === "number" ? i.quantity : null,
      unit: typeof i.unit === "string" ? i.unit : null,
    }));
  return { seen: typeof parsed.seen === "string" ? parsed.seen : "", items };
}
