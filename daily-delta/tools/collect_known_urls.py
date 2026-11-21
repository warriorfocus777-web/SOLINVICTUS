#!/usr/bin/env python3
"""
Collect every source URL already known to the three desks plus everything
already staged in daily-delta/, so the daily sweep can skip what it's already
seen. This is a dedup aid only — it never judges, grades, or qualifies
anything (that stays forbidden for the daily sweep, per MASTER PROMPT §8).

Cadre 7 and Cadre 509 have a structured `sources` array (desk.json /
desk509.json) with a `url` field per source — read directly. Cadre 22
(cadre/index.html) has no separate ledger file yet, so this does a plain
regex scan of the HTML for http(s) URLs as a best-effort fallback: it will
over-match (any link on the page, not just cited sources) but that only
costs the sweep a few extra "already seen, skip" checks, never a missed
duplicate — safe in the direction that matters.

Usage:
    python3 daily-delta/tools/collect_known_urls.py
Prints one URL per line to stdout.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
URL_RE = re.compile(r'https?://[^\s"\'<>)\]]+')


def urls_from_desk_json(path: Path) -> set[str]:
    if not path.exists():
        return set()
    data = json.loads(path.read_text())
    return {s["url"] for s in data.get("sources", []) if s.get("url")}


def urls_from_html_scan(path: Path) -> set[str]:
    if not path.exists():
        return set()
    text = path.read_text(errors="ignore")
    return set(URL_RE.findall(text))


def urls_from_staged_daily_files() -> set[str]:
    found = set()
    delta_dir = ROOT / "daily-delta"
    if not delta_dir.exists():
        return found
    for f in delta_dir.glob("20*.json"):  # dated files, e.g. 2026-11-22.json
        try:
            data = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        for c in data.get("candidates", []):
            if c.get("url"):
                found.add(c["url"])
    return found


def main():
    known = set()
    known |= urls_from_desk_json(ROOT / "cadre7" / "desk.json")
    known |= urls_from_desk_json(ROOT / "cadre509" / "desk509.json")
    known |= urls_from_html_scan(ROOT / "cadre" / "index.html")
    known |= urls_from_staged_daily_files()
    for u in sorted(known):
        print(u)
    print(f"# {len(known)} known URLs", file=sys.stderr)


if __name__ == "__main__":
    main()
