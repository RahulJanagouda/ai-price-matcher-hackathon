// Local dev runner for the Worker-shaped handler. Usage: node backend/dev-server.mjs
// Loads ../../.env.local (repo root) for local secrets; never commit that file.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import worker from "./worker.mjs";

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
