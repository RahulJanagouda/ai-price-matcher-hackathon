# MooseCart

Web app: https://moosecart.app (Cloudflare Pages, same codebase as the native apps; barcode scanning is native-only).

Built from scratch during the Meta Global AI Developer Hackathon
(Oct 27 – Nov 4, 2026), Indie Developer track, problem statement
**Build for Your World**. Everything in this repository is new work
created during the event.

Dictate a grocery list at home, get the best current flyer price for
each item to price-match at your FreshCo in Milton, Ontario, see the
original flyer evidence, and pull the saved plan back up at the
cashier. Prices always come from flyer data — never from a model.

## What works

- **Voice list**: hold-to-talk mic records in the app → `POST
  /dictate` → Muse Spark Open (`meta-models/muse-spark-open-1026`
  on Baseten, audio sent directly, no conversion) returns transcript
  + items → stored flyer offers are matched per item, with a
  stepwise agent trace. Typed lists (`POST /parse`) and photo lists
  (`POST /see`, up to 10 photos) run on the same model.
- **Matching with honesty gates**: deduplication, freshness and
  merchant filtering, query-relevance check, different-form candidates
  (orange juice vs oranges) and multi-product listings are
  review-only until the user confirms. Unmatched items are never
  priced by guesswork.
- **Evidence**: tap any offer for the enlarged flyer snippet with
  merchant, price basis, validity and source.
- **Cashier view**: save the plan on-device and retrieve it at
  checkout, one tap per item back to its evidence.
- **Barcode scan**: EAN/UPC scan (up to 10, batch) → Open Food
  Facts identity → flyer matching (second demo beat).
- **Cart sessions**: per-offer Save drops picks into dated sessions;
  the cart sheet lists every session for retrieval at the cashier.
- **Moose orb shell**: one persistent orb (idle / working / matching
  / success clips at 0.8x) fills the screen on first landing and
  while working, then settles above the results; bottom bar with
  camera, QR, mic, keyboard and cart; task-true phase line below the
  orb narrates each step.

## Stack

- Mobile: Expo (React Native) dev build + release APK (Pixel 9a),
  cable-signed iPhone Release build, web export on Cloudflare Pages
- AI: Baseten-hosted Muse Spark Open
  (`meta-models/muse-spark-open-1026`) for list parse, voice
  dictate, photo understanding and best-deal ranking; Meta Model API
  kept for dev testing and the legacy `/transcribe` fallback
- Flyer data: Apify `gratifying_graph/canada-grocery-deals`,
  ingested into a stored snapshot; app requests never trigger a paid
  scrape. Demo defaults to the frozen snapshot with a `DATA_MODE`
  live switch.
- Backend: Cloudflare Worker (`/health /stores /search /parse
  /dictate /see /bestdeal`), live at
  `https://ai-price-matcher-api.satya-3bf.workers.dev`; Node
  dev-server for local work

## Run locally

```bash
# secrets (never committed): create .env.local with
#   META_API_KEY=...
#   APIFY_TOKEN=...

node scripts/ingest.mjs        # refresh the Milton flyer snapshot
node backend/dev-server.mjs    # backend on http://localhost:8787
npm test                       # matching/parse/transcribe tests

cd apps/mobile
npx expo start --dev-client    # then open the dev build on device
```

For a physical device over USB:
`adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8787 tcp:8787`
and start Metro with `EXPO_PUBLIC_API_URL=http://127.0.0.1:8787`.

## Docs

- `AI-Price-Matcher-Pro-PRD.md` — full product requirements
- `docs/PRD-SUMMARY.md` — every locked decision on one page
- `docs/HACKATHON.md` — event rules, judging, timeline
- `data/policy/freshco.json` — home-store price-match policy record
- `fixtures/apify/` — real Apify sample used to validate the schema

## Hard rules

- No model-invented prices, discounts, evidence links, or eligibility.
- API keys stay server-side / in `.env.local`; never in the app bundle.
- Ambiguous matches never count toward totals until confirmed.
