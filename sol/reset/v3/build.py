#!/usr/bin/env python3
"""Build the extended IASC Stocktake and synchronize assistant evidence records.

Canonical source: sol/reset/v3/data/indicators.json
Generated outputs: sol/reset/v3/index.html and indicator/discrepancy fields in sol/assistant/registry.json
"""
import copy
import html
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = json.loads((HERE / "data" / "indicators.json").read_text(encoding="utf-8"))
PAGE = HERE / "index.html"
REGISTRY = ROOT / "sol" / "assistant" / "registry.json"
SRC = DATA["sources"]
IND = {x["id"]: x for x in DATA["indicators"]}
E = html.escape
STATUS = {
    "completed": ("Completed", "Evidence confirms completion"),
    "ongoing": ("Ongoing", "Implementation is under way"),
    "planned": ("Planned", "Formally scheduled, not yet started or due"),
    "pending": ("Pending verification", "Reported status requires confirmation"),
    "notassessed": ("Not assessed", "No valid outcome assessment available"),
    "superseded": ("Superseded", "Replaced by a newer approved action"),
}
PILLAR = {"define":"Define","deliver":"Deliver","devolve":"Devolve","defend":"Defend","overview":"Overview"}

def badge(key):
    label, _ = STATUS[key]
    return f'<span class="st st-{key}"><svg class="sti" aria-hidden="true"><use href="#s-{key}"/></svg>{E(label)}</span>'

def src_label(i):
    s = SRC[i["source"]]
    return f'{E(s["short"])}, {E(i["source_section"])} · {E(s["version"])}'

def viz(i):
    if "dots" in i:
        on,total=i["dots"]
        cells="".join('<i class="on"></i>' if n<on else "<i></i>" for n in range(total))
        return f'<span class="dots" aria-hidden="true">{cells}</span>'
    if "share" in i:
        return f'<span class="mini" aria-hidden="true"><span class="f" style="--v:{i["share"]}%"></span></span>'
    return ""

def kpi(i,cat):
    if " | " in i["value"]:
        a,b=i["value"].split(" | ")
        value=f'<span class="v num">{E(a)} <span class="vs">|</span> {E(b)}</span><span class="pl2">excl. | incl. US Award Tranche I</span>'
    else:
        value=f'<span class="v num">{E(i["value"])}</span>'
    return (f'<li class="kpi"><p class="kcat">{E(cat)}</p>{value}{viz(i)}'
            f'<p class="kl2">{E(i["label"])}</p><p class="kc">{E(i["note"])}</p>'
            f'<p class="src"><span>{E(SRC[i["source"]]["short"])}, {E(i["source_section"])}</span>'
            f'<span class="tag">{E(i["status"]).upper()}</span><a href="#reg-{i["id"]}">Definition and base</a></p></li>')


SHORT_PAGE = ROOT / "sol" / "reset" / "index.html"

def gen_short_metrics():
    parts = []
    for card in DATA["short_metrics"]:
        i = IND[card["id"]]
        viz_data = card["viz"]
        if viz_data["type"] == "bar":
            viz_html = (f'<span class="mini" aria-hidden="true"><span class="f" style="--v:{viz_data["share"]}%"></span></span>'
                        f'<span class="cap">{E(viz_data["caption"])}</span>')
        elif viz_data["type"] == "spark":
            viz_html = ('<svg class="spark" viewBox="0 0 120 30" role="img" '
                        'aria-label="36% in 2024, 43% in 2025, 63% in accessible October source copies; 62% in site-cited 8 October record">'
                        '<polyline points="4,22.2 60,17.8 116,5.9" fill="none" stroke="#272E67" stroke-width="2"/>'
                        '<circle cx="4" cy="22.2" r="2.5" fill="#7C8490"/><circle cx="60" cy="17.8" r="2.5" fill="#7C8490"/>'
                        '<circle cx="116" cy="5.9" r="3.5" fill="#FF4D59"/></svg>'
                        f'<span class="chip">{E(viz_data["caption"])}</span>')
        elif viz_data["type"] == "comparison":
            viz_html = ('<span class="cols" role="img" aria-label="1.05 billion in 2024 compared with 4.53 billion in the site-cited 8 October source record">'
                        '<span style="height:7px;background:var(--context)"></span><span style="height:30px;background:var(--navy)"></span></span>'
                        f'<span class="chip">{E(viz_data["caption"])}</span>')
        elif viz_data["type"] == "dots":
            cells = "".join('<i class="on"></i>' if n < viz_data["on"] else "<i></i>" for n in range(viz_data["total"]))
            viz_html = f'<span class="dots" role="img" aria-label="{viz_data["on"]} of {viz_data["total"]} plans">{cells}</span><span class="cap">{E(viz_data["caption"])}</span>'
        else:
            raise ValueError("unknown short metric visualization: " + viz_data["type"])
        cls = "mcard hl" if card["id"] == "severity45" else "mcard"
        parts.append(
            f'<li class="{cls}"><span class="v num">{E(card["value"])}</span>'
            f'<span class="l">{E(card["label"])}</span><span class="viz">{viz_html}</span>'
            f'<span class="src">{E(card["source"])}</span></li>'
        )
    return "".join(parts)

