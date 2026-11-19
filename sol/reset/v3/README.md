# /sol/reset/v3/ — Humanitarian Reset Stocktake, parallel edition

A parallel version of `/sol/reset/`, built from the *IASC Humanitarian Reset Master Implementation Brief v3.0* (19 Nov 2026). The live page at `/sol/reset/` is left exactly as it was. This edition shares its fonts, video and poster (`../fonts`, `../media`).

## Files
- `index.html` — the page (plain static HTML, no build step on deploy)
- `data/indicators.json` — single source for headline indicators, the indicator register, roadmap milestones, HWG workstreams and the "as of" date
- `build.py` — rewrites only the `<!-- gen:… -->` blocks in `index.html` from the JSON (stdlib Python)
- `captions.vtt`, `chapters.vtt` — on-screen-text captions and chapters for the overview film

## Updating figures or statuses
1. Edit `data/indicators.json` (value, period, caveat, status, `as_of`).
2. Run `python3 sol/reset/v3/build.py` from the repo root. `--check` exits 1 if the page is stale.
3. Pillar charts are hand-drawn: if a pillar value changes, update the matching chart in `index.html` too (search for the value).

## Rules carried by this edition
- Draft status stays visible (ribbon, masthead, sub-nav, footer) until formal clearance.
- Discrepancies (62% vs 55%; $4.53bn vs ~$4.49bn; 55% vs 20%; 100M vs 66M vs 41M) are shown, not reconciled.
- Statuses use the brief's vocabulary: Completed, Ongoing, Planned, Pending verification, Not assessed, Superseded.
- Headline, sub-line, principle and closing copy are editorial and labelled as such; Fletcher excerpts link to the UNDP source.

## Going live
To make v3 the main edition, point the SOL glyph door (`sol/index.html`, entry `key:"sol-reset"`) at `/sol/reset/v3/`, or move these files up one level and change `../fonts` / `../media` paths back to `fonts` / `media`.

## Accessible view
One click on "Accessible view" (in the draft banner and in the section bar) switches the same page to: 19px text with WCAG 1.4.12 spacing, high contrast, underlined links, a thick yellow-and-black focus ring, one column, no motion or animation, a static (non-sticky) section bar, pillar and transcript sections expanded, every chart also described in words, tables reflowed into labelled rows, and no text smaller than 16px. The choice is remembered in the browser and can be shared as `?view=accessible` (`?view=standard` resets). With no JavaScript, the button is hidden and the standard page stays fully usable. The page also follows system settings for reduced motion, increased contrast and Windows high-contrast mode.
