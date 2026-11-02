import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./worker.mjs" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "ai-price-matcher-api",
    compatibilityDate: "2026-10-28",
    entrypoint,
    env: {
      DATA_MODE: bindings.text("live"),
    },
  },
});
