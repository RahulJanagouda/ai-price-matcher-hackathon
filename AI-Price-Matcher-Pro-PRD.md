# Product Requirements Document: AI Price Matcher Pro

**Version:** 1.2 — proposed commercial product specification  
**Updated:** October 27, 2026  
**Platforms:** iOS and Android  
**Repository:** https://github.com/RahulJanagouda/ai-price-matcher-hackathon  
**Status:** No MVP exists yet. This project is being built from scratch in this repository. This document defines intended behavior; it does not imply every requirement is implemented.

## 1. Executive summary

AI Price Matcher Pro helps shoppers find current local promotional prices for a product and present original flyer evidence when requesting a price match. A shopper scans a barcode or photographs a package, confirms the product, and sees relevant offers over the camera preview. Results explain product compatibility, promotional conditions, validity dates and, where supported, the selected store’s price-match policy.

It also supports planning before the trip. A shopper can type or dictate a grocery list, and the app finds the best current price for each item, recommends the best single store to shop at for price matching, and shows the total estimated savings for the list at that store.

The proposed subscription is CAD $9.99/month for a Canada-first launch. The commercial promise is to help shoppers save more than their subscription fee through verified price matches during a billing period, or request their subscription fee back. Currency, guarantee terms and supported retailer coverage require final approval before sales begin.

### Confirmed implementation direction

