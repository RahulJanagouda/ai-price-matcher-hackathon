import { test } from "node:test";
import assert from "node:assert/strict";
import { seeGroceries, SEE_MODEL } from "../src/see.mjs";

test("see sends a photo to the exact hackathon model and parses items", async () => {
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
                'I see milk and bread.\\n{"seen":"Milk and bread on the counter.","items":[{"name":"milk","quantity":1,"unit":"L"},{"name":"bread","quantity":null,"unit":null}]}',
            },
          },
        ],
      }),
    };
  };
  const out = await seeGroceries(new Uint8Array([1, 2]), { apiKey: "bt-key", fetchImpl: fakeFetch });
  assert.equal(seen.body.model, "meta-models/muse-spark-open-1026");
  assert.equal(seen.body.model, SEE_MODEL);
  assert.equal(seen.auth, "Bearer bt-key");
  assert.equal(seen.body.messages[0].content[1].type, "image_url");
  assert.ok(seen.body.messages[0].content[1].image_url.url.startsWith("data:image/jpeg;base64,"));
  assert.equal(out.seen, "Milk and bread on the counter.");
  assert.deepEqual(out.items, [
    { name: "milk", quantity: 1, unit: "L" },
    { name: "bread", quantity: null, unit: null },
  ]);
});

test("see without a key fails closed", async () => {
  await assert.rejects(() => seeGroceries(new Uint8Array([1]), { apiKey: "" }), /not configured/);
});
