#!/usr/bin/env python3
"""Integrity check for sol/assistant/registry.json. Run from repo root:
   python3 sol/assistant/check_registry.py      (exit 1 on any problem)
Checks every citation resolves, ids are unique, lessons have exactly one
correct answer, simulation steps link up, and no URL is fabricated
(external URLs must be in the ALLOWED list below, i.e. checked by a human)."""
import json, sys, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, "registry.json"), encoding="utf-8"))
DATA = json.load(open(os.path.join(HERE, "..", "reset", "v3", "data", "indicators.json"), encoding="utf-8"))
errs = []
src = {s["id"]: s for s in R["sources"]}
if len(src) != len(R["sources"]): errs.append("duplicate source id")
ALLOWED = {
 "https://interagencystandingcommittee.org/iasc-about/iasc-membership",
 "https://interagencystandingcommittee.org/node/39708",
 "https://www.undp.org/crisis/beyond-crisis-series/9",
 "https://www.eeas.europa.eu/delegations/un-new-york/eu-statement-un-inter-agency-standing-committee-principals-donor-engagement-humanitarian-reset_en",
 "https://www.dfat.gov.au/sites/default/files/united-nations-handbook-2025-26.pdf",
 "https://digitallibrary.un.org/record/135197?ln=en",
 "https://mandates.un.org/mandate/A/RES/48/57",
}
for s in R["sources"]:
    for k in ("title","issuer","date","status","tier"):
        if s.get(k) in (None,""): errs.append(f"source {s['id']} missing {k}")
    u = s.get("url")
    if u and u.startswith("http") and u not in ALLOWED: errs.append(f"unvetted external URL {u}")
    if u and u.startswith("/"):
        path = u.split("#")[0]; anchor = u.split("#")[1] if "#" in u else None
        f = os.path.join(HERE, "..", "..", path.lstrip("/"), "index.html")
        if not os.path.exists(f): errs.append(f"{s['id']}: page {path} missing")
        elif anchor and f'id="{anchor}"' not in open(f, encoding="utf-8").read(): errs.append(f"{s['id']}: anchor #{anchor} missing")
def cite(where, ids):
    for i in ids or []:
        if i not in src: errs.append(f"{where}: unknown source '{i}'")
for t in R["topics"]: cite("topic "+t["id"], t["sources"])
ind = {i["id"] for i in R["indicators"]}
canonical = {i["id"]: i for i in DATA["indicators"]}
if ind != set(canonical): errs.append("assistant indicators do not match canonical indicators.json ids")
for i in R["indicators"]:
    cite("indicator "+i["id"], i["sources"])
    c = canonical.get(i["id"])
    if c and any(i.get(k) != c.get(k) for k in ["value","denominator","period","definition","status","caveat"]):
        errs.append("indicator mismatch with canonical data: "+i["id"])
if R.get("discrepancies") != DATA.get("discrepancies"): errs.append("assistant discrepancy ledger does not match canonical data")
dis = {d["id"] for d in R["discrepancies"]}
for d in R["discrepancies"]:
    cite("disc "+d["id"], d["sources"]); cite("disc values "+d["id"], [v["source"] for v in d["values"]])
for r in R["reading_rules"]: cite("rule "+r["id"], r["sources"])
for m in R["milestones"]:
    cite("milestone "+m["id"], m["sources"])
    if not re.match(r"\d{4}-\d{2}-\d{2}$", m["due"]): errs.append("bad due "+m["id"])
    if m["completed_evidence"]: cite("milestone ev", [m["completed_evidence"]])
for g in R["glossary"]: cite("glossary "+g["term"], g["sources"])
for l in R["lessons"]:
    cite("lesson "+l["id"], l["sources"])
    if sum(o["correct"] for o in l["check"]["options"]) != 1: errs.append("lesson needs exactly one correct: "+l["id"])
sim = R["simulation"]; steps = {s["id"] for s in sim["steps"]}
if sim["start"] not in steps: errs.append("sim start")
rub = {r["id"] for r in sim["rubric"]}
for s in sim["steps"]:
    for c in s["choices"]:
        if c["next"] != "end" and c["next"] not in steps: errs.append(f"sim {s['id']}/{c['id']} -> {c['next']}")
        for k in c["signals"]:
            if k not in rub: errs.append(f"sim signal {k}")
for p in R["pillars"]:
    cite("pillar "+p["id"], p["sources"])
    for i in p["indicators"]:
        if i not in ind: errs.append(f"pillar {p['id']}: indicator {i}")
    for d in p["discrepancies"]:
        if d not in dis: errs.append(f"pillar {p['id']}: disc {d}")
cite("structure", R["structure"]["sources"])
if errs:
    print("\n".join("FAIL " + e for e in errs)); sys.exit(1)
print(f"OK: {len(src)} sources, {len(R['topics'])} topics, {len(ind)} indicators, {len(dis)} discrepancies, {len(R['lessons'])} lessons, {len(steps)} sim steps, all citations resolve")
