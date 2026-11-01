# AGENTS.md — MooseCart

Guidance for any coding agent working in this repository. Read
`docs/PRD-SUMMARY.md` for locked product decisions and
`AI-Price-Matcher-Pro-PRD.md` for the full requirements. This file is
about how to work here without re-learning expensive lessons.

## Golden rules

- Prices, discounts, evidence links and eligibility come only from
  flyer data. Models (Muse Spark, Muse Voice Transcribe) parse,
  match, explain and transcribe — they never generate a price.
- A user request never triggers a paid Apify scrape. Scans and lists
  query stored offers (`data/snapshot/offers.json`).
- Secrets live in `.env.local` (git-ignored, verified with
  `git check-ignore`). Never commit keys, never put them in the
  mobile bundle, never print their values. Validate a key by calling
  its account/models endpoint and reporting only the HTTP status.
- Commit and push after every meaningful change, naming the files.
  Leave the user's unrelated files (`.DS_Store`) alone.
- Decisions are recorded in the PRD only after the user confirms
  them. Recommendations are not decisions.

## Layout

- `apps/mobile/` — Expo (React Native) app. Development build, not
  Expo Go, for the Android film device.
- `backend/worker.mjs` — Cloudflare Worker-shaped API (`/health`,
  `/search`, `/parse`, `/transcribe`). Bundles the snapshot JSON by
  import; do not use `node:fs` in the Worker path.
- `backend/dev-server.mjs` — Node runner for local dev. Loads
  `.env.local`, forwards method/headers/body (GET-only forwarding
  silently breaks POST endpoints), and adds dev-only
  `/transcribe-file` (ffmpeg m4a → WAV).
- `src/offers.mjs` — matching engine. `src/parse.mjs`,
  `src/transcribe.mjs` — Meta Model API clients (server-side only).
- `scripts/ingest.mjs` — Apify ingestion into the snapshot.
- `data/policy/freshco.json` — FreshCo price-match terms of record.
- `fixtures/apify/` — real Apify sample that validated the schema.

## Run and verify

```bash
npm test                                   # root matching/parse tests
cd apps/mobile && npx tsc --noEmit         # mobile typecheck
node backend/dev-server.mjs                # local backend :8787
node scripts/ingest.mjs                    # refresh snapshot (paid run)
cd backend && cf deploy --dry-run          # then cf deploy with
                                           # --secrets-file (META_API_KEY only,
                                           # file in /tmp, delete after)
```

Deployed API: https://ai-price-matcher-api.satya-3bf.workers.dev

Android (Pixel 9a, USB): `adb reverse tcp:8081 tcp:8081` and
`adb reverse tcp:8787 tcp:8787`, Metro started with
`EXPO_PUBLIC_API_URL=http://127.0.0.1:8787`. iPhone: Expo Go on the
same Wi-Fi at `exp://<mac-lan-ip>:8081`; CLI and Expo Go must be
signed into the same Expo account (`npx expo login`). iOS has no
USB forwarding.

## Lessons already paid for

- **Play Protect blocks adb installs.** `pm install` hangs with no
  error while a "Send app for a security check?" dialog waits on the
  phone. Screenshot first (`adb shell screencap`), tap **Don't send**
  (coordinates vary — read the image, do not guess blindly).
- **expo-audio**: declare `RECORD_AUDIO` in `app.json`
  (`android.permissions`) and re-run prebuild, or the permission is
  silently denied. Call `prepareToRecordAsync()` before `record()`,
  and read the file as `recorder.uri ?? recorder.getStatus().url`.
- **Uploads from React Native**: FormData file parts throw
  "Unsupported FormDataPart implementation". POST raw bytes instead
  (`new File(uri).bytes()` from `expo-file-system`).
- **Matching**: class equality is not relevance — "milk" matched
  oranges until a query-token relevance gate was added. Keep the
  regression test. Different product forms (juice vs fruit) and
  multi-product listings ("oranges or sweet potatoes") are
  review-only, never silent substitutions.
- **FreshCo eligibility is narrow** (Ontario): No Frills, Food
  Basics, Real Canadian Superstore, Wal-Mart only; identical
  brand/size; max 4 units; 1¢ beat. Everything else must be labelled
  not price-matchable at FreshCo, and baskets must not claim a
  FreshCo match when no eligible offer exists.
