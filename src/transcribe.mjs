// Speech-to-text via Muse Voice Transcribe (Meta Model API), file endpoint.
// Accepts a WAV file (mono, 16-bit PCM, 16/24 kHz per Meta docs) and returns
// the transcript text. Server-side only; the key never reaches the mobile app.

const TRANSCRIBE_URL = "https://api.meta.ai/v1/asr/transcribe";
export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";

export async function transcribeWav(wavBytes, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("META_API_KEY not configured");
  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [JSON.stringify({ mode: "DIARIZATION", model: TRANSCRIBE_MODEL, audioEncoding: "WAV" })],
      { type: "application/json" },
    ),
  );
  form.append("audio", new Blob([wavBytes], { type: "audio/wav" }), "audio.wav");

  const res = await fetchImpl(`${TRANSCRIBE_URL}?sessionId=price-matcher`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Meta transcribe ${res.status}`);
  const data = await res.json().catch(() => null);
  // Tolerate the documented response shapes without inventing fields.
  const text =
    data?.text ??
    data?.transcript ??
    data?.result?.text ??
    (Array.isArray(data?.segments)
      ? data.segments.map((s) => s?.text ?? "").join(" ").trim()
      : null);
  if (typeof text !== "string") throw new Error("transcribe response had no text");
  return text;
}
