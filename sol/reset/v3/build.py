#!/usr/bin/env python3
"""Regenerate the data-driven blocks of /sol/reset/v3/index.html from data/indicators.json.

The page stays a plain static file (no build step on deploy). This script only rewrites
the HTML between <!-- gen:NAME --> and <!-- /gen:NAME --> markers, so hand-written
content elsewhere in index.html is never touched.

Usage:  python3 sol/reset/v3/build.py          (writes index.html in place)
        python3 sol/reset/v3/build.py --check  (exit 1 if index.html is out of date)
"""
import html, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = json.loads((HERE / "data" / "indicators.json").read_text(encoding="utf-8"))
PAGE = HERE / "index.html"
SRC = DATA["sources"]
IND = {i["id"]: i for i in DATA["indicators"]}
E = html.escape

STATUS = {
    "completed": ("Completed", "Evidence confirms completion"),
    "ongoing": ("Ongoing", "Implementation is under way"),
    "planned": ("Planned", "Formally scheduled, not yet started or due"),
    "pending": ("Pending verification", "Reported status requires confirmation"),
    "notassessed": ("Not assessed", "No valid outcome assessment available"),
    "superseded": ("Superseded", "Replaced by a newer approved action"),
}
PILLAR = {"define": "Define", "deliver": "Deliver", "devolve": "Devolve", "defend": "Defend", "overview": "Overview"}


def badge(key):
    label, _ = STATUS[key]
    return f'<span class="st st-{key}"><svg class="sti" aria-hidden="true"><use href="#s-{key}"/></svg>{E(label)}</span>'


def src_label(i):
    s = SRC[i["source"]]
    return f'{E(s["short"])}, {E(i["source_section"])} · {E(s["version"])}'


def viz(i):
    if "dots" in i:
        on, total = i["dots"]
        cells = "".join('<i class="on"></i>' if n < on else "<i></i>" for n in range(total))
        return f'<span class="dots" aria-hidden="true">{cells}</span>'
    if "share" in i:
        return f'<span class="mini" aria-hidden="true"><span class="f" style="--v:{i["share"]}%"></span></span>'
    return ""


def kpi(i, cat):
    if " | " in i["value"]:
        a, c = i["value"].split(" | ")
        val = f'<span class="v num">{E(a)} <span class="vs">|</span> {E(c)}</span><span class="pl2">excl. | incl. US Award Tranche I</span>'
    else:
        val = f'<span class="v num">{E(i["value"])}</span>'
    return (f'<li class="kpi"><p class="kcat">{E(cat)}</p>{val}{viz(i)}'
            f'<p class="kl2">{E(i["label"])}</p><p class="kc">{E(i["note"])}</p>'
            f'<p class="src"><span>{E(SRC[i["source"]]["short"])}, {E(i["source_section"])}</span>'
            f'<span class="tag">{E(i["status"]).upper()}</span><a href="#reg-{i["id"]}">Definition and base</a></p></li>')


def gen_kpis():
    return '<ul class="kpis">' + "".join(kpi(IND[k], g["title"]) for g in DATA["kpi_groups"] for k in g["ids"]) + "</ul>"
def gen_register():
    rows = []
    for i in DATA["indicators"]:
        rows.append(
            f'<tr id="reg-{i["id"]}"><th scope="row">{E(i["title"])}</th><td class="num">{E(i["value"].replace(" | ", " / "))}</td>'
            f'<td>{E(i["denominator"])}</td><td>{E(i["period"])}</td><td>{E(i["definition"])}</td>'
            f'<td>{E(i["caveat"])}</td><td>{E(PILLAR[i["pillar"]])}</td><td>{src_label(i)}</td></tr>')
    return ('<div class="tscroll" tabindex="0" role="region" aria-label="Indicator register, scrollable"><table class="reg">'
            '<caption class="sr-only">Indicator register: every headline figure with its base, period, definition, caveat and source</caption>'
            '<thead><tr><th scope="col">Indicator</th><th scope="col">Value</th><th scope="col">Base</th><th scope="col">Period</th>'
            '<th scope="col">Definition</th><th scope="col">Read with care</th><th scope="col">Pillar</th><th scope="col">Source</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def gen_roadmap():
    items = []
    for m in DATA["milestones"]:
        ev = E(m["evidence"])
        if m.get("evidence_source"):
            s = SRC[m["evidence_source"]]
            ev += f' <a href="{E(s["url"])}" rel="noopener" target="_blank">{E(s["short"])}<span class="sr-only"> (opens in a new tab)</span></a>'
        items.append(
            f'<li class="ms ms-{m["status"]}"><div class="msd"><b class="num">{E(m["date"])}</b>{badge(m["status"])}</div>'
            f'<div class="msb"><p class="msw">{E(m["what"])}</p>'
            f'<dl><div><dt>Owner</dt><dd>{E(m["owner"])}</dd></div><div><dt>Evidence</dt><dd>{ev}</dd></div>'
            f'<div><dt>Qualification</dt><dd>{E(m["qualification"])}</dd></div></dl></div></li>')
    return f'<ol class="road">{"".join(items)}</ol>'


def gen_workstreams():
    rows = "".join(
        f'<tr><th scope="row">{E(w["name"])}</th><td>{E(w["reported"])}</td><td>{badge(w["status"])}</td><td>{E(w["note"])}</td></tr>'
        for w in DATA["workstreams"])
    return ('<div class="tscroll" tabindex="0" role="region" aria-label="HWG workstreams, scrollable"><table class="reg ws">'
            '<caption class="sr-only">HWG workstreams: status reported in the presentation and status on this page</caption>'
            '<thead><tr><th scope="col">Workstream</th><th scope="col">Reported (presentation, slide 13)</th>'
            '<th scope="col">Status on this page</th><th scope="col">Note</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>')


def gen_asof():
    return E(DATA["as_of"])


GEN = {"kpis": gen_kpis, "register": gen_register, "roadmap": gen_roadmap, "workstreams": gen_workstreams, "asof": gen_asof}


def render(text):
    for name, fn in GEN.items():
        pat = re.compile(r"(<!-- gen:%s -->)(.*?)(<!-- /gen:%s -->)" % (name, name), re.S)
        if not pat.search(text):
            sys.exit(f"marker gen:{name} missing in index.html")
        text = pat.sub(lambda m: m.group(1) + fn() + m.group(3), text)
    return text


if __name__ == "__main__":
    cur = PAGE.read_text(encoding="utf-8")
    new = render(cur)
    if "--check" in sys.argv:
        sys.exit(0 if new == cur else 1)
    PAGE.write_text(new, encoding="utf-8")
    print("index.html regenerated from data/indicators.json")