- **Voice path (current)**: the app posts its m4a recording to
  `POST /dictate`; Muse Spark Open on Baseten
  (`meta-models/muse-spark-open-1026` — use that exact hackathon
  ID) accepts M4A/AAC directly and returns transcript + items in
  one call. No conversion anywhere. `BASETEN_API_KEY` lives in
  `.env.local` and as a Worker secret. This also qualifies the
  project for the Best Build on Open Weight bonus. Verified on a real
  Pixel 9a mic Oct 30 (plain list, quantities, natural speech — all
  flawless), so the Nov 1 STT fallback decision is settled: keep Baseten. Meta's
  speech-to-text file API (below) remains the WAV alternative.
- **Typed-list parse** (`src/parse.mjs`, `POST /parse`) also runs on Muse
  Spark Open via Baseten — no app inference uses dev.meta.ai credits
  anymore. The Meta Model API key remains for dev testing and the
  `/transcribe` fallback.
- **Meta speech-to-text file API** needs WAV mono 16-bit PCM at
  16/24 kHz, multipart with a JSON `request` part
  (`mode: "DIARIZATION"`). Phone recordings are m4a; conversion is
  dev-backend-only today (ffmpeg). A synthesized test file
  (`say` + ffmpeg) proves the pipeline without a human voice.
- **Apify actor** (`gratifying_graph/canada-grocery-deals`): input is
  `{ postalCode, queries[], maxItemsPerQuery, onlyWithPrice }`,
  pay-per-event (~$2/1000 results). Output has no barcode and no
  flyer-page URL; `imageUrl` is a cropped flyer snippet and is the
  evidence. Category cannot be trusted (a guitar amp was "Food").
- **Cloudflare**: this project uses `cf` (v0.15+) with
  `backend/cloudflare.config.ts`; plain-text bindings are
  `bindings.text(...)` under `env`, not `vars`. `cf auth whoami`
  should show the user's account before deploying.
- **FreshCo's site returns 403** to automated fetches. Policy terms
  must come from the user (browser) or search-index snippets.
- **Environment**: the Mac disk runs at ~97% — the Android emulator
  froze under that pressure; prefer the physical Pixel. Dev servers
  started in an agent session die with the session; say so instead
  of claiming anything is permanently running.
- **Expo Go ≠ dev build.** Expo Go (iPhone quick-look) loads the JS
  bundle from Metro over LAN and needs a matching Expo login. A
  standalone install needs a release build or TestFlight/EAS with
  an Apple Developer account. Free personal-team signing expires
  in 7 days — do not start that clock early.
- **Android release build**: `cd apps/mobile/android &&
  EXPO_PUBLIC_API_URL=https://ai-price-matcher-api.satya-3bf.workers.dev
  ./gradlew assembleRelease` produces
  `app/build/outputs/apk/release/app-release.apk` (JS embedded, no
  Metro needed; backend defaults to the hosted Worker). It is
  signed with the template debug key — fine for sideloading and
  emulators, not for Play Store. First release build takes ~5 min.
  On emulator first launch, disable the stylus handwriting panel
  (`settings put secure stylus_handwriting_enabled 0`) before
  scripted typing.

## Hackathon constraints

- Indie Developer track, "Build for Your World". Submissions due
  Nov 4, 9:00 PM ET; 3-minute video; repo public; only work built
  during the event may be demoed.
- Build complete by Sat Oct 31; testing from Sun Nov 1 (voice
  fallback decision that day; real FreshCo test shop Nov 1–3).
- Cloudflare skills are installed locally in `.agents/skills`
  (`npx skills add https://github.com/cloudflare/skills`); they are
  tooling, not app code, and are intentionally not committed.

- **Web**: `apps/mobile` exports to Cloudflare Pages project
  `moosecart` (`https://moosecart.app`, zone active). Deploy: `npx expo
  export --platform web` in `apps/mobile`, then `wrangler pages deploy
  apps/mobile/dist --project-name moosecart`. Web hides the barcode
  scanner (native-only detection), stores the saved plan in
  `localStorage`, and needs Worker CORS (allowlist in
  `backend/worker.mjs`). Sandbox TLS cannot reach `*.pages.dev`, so
  verify new web deploys by opening the URL in a real browser.

- **App v2 (Nov 1)**: login screen (mock) -> Stores near you (`GET
  /stores`) -> main screen with persistent moose orb (idle / working /
  matching / success clips in `apps/mobile/assets/moose/` via `expo-video`),
  phase status stepper, bottom bar (big mic, barcode left, type dialog
  right), offer thumbnails + per-offer Save into dated sessions, cart icon
  with session list. Account/subscription stubs removed.

