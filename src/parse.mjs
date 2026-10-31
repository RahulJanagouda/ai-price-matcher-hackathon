// Grocery-list parsing via Muse Spark Open (Baseten, Meta open-weights).
// Server-side only: the API key must never reach the mobile bundle.
// The model proposes structure; prices never come from here.
import { extractJson } from "./dictate.mjs";

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
export const PARSE_MODEL = "meta-models/muse-spark-open-1026";

const SYSTEM = [
  "Parse a grocery list (typed or transcribed speech) into JSON only.",
  'Shape: {"items":[{"name":string,"quantity":number|null,"unit":string|null}]}',
  "Keep product names generic (no brand invention). Convert spoken quantities",
  "(a dozen = 12). If a size is stated, put it in unit (e.g. \"2 L\"). No prose.",
].join(" ");

export async function parseGroceryList(text, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("BASETEN_API_KEY not configured");
  const res = await fetchImpl(BASETEN_URL, {
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
  if (!res.ok) throw new Error(`Baseten ${res.status}`);
  const data = await res.json();
  const parsed = extractJson(data?.choices?.[0]?.message?.content ?? "");
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      quantity: typeof i.quantity === "number" ? i.quantity : null,
      unit: typeof i.unit === "string" ? i.unit : null,
    }));
}
