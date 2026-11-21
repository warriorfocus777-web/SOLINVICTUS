#!/usr/bin/env python3
"""
Evidence audit — runs the MASTER PROMPT v2 Evidence Gate (§4) and the
mechanical confidence rule (§4) against the live Cadre 7 and Cadre 509 desk
files, and reports where the computed result differs from what the desk has
on record. Changes nothing. Read-only by design: §1 forbids silently
rewriting a signed or sealed record, so this script's only job is to surface
mismatches for the desk to review.

Usage:
    python3 evidence_audit.py > ../AUDIT-2026-11-21.md
"""

import json
import sys
from pathlib import Path

from evidence_engine import assess_originators, gate_outcome, mechanical_confidence, Confidence

ROOT = Path(__file__).resolve().parent.parent

CONF_ALIASES = {
    "not declared": Confidence.NOT_DECLARED,
    "to be declared by the desk": Confidence.NOT_DECLARED,
    "low": Confidence.LOW,
    "moderate": Confidence.MODERATE,
    "high": Confidence.HIGH,
}


def normalize_stored_conf(raw: str) -> Confidence | None:
    if raw is None:
        return None
    return CONF_ALIASES.get(raw.strip().lower())


def audit_cadre7(path: Path, out: list):
    data = json.loads(path.read_text())
    sources_by_id = {s["id"]: s for s in data["sources"]}
    out.append("## Cadre 7 — `cadre7/desk.json`\n")
    out.append(f"No `originators` lookup table in this file — independence is judged "
                f"from each source's raw `o` string. See Known limitation #1.\n")

    for note in data["notes"]:
        cited_ids = note.get("src", [])
        cited_sources = [sources_by_id[i] for i in cited_ids if i in sources_by_id]
        missing = [i for i in cited_ids if i not in sources_by_id]
        assessment = assess_originators(cited_sources, originators_table=None)
        gate = gate_outcome(assessment)
        computed_conf = mechanical_confidence(assessment, gate, has_material_contradiction=False)
        stored_conf = normalize_stored_conf(note.get("conf"))

        out.append(f"### {note['id']} — status: `{note.get('status')}`, signed: `{note.get('signed')}`")
        out.append(f"- Question: {note.get('q', {}).get('en', '')}")
        out.append(f"- Cited sources: {len(cited_ids)}" + (f" (missing from ledger: {missing})" if missing else ""))
        out.append(f"- Grade-C excluded: {assessment.excluded_grade_c or 'none'}")
        out.append(f"- Qualifying originators ({len(assessment.qualifying_originators)}): "
                    + ", ".join(assessment.qualifying_originators))
        out.append(f"- **Gate outcome: {gate.value}**")
        out.append(f"- Stored confidence: `{note.get('conf')}`  |  Mechanical confidence (no contradiction flag available — assumed none): `{computed_conf.value}`")
        if stored_conf is not None and stored_conf != computed_conf:
            out.append(f"  - ⚠ MISMATCH — desk said {stored_conf.value}, engine computes {computed_conf.value}. "
                        f"Not auto-corrected (§1: confidence is the desk's call, not overridden after the fact). "
                        f"See Known limitation #2 for why this particular note is likely a false mismatch.")
        out.append("")


def audit_cadre509(path: Path, out: list):
    data = json.loads(path.read_text())
    sources_by_id = {s["id"]: s for s in data["sources"]}
    originators_table = data.get("originators", {})
    out.append("## Cadre 509 — `cadre509/desk509.json`\n")
    out.append(f"Has an `originators` lookup table ({len(originators_table)} codes) — independence is judged "
                f"from each source's `o` code against that table, which is the better of the two desks for this.\n")

    for cell in data["cells"]:
        cited_pairs = cell.get("src", [])
        cited_ids = [p[0] if isinstance(p, list) else p for p in cited_pairs]
        cited_sources = [sources_by_id[i] for i in cited_ids if i in sources_by_id]
        missing = [i for i in cited_ids if i not in sources_by_id]
        assessment = assess_originators(cited_sources, originators_table=originators_table)
        gate = gate_outcome(assessment)
        computed_conf = mechanical_confidence(assessment, gate, has_material_contradiction=False)
        stored_conf = normalize_stored_conf(cell.get("conf"))

        out.append(f"### Cell {cell.get('n'):02d} — {cell.get('label')} (`{cell.get('id')}`) — status: `{cell.get('status')}`")
        out.append(f"- Cited sources: {len(cited_ids)}" + (f" (missing from ledger: {missing})" if missing else ""))
        out.append(f"- Grade-C excluded: {assessment.excluded_grade_c or 'none'}")
        out.append(f"- Stored `orig`/`orig_names`: {cell.get('orig')} / {cell.get('orig_names')}")
        out.append(f"- Engine-computed qualifying originators ({len(assessment.qualifying_originators)}): "
                    + ", ".join(assessment.qualifying_originators))
        if cell.get("orig") is not None and cell.get("orig") != len(assessment.qualifying_originators):
            out.append(f"  - ⚠ MISMATCH — desk recorded orig={cell.get('orig')}, engine counts {len(assessment.qualifying_originators)}.")
        out.append(f"- **Gate outcome: {gate.value}**")
        out.append(f"- Stored confidence: `{cell.get('conf')}`  |  Mechanical confidence: `{computed_conf.value}`")
        if stored_conf is not None and stored_conf != computed_conf:
            out.append(f"  - ⚠ MISMATCH — desk said {stored_conf.value}, engine computes {computed_conf.value}.")
        out.append("")