- **Repo hygiene (Nov 1)**: `git add -A` once swept in local tooling
  (`.agents/skills`, `.claude` symlinks, `.wrangler`, `.cloudflare`,
  `.DS_Store`, a nested `apps/mobile/apps/mobile` copy). Removed in
  `741a162` and gitignored. Always `git status` before committing and
  never commit skill installs or edge caches.
- **Icon QA**: inline-SVG icon paths can be rendered headless for visual
  check — dump paths to `/tmp/icons.html`, screenshot with
  `Google Chrome --headless --screenshot`, read the PNG. All app icons
  now use the Material Symbols outlined 960-grid style (camera was the
  odd one out on the 24-grid filled style).

- **Persistent orb (Nov 1)**: one `MooseOrb` mounted once at the root;
  screens swap the body beneath it. Size is an `Animated.Value`
  (280 login/working ↔ 112 headers, JS driver — width/height cannot
  use native). Plain View/Image/VideoView styles reject animated
  values, so the animated geometry lives on an outer `Animated.View`
  that clips a full-bleed inner view. Single mount also fixed the
  per-screen video-not-playing flakiness.

- **iOS cable build (Nov 1)**: Xcode 26 defaults pods to Swift 6, which
  breaks `expo-modules-jsi` (data-race error in `JavaScriptObject.swift`).
  Fixed with `SWIFT_VERSION = 5.0` for all pod targets in
  `apps/mobile/ios/Podfile` post_install (ios/ is gitignored, so this
  lives on disk only) plus a same-thread `@unchecked Sendable` wrapper
  patch in `node_modules/expo-modules-jsi/.../JavaScriptObject.swift`
  (also on disk only — reapply after any npm install). Build with
  `xcodebuild -workspace MooseCart.xcworkspace -scheme MooseCart
  -configuration Release -destination 'id=<iPhone UDID>'
  -allowProvisioningUpdates`, install with `xcrun devicectl device
  install`. Needs Apple ID in Xcode + Personal Team selected once in
  Signing & Capabilities; free account = 7-day install.

- **Worker secrets wipe (Nov 1)**: `cf deploy` WITHOUT `--secrets-file`
  silently clears `BASETEN_API_KEY`/`META_API_KEY` on the deployed Worker
  (all model endpoints 502/fallback). Always deploy backend with the
  secrets file built from `.env.local`, delete the temp file after, and
  curl `/parse` after every deploy. Symptom of wiped secrets: model
  endpoints return fallbacks/errors while `/health` stays fine.
- **Test secret redaction**: the runtime masks secret-shaped strings
  (e.g. `bt-key`) in tool output AND in-memory comparisons behave
  accordingly — assert auth headers with a regex (`/^Bearer \S+$/`),
  never a literal redacted value.
- **Podfile regen**: `expo run:ios`/prebuild regenerates `ios/Podfile`,
  dropping the Swift 5 pin. Re-apply before every iOS build (recipe
  above); the node_modules Swift patch survives until reinstall.
- **Baseten reasoning budget**: `max_tokens: 200` starves Muse Spark's
  reasoning and the call fails. No `max_tokens` cap + system prompt for
  ranking calls (`src/bestdeal.mjs` pattern).

- **Full flyer pages (blocked on data, Nov 1)**: Apify records carry only
  item cutouts (`imageUrl`, f.wishabi.net/page_items/…) plus a numeric
  `flyerId` — no page-level image exists anywhere in our data, and page
  URLs are not derivable from the flyerId. The evidence modal is styled
  flyer-card-like (merchant header, hero price) as the closest honest
  upgrade. To unblock true Flipp-style pages: extend the actor/query to
  return a page image URL per item (check the actor schema first), store
  it as `pageImageUrl` on snapshot records, plumb through
  `normalizeOffer` → `SearchResult` → `Offer` type → evidence modal.
- **Merchant logos (blocked on assets, Nov 1)**: no logo files exist in
  the repo or the moose asset folder, so offer rows use deterministic
  initial-avatar chips (`MerchantAvatar`, falls back gracefully). To use
  real marks: drop PNGs into `apps/mobile/assets/merchants/<slug>.png`
  (slugs: freshco, walmart, food-basics, giant-tiger, no-frills,
  superstore, loblaws, zehrs, metro, sobeys, longo, adonis, independent,
  fortinos, healthy-planet, shoppers, rexall), add a static
  `MERCHANT_LOGOS: Record<string, number>` map with one `require()` per
  slug (Metro forbids dynamic paths), and check the map first in
  `MerchantAvatar`. Do not hotlink remote logos (offline store use).
