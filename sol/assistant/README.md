# IASC Humanitarian Reset & Coordination Intelligence Assistant

A contextual, source-aware chat companion for the two live pages:

- `/sol/reset/overview/` — the IASC Overview explainer
- `/sol/reset/` — the Humanitarian Reset stocktake

Not an official IASC spokesperson, policy authority, operational decision-maker or
endorsed product. Neither page's content or functionality was changed beyond adding
a stylesheet link and a script tag before `</body>`.

## What's actually running (read this before assuming it's "AI")

**There is no live AI backend.** No API key, no server, no RAG pipeline, no model
call. `assistant.js` matches the visitor's question against `registry.json` — a
hand-built registry of exactly what's published on these two pages plus the richer
indicator set already maintained in `../reset/v3/data/indicators.json` — and renders
a templated, cited answer. The UI says **"DEMO MODE · no live AI backend"** on every
message footer and in the launcher's own copy, for this reason. This matches the
brief's own instruction for this situation: *"If credentials/backend are unavailable:
implement UI and modular API contract, label demo mode, never claim live."*

Files:
- `assistant.js` — all logic: retrieval, rendering, modes, keyboard/focus handling.
- `assistant.css` — brand-restrained styling (IASC dark blue #272E67, UN blue
  #009EDB, IASC pink #FF4D59 used only for caveats/alerts, matching the existing
  Reset page's own caveat styling).
- `registry.json` — the source registry. **Edit this, not assistant.js**, when a
  figure, document or discrepancy changes. Each entry carries an evidence tier
  (1–4, as defined in the master brief), issuer, date, status and URL where one
  exists; nothing is invented, and nothing is upgraded from Tier 3/4 to official
  IASC policy.

## Known limitations (honest, not hidden)

1. **No live model.** Free-text questions outside the registry's coverage get an
   explicit "no evidence found" response, not a guess. The seven modes (Ask,
   Explore, Learn, Simulate, Find, Compare, Brief) are implemented as templated
   renderers over the same registry, not as separate AI skills.
2. **Montserrat is not self-hosted in this repo.** The brief specifies Montserrat
   for headings; no Montserrat `.woff2` exists under `/sol/reset/fonts/` or
   elsewhere in the repository, and this change does not fetch fonts from Google
   Fonts or any other external host (that would add an external network
   dependency and a privacy/CSP question the rest of the site avoids). Widget
   headings fall back to the page's own self-hosted Roboto Slab. Drop a licensed
   Montserrat `.woff2` into `/sol/reset/fonts/` and add an `@font-face` in
   `assistant.css` to close this gap.
3. **History is not persisted.** Per the brief ("Persistent history only if
   secure, consented and disclosed"), nothing is saved across page loads or sent
   anywhere — the safer default given there is no backend to secure it on.
4. **No live rate limiting.** There's no server to rate-limit. The widget guards
   against double-submits client-side (disables Send while a reply is rendering)
   — a real, not simulated, safeguard — but this is not a substitute for
   server-side throttling if a live backend is added later.
5. **v3 (`/sol/reset/v3/`) does not yet have the widget.** It wasn't in the brief's
   "LIVE PAGES" list, so it was left untouched. Adding it is a two-line change
   (same `<link>` + `<script>` pair) once v3 is ready to go live.
6. **Simulation has one scenario.** `registry.json → simulation` currently defines
   a single branching step for "FICTIONAL LEARNING SCENARIO — NOT OPERATIONAL
   GUIDANCE." Add further `steps` entries (each with `choices`) to extend it;
   `assistant.js → resolveSimChoice` does not yet chain to a second step
   automatically — that's the next piece of real logic to add, not just data.

## API contract for a future live backend

If a real backend/RAG pipeline is added later, keep the frontend unaware of any
secret. Suggested contract (not implemented — there is no server here):

```
POST https://<your-backend>/api/assistant/query
Content-Type: application/json

{
  "query": "string, the visitor's message",
  "mode": "ask|explore|learn|simulate|find|compare|brief",
  "context": "overview|reset",
  "history": [{"role":"user|assistant","text":"..."}]   // only if persistence is
                                                          // implemented, disclosed
                                                          // and consented to
}
```

Expected response shape (so `assistant.js`'s render functions — `addBotCard`,
`renderSources`, the table/kv/caveat helpers — can be reused almost as-is):

```
{
  "answer": "string, plain text or limited HTML",
  "citations": [
    {"id": "registry-id-or-new-id", "title": "...", "issuer": "...", "date": "...",
     "tier": 1, "status": "...", "url": "..."}
  ],
  "caveat": "string or null",
  "no_evidence": false
}
```

Environment variables a live deployment would need (never in frontend code,
never committed):

- `ANTHROPIC_API_KEY` — server-side only, injected via the hosting platform's
  secret store (e.g. a Cloudflare Pages Function / Worker secret), never in any
  file under `sol/`.
- `ASSISTANT_ALLOWED_ORIGINS` — CORS allow-list restricted to
  `https://solinvictus.app`.

Before wiring real Claude API calls, check the current Anthropic API docs for
streaming, retrieval and tool-use features rather than relying on this note,
which will go stale.

## Updating the registry

1. Edit `registry.json` (figures, statuses, new documents, new discrepancies).
2. If the figure also lives in `../reset/v3/data/indicators.json`, update both —
   they are not currently code-linked (the v3 build has its own
   `build.py` / `--check` pipeline; this registry is a separate, simpler copy
   scoped to what the two live pages actually show).
3. No build step: `registry.json` is fetched at runtime by `assistant.js`.
