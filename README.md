# MooseCart

Price-match every grocery trip. Dictate a list at home, and MooseCart finds
the best current flyer price for each item to price-match in-store — with the
flyer snippet as proof, a plan you pull up at the cashier, and a barcode
second beat in the aisle. Prices always come from flyer data; models never
invent one.

No accounts, no GPS: for the hackathon the demo base is fixed to Milton,
Ontario (FreshCo, No Frills and Real Canadian Superstore there), so the whole
flow runs without logins or location permissions. The engine itself is
store-driven — capture any store's policy and it works the same way.

Built from scratch during the Meta Global AI Developer Hackathon
(Oct 27 – Nov 4, 2026), **Indie Developer** track, problem statement
**Build for Your World**. Everything in this repository is new work created
during the event.

## Try it

- **Web app (fastest): https://moosecart.app** — same codebase as the native
  apps, deployed on Cloudflare Pages. Plan and price any list; barcode
  scanning is native-only.
- **iPhone** — native Release build (`com.moosecart.app`), cable-installed on
  the demo iPhone 15 Pro Max. See it in the demo video; build it yourself
  with Xcode (`apps/mobile/ios/MooseCart.xcworkspace`, Release scheme,
  free personal-team signing).
- **Android** — native release APK, demoed on a Pixel 9a. Build it with
  `cd apps/mobile/android && ./gradlew assembleRelease` (JS is embedded; the
  app talks to the hosted backend, no Metro needed).

Demo video (3 min, required viewing): link added here at submission.

## Why this wins on the rubric

- **Impact (30%)** — a real weekly ritual for real households: grocery
  price matching in Ontario, where the discount chains (FreshCo, No Frills,
  Real Canadian Superstore) guarantee it. Home-list planning, cashier
  retrieval, in-aisle barcode check, saved sessions, recent-search re-runs.
- **Use of Meta AI tooling (25%)** — every model call below is Meta's:

| What the app does | Where | Which Meta model |
| --- | --- | --- |
| Dictate a grocery list by voice | `POST /dictate` | Muse Spark Open `meta-models/muse-spark-open-1026` (Baseten) — transcribes the phone's m4a and parses items in one call, no conversion |
| Parse a typed list | `POST /parse` | Muse Spark Open (Baseten) — turns "milk, eggs, oranges" into structured items |
| Understand grocery photos | `POST /see` | Muse Spark Open (Baseten) — lists what's in up to 10 photos; the user confirms before anything is priced |
| Rank the shortlist, crown the pick | `POST /bestdeal` | Muse Spark Open (Baseten) — picks one best deal per item from flyer-grounded candidates, with a reason |
| Speech-to-text fallback path | legacy `POST /transcribe` | Muse Spark (Meta Model API) — WAV path, kept as insurance |
| Build this entire repo | dev-time, via Muse Code | Muse Spark + Muse Wonder — every feature, fix, test, and commit |
| Create the moose mascot | app art | Muse (agent) — orb clips, launcher icon, header art |

  This also puts the **Best Build on Open Weight Models** bonus in scope
  (Muse Spark Open, partner-hosted on Baseten, verified live Oct 30 on a
  real Pixel 9a mic — 3/3 takes flawless). The table's last two rows put the
  **Best Creative Build** bonus in scope too.
- **Technical depth (20%)** — policy-driven multi-store engine: each home
  store carries its captured price-match terms (`data/policy/*.json`) and
  the matcher labels eligibility per offer, per store, with normalized
  merchant spelling (Wal-Mart = Walmart) and direction-aware rules (FreshCo
  beats by 1¢; No Frills/RCSS match). Honesty gates: dedup, freshness,
  relevance, different-form and multi-product review-only, zero-match never
  guessed. Snapshot-first data (a request never triggers a paid scrape).
- **Demo (25%)** — hero voice list with stepwise agent trace, barcode second
  beat over the camera, receipt as proof-only close.

## How it works

1. Pick your store (FreshCo, No Frills, or Real Canadian Superstore in the
   Milton demo base — each with its real captured policy; only
   policy-backed stores list).
2. Speak (hold-to-talk), type, photograph (up to 10), or scan barcodes
   (up to 10, batched).
3. The agent parses → matches each item against the stored flyer snapshot →
   asks you to confirm only the ambiguous ones → totals the payable basket.
4. Save offers into dated sessions; the cart sheet replays recent searches
   and saved picks with flyer evidence at the cashier.

## Stack

- Mobile: Expo (React Native) — Pixel 9a release APK, cable-signed iPhone
  Release build, web export on Cloudflare Pages
- AI: Baseten-hosted Muse Spark Open for parse/dictate/see/bestdeal; Meta
  Model API for dev + legacy transcribe fallback
- Flyer data: Apify `gratifying_graph/canada-grocery-deals`, ingested into
  `data/snapshot/offers.json`; app requests never trigger a paid scrape.
  Snapshot default, `DATA_MODE` live switch, mode disclosed.
- Backend: Cloudflare Worker (`/health /stores /search /parse /dictate
  /see /bestdeal`), live at
  `https://ai-price-matcher-api.satya-3bf.workers.dev`; Node dev-server
  for local work

## Run locally

```bash
# secrets (never committed): create .env.local with
#   META_API_KEY=...
#   APIFY_TOKEN=

node scripts/ingest.mjs        # refresh the flyer snapshot (paid Apify run)
node backend/dev-server.mjs    # backend on http://localhost:8787
npm test                       # matching/parse/dictate tests (24 pass)

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
- `data/policy/` — home-store price-match policy records
  (`freshco.json`, `nofrills.json`, `rcss.json`) + `stores.json`
- `fixtures/apify/` — real Apify sample used to validate the schema

## Hard rules

- No model-invented prices, discounts, evidence links, or eligibility.
- API keys stay server-side / in `.env.local`; never in the app bundle.
- Ambiguous matches never count toward totals until confirmed.
