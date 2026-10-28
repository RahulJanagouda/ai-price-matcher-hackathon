// Grocery-list parsing via Muse Spark (Meta Model API).
// Server-side only: the API key must never reach the mobile bundle.
// The model proposes structure; prices never come from here.

const META_URL = "https://api.meta.ai/v1/chat/completions";
export const PARSE_MODEL = "muse-spark-1.3";

const SYSTEM = [
  "Parse a grocery list (typed or transcribed speech) into JSON only.",
  'Shape: {"items":[{"name":string,"quantity":number|null,"unit":string|null}]}',
  "Keep product names generic (no brand invention). Convert spoken quantities",
  "(a dozen = 12). If a size is stated, put it in unit (e.g. \"2 L\"). No prose.",
].join(" ");

export async function parseGroceryList(text, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("META_API_KEY not configured");
  const res = await fetchImpl(META_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: PARSE_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: String(text ?? "") },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Meta API ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("model did not return JSON");
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      quantity: typeof i.quantity === "number" ? i.quantity : null,
      unit: typeof i.unit === "string" ? i.unit : null,
    }));
}
