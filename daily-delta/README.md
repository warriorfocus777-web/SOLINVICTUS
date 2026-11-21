# daily-delta/

The §8 "Daily Delta" from the master prompt: an internal-only, staging-only
register of newly-found source material for Cadre 22, Cadre 7 and Cadre 509.
A scheduled daily sweep writes here. **Nothing in this directory is read by
any public page, and this branch is never merged into `main` automatically.**
It exists so new material doesn't get lost between desk refresh cycles,
without pretending a daily automated pass can do the desk's editorial work.

## What the sweep is allowed to do

- Search for new reporting since the last known date on each desk.
- Check candidate URLs against `tools/collect_known_urls.py`'s output
  (every source already in `cadre7/desk.json`, `cadre509/desk509.json`, a
  best-effort scan of `cadre/index.html`, and everything already staged
  here) and skip anything already known.
- Record, per new candidate: title, originator, publisher, date, url,
  language, which desk(s)/cell(s) it looks relevant to, and one line on why
  it looks new/relevant.
- Commit new findings to **this branch only** (`daily-delta`), never `main`.

## What it must never do (§8, §1)

- Assign a grade (A/B/C), a provenance category, a confidence level, or a
  verdict to anything.
- Write or edit anything in `cadre7/desk.json`, `cadre509/desk509.json`, or
  `cadre/index.html`.
- Open a PR, merge, or push to `main`.
- Produce a daily judgement, recommendation, or targeting/operational note.
- Skip a day silently if something broke — if the sweep can't run (search
  failed, repo unreachable), it says so in its own output rather than
  reporting "nothing new" by default.

## File format

One file per day that found something new, named `YYYY-MM-DD.json`:

```json
{
  "date": "2026-11-22",
  "candidates": [
    {
      "title": "Exact headline or document title",
      "originator": "Best-guess originating org/person (not a desk originator code — the desk assigns that)",
      "publisher": "Outlet or publisher",
      "date": "22.11.2026",
      "url": "https://...",
      "lang": "en",
      "desk_hint": ["cadre7", "cadre509"],
      "cell_hint": ["command", null],
      "why_new": "One line: what's new here and why it looks relevant to that desk/cell."
    }
  ]
}
```

A day with nothing new writes no file at all — absence of a file for a date
means the sweep ran and found nothing, not that it didn't run. (Sweep-failure
days are reported in the scheduled task's own output, not written here.)

## Promoting a candidate into a desk

Entirely manual, by design. The desk (Matt) reads a staged candidate,
grades it, decides which cell(s)/note(s) it bears on, and adds it to the real
ledger (`cadre7/desk.json` / `cadre509/desk509.json` / `cadre/index.html`)
through the normal editorial process — exactly as the existing
`record-update-*.md` sessions already do. Nothing here shortcuts that.
