# IASC Humanitarian Reset & Coordination Intelligence Assistant — v2

A contextual, source-aware learning companion on three pages:

| Page | Path | Assistant context |
|---|---|---|
| IASC Overview | `/sol/reset/overview/` | `overview` |
| Humanitarian Reset stocktake | `/sol/reset/` | `reset` |
| Four Ds Explorer (new) | `/sol/reset/four-ds/` | `reset` |

Independent. **Not** an official IASC spokesperson, policy authority, operational decision-maker or endorsed product — the UI says so on open and on every exported answer.

## What is actually running

**Demo mode (default, live today).** No language model. `assistant.js` routes each question to an entry in `registry.json` and renders a cited answer. The footer badge reads "Demo mode · no AI connected" and every answer card says "registry answer, no AI". Off-registry questions get an explicit *No evidence found* card, never a guess.

**Live mode (optional, built but off).** `functions/api/assistant.js` is a Cloudflare Pages Function that retrieves from the same registry, calls the Claude API server-side, and strips any citation id that isn't in the registry before returning. The browser only calls it when `registry.json → backend.enabled` is `true`; if it fails, the widget says so and falls back to the registry answer.

## Files

| File | Role |
|---|---|
| `registry.json` | Single source of truth: sources (tier, status, clearance, version, last checked, on-page anchor), topics with plain/detail/technical levels, indicators (value, base, period, definition, status, caveat), the six preserved source conflicts, reading rules, milestones with ISO due dates, glossary (each term cited to its own source), lessons with knowledge checks, the fictional simulation, and the Four Ds pillar data. **Edit this, not the JS.** |
| `check_registry.py` | `python3 sol/assistant/check_registry.py` — fails if any citation, on-page anchor, lesson answer key, simulation link or pillar reference is broken, or if an external URL isn't on the vetted list. Run after every edit. |
| `assistant.js` / `assistant.css` | Widget (vanilla JS, no dependencies). Registry text is only ever inserted with `textContent`. |
| `media/IASC_Logo_Blue.png` | The supplied logo, byte-identical (SHA-256 `1135b6ab…3a030d23`). Shown on white, height-scaled only. |
| `fonts/montserrat-latin-wght-normal.woff2` | Self-hosted Montserrat (SIL OFL, `fonts/OFL.txt`). Roboto comes from the Reset page's own self-hosted copy. |
| `../reset/four-ds/index.html` | Four Ds Explorer, reading the same `registry.json`. |
| `/functions/api/assistant.js` | Optional live backend. |

## Behaviour mapped to the brief

- **Context**: detected from the URL; switch with the *IASC Overview / Humanitarian Reset* toggle. Switching keeps the conversation and posts context-specific starters.
- **Modes**: Ask · Explore (accessible HTML diagrams of the IASC structure and the four Ds) · Learn (4 lessons + checks + glossary) · Simulate (3-step branching fictional scenario, evolving information, reasoning feedback, rubric debrief) · Find (sources ranked by tier, then relevance, with the reason shown) · Compare (conflicts, pillars, members/invitees) · Brief (study note, FAQ, timeline — labelled "not a cleared official communication").
- **Answer controls**: Explain simply / More detail / Technical / Show evidence / Compare; follow-up chips; Copy with citations; Download .md (citations kept); Helpful/Not helpful (local only).
- **Evidence**: source drawer per answer with title, tier, issuer, date, version, status/clearance, last-checked date, and a link to the original or the exact page section. When the originals are unpublished drafts the drawer says the answer relies on the secondary page.
- **Conflicts preserved**: 62% vs 55%; $4.53bn (2 Oct) vs ~$4.49bn (end Sept); 17→40→75% not one series; local share 55% / 20% / 53%; area-based coordination; 100M vs 66M vs 41M. Plus rules for the non-representative perception survey, qualitative-only Defend, outputs ≠ outcomes.
- **Dates**: milestone status is computed against today's date. Past-due items without evidence read "Past due — status unconfirmed".
- **States**: loading, no evidence, retrieval error, registry unavailable (launcher disabled), offline, client rate limit (30/min demo, 10/min live), live-service failure with fallback.
- **Privacy**: warning above the input; heuristic nudge if a message looks like it contains an ID/email/phone; nothing stored or sent in demo mode; no analytics.
- **Accessibility**: closed panel is `hidden` (not just off-screen), Esc closes and returns focus, visible focus, `role="log"` live region, reduced motion, forced-colours support, 0 axe violations (WCAG 2.1 AA rules) on all three pages at desktop/tablet/mobile.

## Turning on live mode

1. Cloudflare dashboard → Pages → this project → *Settings → Variables and secrets*:
   - `ANTHROPIC_API_KEY` — **Secret**. Never commit it or put it under `sol/`.
   - `ASSISTANT_MODEL` — optional, default `claude-sonnet-5-5` (check current model ids at docs.claude.com before changing).
   - `ASSISTANT_ALLOWED_ORIGINS` — optional, default `https://solinvictus.app`.
2. Add a WAF rate-limiting rule for `/api/assistant` (the function's own limiter is per-isolate, best effort).
3. Deploy, then test: `curl -X POST https://solinvictus.app/api/assistant -H 'content-type: application/json' -H 'origin: https://solinvictus.app' -d '{"query":"Why 62% vs 55%?","context":"reset"}'`
4. Only then set `"backend": {"enabled": true, ...}` in `registry.json`.
5. The privacy note switches automatically to say questions are sent to a third-party AI service. Review that wording (and the provider's data terms) before enabling.

API contract — request `{query, mode, context}`; response `{answer, citations: [registry source ids], caveat, no_evidence}`.

## Rollback

Everything is additive except `assistant.js`, `assistant.css`, `registry.json` (same paths, so the page hooks didn't change) and two links on `/sol/reset/`. Revert the merge commit, or restore those three files from the commit before it. Deleting `/functions/` removes the backend entirely.
