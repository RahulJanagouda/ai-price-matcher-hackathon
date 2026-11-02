# MooseCart

<p align="center">
  <a href="https://moosecart.app/assets/assets/moose/idle.923b89337d5f301898dfa977ce1a3bbb.mp4">
    <img src="docs/moose-idle.gif" alt="The MooseCart moose at idle — click to play the full clip" width="320" />
  </a>
</p>

Stop overpaying for groceries. Tell MooseCart your list — speak it, type it,
snap your fridge, or scan the shelf — and it hunts every current flyer, finds
exactly what your store will price-match, and hands you the flyer proof to
show at the till. Prices always come from flyer data; models never invent one.

No accounts, no GPS, no setup: for the hackathon the demo base is fixed to
Milton, Ontario — FreshCo, No Frills and Real Canadian Superstore, all
national chains — so the whole flow runs the moment you open the app. The
engine itself is store-driven: capture any store's policy and it works the
same way, anywhere in Canada. FreshCo's captured terms already span Ontario
and Western Canada (Save-On-Foods replaces Food Basics out west).
Expanding to the US is the same shape — Flipp works there too, so it is a
new store policy plus the US actor, not a new app.

Built from scratch during the Meta Global AI Developer Hackathon
(Oct 27 – Nov 4, 2026), **Indie Developer** track, problem statement
**Build for Your World**. Everything in this repository is new work created
during the event.

## Try it

- **Web app (fastest): https://moosecart.app** — same codebase as the native
  apps, deployed on Cloudflare Pages against the live hosted backend: open
  the link and price a list with zero setup. Barcode scanning is native-only.
- **iPhone** — native Release build (`com.moosecart.app`), cable-installed on
  the demo iPhone 15 Pro Max. See it in the demo video; build it yourself
  with Xcode (`apps/mobile/ios/MooseCart.xcworkspace`, Release scheme,
  free personal-team signing).
- **Android** — native release APK, demoed on a Pixel 9a. Build it with
  `cd apps/mobile/android && ./gradlew assembleRelease` (JS is embedded; the
  app talks to the hosted backend, no Metro needed).

Demo video (3 min, required viewing): link added here at submission.

## Why this wins on the rubric

- **Impact (30%)** — grocery shopping happens every single week, and so does
  overpaying. Canada's national discount chains guarantee price matching, yet
  almost nobody claims it at the till because nobody carries every flyer in
  their head. MooseCart does: home-list planning, cashier-ready proof,
  in-aisle barcode checks, saved sessions, and recent searches that re-run
  in one tap.
- **Use of Meta AI tooling (25%)** — not breadth for its own sake. The demonstrated capability is a messy spoken list becoming a checked, evidence-backed plan with uncertainty handled visibly — and every model call on that path is Meta's:

| What the app does | Where | Which Meta model |
| --- | --- | --- |
| Dictate a grocery list by voice | `POST /dictate` | Muse Spark Open `meta-models/muse-spark-open-1026` (Baseten) — transcribes the phone's m4a and parses items in one call, no conversion |
| Parse a typed list | `POST /parse` | Muse Spark Open (Baseten) — turns "grab a dozen eggs, two litres of milk and a bunch of bananas" into items with quantities (quantities + natural speech verified on-device Oct 30) |
| Understand grocery photos | `POST /see` | Muse Spark Open (Baseten) — show-then-price across up to 10 photos: lists what the moose sees first, prices only what you confirm |
| Rank the shortlist, crown the pick | `POST /bestdeal` | Muse Spark Open (Baseten) — picks one best deal per item from flyer-grounded candidates, with a reason |
| Speech-to-text fallback path | legacy `POST /transcribe` (shipped but idle) | Muse Spark (Meta Model API) — WAV path, built and still present, but unused by default to save token budgets: Muse Spark Open on Baseten does the job, and the budget lives there |
| Build this entire repo | dev-time, via Muse Code | Muse Spark + Muse Wonder — every feature, fix, test, and commit |
| Create the moose mascot | app art | Muse Image (via Muse, which uses this model) — launcher icon, header art |
| Animate the moose agent | orb video clips | Muse Video (via Muse, which uses this model) — idle, working, matching, and success clips |

  This also puts the **Best Build on Open Weight Models** bonus in scope
  (Muse Spark Open, partner-hosted on Baseten). The table's last three
  rows put the **Best Creative Build** bonus in scope too.
- **Technical depth (20%)** — talk like a person and the app keeps up:
  "grab a dozen eggs, two litres of milk and a bunch of bananas" becomes
  a structured list, and a messy fridge photo becomes items to price —
  both through Muse's understanding, with you confirming what it saw.
  Then the hunting happens for you: each home store carries its real
  price-match terms (`data/policy/*.json`), and the matcher labels every
  offer per store — FreshCo beats by 1¢, No Frills and RCSS match —
  holding anything uncertain for your call and never guessing. Proof you
  can show: the item snippet plus the item page and full flyer links,
  saved on every record. Live-first data, snapshot one flag away, mode
  always disclosed.
- **Demo (25%)** — watch the agent think: a stepwise trace from heard to
  parsed to matched, one tap to settle the ambiguous ones, best offers
  saved for the cashier — then the barcode beat over the live camera.

## How it works

1. Select the store — pick a nearby store that price-matches. For the
   hackathon we skip location and use Milton as the base: FreshCo,
   No Frills, and Real Canadian Superstore, each with its real captured
   policy.
2. Share your shopping list — say *"grab a dozen eggs, two litres of milk
   and a bunch of bananas"*, type it, photograph the fridge, or scan the
   shelf barcode.
3. The magic: the moose gets the offers — save them for the cashier,
   each with its flyer proof.

## Stack

- Mobile: Expo (React Native) — Pixel 9a release APK, cable-signed iPhone
  Release build, web export on Cloudflare Pages
- AI: Baseten-hosted Muse Spark Open for parse/dictate/see/bestdeal; Meta
  Model API for dev + legacy transcribe fallback
- Flyer data: Apify `gratifying_graph/canada-grocery-deals`. Live by
  default (one actor run per query, mode disclosed via `dataMode`);
  `DATA_MODE=snapshot` serves the checked-in `data/snapshot/offers.json`
  instead. Every record carries its market-pinned full-flyer link, saved
  at ingest — opening flyer proof costs nothing, only `/search` does.
  A fully Flipp-independent backend (self-hosted images, whole-flyer
  ingestion) is entirely feasible — deliberately out of scope for a 10-day
  hackathon on free budgets.
- Backend: Cloudflare Worker (`/health /stores /search /parse /dictate
  /see /bestdeal`), live at
  `https://ai-price-matcher-api.satya-3bf.workers.dev`; Node dev-server
  for local work
- Built with: Muse Code — every feature, fix, test, and commit in this
  repo was written through the agent (Muse Spark + Muse Wonder behind it)

## Run locally

```bash
# secrets (never committed): create .env.local with
#   META_API_KEY=...
#   BASETEN_API_KEY=...
#   APIFY_TOKEN=

node scripts/ingest.mjs        # refresh the flyer snapshot (paid Apify run)
node backend/dev-server.mjs    # backend on http://localhost:8787
npm test                       # matching/parse/dictate/see/bestdeal tests (29 pass)

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
- Anything uncertain waits for your call before it confirms.
