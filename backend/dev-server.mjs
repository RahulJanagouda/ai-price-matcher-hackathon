// Local dev runner for the Worker-shaped handler. Usage: node backend/dev-server.mjs
import { createServer } from "node:http";
import worker from "./worker.mjs";

const port = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  const url = `http://localhost:${port}${req.url}`;
  const response = await worker.fetch(new Request(url), process.env);
  res.writeHead(response.status, { "content-type": response.headers.get("content-type") ?? "application/json" });
  res.end(await response.text());
}).listen(port, () => {
  console.log(`backend listening on http://localhost:${port} (DATA_MODE=${process.env.DATA_MODE ?? "snapshot"})`);
});
