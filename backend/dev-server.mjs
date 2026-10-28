// Local dev runner for the Worker-shaped handler. Usage: node backend/dev-server.mjs
// Loads ../../.env.local (repo root) for local secrets; never commit that file.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import worker from "./worker.mjs";
import { transcribeWav } from "../src/transcribe.mjs";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Dev-only: convert an uploaded recording (m4a/aac from the phone) to the
// WAV shape Muse Voice Transcribe requires, using local ffmpeg. Production
// conversion/streaming is a Cloudflare-side decision still to be made.
async function handleTranscribeFile(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const input = Buffer.concat(chunks);
  const stamp = `${Date.now()}`;
  const inPath = join(tmpdir(), `list-${stamp}.m4a`);
  const outPath = join(tmpdir(), `list-${stamp}.wav`);
  try {
    writeFileSync(inPath, input);
    const conv = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", inPath, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", "-map_metadata", "-1", outPath]);
    if (conv.status !== 0) throw new Error("ffmpeg conversion failed");
    const text = await transcribeWav(new Uint8Array(readFileSync(outPath)), { apiKey: process.env.META_API_KEY });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ text }));
  } catch (e) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "transcribe failed" }));
  } finally {
    try { unlinkSync(inPath); } catch {}
    try { unlinkSync(outPath); } catch {}
  }
}

const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...rest] = t.split("=");
    if (!process.env[k.trim()]) process.env[k.trim()] = rest.join("=").trim();
  }
}

const port = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  if (req.url?.startsWith("/transcribe-file") && req.method === "POST") {
    await handleTranscribeFile(req, res);
    return;
  }
  const url = `http://localhost:${port}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const response = await worker.fetch(
    new Request(url, { method: req.method, headers: req.headers, body }),
    process.env,
  );
  res.writeHead(response.status, { "content-type": response.headers.get("content-type") ?? "application/json" });
  res.end(await response.text());
}).listen(port, () => {
  console.log(`backend listening on http://localhost:${port} (DATA_MODE=${process.env.DATA_MODE ?? "snapshot"})`);
});
