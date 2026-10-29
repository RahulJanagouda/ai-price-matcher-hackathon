// Voice grocery list in one call via Muse Spark Open on Baseten.
// The phone records m4a/AAC; Muse Spark Open accepts M4A/AAC directly
// (WAV/MP3/FLAC/OGG also), so no ffmpeg conversion is needed anywhere.
// Server-side only: the Baseten key never reaches the mobile bundle.
// Hackathon model ID must be exactly meta-models/muse-spark-open-1026.

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
export const DICTATE_MODEL = "meta-models/muse-spark-open-1026";

const PROMPT = [
  "Listen to this grocery list recording. Transcribe it, then return JSON only:",
  '{"transcript": string, "items": [{"name": string, "quantity": number|null, "unit": string|null}]}',
  "Keep product names generic (no brand invention). Convert spoken quantities",
  "(a dozen = 12). If a size is stated, put it in unit. No prose outside the JSON.",
].join(" ");

function extractJson(content) {
  const text = String(content ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function dictateList(audioBytes, { apiKey, mime = "audio/mp4", fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("BASETEN_API_KEY not configured");
  const base64 = Buffer.from(audioBytes).toString("base64");
  const res = await fetchImpl(BASETEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DICTATE_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "audio_url", audio_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Baseten ${res.status}`);
  const data = await res.json();
  const parsed = extractJson(data?.choices?.[0]?.message?.content ?? "");
  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      quantity: typeof i.quantity === "number" ? i.quantity : null,
      unit: typeof i.unit === "string" ? i.unit : null,
    }));
  return { transcript: typeof parsed.transcript === "string" ? parsed.transcript : "", items };
}
