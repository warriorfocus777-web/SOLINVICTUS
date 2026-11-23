# /sol/reset/v3/ — Humanitarian Reset Stocktake, parallel edition

An extended edition of `/sol/reset/`. `/sol/reset/v3/data/indicators.json` is the canonical source for indicator values, reporting metadata and the discrepancy ledger. The assistant registry indicator records are synchronized from this file by the build script. This edition shares its fonts, video and poster (`../fonts`, `../media`).

## Files
- `index.html` — the page (plain static HTML, no build step on deploy)
- `data/indicators.json` — single source for headline indicators, the indicator register, roadmap milestones, HWG workstreams and the "as of" date
- `build.py` — rewrites only the `<!-- gen:… -->` blocks in `index.html` from the JSON (stdlib Python)
- `captions.vtt`, `chapters.vtt` — on-screen-text captions and chapters for the overview film

## Updating figures or statuses
1. Edit `data/indicators.json` (value, period, caveat, status, `as_of`).
2. Run `python3 sol/reset/v3/build.py` from the repo root. It rebuilds the extended page and synchronizes the assistant registry indicator facts and discrepancy ledger. `--check` exits 1 if either generated output is stale.
3. Pillar charts are hand-drawn: if a chart value changes, update the matching chart in `index.html` and keep its denominator, period and caveat aligned with canonical data. Automated checks verify the register and assistant data, not every pixel in manually authored charts.

## Rules carried by this edition
- Draft status stays visible (ribbon, masthead, sub-nav, footer) until formal clearance.
- Discrepancies (62% vs 55%; $4.53bn vs ~$4.49bn; 55% vs 20%; 100M vs 66M vs 41M) are shown, not reconciled.
- Statuses use the brief's vocabulary: Completed, Ongoing, Planned, Pending verification, Not assessed, Superseded.
- Headline, sub-line, principle and closing copy are editorial and labelled as such; Fletcher excerpts link to the UNDP source.

## Going live
To make v3 the main edition, point the SOL glyph door (`sol/index.html`, entry `key:"sol-reset"`) at `/sol/reset/v3/`, or move these files up one level and change `../fonts` / `../media` paths back to `fonts` / `media`.

## Accessible view
One click on "Accessible view" (in the draft banner and in the section bar) switches the same page to: 19px text with WCAG 1.4.12 spacing, high contrast, underlined links, a thick yellow-and-black focus ring, one column, no motion or animation, a static (non-sticky) section bar, pillar and transcript sections expanded, every chart also described in words, tables reflowed into labelled rows, and no text smaller than 16px. The choice is remembered in the browser and can be shared as `?view=accessible` (`?view=standard` resets). With no JavaScript, the button is hidden and the standard page stays fully usable. The page also follows system settings for reduced motion, increased contrast and Windows high-contrast mode.


## Source-version review (23 November 2026)

The exact Stocktake file cited on the website as the 8 October 2026 revision was not available in the repository/source archive used for this review. The accessible four-page Stocktake draft and 17-slide presentation both report 63% for severity 4–5 prioritization; the site-cited 8 October data record says 62%. The accessible source copies distinguish 100M collective results (including 40M with life-saving support) from 66M of 148M targeted reached (including 41M in the most severe locations). See `data/indicators.json` → `source_review` and `discrepancies` for provenance and unresolved questions.
