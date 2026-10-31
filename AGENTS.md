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
