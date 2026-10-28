# AI Price Matcher Pro — Locked Decisions Summary

Plain-language summary of every decision locked during the PRD grill.
Source of truth remains `AI-Price-Matcher-Pro-PRD.md`; this file is the
quick reference. Last updated: October 28, 2026.

## The product

- Fresh build from scratch in this repo. No prior MVP exists or is reused.
- Hackathon: Meta Global AI Developer Hackathon, **Indie Developer** track,
  problem statement **Build for Your World**.
- Submissions due **November 4, 9:00 PM ET**. Repo is public; everything
  demoed is new work built during the event. 3-minute demo video required.
- Judging: pass/fail theme + Meta-model gate, then Impact 30%,
  Use of Meta AI Tooling 25%, Technical Depth 20%, Demo 25%.

## The demo (in priority order)

1. **Hero — voice grocery list at home.** Dictate a list, watch the agent
   trace work (heard → parsed → matched → needs your call → total), confirm
   the one ambiguous item, see the total payable at FreshCo.
2. **Second beat — in-store barcode scan** of a real packaged product,
   matched offer and flyer evidence over the camera.
3. **Optional close — receipt photo** from a real price-matched shop.
   Displayed as proof only; the app never calculates savings from it.

## Locked decisions

| Area | Decision |
| --- | --- |
| Home store | User's nearby FreshCo, 9060 Louis St Laurent Ave, Milton, ON L9E 1X7. Fixed destination; competitor flyers are match targets there. |
| Store policy | FreshCo "Lowest Price Guaranteed", full terms captured 2026-10-28 in `data/policy/freshco.json`. Ontario program: No Frills, Food Basics, Real Canadian Superstore, Wal-Mart only; identical brand/size; max 4 units; current-flyer evidence; FreshCo beats by 1¢. Matcher flags eligibility per offer and ranks eligible first; all other merchants are labelled not price-matchable at FreshCo. |
| Flyer data | Apify `gratifying_graph/canada-grocery-deals`. Scans/lists query stored offers; a request never launches a paid scrape. |
| Demo data | Frozen snapshot of real ingestion by default; server-side flag flips to live. Mode disclosed in the demo. No hand-written offers. |
| Demo list/scan item | Chosen backwards from snapshot coverage at recording time (promos change weekly); one deliberate ambiguity (e.g. "orange"); scan product bought exactly as pictured. |
| Matching | Parse → retrieve/rank → user confirms ambiguous items. Uncertain items stay review-only and never count in totals. |
| Evidence | Provider `imageUrl` flyer snippet, enlarged, with merchant, price basis, validity, source. Flipp webview link optional only after real-device validation. |
| Savings | Total payable always shown. Estimated savings only against a known FreshCo price. No invented shelf prices. |
| Speech | Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`) primary; on-device STT fallback decided **November 1**. |
| Other AI | Muse Spark: list parsing, matching/normalisation, condition explanation, packaging vision. AI never generates prices, discounts, evidence links, or eligibility. |
| Agent trace | Visible in UI at every step (targets the Best Agentic Use-Case bonus). |
| Mobile | Expo (React Native), lightweight on-device helpers. Demo device: **Pixel 9a, Android development build** (not Expo Go). Android emulator also available for installs during development. |
| Backend | Cloudflare (Workers + D1/R2). Meta Model API is the only AI provider; Modal/Baseten are unbuilt backup. |
| Accounts/billing | Stub screens only for the hackathon. No real auth, billing, verified savings journal, or guarantee flow until commercial phase. |
| Cashier retrieval | Saved plan (items, confirmed offers, evidence) on-device, no account needed. Distinct from the post-purchase savings journal (commercial). |

## Schedule

| When | What |
| --- | --- |
| By Sat Oct 31 | Whole hackathon build complete |
| Sun Nov 1 | Voice fallback decision; testing and improving begins |
| Nov 1–3 | Real price-matched test shop at FreshCo; keep the receipt |
| Wed Nov 4 | Demo video + submission only (due 9:00 PM ET) |

## Inputs confirmed from the user (Oct 28)

- `META_API_KEY` and `APIFY_TOKEN` provided in `.env.local` (never
  committed). Both validated live on Oct 28: Apify account endpoint and
  Meta models endpoint each returned HTTP 200.
- FreshCo store: 9060 Louis St Laurent Ave, Milton, ON L9E 1X7.
- Android emulator running for app installs; Pixel 9a is the film device.
- Cloudflare: official Cloudflare skills installed locally
  (`.agents/skills`, 19 skills incl. `wrangler`, `workers-best-practices`,
  `cloudflare`). Cloudflare account authentication is done by the user;
  deploys use the Cloudflare API MCP / Wrangler once authenticated.

## Hard rules (never break)

- Prices and evidence come only from flyer data — never from a model.
- A request never triggers a paid scrape.
- API keys stay server-side / in `.env.local`; never in the mobile bundle,
  never committed.
- Ambiguous matches are review-only until the user confirms.
- Demo mode (snapshot vs live) is disclosed; demo offers are real ingested
  data, never fabricated.

## Still open

- FreshCo legal terms: captured (see policy record). Remaining: confirm
  the Milton store's own competitor list in-store during the test shop,
  since FreshCo may vary it by store.
- Backend Meta API key provisioning on Cloudflare with spend limit and a
  proven test call (account credit itself is confirmed).
- Final demo list + scan product — locked at recording from live promos.
- Behavioural analytics choice before public sharing (no transcripts,
  photos, or receipts in events).