def main():
    out = []
    out.append("# Evidence Gate / Confidence audit — 2026-11-21")
    out.append("")
    out.append("Generated by `tools/evidence_audit.py` against the MASTER PROMPT v2 rules. "
                "Read-only: nothing in `cadre7/desk.json` or `cadre509/desk509.json` was changed to produce this.")
    out.append("")
    out.append("## Headline finding — do not wire this engine into the live pages yet")
    out.append("")
    out.append("Every Cadre 509 cell below shows an engine-computed originator count higher than the desk's "
                "own `orig`/`orig_names`, and every one of those pushes the gate to ELIGIBLE and confidence to "
                "HIGH or MODERATE where the desk correctly holds the cell at `held`/`empty`/`candidate` with "
                "confidence not declared. This is not the desk being wrong. It is this engine being too naive "
                "to use safely: §4's own text — \"count originators, not documents or outlets\" — presumes a "
                "prior, semantic judgement this engine cannot make from the current schema: *which cited "
                "sources actually assert the cell's specific claim*, versus which are cited as context, as a "
                "negative/NOT-FOUND result, or as out of the cell's time period. The desk already makes this "
                "call by hand (e.g. cell 05's per-source notes mark some citations \"different period\" or "
                "\"one event\"; cell 06's sources are cited precisely to document that PNH accountability "
                "data was *searched for and not found*, not that it was found). That distinction is not a "
                "structured field anywhere in either desk file — the free-text per-source notes are a partial, "
                "inconsistent hint, not something this engine should parse and act on. Mechanically counting "
                "every cited source as a qualifying originator, as done below, systematically inflates "
                "eligibility and confidence — exactly the failure mode the whole platform exists to prevent. "
                "**Recommendation:** add a structured per-citation field (e.g. `role`: `asserts` / `context` / "
                "`out-of-scope` / `negative-result`) before any gate/confidence computation is trusted beyond "
                "diagnostic use, and before task \"wire engine into desk pages\" proceeds. That field is an "
                "editorial decision for the desk to make per citation, not something to infer or backfill here.")
    out.append("")
    out.append("The mismatches below are shown anyway, in full, because they are the evidence for the finding "
                "above — not because they are action items to fix by changing the desk's numbers.")
    out.append("")

    audit_cadre7(ROOT / "cadre7" / "desk.json", out)
    audit_cadre509(ROOT / "cadre509" / "desk509.json", out)

    out.append("## Known limitations of this engine")
    out.append("")
    out.append("0. **Claim-relevance is not a structured field (see Headline finding above).** This is the "
                "limitation that actually matters; the rest are secondary until this one is fixed.")
    out.append("1. **No provenance chain yet.** §3 of the master prompt calls for "
                "DIRECT/RELAY/DERIVED/SECONDARY/UNRESOLVED per source. Neither desk file has this field. "
                "Independence here is judged only from the `o` originator string (Cadre 509, via its "
                "`originators` table) or raw `o` text (Cadre 7, no table at all — a real gap: two "
                "differently-worded mentions of the same organization will be double-counted as independent). "
                "Adding the provenance field and, for Cadre 7, an `originators` table like Cadre 509's, is the "
                "next concrete step toward §3.")
    out.append("2. **Confidence formula has no contradiction input from the data.** Cadre 7's N-001 is the "
                "clearest case: the desk set confidence to MODERATE for a documented reason (an unpublished "
                "bilateral exchange cannot be excluded) that is not a hard contradiction, just residual "
                "uncertainty. This engine has no field to read that from, so it computes HIGH and flags a "
                "mismatch that is not actually an error — it is the engine missing an input, not the desk "
                "being wrong. Recommend adding an explicit `residual_uncertainty` or `soft_discrepancy` flag "
                "to the note/cell schema, with a short reason string, before treating this engine's confidence "
                "output as more than advisory.")
    out.append("3. **Discrepancies aren't linked to specific cells/notes.** Cadre 509's `discrepancies` array "
                "(D-509-xx) has no field tying a discrepancy to the cell(s) it affects, so this engine cannot "
                "mechanically treat a logged discrepancy as the \"material contradiction\" input to §4's "
                "confidence rule. It currently assumes no contradiction for every cell, which is optimistic. "
                "Worth adding a `cells` or `notes` link array to each discrepancy entry.")
    out.append("4. **This audit does not cover Cadre 22** (`cadre/index.html`, ~6,000 lines, no separate JSON "
                "ledger) — its data model needs to be extracted before this engine can run against it.")

    print("\n".join(out))


if __name__ == "__main__":
    main()
