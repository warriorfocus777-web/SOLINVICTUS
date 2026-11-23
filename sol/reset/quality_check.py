#!/usr/bin/env python3
"""Static integrity checks for IASC pages and the canonical evidence model.

These checks are not a substitute for browser, screen-reader, real-device or
formal accessibility testing.
"""
from html.parser import HTMLParser
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
PAGE_PATHS = [
    "sol/reset/overview/index.html",
    "sol/reset/index.html",
    "sol/reset/v3/index.html",
    "sol/reset/four-ds/index.html",
]
ERRORS = []
WARNINGS = []


class PageAudit(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicates = set()
        self.anchors = []
        self.images_without_alt = []
        self.h1_count = 0
        self.title_count = 0
        self.description = False
        self.noindex = False
        self.blank_without_noopener = []
        self.blank_without_noreferrer = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicates.add(element_id)
            self.ids.add(element_id)

        if tag == "a":
            href = attrs.get("href", "")
            if href.startswith("#") and len(href) > 1:
                self.anchors.append(href[1:])
            if attrs.get("target") == "_blank":
                rel = set((attrs.get("rel") or "").lower().split())
                if "noopener" not in rel:
                    self.blank_without_noopener.append(href)
                if "noreferrer" not in rel:
                    self.blank_without_noreferrer.append(href)

        if tag == "img" and "alt" not in attrs:
            self.images_without_alt.append(attrs.get("src", "(unknown src)"))
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self.title_count += 1
        if tag == "meta":
            name = (attrs.get("name") or "").lower()
            content = attrs.get("content") or ""
            if name == "description" and content.strip():
                self.description = True
            if name == "robots" and "noindex" in content.lower():
                self.noindex = True


loaded = {}
for relative in PAGE_PATHS:
    path = ROOT / relative
    if not path.is_file():
        ERRORS.append(f"missing page: {relative}")
        continue
    source = path.read_text(encoding="utf-8")
    loaded[relative] = source
    audit = PageAudit()
    try:
        audit.feed(source)
    except Exception as exc:
        ERRORS.append(f"{relative}: HTML parse error: {exc}")
        continue

    if audit.duplicates:
        ERRORS.append(f"{relative}: duplicate IDs: {sorted(audit.duplicates)}")
    if audit.images_without_alt:
        ERRORS.append(f"{relative}: images missing alt: {audit.images_without_alt}")
    if audit.h1_count != 1:
        ERRORS.append(f"{relative}: expected exactly one h1; found {audit.h1_count}")
    if not audit.title_count or not audit.description:
        ERRORS.append(f"{relative}: missing title or meta description")
    if not audit.noindex:
        WARNINGS.append(f"{relative}: page is indexable; verify clearance before enabling discovery")
    missing_anchors = sorted(set(audit.anchors) - audit.ids)
    if missing_anchors:
        WARNINGS.append(f"{relative}: unresolved local anchors: {missing_anchors}")
    if audit.blank_without_noopener:
        ERRORS.append(f"{relative}: target=_blank links missing noopener: {audit.blank_without_noopener}")
    if audit.blank_without_noreferrer:
        WARNINGS.append(f"{relative}: target=_blank links missing noreferrer: {audit.blank_without_noreferrer}")

# Canonical evidence and runtime registry must be identical for numeric facts.
data = json.loads((ROOT / "sol/reset/v3/data/indicators.json").read_text(encoding="utf-8"))
registry = json.loads((ROOT / "sol/assistant/registry.json").read_text(encoding="utf-8"))
canonical = {i["id"]: i for i in data["indicators"]}
runtime = {i["id"]: i for i in registry["indicators"]}
if len(canonical) != len(data["indicators"]):
    ERRORS.append("canonical indicator IDs are not unique")
if set(canonical) != set(runtime):
    ERRORS.append("assistant registry indicator IDs differ from canonical data")
for indicator_id, item in canonical.items():
    runtime_item = runtime.get(indicator_id)
    if not runtime_item:
        continue
    for field in ["value", "denominator", "period", "definition", "status", "caveat"]:
        if runtime_item.get(field) != item.get(field):
            ERRORS.append(f"assistant indicator {indicator_id} differs in {field}")
    for source_id in item.get("assistant_sources", [item["source"]]):
        if not any(s.get("id") == source_id for s in registry["sources"]):
            ERRORS.append(f"indicator {indicator_id} references missing source {source_id}")
if registry.get("discrepancies") != data.get("discrepancies"):
    ERRORS.append("assistant discrepancy ledger differs from canonical data")

source_ids = set(data["sources"])
for issue in data.get("discrepancies", []):
    for value in issue.get("values", []):
        if value.get("source") not in source_ids:
            ERRORS.append(f"discrepancy {issue['id']} references missing source {value.get('source')}")
    for source_id in issue.get("sources", []):
        if source_id not in source_ids:
            ERRORS.append(f"discrepancy {issue['id']} references missing source {source_id}")

if len(data.get("short_metrics", [])) != 6:
    ERRORS.append("short Stocktake must contain six canonical headline metric definitions")
for card in data.get("short_metrics", []):
    if card.get("id") not in canonical:
        ERRORS.append(f"short metric references unknown indicator {card.get('id')}")
if len(data.get("discrepancies", [])) != 8:
    ERRORS.append("expected eight documented source-reconciliation items")

short = loaded.get("sol/reset/index.html", "")
extended = loaded.get("sol/reset/v3/index.html", "")
overview = loaded.get("sol/reset/overview/index.html", "")
four_ds = loaded.get("sol/reset/four-ds/index.html", "")

if "including 41 million with life-saving support" in short + extended:
    ERRORS.append("40M life-saving-support and 41M severe-location measures are conflated")
if "presentation gives 55% for 2026" in short.lower() + extended.lower():
    ERRORS.append("superseded 62% vs 55% severity statement remains visible")
if "including 40 million with life-saving support" not in short:
    ERRORS.append("short Stocktake omits the 40M life-saving-support measure")
if "including 40 million with life-saving support" not in extended:
    ERRORS.append("extended Stocktake omits the 40M life-saving-support measure")
if "exact file was not available" not in short.lower() or "exact file was not available" not in extended.lower():
    ERRORS.append("source-version limitation for the 8 October file is not visible on both Stocktake pages")

if "Roboto Slab" in extended:
    ERRORS.append("extended Stocktake still uses Roboto Slab instead of Montserrat")
if '--f-slab:"IASC Montserrat"' not in extended:
    ERRORS.append("extended Stocktake Montserrat display font token missing")
if '--red:#FF4D59' not in extended or '--blue:#009EDB' not in extended:
    ERRORS.append("extended Stocktake official brand colour tokens missing")

for label, page in [
    ("Overview", overview), ("Short Stocktake", short),
    ("Extended Stocktake", extended), ("Four Ds Explorer", four_ds)
]:
    if "IASC Montserrat" not in page:
        ERRORS.append(f"{label}: IASC Montserrat font family missing")
    for colour in ["#272E67", "#009EDB", "#FF4D59"]:
        if colour not in page:
            ERRORS.append(f"{label}: primary identity colour {colour} missing")
    if "/sol/assistant/media/IASC_Logo_Blue.png" not in page:
        ERRORS.append(f"{label}: approved original IASC blue logo asset missing")

headers = (ROOT / "_headers").read_text(encoding="utf-8")
for required in ["Referrer-Policy: strict-origin-when-cross-origin", "X-Content-Type-Options: nosniff"]:
    if required not in headers:
        ERRORS.append(f"security headers file missing {required}")

if ERRORS:
    print("\n".join("FAIL " + e for e in ERRORS))
    if WARNINGS:
        print("\n".join("WARN " + w for w in WARNINGS))
    sys.exit(1)

print(f"OK: {len(PAGE_PATHS)} IASC pages parsed; source registry, canonical indicators, reconciliation ledger, brand tokens, logo assets and page structure checked.")
for warning in WARNINGS:
    print("WARN " + warning)