**First MVP: use [Apify Canada Grocery Deals](https://apify.com/gratifying_graph/canada-grocery-deals), actor `gratifying_graph/canada-grocery-deals`, as the flyer-data provider.** This replaces the previously evaluated `chimerical_quicklime/flipp-scraper` as the selected MVP provider. Build the application backend from scratch in this repository.

The new backend will invoke the selected actor through controlled ingestion, normalize and cache usable offers, and serve stable mobile-facing endpoints. Apify credentials remain server-side. A user scan should query stored offers rather than launch a paid scrape.

**Optional second step, if time permits: build our own flyer-data API and ingestion pipeline.** This is not required to launch the MVP and must not delay it. Keep the mobile-facing data contract independent of Apify so the provider can be replaced without rebuilding the apps. Owning an API does not remove the need for permitted upstream data sources or commercial display rights.

The selected actor’s exact output, input contract, coverage, pricing and evidence-link support must be validated during implementation. This PRD does not assume undocumented capabilities or represent a paid provider run as completed.

**Confirmed AI direction: Meta models are a core part of the product, not an optional extra.** Lightweight helpers run on the mobile device (barcode scanning, image capture, request preparation). Heavy inference runs in the cloud. Cloud inference uses Meta models accessed via https://dev.meta.ai/ and/or self-hosted open-weight models on Modal (https://modal.com/) or Baseten (https://baseten.co), where credits are available; the exact host per model is decided during implementation. Data storage and other supporting services use Cloudflare. Confirmed AI use cases: (1) vision identification of a product from packaging, (2) matching and normalization of flyer text against a scanned or listed product (brand, size, variant, conflict detection), and (3) extraction of promotional conditions from flyer text with a plain-language eligibility explanation. Prices and evidence links always come from flyer data, never from a model.

**Hackathon judging alignment:** the demo is judged on Impact (30%), Use of Meta AI Tooling (25%), Technical Depth & Execution (20%), and Demo (25%), after a pass/fail gate on theme fit and reasonable use of the Meta Model API and/or Meta open-weight models. The build must therefore make Meta-model use visible and load-bearing in the main flow, and the demo must hold up live.

## 2. Problem

At a store, shoppers must identify an exact product, search competitors’ flyers, verify package size and promotional conditions, check dates and regional applicability, understand store policies and produce evidence at checkout. This is cumbersome while shopping. Before the trip, the same work multiplies across a whole grocery list: comparing every item across every flyer to decide where to shop is impractical by hand.

The product should reduce this to a short scan-and-confirm interaction in store, and a short list-and-plan interaction before the trip. Its value is reliable product matching, useful policy guidance and accessible evidence. AI supports product identification, matching and condition explanation; it is not a price source.

## 3. Goals and non-goals

### Goals

1. Find credible current local offers quickly.
2. Plan a whole grocery list before the trip: best price per item and the best single store to shop at for price matching.
3. Prevent misleading comparisons between incompatible products or conditions.
4. Make original flyer evidence easy to present.
5. Track realized savings separately from potential savings.
6. Operate a clear, supportable savings guarantee.
7. Keep data, recognition, support and refund costs sustainable.
8. Deliver the MVP using the selected Apify actor before considering an owned flyer-data service.

### Non-goals for the initial commercial release

- Automatic negotiation or guaranteed retailer acceptance.
- Purchasing products or operating a grocery marketplace.
- Universal retailer, region or category coverage.
- Automatic loyalty-account or personalized-coupon application.
- Treating different package sizes as price-match eligible simply because unit prices compare.
- AI-generated prices or fabricated source evidence.
- Continuous shopping-cart recognition or spatial augmented reality.
- Building a replacement flyer-data API as an MVP prerequisite.
- Automatically refunding retail merchandise.

## 4. Customers and launch assumptions

| Persona | Need | Value |
| --- | --- | --- |
| Household budget shopper | Save without extensive planning | Fast local comparisons and visible savings |
| Existing price-match shopper | Reduce flyer searching and checkout friction | Exact details and original evidence |
| Occasional bargain shopper | Know whether an advertised price is usable | Clear conditions and policy guidance |

Primary launch persona: a regular shopper at a supported Canadian grocery retailer that accepts competitor price matches.

| Area | Working assumption |
| --- | --- |
| Geography | Selected Canadian regions with validated coverage |
| Currency | CAD; final pricing decision pending |
| Subscription | CAD $9.99/month, with tax treatment disclosed |
| Initial category | Identifiable packaged groceries |
| Identification | Barcode first; manual, photo and voice fallbacks |
| List input | Typed or dictated grocery list (pre-trip planning) |
| MVP flyer provider | Apify `gratifying_graph/canada-grocery-deals` |
| Application backend | Build from scratch in this repository |
| AI inference | Lightweight helpers on device; heavy Meta-model inference in the cloud (dev.meta.ai, Modal, Baseten) |
| Data and storage | Cloudflare |
| Guarantee evidence | Receipt-backed successful price matches |
| Owned flyer-data API | Optional later step if time permits |
| US launch | Future expansion; not part of the initial build |

Variable-weight goods, complex bundles and personalized promotions should initially be excluded from recommendations or explicitly marked for review.

## 5. Core journeys

### First comparison

1. User enters a postal code and selects the store where they are shopping.
2. App explains coverage and requests camera permission when scanning starts.
3. User scans a barcode.
4. App identifies the product and requests confirmation where needed.
5. User optionally enters the current shelf price.
6. Ranked offers appear over the camera preview.
7. User opens the original flyer and reviews conditions.
8. User requests a match at checkout.

Success: useful evidence is accessible without searching a separate flyer application.

### Unknown product

1. Lookup cannot identify the barcode.
2. User selects manual entry or explicitly requests photo identification.
3. User confirms name, brand, size and variant.
4. App searches stored offers; incomplete identity yields review-only candidates.

Success: a usable fallback without fabricated certainty.

### Pre-shop list planning

1. User creates a grocery list by typing items or dictating them by voice.
2. App transcribes speech to text, then parses the list into individual items with quantities where stated.
3. User reviews and corrects the parsed items.
4. App searches stored offers for each item and finds the best current price per item.
5. App recommends the best single store to shop at for price matching, based on the store’s price-match policy, item coverage and total estimated savings.
6. User opens any item to review its offer, conditions and original flyer evidence before the trip.

Note on speech: dictation uses Meta Muse Voice Transcribe (speech-to-text) as the primary path, with on-device speech recognition as the fallback if it is not viable; the fallback decision is made by November 4. Muse Voice Transcribe does not synthesize speech, so there is no text-to-speech read-back.

Success: the shopper knows where to shop and what each item should cost before leaving home, with evidence ready for checkout.

### Record savings

1. User records a successful purchase.
2. User supplies purchased store, product, quantity, shelf price and price paid.
3. User submits receipt evidence when requesting verified credit.
4. Entry is labelled self-reported, pending, verified, rejected or reversed.
5. Verified savings contribute to the relevant subscription billing period.

### Guarantee claim

1. User opens a completed billing period.
2. App displays verified savings and eligibility rules.
3. User submits a claim and any missing evidence.
4. Support reviews and explains its decision.
5. App shows the refund outcome and separate cancellation guidance.

## 6. Functional requirements

P0 means required for commercial launch; P1 means a follow-up release; P2 means future expansion. A free development demo may precede completion of commercial P0 requirements.

### Location and retailer context

- **LOC-01, P0:** Validate Canadian postal codes without requiring GPS.
- **LOC-02, P0:** Select the current retailer and applicable store region.
- **LOC-03, P0:** Disclose supported coverage before implying availability.
- **LOC-04, P0:** Filter by market, currency and applicable location.
- **LOC-05, P0:** Revalidate or clear results when location/current store changes.
- **LOC-06, P1:** Optional approximate location with explicit permission.

Acceptance: an offer from an unsupported region cannot appear as a recommended local match.

### Camera and product identification

- **SCAN-01, P0:** Support EAN-13, EAN-8, UPC-A and UPC-E with appropriate canonicalization and check-digit handling. UPC-E needs expansion where applicable; padding alone is insufficient.
- **SCAN-02, P0:** Suppress duplicate submissions from repeated callbacks.
- **SCAN-03, P0:** Provide permission-denied and camera-unavailable manual fallbacks.
- **SCAN-04, P0:** Confirm relevant fields when identity is uncertain.
- **SCAN-05, P0:** Require an explicit photo action and processing disclosure before upload.
- **SCAN-06, P0:** Pause the camera when closed or backgrounded.
- **SCAN-07, P1:** Repeat-product lookup and scan history.

AI may extract identity only. It must not invent prices, discounts, evidence links or eligibility.

### Meta AI capabilities

- **AI-01, P0:** Vision identification: identify a product from a packaging photo when barcode lookup fails or is unavailable. The user confirms the result before it is used.
- **AI-02, P0:** Matching and normalization: normalize flyer text and listed/scanned product descriptions (brand, size, variant) and flag conflicts. A model suggestion cannot override contradictory barcode or size metadata. Confirmed pipeline for list items: (1) parse the list into structured items, (2) retrieve and rank candidate offers from stored data, (3) the user confirms ambiguous items before they count toward totals or the store recommendation. Uncertain items stay review-only.
- **AI-03, P0:** Condition extraction: extract promotional conditions (member-only, multi-buy, coupon, limits, per-weight) from flyer text and explain eligibility in plain language.
- **AI-04, P0:** List parsing: parse a typed or dictated grocery list into items with quantities where stated. The user reviews and corrects the parse before search.
- **AI-05, P0:** Speech input: transcribe dictated lists with Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`, Meta Model API — realtime WebSocket `wss://api.meta.ai/v1/asr/realtime` or file endpoint `POST /v1/asr/transcribe`; see https://dev.meta.ai/docs/models#muse-voice-transcribe) as the primary path. If it is not viable in testing — including country availability, latency or reliability — fall back to on-device speech recognition. Fallback decision deadline: November 4. Muse Voice Transcribe returns transcript text only; it does not synthesize speech, so there is no text-to-speech read-back.
- **AI-06, P0:** Placement: lightweight helpers run on device; heavy inference runs in the cloud on Meta models via dev.meta.ai, Modal or Baseten. Model, host and availability are validated during implementation.
- **AI-07, P0:** Models must not invent prices, discounts, evidence links or eligibility. Prices and evidence come only from ingested flyer data.

### Shopping list and store recommendation

- **LIST-01, P0:** Create a grocery list by typing or dictating items.
- **LIST-02, P0:** For each list item, find the best current local price from stored offers, with conditions and evidence.
- **LIST-03, P0:** Recommend the best single store to shop at for price matching. Confirmed rule: first hard-filter to stores with a curated price-match policy that accepts competitor flyers (stores that do not price-match cannot be recommended, however cheap); then rank survivors by confirmed list items covered, then total cost of the confirmed basket, then total estimated savings. Show the reasoning (for example coverage count and estimated savings). Candidate stores for the demo region — for example FreshCo, No Frills, Real Canadian Superstore and Giant Tiger — must be verified against current policy before use; some major chains have ended ad matching.
- **LIST-04, P0:** Show per-item best prices and the list total at the recommended store. Items with no matching offer are shown as unmatched, never priced by a model.
- **LIST-05, P1:** Re-run a saved list against fresh offers.

### Flyer ingestion and provenance

- **DATA-01, P0:** Integrate the selected Apify Canada Grocery Deals actor through the new backend built in this repository.
- **DATA-02, P0:** Validate its actual inputs, output fields, regional coverage, conditions and evidence URLs using permitted samples.
- **DATA-03, P0:** Ingest independently of scans; cache normalized records for reuse.
- **DATA-04, P0:** Retain source/offer IDs, merchant, identity, currency, price, price basis, conditions, applicable location, validity, fetch timestamp and original evidence URL.
- **DATA-05, P0:** Reject ambiguous price text and unusable records. Missing provider fields remain unknown; they must not be invented.
- **DATA-06, P0:** Exclude expired, future or stale offers from recommendations. Proposed maximum data age: 24 hours.
- **DATA-07, P0:** Interpret dates in the applicable retailer time zone.
- **DATA-08, P0:** Monitor refresh failures, rejected records, coverage and provider spending.
- **DATA-09, P0:** Preserve last usable data on failed imports, subject to freshness rules; never fall back silently to demo data.
- **DATA-10, P1:** Reconcile multiple provider records when needed.
- **DATA-11, P0:** Deduplicate records: the same offer can appear multiple times with different image URLs.
- **DATA-12, P0:** Filter non-grocery merchants and apply a semantic relevance check per query. The provider category field cannot be trusted alone.
- **DATA-13, P0:** Parse `priceText` for the price basis (for example `/lb`, `each`, `2 for`). `currentPrice` is not comparable across different bases. Reject or mark review-only any listing whose name combines multiple alternative products at one price.

A fresh offer does not establish inventory availability. Apify credentials must never enter the mobile bundle.

**Validated Apify sample (October 27, 2026; query “Orange”, postal code L9E2H4; see `fixtures/apify/orange-L9E2H4.sample.json`):** fields returned are `dealId`, `query`, `postalCode`, `name`, `merchant`, `merchantId`, `currentPrice`, `originalPrice`, `currency`, `priceText`, `saleStory`, `category`, `brandIds`, `flyerId`, `flyerName`, `validFrom`, `validTo`, `imageUrl`, `itemType`, `source` and `fetchedAt`. Findings: no barcode, no structured brand/size fields (both are embedded in `name`), no promotional-condition fields beyond `priceText`/`saleStory`, and no flyer-page evidence URL — `imageUrl` is the only evidence asset, so what counts as presentable evidence must be decided explicitly. The response mixes fruit, juice, peppers, guitar amplifiers (brand “Orange”) and furniture (colour match), includes exact duplicates, and includes multi-product listings at a single price. This confirms DATA-11 to DATA-13 and the parse → rank → confirm pipeline in AI-02.

### Product matching and ranking

Expose distinct dimensions:

| Dimension | States |
| --- | --- |
| Product identity | Confirmed / uncertain / incompatible |
| Promotion applicability | Unconditional / conditions met / conditions unknown |
| Store policy | Appears supported / unknown / excluded |
| Evidence freshness | Current / stale / expired |
| Availability | Confirmed where supported / unknown |

P0 rules:

- Conflicting barcodes, sizes or variants require exclusion or explicit review.
- A barcode match cannot automatically override contradictory metadata.
- Loyalty, multi-buy, coupon and per-weight conditions require explicit interpretation.
- Equivalent unit prices do not imply retailer eligibility.
- Recommended candidates rank by lowest applicable purchase price after identity, conditions and policy checks.
- Uncertain candidates appear separately as review-only.
- Estimated savings require a compatible, known shelf price.
- Monetary arithmetic uses integer minor units and cannot produce negative savings.

Acceptance: a $2.49 member-only promotion cannot outrank an unconditional $2.99 offer as the user’s recommended price when membership applicability is unknown.

### Retailer policy guidance

P0: maintain a curated policy record for each supported retailer with official source, review date, eligible competitors, geography, exclusions and evidence requirements. Support known store exceptions. Explain recommendation reasoning and final retailer discretion. Outdated or uncertain policies cannot support confident eligibility labels.

Acceptance: exact product identity alone cannot yield a “recommended for price matching” designation.

### Camera overlay and evidence

P0: show product, retailer, price, conditions and status in a readable camera panel. Original flyer evidence must be reachable within two taps. Allow evidence enlargement and preserve qualifications when sharing. Distinguish saved evidence from revalidated evidence. Demo offers cannot be presented or shared as live proof.

Confirmed evidence definition: the provider’s `imageUrl` is a cropped flyer snippet containing the price graphic and offer terms (verified visually on the “Orange” sample), and is good enough as primary evidence. The evidence view shows the enlarged snippet together with merchant, price and price basis, validity dates and source. Optionally, a “view on Flipp” action may open a webview using the pattern `https://flipp.com/item/{id}?postal_code={postalCode}`; this is an enhancement only — the ID field it uses and its rendering in a real device webview must be validated first (a plain fetch returns Flipp’s generic error page, likely JavaScript/bot protection), and evidence must never depend on it. Never fabricate a flyer URL the provider did not supply data for.

A bottom-panel overlay satisfies MVP camera-window requirements. Spatial labels anchored to packaging are P2.

### Saved offers, cashier retrieval and offline behavior

P0: save identity, offer details, conditions, evidence reference and timestamps. Mark expired/stale entries, provide deletion controls and isolate accounts. Offline evidence is allowed only where provider rights permit. Explain connectivity requirements; offline records cannot appear freshly verified.

**Cashier retrieval (in scope for the hackathon build):** a saved shopping plan — the list or scanned items, their confirmed offers, the recommended store and the evidence for each item — must be retrievable in one place at the cashier, so the shopper can present each offer without re-searching. Local on-device persistence is sufficient for the hackathon build; no account is required. This is distinct from the savings journal below: cashier retrieval is about presenting offers at checkout, not accounting for purchases afterwards.

### Savings journal and receipt verification (commercial scope; not the hackathon build)

This is post-purchase accounting: recording what was actually bought and verifying it against receipts. It is distinct from cashier retrieval above and is deferred until after the hackathon.

P0 (commercial): distinguish potential savings from completed purchases. Record product, store, quantity, purchase date, shelf price, paid price and receipt. Maintain verification states, prevent duplicate receipt/line-item credit, handle returns and corrections, and group totals by subscription billing period and currency. Explain accepted/rejected entries.

`Verified savings = max(0, eligible shelf price − eligible price paid) × eligible quantity`

Treatment of tax, fees, cashback, loyalty rewards and unrelated coupons must be explicit in the guarantee terms.

### Accounts and subscriptions

P0: support creation, confirmation, sign-in, recovery, sign-out and deletion. Use native store billing and actual localized prices. Disclose renewal, restore purchases and offer subscription management. Enforce entitlements server-side. Handle expiration, renewal, refund, grace periods and account changes. Refund requests and cancellations are separate actions.

Proposed acquisition: allow a limited sample comparison before purchase. Free allowance and any trial remain decisions to validate; no trial is assumed in the financial model.

## 7. Savings guarantee proposal

The following operational terms are proposals, not finalized commercial commitments:

| Item | Proposed rule |
| --- | --- |
| Measurement period | One completed subscription billing period |
| Savings threshold | Verified savings must exceed the subscription fee actually paid |
| Eligible savings | Successful receipt-backed price matches attributable to app-discovered offers |
| Refund | Fee for the qualifying period; tax treatment subject to applicable store/payment rules |
| Claim window | Within 14 days after period end |
| Review target | Five business days after complete evidence |
| Repeated claims | Permitted subject to published eligibility and abuse controls |
| Cancellation | Separate from refund submission |
| Exclusions | Duplicates, returned purchases, fabricated evidence, unsupported markets and other prominent published exclusions |

Any minimum usage requirement must be prominent before purchase. Do not advertise an unconditional guarantee when meaningful conditions apply. Do not promise refund routes or processing times unsupported by actual payment/store operations.

## 8. Provider and backend strategy

### Step 1 — MVP with Apify

Use https://apify.com/gratifying_graph/canada-grocery-deals as the selected flyer-data source. Build a new API in this repository for ingestion, normalization, caching, matching and source-evidence delivery. Do not build a replacement scraper/API first. Validate real field mappings and commercial collection, storage, display and redistribution permissions. Actor availability alone does not prove licensing rights.

Barcode product identification remains a separate capability, currently evaluating Open Food Facts. Meta-model AI provides vision identification, matching/normalization, condition explanation and list parsing (see §6, AI-01 to AI-07); it is not a price generator.

Previous candidates, including chimerical_quicklime/flipp-scraper and Kiizon/flippscrape, are historical research references rather than selected MVP providers.

### Confirmed cloud architecture

- Mobile: lightweight helpers only (barcode scanning, image capture, request preparation, cached display).
- Heavy inference: Meta models in the cloud via https://dev.meta.ai/ and/or open-weight models hosted on https://modal.com/ or https://baseten.co. Credits are available on all three; assign each model to a host during implementation based on availability, latency and cost.
- Data and supporting services: Cloudflare for storage and other backend needs. Specific products (for example Workers, D1, R2, KV) are selected during implementation.
- Apify credentials and all provider/model keys remain server-side.

### Demo data mode

- The real Apify ingestion pipeline is built and run for the demo region, and a snapshot of its real ingested offers is frozen as the demo dataset.
- The demo defaults to the frozen snapshot: same schema, same matching code and same evidence URLs as live data, so the demo cannot break on provider outages, slowness or thin same-day coverage.
- A server-side flag can switch the data source to live ingested offers without a code change, so the presenter can go live on demand. The flag changes only the data source, never the API shape.
- The active mode (snapshot or live) is disclosed in the demo. Hand-written or fabricated offers are never used as demo data.

### Step 2 — Optional owned flyer-data API

If time permits after delivering the MVP, build an internally managed flyer-data API and ingestion pipeline. Evaluate it against Apify on coverage, accuracy, freshness, permitted use, costs and maintenance effort. Define allowed upstream sources and operational ownership before implementation. Migrate only after comparable quality is demonstrated.

The application-facing API contract must remain stable so mobile applications do not depend on raw Apify output. An owned flyer-data service remains optional and is not a launch dependency.

## 9. Experience requirements

Users must understand results without knowing provider internals. Show uncertainty next to prices. Keep scanning, correction and evidence usable one-handed. Support dynamic text, screen readers and adequate touch targets; do not encode status with color alone. Distinguish product identification from offer-search loading. Empty states must differentiate unsupported coverage from no matching offer. Preserve entered details on network errors. Never imply no lower price exists anywhere simply because none was found.

## 10. Proposed nonfunctional targets

| Area | Launch target to validate in beta |
| --- | --- |
| Cached identity lookup | p95 under one second |
| Stored-offer comparison | p95 under two seconds |
| Known-barcode scan to useful result | p95 under five seconds on typical mobile connectivity, excluding confirmation |
| Photo identification | p95 under 15 seconds, with timeout and fallback |
| API availability | 99.5% monthly during initial commercial operation |
| Crash-free sessions | At least 99.5% |
| Recommended freshness | Every recommendation within configured freshness threshold |
| Accessibility | Core flows usable with VoiceOver and TalkBack |
| Recovery | Tested database backup and restore process |

Measure network latency, provider time and application processing separately.

## 11. Security and privacy

P0: keep secrets server-side; treat Expo public variables as public. Verify identity, authorization and ownership for private data. Encrypt transport and sensitive evidence at rest. Use restricted, expiring receipt access. Minimize collection; define retention for receipts, photos, accounts and claims. Provide deletion controls with disclosed retention exceptions. Obtain photo-processing consent. Redact credentials, photos, receipts and personal data from logs. Enforce upload/request limits, provider timeouts and abuse controls. Document third-party processing. Analytics must not include raw photos or receipt contents.

## 12. Metrics and economics

North-star metric: subscribers completing at least one verified successful price match per billing period.

Track activation, identification coverage, useful offer coverage, audited recommendation precision, successful match rate, verified savings, subscription conversion, retention, guarantee claim rate and contribution margin.

Proposed quality gate: at least 98% correctness in a representative recommended-offer audit, with no known systematic incompatible-product failure. Establish conversion, retention and savings targets from beta evidence.

Suggested events: scan_started, product_confirmed, comparison_completed, evidence_opened, list_created, list_parsed, store_recommended, match_attempt_recorded, receipt_verified, subscription_started and guarantee_claim_submitted. Do not include sensitive evidence in event payloads.

`Monthly contribution = net subscription receipts − data − recognition − infrastructure − variable support − guarantee refunds`

Reuse regional imports and barcode caches, keep on-device work lightweight and cloud inference behind cached/stable contracts, measure costs by useful coverage and monitor claims/support costs. Validate economics in a pilot before broad guarantee promotion.

## 13. Build-from-scratch scope versus commercial requirements

This repository starts empty aside from this PRD. Everything below must be built from scratch.

| Area | Starting point | Required build |
| --- | --- | --- |
| Mobile | None | Expo app with scanning, manual entry, overlay and saved offers, plus native validation and polished failure states |
| Matching | None | Ranker and region filters with conflict handling, richer conditions and policy guidance |
| AI | None | Cloud Meta-model services for vision ID, matching/normalization, condition explanation, list parsing and speech (dev.meta.ai, Modal, Baseten); lightweight helpers on device |
| Shopping list | None | Typed/dictated list, per-item best price and best-store recommendation |
| Data | None | Ingestion for the selected Canada Grocery Deals provider; validate output, schedule refreshes and monitor coverage. Storage on Cloudflare |
| Accounts | None | Account system with recovery, deletion, confirmation/deep-link lifecycle (provider decided during implementation; storage on Cloudflare) |
| Billing | None | RevenueCat client/backend integration, actual store setup and sandbox validation |
| Savings | None | Savings journal with billing periods and receipt verification |
| Guarantee | None | Guarantee UI plus terms, claims, support and refund operations |
| Owned data service | Not required | Optional second-step API if time permits |

No statement here represents the new actor as already integrated or verified. Infrastructure choices (database, host) are to be decided during the build; requirements do not mandate SQLite or a specific host.

## 14. Delivery plan

### Hackathon build scope (deadline: November 4)

In scope, fully working:
- List planner: voice dictation (Muse Voice Transcribe primary, on-device fallback decided by November 4) → Meta LLM parse → retrieve and rank → user confirms ambiguous items → best-store recommendation with reasoning → per-item evidence.
- In-store scan as the second demo beat: barcode → ranked offers over the camera → evidence card.
- Cashier retrieval: the saved plan (items, confirmed offers, recommended store, evidence) retrievable in one place at checkout, persisted locally on device.
- Backend: Apify ingestion for the demo region, frozen real snapshot as the default demo dataset with a server-side live-switch flag, Cloudflare storage, cloud Meta inference.
- One curated price-match policy table for the demo region (postal code L9E2H4), verified before use.

Stubbed for completeness (visible screens, no real backend):
- Account screens (sign-in/sign-up UI only; no real auth, no login wall in front of the demo).
- Subscription screens (plans and paywall UI only; no real billing or entitlement enforcement). Stubs must be labelled or behave as previews, not presented as working commerce.

Out of scope for the hackathon (commercial follow-up, stays in this PRD):
- Real accounts and authentication, RevenueCat billing, receipt verification, the post-purchase savings journal, the savings-guarantee flow, and multi-region coverage.

### First step: deliver the Apify-backed MVP

1. Validate selected actor fields, sample evidence, region coverage, rights and cost.
2. Build the ingestion layer from scratch and add sanitized contract fixtures.
3. Deliver scanning, product confirmation, ranked camera offers and original evidence on iOS/Android.
4. Add monitoring, controlled refreshes, authentication and subscription testing.
5. Run a closed beta, then a paid pilot only when commercial P0 requirements—including guarantee operations—are met.

Exits: representative accuracy meets the quality gate; native journeys and billing are validated; claims/support/privacy processes work; economics are reviewed. The initial demo/beta can precede paid release.

### Second step: optional owned flyer-data API

If time permits, implement and validate an owned ingestion/API service behind the same application contract. Compare quality, coverage and operating cost before migration. This work must not block the Apify-backed MVP.

Further expansion may add regions, retailers, US support, non-food catalogs, household sharing and spatial AR. Calendar estimates follow provider validation and team-capacity planning.

## 15. Commercial launch acceptance

- Selected Apify integration validated against actual permitted output.
- Commercial data rights and supported coverage documented.
- Recommended product/price/policy accuracy demonstrated.
- No expired or stale recommendation presented as current.
- Legible original evidence accessible.
- Physical iOS/Android scanning and lifecycle tests completed.
- Native purchase, restore, renewal, expiration and refund tests completed.
- Server-side authentication and entitlement enforcement verified.
- Receipt verification, guarantee claims and support ownership operational.
- Terms, privacy, guarantee, renewal and cancellation disclosures published.
- Account recovery/deletion supported.
- Refresh alerts, spending controls, backups and incident handling established.
- Demo content excluded from live claims and verified totals.
- Pilot economics reviewed.
- Owned flyer-data API explicitly not required for this launch.

## 16. Decisions remaining

1. Confirm Canada-only launch and CAD $9.99 pricing.
2. Select supported regions, retailers and categories from validated actor coverage.
3. Finalize guarantee eligibility and any prominently disclosed minimum usage.
4. Define evidence proving the original shelf price.
5. Decide treatment of coupons, rewards, tax and fees.
6. Set free comparison allowance or trial policy.
7. Assign receipt review, support and refund ownership.
8. Decide later whether an owned flyer-data API justifies its time and operating cost.

The MVP provider decision is settled: use Apify Canada Grocery Deals first. Remaining validation concerns implementation fit and permitted use, not a requirement to build our own API before delivering the apps.
