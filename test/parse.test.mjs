import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGroceryList } from "../src/parse.mjs";
import { transcribeWav } from "../src/transcribe.mjs";

test("parse returns structured items and sends the key server-side", async () => {
  let seenAuth = null;
  const fakeFetch = async (url, opts) => {
    seenAuth = opts.headers.Authorization;
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  { name: "milk", quantity: 2, unit: "L" },
                  { name: "eggs", quantity: 12 },
                ],
              }),
            },
          },
        ],
      }),
    };
  };
  const items = await parseGroceryList("milk and eggs", { apiKey: "test-key", fetchImpl: fakeFetch });
  assert.equal(seenAuth, "Bearer test-key");
  assert.deepEqual(items, [
    { name: "milk", quantity: 2, unit: "L" },
    { name: "eggs", quantity: 12, unit: null },
  ]);
});

test("parse without a key fails closed", async () => {
  await assert.rejects(() => parseGroceryList("milk", { apiKey: "" }), /not configured/);
});

test("transcribe extracts text from the response", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ text: "milk, eggs" }) });
  const text = await transcribeWav(new Uint8Array([1, 2, 3]), { apiKey: "k", fetchImpl: fakeFetch });
  assert.equal(text, "milk, eggs");
});
