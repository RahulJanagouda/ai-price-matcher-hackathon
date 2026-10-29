import { test } from "node:test";
import assert from "node:assert/strict";
import { dictateList, DICTATE_MODEL } from "../src/dictate.mjs";

test("dictate sends m4a to the exact hackathon model and parses items", async () => {
  let seen = null;
  const fakeFetch = async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                'Here is the result:\n{"transcript":"milk and eggs","items":[{"name":"milk","quantity":null},{"name":"eggs","quantity":12}]}',
            },
          },
        ],
      }),
    };
  };
  const out = await dictateList(new Uint8Array([1, 2]), { apiKey: "bt-key", fetchImpl: fakeFetch });
  assert.equal(seen.body.model, "meta-models/muse-spark-open-1026");
  assert.equal(seen.body.model, DICTATE_MODEL);
  assert.equal(seen.auth, "Bearer bt-key");
  assert.equal(seen.body.messages[0].content[1].type, "audio_url");
  assert.ok(seen.body.messages[0].content[1].audio_url.url.startsWith("data:audio/mp4;base64,"));
  assert.equal(out.transcript, "milk and eggs");
  assert.deepEqual(out.items, [
    { name: "milk", quantity: null, unit: null },
    { name: "eggs", quantity: 12, unit: null },
  ]);
});

test("dictate without a key fails closed", async () => {
  await assert.rejects(() => dictateList(new Uint8Array([1]), { apiKey: "" }), /not configured/);
});