def gen_short_notes():
    rows = []
    for discrepancy in DATA["discrepancies"]:
        source_items = []
        for item in discrepancy["values"]:
            source = SRC[item["source"]]
            source_items.append(f'<li><b>{E(source["short"])}</b>: {E(item["value"])}</li>')
        rows.append(
            f'<tr><th scope="row">{E(discrepancy["label"])}</th>'
            f'<td><ul class="note-sources">{"".join(source_items)}</ul></td>'
            f'<td><p>{E(discrepancy["explanation"])}</p>'
            f'<p><b>Do not infer:</b> {E(discrepancy["do_not"])}</p></td></tr>'
        )
    return "".join(rows)

def gen_kpis():
    return '<ul class="kpis">'+"".join(kpi(IND[k],g["title"]) for g in DATA["kpi_groups"] for k in g["ids"])+"</ul>"

def gen_register():
    rows=[]
    for i in DATA["indicators"]:
        rows.append(f'<tr id="reg-{i["id"]}"><th scope="row">{E(i["title"])}</th><td class="num">{E(i["value"].replace(" | "," / "))}</td>'
          f'<td>{E(i["denominator"])}</td><td>{E(i["period"])}</td><td>{E(i["definition"])}</td><td>{E(i["caveat"])}</td>'
          f'<td>{E(PILLAR[i["pillar"]])}</td><td>{src_label(i)}</td></tr>')
    return ('<div class="tscroll" tabindex="0" role="region" aria-label="Indicator register, scrollable"><table class="reg">'
      '<caption class="sr-only">Indicator register: every headline figure with its base, period, definition, caveat and source</caption>'
      '<thead><tr><th scope="col">Indicator</th><th scope="col">Value</th><th scope="col">Base</th><th scope="col">Period</th>'
      '<th scope="col">Definition</th><th scope="col">Read with care</th><th scope="col">Pillar</th><th scope="col">Source</th></tr></thead>'
      f'<tbody>{"".join(rows)}</tbody></table></div>')

def gen_roadmap():
    items=[]
    for m in DATA["milestones"]:
        ev=E(m["evidence"])
        sid=m.get("evidence_source")
        if sid:
            s=SRC[sid]
            if s.get("url"):
                ev+=f' <a href="{E(s["url"])}" rel="noopener noreferrer" target="_blank">{E(s["short"])}<span class="sr-only"> (opens in a new tab)</span></a>'
            else:
                ev+=f' <span>{E(s["short"])}</span>'
        items.append(f'<li class="ms ms-{m["status"]}"><div class="msd"><b class="num">{E(m["date"])}</b>{badge(m["status"])}</div>'
          f'<div class="msb"><p class="msw">{E(m["what"])}</p><dl><div><dt>Owner</dt><dd>{E(m["owner"])}</dd></div>'
          f'<div><dt>Evidence</dt><dd>{ev}</dd></div><div><dt>Qualification</dt><dd>{E(m["qualification"])}</dd></div></dl></div></li>')
    return f'<ol class="road">{"".join(items)}</ol>'

def gen_workstreams():
    rows="".join(f'<tr><th scope="row">{E(w["name"])}</th><td>{E(w["reported"])}</td><td>{badge(w["status"])}</td><td>{E(w["note"])}</td></tr>' for w in DATA["workstreams"])
    return ('<div class="tscroll" tabindex="0" role="region" aria-label="HWG workstreams, scrollable"><table class="reg ws">'
      '<caption class="sr-only">HWG workstreams: status reported in the presentation and status on this page</caption>'
      '<thead><tr><th scope="col">Workstream</th><th scope="col">Reported (presentation, slide 13)</th><th scope="col">Status on this page</th><th scope="col">Note</th></tr></thead>'
      f'<tbody>{rows}</tbody></table></div>')

def gen_asof():
    return E(DATA["as_of"])

GENERATORS={"kpis":gen_kpis,"register":gen_register,"roadmap":gen_roadmap,"workstreams":gen_workstreams,"asof":gen_asof,"short-metrics":gen_short_metrics,"short-notes":gen_short_notes}

def render_page(source):
    for name,generator in GENERATORS.items():
        pattern=re.compile(r"(<!-- gen:%s -->)(.*?)(<!-- /gen:%s -->)"%(name,name),re.S)
        if not pattern.search(source):
            raise ValueError(f"required generated marker gen:{name} is missing")
        source=pattern.sub(lambda m:m.group(1)+generator()+m.group(3),source)
    return source

def project_registry(registry):
    output=copy.deepcopy(registry)
    previous={x["id"]:x for x in output.get("indicators",[])}
    synchronized=[]
    for i in DATA["indicators"]:
        old=previous.get(i["id"],{})
        item=dict(old)
        item.update({
          "id":i["id"],
          "pillar":"overall" if i["pillar"]=="overview" else i["pillar"],
          "kind":i.get("assistant_kind",old.get("kind","process")),
          "title":i["title"],
          "aliases":i.get("assistant_aliases",old.get("aliases",[])),
          "value":i["value"],"denominator":i["denominator"],"period":i["period"],
          "definition":i["definition"],
          "sources":i.get("assistant_sources",old.get("sources",[i["source"]])),
          "status":i["status"],"caveat":i["caveat"]
        })
        synchronized.append(item)
    output["indicators"]=synchronized
    output["discrepancies"]=copy.deepcopy(DATA.get("discrepancies",[]))
    output["content_as_of"]=DATA["as_of"]
    output["generated"]=DATA.get("reviewed_at",output.get("generated"))
    output["_about"]=("Source-aware independent IASC learning assistant. Indicator facts and the discrepancy ledger "
      "are generated from /sol/reset/v3/data/indicators.json; update that file and run the Stocktake build "
      "to keep the assistant, Four Ds Explorer and extended indicator register aligned. "
      "Not an official IASC spokesperson or operational authority.")
    return output

def main():
    current_page=PAGE.read_text(encoding="utf-8")
    current_short=SHORT_PAGE.read_text(encoding="utf-8")
    rendered_page=render_page(current_page)
    rendered_short=render_page(current_short)
    current_registry=json.loads(REGISTRY.read_text(encoding="utf-8"))
    rendered_registry=project_registry(current_registry)
    if "--check" in sys.argv:
        stale=[]
        if rendered_page!=current_page: stale.append("extended Stocktake generated HTML")
        if rendered_short!=current_short: stale.append("short Stocktake generated metrics / source notes")
        if rendered_registry!=current_registry: stale.append("assistant registry indicators/discrepancies")
        if stale:
            print("STALE: "+", ".join(stale)+". Run python3 sol/reset/v3/build.py.")
            return 1
        print(f"OK: {len(DATA['indicators'])} canonical indicators and {len(DATA.get('discrepancies',[]))} discrepancies synchronized.")
        return 0
    PAGE.write_text(rendered_page,encoding="utf-8")
    SHORT_PAGE.write_text(rendered_short,encoding="utf-8")
    REGISTRY.write_text(json.dumps(rendered_registry,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Updated extended Stocktake and assistant registry from canonical data.")
    return 0

if __name__=="__main__":
    sys.exit(main())
