/*!
 * IASC Humanitarian Reset & Coordination Intelligence Assistant — v2
 * Contextual, source-aware learning companion for /sol/reset/overview/, /sol/reset/ and
 * /sol/reset/four-ds/.
 *
 * HONESTY NOTE: unless registry.json → backend.enabled is true AND the server endpoint
 * answers, there is NO language model behind this widget. Answers are templated renders of
 * registry.json, and the UI says "Demo mode" on every answer. With a backend enabled, the
 * server must return citation ids that exist in the registry; unknown ids are dropped here.
 *
 * Not an official IASC spokesperson, policy authority, operational decision-maker or endorsed
 * product. No conversation is stored or sent anywhere in demo mode. Registry text is treated
 * as data: it is always inserted with textContent, never as HTML.
 */
(function () {
  "use strict";
  if (window.__iascAssistantV2) return;
  window.__iascAssistantV2 = true;

  var SCRIPT = document.currentScript;
  var BASE = SCRIPT && SCRIPT.src ? SCRIPT.src.replace(/assistant\.js(\?.*)?$/, "") : "/sol/assistant/";
  var PAGE_CONTEXT = /\/overview\//.test(location.pathname) ? "overview" : "reset";
  var EXPLORER_URL = "/sol/reset/four-ds/";
  var MAX_INPUT = 600, RATE_MS = 60000; // per-minute caps: 30 local (demo), 10 live (matches server)

  var MODES = [
    { id: "ask", label: "Ask", hint: "Source-grounded answers to your questions." },
    { id: "explore", label: "Explore", hint: "Diagrams of the IASC structure and the four Ds — nothing invented." },
    { id: "learn", label: "Learn", hint: "Short lessons, glossary and knowledge checks." },
    { id: "simulate", label: "Simulate", hint: "A fictional branching scenario with a debrief. Not operational guidance." },
    { id: "find", label: "Find", hint: "Search and rank sources, with why each one is relevant." },
    { id: "compare", label: "Compare", hint: "Side-by-side figures, sources and pillars, without conflating them." },
    { id: "brief", label: "Brief", hint: "Source-traceable notes, FAQs, timelines. Not cleared official communications." }
  ];
  var CORE_STARTERS = [
    "Explain the IASC in five minutes.",
    "Explore how the IASC works.",
    "Explain the Humanitarian Reset and its four Ds.",
    "Explore stocktake figures and caveats.",
    "Start a fictional coordination scenario.",
    "Find an official document or source."
  ];
  var CONTEXT_STARTERS = {
    overview: ["What does the IASC do and not do?", "Members vs standing invitees?", "What are the humanitarian principles?", "What does the Secretariat do?", "Explain global vs country coordination.", "Where can I verify?"],
    reset: ["Explain the Reset in two minutes.", "Deliver — what does it show and not prove?", "Explain the source differences.", "Outcomes vs implementation — what's the evidence?", "Show next milestones.", "Explain key caveats."]
  };

  var S = {
    context: PAGE_CONTEXT, mode: "ask", reg: null, busy: false, sent: [],
    live: false, sim: null, cards: 0
  };
  var R; // registry shortcut

  /* ---------------- DOM helpers ---------------- */
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function byId(list, id) { for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i]; return null; }
  function src(id) { return byId(R.sources, id); }
  function uniq(a) { var o = []; (a || []).forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return o; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function fmtDate(d) { return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }

  /* ---------------- retrieval ---------------- */
  var STOP = "the a an and or of to in on for is are was were be what how why who which does do did with about this that it its as at by from me my i you your can tell explain show".split(" ");
  function toks(s) {
    return String(s || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9%$.\-\/\s]/g, " ").split(/\s+/)
      .filter(function (t) { return t && STOP.indexOf(t) < 0; });
  }
  function scoreTopic(q, qt, t) {
    var s = 0;
    (t.keywords || []).forEach(function (k) {
      if (k.indexOf(" ") > -1 || k.length > 4) { if (q.indexOf(k) > -1) s += k.indexOf(" ") > -1 ? 5 : 3; }
      else if (qt.indexOf(k) > -1) s += 3;
    });
    toks(t.title).forEach(function (w) { if (w.length > 3 && qt.indexOf(w) > -1) s += 1; });
    if (s > 0 && t.context === S.context) s += 2;
    return s;
  }
  function nums(q) { return (q.match(/\d+(?:\.\d+)?/g) || []); }
  function scoreDisc(q, qt, d) {
    var s = 0, ns = nums(q);
    d.keywords.forEach(function (k) {
      if (/^\d+(\.\d+)?$/.test(k)) { if (ns.indexOf(k) > -1) s += 2; }
      else if (k.length > 3 ? q.indexOf(k) > -1 : qt.indexOf(k) > -1) s += 2;
    });
    if (/\b(vs|versus|differ|difference|discrepanc|conflict|disagree|why .*\d)/.test(q)) s += 3;
    return s;
  }
  function glossaryHit(q) {
    var m = q.match(/^(?:what (?:is|are|does)|define|meaning of|who (?:is|are))\s+(?:an?\s+|the\s+)?([a-z0-9 \-–]+?)\??$/);
    var term = (m ? m[1] : q.replace(/\?$/, "")).trim();
    for (var i = 0; i < R.glossary.length; i++) {
      var g = R.glossary[i], gt = g.term.toLowerCase();
      if (term === gt || term === gt + "s" || (term.length <= 6 && term === gt.split(" ")[0])) return g;
    }
    return null;
  }
  function route(query) {
    var q = query.toLowerCase().replace(/[–—]/g, "-"), qt = toks(q);
    var gl = glossaryHit(q); if (gl && gl.term.length <= 16 && q.length < 40) return { type: "glossary", data: gl };
    if (/milestone|deadline|timeline|due|next steps|upcoming/.test(q)) return { type: "milestones" };
    var best = null, bs = 0;
    R.topics.forEach(function (t) { var s = scoreTopic(q, qt, t); if (s > bs) { bs = s; best = { type: "topic", data: t }; } });
    var bd = null, bds = 0;
    R.discrepancies.forEach(function (d) { var s = scoreDisc(q, qt, d); if (s > bds) { bds = s; bd = d; } });
    if (bd && bds >= 5 && bds >= bs) return { type: "discrepancy", data: bd };
    if (/source differences|where .* differ|documents differ/.test(q)) return { type: "discrepancies" };
    var bi = null, bis = 0;
    R.indicators.forEach(function (i) {
      var s = 0; toks(i.title + " " + i.value + " " + i.definition).forEach(function (w) { if (w.length > 2 && qt.indexOf(w) > -1) s += 1; });
      if (q.indexOf(i.value.toLowerCase().split(" ")[0]) > -1) s += 3;
      (i.aliases || []).forEach(function (a) { if (q.indexOf(a) > -1) s += 4; });
      if (s >= 4 && /how (many|much)|what (was|is) the|total|figure|number|share|percent|rate|funded/.test(q)) s += 3;
      if (s > bis) { bis = s; bi = i; }
    });
    if (bi && bis >= 4 && bis > bs) return { type: "indicator", data: bi };
    if (best && bs >= 3) return best;
    if (gl) return { type: "glossary", data: gl };
    if (bd && bds >= 4) return { type: "discrepancy", data: bd };
    if (bi && bis >= 3) return { type: "indicator", data: bi };
    return { type: "none" };
  }

  /* ---------------- milestone date logic ---------------- */
  function milestoneStatus(m) {
    var due = new Date(m.due + "T23:59:59"), now = today();
    if (m.completed_evidence) return { label: "Held / completed", tone: "ok", why: "Evidence: " + src(m.completed_evidence).title };
    if (due < now) return { label: "Past due — status unconfirmed", tone: "warn", why: "Due " + m.label + "; no record of completion in the registry." };
    var days = Math.round((due - now) / 864e5);
    if (days <= 60) return { label: "Due soon (" + days + " days)", tone: "soon", why: "" };
    return { label: "Upcoming", tone: "", why: "" };
  }

  /* ---------------- rendering: sources ---------------- */
  function tierLabel(t) { return { 1: "Tier 1 · official IASC", 2: "Tier 2 · official UN/humanitarian", 3: "Tier 3 · independent/secondary", 4: "Tier 4 · inference/hypothetical" }[t] || "Tier " + t; }
  function sourceItem(s) {
    var meta = [s.issuer, s.date, s.version].filter(Boolean).join(" · ");
    var status = s.status + (s.clearance ? " — " + s.clearance : "");
    var links = h("div", { class: "ia-m" });
    if (s.url) {
      var ext = /^https?:/.test(s.url);
      links.appendChild(h("a", { href: s.url, target: ext ? "_blank" : null, rel: ext ? "noopener noreferrer" : null, text: ext ? "Open source ↗" : "Go to section" }));
    } else {
      links.appendChild(document.createTextNode("Original not publicly available. "));
      var via = s.via && src(s.via);
      if (via) { links.appendChild(document.createTextNode("Read via ")); links.appendChild(h("a", { href: via.url, text: via.title })); }
    }
    return h("div", { class: "ia-src" }, [
      h("div", null, [h("span", { class: "ia-t", text: s.title }), h("span", { class: "ia-tier t" + s.tier, text: tierLabel(s.tier) })]),
      h("div", { class: "ia-m", text: meta }),
      h("div", { class: "ia-m", text: "Status: " + status + (s.last_checked ? " · last checked " + s.last_checked : "") }),
      s.note ? h("div", { class: "ia-m", text: s.note }) : null,
      links
    ]);
  }
  function sourcesDrawer(ids, open) {
    ids = uniq(ids).filter(src);
    if (!ids.length) return null;
    var originals = ids.filter(function (i) { return src(i).kind !== "page"; });
    var allUnpublished = originals.length && originals.every(function (i) { return !src(i).url; });
    var d = h("details", { class: "ia-sources", open: open || null }, [h("summary", { text: "Sources (" + ids.length + ")" })]);
    if (allUnpublished) d.appendChild(h("p", { class: "ia-note", text: "The original documents are unpublished drafts, so this answer relies on the independent page's reproduction of them." }));
    ids.forEach(function (i) { d.appendChild(sourceItem(src(i))); });
    return d;
  }

  /* ---------------- rendering: cards ---------------- */
  var logEl, inputEl, sendBtn, panelEl, launcherEl, modeHintEl, subEl, liveBadge;

  function scroll(el) { if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); else logEl.scrollTop = logEl.scrollHeight; }
  function addUser(text) { var n = h("div", { class: "ia-msg ia-user", text: text }); logEl.appendChild(n); scroll(n); }
  function addDivider(text) { var n = h("div", { class: "ia-divider", role: "note", text: text }); logEl.appendChild(n); scroll(n); }

  function table(t) {
    var head = h("tr", null, t.headers.map(function (x) { return h("th", { scope: "col", text: x }); }));
    var body = h("tbody", null, t.rows.map(function (r) { return h("tr", null, r.map(function (c) { return h("td", { text: c }); })); }));
    return h("div", { class: "ia-tblwrap" }, [h("table", { class: "ia-tbl" }, [t.caption ? h("caption", { class: "ia-sr", text: t.caption }) : null, h("thead", null, [head]), body])]);
  }
  function caveat(text) { return h("div", { class: "ia-caveat" }, [h("span", { "aria-hidden": "true", text: "⚠" }), h("span", null, [h("b", { text: "Caveat: " }), text])]); }

  /* A card is built from a plain "answer" object so the same object drives copy/export. */
  function card(a) {
    S.cards++;
    var c = h("article", { class: "ia-card", "aria-label": a.title || "Answer" });
    c.appendChild(h("span", { class: "ia-kind" + (a.fiction ? " ia-fiction" : ""), text: a.kind || "Answer" }));
    if (a.title) c.appendChild(h("h4", { text: a.title }));
    var bodyWrap = h("div");
    c.appendChild(bodyWrap);
    function paint() {
      bodyWrap.textContent = "";
      var text = a.levels ? a.levels[a.level] : a.text;
      if (a.levels) bodyWrap.appendChild(h("p", { class: "ia-note", text: { plain: "Plain-language synthesis of the sources below.", detail: "Summary of what the sources state.", technical: "Technical reading — includes labelled interpretation." }[a.level] }));
      if (text) String(text).split("\n").forEach(function (para) { bodyWrap.appendChild(h("p", { text: para })); });
      if (a.points && a.level !== "plain") bodyWrap.appendChild(h("ul", { class: "ia-points" }, a.points.map(function (p) { return h("li", { text: p }); })));
      if (a.kv) bodyWrap.appendChild(h("dl", { class: "ia-kv" }, [].concat.apply([], a.kv.map(function (p) { return [h("dt", { text: p[0] }), h("dd", { text: p[1] })]; }))));
      if (a.table) bodyWrap.appendChild(table(a.table));
      if (a.node) bodyWrap.appendChild(a.node);
      if (a.evidenceOpen && a.evidence) bodyWrap.appendChild(a.evidence());
    }
    paint();
    if (a.levels) {
      var depth = h("div", { class: "ia-depth", role: "group", "aria-label": "Answer depth and evidence" });
      [["plain", "Explain simply"], ["detail", "More detail"], ["technical", "Technical"]].forEach(function (lv) {
        depth.appendChild(h("button", { type: "button", "aria-pressed": String(a.level === lv[0]), text: lv[1], onclick: function () {
          a.level = lv[0]; Array.prototype.forEach.call(depth.querySelectorAll("[data-lv]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-lv") === a.level)); }); paint();
        }, "data-lv": lv[0] }));
      });
      depth.appendChild(h("button", { type: "button", text: "Show evidence", onclick: function () {
        var det = c.querySelector(".ia-sources"); if (det) det.open = true;
        if (a.evidence && !a.evidenceOpen) { a.evidenceOpen = true; paint(); }
        if (det) det.scrollIntoView({ block: "nearest" });
      } }));
      if (a.compare) depth.appendChild(h("button", { type: "button", text: "Compare", onclick: a.compare }));
      c.appendChild(depth);
    }
    if (a.caveat) c.appendChild(caveat(a.caveat));
    if (a.choices) {
      var cw = h("div", { class: "ia-choices", role: "group", "aria-label": "Choose an option" });
      a.choices.forEach(function (ch) {
        cw.appendChild(h("button", { type: "button", text: ch.text, onclick: function (e) {
          Array.prototype.forEach.call(cw.querySelectorAll("button"), function (b) { b.disabled = true; });
          e.currentTarget.classList.add("ia-picked"); e.currentTarget.setAttribute("aria-pressed", "true");
          ch.onClick();
        } }));
      });
      c.appendChild(cw);
    }
    var drawer = sourcesDrawer(a.sources, a.openSources);
    if (drawer) c.appendChild(drawer);
    if (a.followups && a.followups.length) {
      c.appendChild(h("div", { class: "ia-label", text: "Next exploration" }));
      c.appendChild(h("div", { class: "ia-chips ia-row" }, a.followups.map(function (f) {
        return typeof f === "string" ? h("button", { type: "button", class: "ia-chip", text: f, onclick: function () { ask(f); } })
          : h("button", { type: "button", class: "ia-chip", text: f.label, onclick: f.onClick });
      })));
    }
    var acts = h("div", { class: "ia-actions" });
    acts.appendChild(h("button", { type: "button", text: "Copy with citations", onclick: function () { copyAnswer(a, acts); } }));
    acts.appendChild(h("button", { type: "button", text: "Download .md", onclick: function () { exportAnswer(a); } }));
    acts.appendChild(h("button", { type: "button", "aria-label": "Helpful", text: "Helpful", onclick: function () { note(acts, "Thanks. Feedback stays in this browser tab; nothing is sent."); } }));
    acts.appendChild(h("button", { type: "button", "aria-label": "Not helpful", text: "Not helpful", onclick: function () { note(acts, "Noted locally. Try “More detail”, another mode, or Find."); } }));
    acts.appendChild(h("span", { class: "ia-status", text: S.live && a.liveAnswer ? "Live AI · citations checked against registry" : "Demo mode · registry answer, no AI" }));
    c.appendChild(acts);
    var wrap = h("div", { class: "ia-msg" }, [c]);
    logEl.appendChild(wrap); scroll(wrap);
    return c;
  }
  function note(where, text) { var old = where.querySelector(".ia-flash"); if (old) old.remove(); where.appendChild(h("span", { class: "ia-status ia-flash", role: "status", text: text })); }

  function plainText(a) {
    var L = [];
    if (a.fiction) L.push(R.simulation.label);
    if (a.title) L.push(a.title, "");
    if (a.levels) L.push(a.levels[a.level]); else if (a.text) L.push(a.text);
    (a.points || []).forEach(function (p) { L.push("- " + p); });
    (a.kv || []).forEach(function (p) { L.push(p[0] + ": " + p[1]); });
    if (a.table) { L.push(""); L.push(a.table.headers.join(" | ")); a.table.rows.forEach(function (r) { L.push(r.join(" | ")); }); }
    if (a.caveat) L.push("", "Caveat: " + a.caveat);
    var ids = uniq(a.sources).filter(src);
    if (ids.length) {
      L.push("", "Sources:");
      ids.forEach(function (i) {
        var s = src(i), u = s.url ? (/^https?:/.test(s.url) ? s.url : location.origin + s.url) : "not publicly available";
        L.push("- " + s.title + " — " + s.issuer + ", " + s.date + " (" + s.version + "). Status: " + s.status + (s.clearance ? ", " + s.clearance : "") + ". " + tierLabel(s.tier) + ". " + u);
      });
    }
    L.push("", "Generated by an independent learning assistant (" + (S.live && a.liveAnswer ? "live AI" : "demo mode, no AI") + ") on " + fmtDate(new Date()) + ". Not an official IASC communication.");
    return L.join("\n");
  }
  function copyAnswer(a, acts) {
    var t = plainText(a);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(function () { note(acts, "Copied, with citations."); }, function () { note(acts, "Copy blocked by the browser — use Download .md."); });
    else note(acts, "Copy unavailable here — use Download .md.");
  }
  function exportAnswer(a) {
    var blob = new Blob([plainText(a).replace(/^(.+)\n\n/, "# $1\n\n")], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob), link = h("a", { href: url, download: "iasc-assistant-" + (a.title || "answer").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".md" });
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- answer builders ---------------- */
  function indicatorRows(ids) {
    return { headers: ["Indicator", "Value", "Denominator / base", "Period", "Status"], caption: "Indicators with period, denominator and status",
      rows: ids.map(function (i) { var x = byId(R.indicators, i); return [x.title, x.value, x.denominator, x.period, x.status]; }) };
  }
  function topicDiscrepancies(t) {
    var p = byId(R.pillars, t.id); if (p) return p.discrepancies;
    if (t.id === "reset-2min" || t.id === "outcomes") return ["reach-framing"];
    if (t.id === "caveats") return R.discrepancies.map(function (d) { return d.id; });
    return [];
  }
  function answerTopic(t, level) {
    var p = byId(R.pillars, t.id);
    var a = { kind: t.context === "overview" ? "Overview · grounded answer" : "Reset · grounded answer", title: t.title,
      levels: { plain: t.plain, detail: t.detail, technical: t.technical }, level: level || "detail",
      points: t.points, caveat: t.caveat, sources: t.sources, followups: t.followups.slice() };
    if (t.table) a.table = t.table;
    if (t.diagram === "structure") a.node = structureDiagram();
    if (t.diagram === "fourds") { a.node = fourDsDiagram(); a.followups.push({ label: "Open the Four Ds Explorer ↗", onClick: function () { location.href = EXPLORER_URL; } }); }
    if (p && p.indicators.length) a.evidence = function () { return table(indicatorRows(p.indicators)); };
    var disc = topicDiscrepancies(t);
    if (disc.length) a.compare = function () { disc.forEach(function (d) { answerDiscrepancy(byId(R.discrepancies, d)); }); };
    else a.compare = function () { setMode("compare"); answerCompareMenu(); };
    if (t.id === "reset-2min" || t.id === "caveats") a.evidence = function () { return table(indicatorRows(["reached", "severity45", "gho", "cbpf", "local"])); };
    card(a);
  }
  function answerIndicator(x) {
    var related = R.discrepancies.filter(function (d) { return d.keywords.some(function (k) { return x.value.indexOf(k) > -1; }); });
    card({ kind: "Figure · as reported", title: x.title,
      text: x.value + " — " + x.period + ".", kv: [["Denominator / base", x.denominator], ["Definition", x.definition], ["Type of measure", x.kind], ["Status", x.status], ["Pillar", x.pillar]],
      caveat: x.caveat, sources: x.sources,
      followups: related.map(function (d) { return { label: "Compare: " + d.label, onClick: function () { answerDiscrepancy(d); } }; }).concat(["Outcomes vs implementation — what's the evidence?"]) });
  }
  function answerDiscrepancy(d) {
    card({ kind: "Source conflict · preserved, not resolved", title: d.label,
      text: d.explanation,
      table: { headers: ["Source", "Reported value"], caption: "Values reported by each source", rows: d.values.map(function (v) { return [src(v.source).title + " (" + src(v.source).status + ")", v.value]; }) },
      caveat: "Do not " + d.do_not.charAt(0).toLowerCase() + d.do_not.slice(1),
      sources: d.sources, followups: ["Explain the source differences.", "Explain key caveats."] });
  }
  function answerAllDiscrepancies() {
    card({ kind: "Source conflicts · preserved", title: "Where the Stocktake and the presentation differ",
      text: "The Reset page follows the Stocktake, the more detailed document, but keeps each difference visible. Both documents are drafts pending clearance.",
      table: { headers: ["Figure", "What differs"], rows: R.discrepancies.map(function (d) { return [d.label, d.values.map(function (v) { return src(v.source).title.replace("Humanitarian Reset: ", "") + ": " + v.value; }).join(" / ")]; }) },
      caveat: "Differences in period, definition and denominator are the usual cause; the sources do not explain every gap.",
      sources: ["stocktake", "presentation", "rs-notes"],
      followups: R.discrepancies.map(function (d) { return { label: d.label, onClick: function () { answerDiscrepancy(d); } }; }) });
  }
  function answerGlossary(g) {
    card({ kind: "Glossary", title: g.term, text: g.def, sources: g.sources, followups: ["Explore how the IASC works.", "Explain the Humanitarian Reset and its four Ds."] });
  }
  function answerMilestones() {
    var now = today();
    card({ kind: "Milestones · status computed for today", title: "Milestones as of " + fmtDate(now),
      text: "Statuses are recalculated from each milestone's due date and the evidence on file — past-due items are never repeated in the future tense.",
      table: { headers: ["Due", "Milestone", "Status today", "Note"], caption: "Milestones with computed status",
        rows: R.milestones.map(function (m) { var st = milestoneStatus(m); return [m.label, m.what, st.label, (st.why ? st.why + " " : "") + m.note]; }) },
      caveat: "No milestone here is confirmed complete by an IASC record. Check with the IASC Secretariat for current status.",
      sources: uniq([].concat.apply([], R.milestones.map(function (m) { return m.sources.concat(m.completed_evidence ? [m.completed_evidence] : []); }))),
      followups: ["What's underway and what's next?", "Outcomes vs implementation — what's the evidence?"] });
  }
  function noEvidence(q) {
    var sug = CONTEXT_STARTERS[S.context].slice(0, 4);
    card({ kind: "No evidence found", title: "Not covered by the sources on file",
      text: "I can't find this in the registry of sources behind these pages, so I won't guess. In demo mode I can only answer from that registry.",
      caveat: "Absence here means the sources on file don't cover it — not that the answer is 'no'.",
      followups: sug.concat([{ label: "Search sources (Find)", onClick: function () { setMode("find"); answerFind(q); } }]) });
  }

  /* ---------------- diagrams (accessible HTML, not images) ---------------- */
  function structureDiagram() {
    var st = R.structure;
    function node(n, cls) { return h("div", { class: "ia-node " + (cls || "") }, [h("b", { text: n.name }), h("span", { text: n.note })]); }
    return h("div", { role: "figure", "aria-label": "IASC structure diagram, from the Secretariat's structure page as summarized on the Overview page" }, [
      h("ul", { class: "ia-org" }, [
        h("li", null, [node(st.top, "ia-top")]), h("li", { class: "ia-link", "aria-hidden": "true" }),
        h("li", null, [h("span", { class: "ia-sr", text: "Reporting to the Principals:" }), h("ul", { class: "ia-three" }, st.reporting.map(function (n) { return h("li", null, [node(n)]); }))]),
        h("li", { class: "ia-link", "aria-hidden": "true" }),
        h("li", null, [h("span", { class: "ia-sr", text: "Below OPAG:" }), node(st.below_opag)]),
        h("li", { class: "ia-link", "aria-hidden": "true" }),
        h("li", null, [node(st.secretariat, "ia-sec")])
      ]),
      h("p", { class: "ia-note", text: "Lines show the order on the Overview page, not formal reporting lines beyond what it states. The Secretariat connects all bodies." })
    ]);
  }
  function fourDsDiagram() {
    return h("div", { class: "ia-4d", role: "group", "aria-label": "The four Ds — select one for details" }, R.pillars.map(function (p) {
      var first = p.indicators[0] && byId(R.indicators, p.indicators[0]);
      return h("button", { type: "button", onclick: function () { answerTopic(byId(R.topics, p.id)); } }, [
        h("span", { class: "ia-n", text: p.number }), h("b", { text: p.title }), h("span", { text: p.short }),
        h("span", { class: "ia-note", text: first ? " " + first.value + " — " + first.title : " Qualitative only" })
      ]);
    }));
  }

  /* ---------------- modes ---------------- */
  function answerExplore(q) {
    var ql = (q || "").toLowerCase();
    if (/four ?d|pillar|reset|define|deliver|devolve|defend/.test(ql) || (!/structure|iasc|secretariat|opag|edg/.test(ql) && S.context === "reset")) answerTopic(byId(R.topics, "four-ds"));
    else answerTopic(byId(R.topics, "iasc-structure"));
  }
  function answerLearnMenu() {
    var ls = R.lessons.slice().sort(function (a, b) { return (a.context === S.context ? 0 : 1) - (b.context === S.context ? 0 : 1); });
    card({ kind: "Learn", title: "Short lessons with a knowledge check",
      text: "Pick a lesson. Each ends with one question and an explanation, so you can check your understanding rather than memorize.",
      followups: ls.map(function (l) { return { label: l.title + " (" + l.minutes + " min)", onClick: function () { runLesson(l); } }; })
        .concat([{ label: "Browse the glossary", onClick: answerGlossaryList }]) });
  }
  function answerGlossaryList() {
    card({ kind: "Glossary", title: "Terms used on both pages", table: { headers: ["Term", "Meaning"], rows: R.glossary.map(function (g) { return [g.term, g.def]; }) },
      sources: uniq([].concat.apply([], R.glossary.map(function (g) { return g.sources; }))) });
  }
  function runLesson(l) {
    card({ kind: "Lesson", title: l.title, points: l.steps, level: "detail", text: "", sources: l.sources });
    var c = card({ kind: "Knowledge check", title: l.check.q,
      choices: l.check.options.map(function (o) { return { text: o.text, onClick: function () {
        card({ kind: o.correct ? "Correct" : "Not quite", text: o.why, sources: l.sources,
          followups: [{ label: "Another lesson", onClick: answerLearnMenu }] });
      } }; }) });
    return c;
  }
  function answerFind(q) {
    var qt = toks(q || ""), list = R.sources.map(function (s) {
      var hay = toks([s.title, s.issuer, s.note, s.format, s.context].join(" ")), sc = 0, why = [];
      qt.forEach(function (t) { if (t.length > 2 && hay.indexOf(t) > -1) { sc += 2; if (why.length < 3) why.push(t); } });
      if (s.context === S.context) sc += 1;
      return { s: s, score: sc, why: why };
    }).filter(function (x) { return !qt.length || x.score > 1; });
    if (!list.length) list = R.sources.filter(function (s) { return s.kind !== "page"; }).map(function (s) { return { s: s, score: 0, why: [] }; });
    list.sort(function (a, b) { return a.s.tier - b.s.tier || b.score - a.score; });
    list = list.slice(0, 10);
    card({ kind: "Find · ranked sources", title: qt.length ? "Sources matching “" + q + "”" : "Sources on file",
      text: "Ranked by evidence tier (official first), then by relevance to your words and the current page.",
      table: { headers: ["Source", "Tier", "Status", "Why it's listed"], caption: "Ranked sources",
        rows: list.map(function (x) { return [x.s.title, String(x.s.tier), x.s.status + (x.s.clearance ? " — " + x.s.clearance : ""), x.why.length ? "Matches: " + x.why.join(", ") : (x.s.context === S.context ? "Source for this page" : "Related page")]; }) },
      caveat: "Tier 3 entries are sections of the independent pages; prefer Tier 1–2 originals where they are public.",
      sources: list.map(function (x) { return x.s.id; }), openSources: true });
  }
  function answerCompareMenu() {
    card({ kind: "Compare", title: "What would you like to compare?",
      text: "Comparisons keep each figure's source, period, definition and denominator separate.",
      followups: R.discrepancies.map(function (d) { return { label: d.label, onClick: function () { answerDiscrepancy(d); } }; })
        .concat([{ label: "The four pillars side by side", onClick: answerPillarCompare }, { label: "Members vs standing invitees", onClick: function () { answerTopic(byId(R.topics, "iasc-community")); } }]) });
  }
  function answerPillarCompare() {
    card({ kind: "Compare · pillars", title: "The four Ds side by side",
      table: { headers: ["Pillar", "Headline", "Indicators on file", "Main caveat"], rows: R.pillars.map(function (p) { return [p.number + " " + p.title, p.headline, p.indicators.length ? String(p.indicators.length) : "None (qualitative)", p.caveat]; }) },
      caveat: "Indicators measure different things across pillars (process, outputs, reach, perception). Do not rank pillars by these numbers.",
      sources: ["stocktake", "rs-define", "rs-deliver", "rs-devolve", "rs-defend"],
      followups: [{ label: "Open the Four Ds Explorer ↗", onClick: function () { location.href = EXPLORER_URL; } }] });
  }
  function answerCompare(q) {
    var ql = q.toLowerCase();
    if (/pillar|four ?d/.test(ql)) return answerPillarCompare();
    if (/member|invitee/.test(ql)) return answerTopic(byId(R.topics, "iasc-community"));
    var r = route(q);
    if (r.type === "discrepancy") return answerDiscrepancy(r.data);
    var qt = toks(ql), best = null, bs = 0;
    R.discrepancies.forEach(function (d) { var s = scoreDisc(ql, qt, d); if (s > bs) { bs = s; best = d; } });
    if (best && bs >= 2) return answerDiscrepancy(best);
    answerCompareMenu();
  }
  function answerBrief(q) {
    var ql = (q || "").toLowerCase(), r = route(q);
    var label = "Not a cleared official communication — study notes generated from the registry, for learning.";
    if (/timeline|milestone/.test(ql)) return answerMilestones();
    if (/faq/.test(ql)) {
      var ts = R.topics.filter(function (t) { return t.context === S.context; }).slice(0, 6);
      return card({ kind: "Brief · FAQ", title: (S.context === "overview" ? "IASC" : "Humanitarian Reset") + " — FAQ",
        text: ts.map(function (t) { return "Q: " + t.title + "\nA: " + t.plain; }).join("\n"), caveat: label,
        sources: uniq([].concat.apply([], ts.map(function (t) { return t.sources; }))) });
    }
    var t = r.type === "topic" ? r.data : byId(R.topics, S.context === "overview" ? "iasc-what" : "reset-2min");
    var p = byId(R.pillars, t.id);
    card({ kind: "Brief · study note", title: "Study note: " + t.title,
      text: "Summary: " + t.plain + "\nKey source statements: " + t.detail + (t.caveat ? "\nInterpretation and limits: " + t.caveat : ""),
      points: t.points, level: "detail",
      table: p && p.indicators.length ? indicatorRows(p.indicators) : null,
      caveat: label, sources: t.sources, followups: ["Brief: FAQ", "Brief: timeline"] });
  }

  /* Simulation: branching, evolving information, reasoning feedback, rubric debrief. */
  function startSim() {
    var sim = R.simulation;
    S.sim = { path: [], signals: {} };
    card({ kind: sim.label, fiction: true, title: sim.title, text: sim.setting + "\n" + sim.role_limits,
      points: sim.objectives.map(function (o) { return "Objective: " + o; }), level: "detail",
      caveat: "Fictional learning scenario — not operational guidance. Real situations go to approved procedures, accountable leadership and qualified personnel." });
    simStep(byId(sim.steps, sim.start));
  }
  function simStep(step) {
    var prev = S.sim.path.length ? S.sim.path[S.sim.path.length - 1].choice : null;
    var extra = step.context_by_previous && prev ? "\nBecause of your last choice: " + step.context_by_previous[prev] : "";
    card({ kind: R.simulation.label, fiction: true, title: step.title, text: step.prompt + extra + "\nWhat you don't know: " + step.uncertainty,
      choices: step.choices.map(function (ch) { return { text: ch.text, onClick: function () {
        S.sim.path.push({ step: step.id, choice: ch.id, text: ch.text });
        for (var k in ch.signals) S.sim.signals[k] = (S.sim.signals[k] || 0) + ch.signals[k];
        card({ kind: "Reasoning feedback", fiction: true, text: ch.feedback,
          followups: ch.next === "end" ? [{ label: "See the debrief", onClick: simDebrief }] : [{ label: "Continue the scenario", onClick: function () { simStep(byId(R.simulation.steps, ch.next)); } }] });
      } }; }) });
  }
  function simDebrief() {
    var sig = S.sim.signals;
    function read(v) { return v == null ? "Not tested by your path" : v >= 2 ? "Strongly considered" : v >= 0 ? "Partly considered — trade-offs visible" : "Under-weighted in your choices"; }
    card({ kind: "Debrief", fiction: true, title: "Debrief: your reasoning, not a score",
      text: "There was no single correct path. Each option traded speed, accuracy, inclusion and principle differently. The rubric reflects which considerations your choices emphasized.",
      table: { headers: ["Dimension", "Your path", "Reflect"], rows: R.simulation.rubric.map(function (r) {
        return [r.label, r.id === "reasoning" ? "Self-assessed" : read(sig[r.id]), r.question]; }) },
      points: S.sim.path.map(function (p, i) { return "Step " + (i + 1) + ": " + p.text; }), level: "detail",
      caveat: "FICTIONAL LEARNING SCENARIO — NOT OPERATIONAL GUIDANCE. Nothing here describes real procedures or authorities.",
      followups: [{ label: "Replay the scenario", onClick: startSim }, "Deliver — what does it show and not prove?", "What are the humanitarian principles?"] });
  }

  /* ---------------- starters & dispatch ---------------- */
  function starter(text) {
    var t = text.toLowerCase();
    if (/five minutes/.test(t)) { if (S.mode === "learn") return runLesson(byId(R.lessons, "l-iasc")), true; return answerTopic(byId(R.topics, "iasc-what")), true; }
    if (/^explore how the iasc works/.test(t)) return answerTopic(byId(R.topics, "iasc-structure")), true;
    if (/reset and its four ds|explain the four ds/.test(t)) return answerTopic(byId(R.topics, "four-ds")), true;
    if (/stocktake figures and caveats/.test(t)) {
      card({ kind: "Reset · figures with caveats", title: "Headline stocktake figures",
        text: "Each figure keeps its period, base and status. All are from draft documents pending clearance.",
        table: indicatorRows(["reached", "severe41", "severity45", "gho", "cbpf", "clusters", "transition", "local"]),
        caveat: "62% (Stocktake) vs 55% (presentation); $4.53bn (2 Oct) vs ~$4.49bn (end Sept); local share 55% or 20% depending on the US award. Reach and allocations are not outcomes.",
        sources: ["stocktake", "presentation", "rs-key", "rs-notes"], followups: ["Explain the source differences.", "Outcomes vs implementation — what's the evidence?", "Compare 100M vs 66M vs 41M."] });
      return true;
    }
    if (/fictional coordination scenario/.test(t)) { setMode("simulate"); startSim(); return true; }
    if (/find an official document/.test(t)) { setMode("find"); answerFind(""); return true; }
    if (/^brief: faq/.test(t)) { answerBrief("faq"); return true; }
    if (/^brief: timeline|show next milestones/.test(t)) { answerMilestones(); return true; }
    if (/source differences/.test(t)) { answerAllDiscrepancies(); return true; }
    return false;
  }
  function answerLocal(q) {
    if (starter(q)) return;
    if (S.mode === "simulate") return startSim();
    if (S.mode === "learn") { var g = glossaryHit(q.toLowerCase()); return g ? answerGlossary(g) : answerLearnMenu(); }
    if (S.mode === "explore") return answerExplore(q);
    if (S.mode === "find") return answerFind(q);
    if (S.mode === "compare") return answerCompare(q);
    if (S.mode === "brief") return answerBrief(q);
    var r = route(q);
    if (r.type === "topic") return answerTopic(r.data);
    if (r.type === "discrepancy") return answerDiscrepancy(r.data);
    if (r.type === "discrepancies") return answerAllDiscrepancies();
    if (r.type === "indicator") return answerIndicator(r.data);
    if (r.type === "glossary") return answerGlossary(r.data);
    if (r.type === "milestones") return answerMilestones();
    noEvidence(q);
  }

  /* Optional live backend: only when registry.backend.enabled. Unknown citation ids are dropped. */
  function answerLive(q) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    return fetch(R.backend.endpoint, { method: "POST", credentials: "omit", headers: { "content-type": "application/json" }, signal: ctrl && ctrl.signal,
      body: JSON.stringify({ query: q, mode: S.mode, context: S.context }) })
      .then(function (r) {
        clearTimeout(timer);
        if (r.status === 429) throw { rate: true };
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        var ids = uniq(j.citations).filter(src), dropped = (j.citations || []).length - ids.length;
        if (j.no_evidence) return noEvidence(q);
        card({ kind: "Live AI answer · " + S.context, liveAnswer: true, text: String(j.answer || ""),
          caveat: [j.caveat, dropped > 0 ? dropped + " citation(s) not in the registry were removed." : null, !ids.length ? "No registry source supports this answer — treat it as Tier 4 (unsupported)." : null].filter(Boolean).join(" ") || null,
          sources: ids, followups: CONTEXT_STARTERS[S.context].slice(0, 3) });
      });
  }

  function rateLimited() {
    var now = Date.now();
    S.sent = S.sent.filter(function (t) { return now - t < RATE_MS; });
    if (S.sent.length >= (S.live ? 10 : 30)) return true;
    S.sent.push(now); return false;
  }
  function ask(text) {
    text = String(text || "").trim().slice(0, MAX_INPUT);
    if (!text || S.busy) return;
    addUser(text);
    if (rateLimited()) { card({ kind: "Slow down", text: "That's a lot of questions in a minute. Please wait a moment and try again.", caveat: null }); return; }
    if (/\b\d{6,}\b|@[a-z0-9-]+\.[a-z]{2,}|\+\d{7,}/i.test(text)) {
      card({ kind: "Privacy", text: "Your message looks like it may contain an ID number, email or phone number. Please don't enter personal or sensitive data. In demo mode nothing leaves your browser, but avoid it regardless.", caveat: null });
    }
    S.busy = true; sendBtn.disabled = true;
    var loading = h("div", { class: "ia-loading", role: "status", text: S.live ? "Checking sources and asking the live service…" : "Searching the source registry…" });
    logEl.appendChild(loading); scroll(loading);
    var done = function () { loading.remove(); S.busy = false; sendBtn.disabled = false; };
    if (S.live && S.mode === "ask" && !starter_isLocal(text)) {
      answerLive(text).then(done, function (err) {
        done();
        if (err && err.rate) card({ kind: "Rate limited", text: "The live service is busy. Here is the registry answer instead.", caveat: null });
        else card({ kind: "Live service unavailable", text: navigator.onLine === false ? "You appear to be offline. Showing the registry answer instead." : "The live service didn't respond. Showing the registry answer instead.", caveat: null });
        try { answerLocal(text); } catch (e) { retrievalFailed(e); }
      });
      return;
    }
    setTimeout(function () { done(); try { answerLocal(text); } catch (e) { retrievalFailed(e); } }, 180);
  }
  function starter_isLocal(t) { return CORE_STARTERS.indexOf(t) > -1 || /^brief: |show next milestones|source differences/i.test(t); }
  function retrievalFailed(e) {
    if (window.console) console.error("IASC assistant retrieval error", e);
    card({ kind: "Something went wrong", text: "The answer could not be assembled from the registry. Try rephrasing, another mode, or Restart.", caveat: null });
  }

  /* ---------------- chrome ---------------- */
  function setMode(id) {
    S.mode = id;
    Array.prototype.forEach.call(panelEl.querySelectorAll(".ia-modes button"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === id)); });
    modeHintEl.textContent = byId(MODES, id).hint;
    inputEl.placeholder = { ask: "Ask about the IASC or the Reset…", explore: "e.g. “structure” or “four Ds”", learn: "Type a term, or press Send for lessons", simulate: "Press Send to start the scenario", find: "Search sources, e.g. “membership”", compare: "e.g. “62 vs 55” or “pillars”", brief: "e.g. “Devolve”, “FAQ”, “timeline”" }[id];
  }
  function setContext(ctx, announce) {
    var changed = ctx !== S.context;
    S.context = ctx;
    Array.prototype.forEach.call(panelEl.querySelectorAll(".ia-seg button"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-ctx") === ctx)); });
    subEl.textContent = ctx === "overview" ? "Grounding: IASC Overview — who, community, functions, principles, structure, Secretariat."
      : "Grounding: Humanitarian Reset — Define, Deliver, Devolve, Defend, progress, caveats, documents, next phase.";
    if (changed && announce) {
      addDivider("Context switched to " + (ctx === "overview" ? "IASC Overview" : "Humanitarian Reset") + ". Conversation kept.");
      card({ kind: "Suggested for this context", text: ctx === "overview" ? "Questions grounded in the Overview page:" : "Questions grounded in the Reset page:", followups: CONTEXT_STARTERS[ctx] });
    }
  }
  var lastFocus = null;
  function openPanel() {
    lastFocus = document.activeElement;
    panelEl.hidden = false; launcherEl.hidden = true;
    panelEl.classList.add("ia-entering");
    requestAnimationFrame(function () { panelEl.classList.remove("ia-entering"); });
    document.addEventListener("keydown", onKey, true);
    setTimeout(function () { inputEl.focus(); }, 30);
  }
  function closePanel() {
    panelEl.hidden = true; launcherEl.hidden = false;
    document.removeEventListener("keydown", onKey, true);
    (launcherEl || lastFocus).focus();
  }
  function onKey(e) { if (e.key === "Escape" && !panelEl.hidden) { e.preventDefault(); closePanel(); } }
  function restart() { logEl.textContent = ""; S.sim = null; welcome(); inputEl.focus(); }
  function resetAll() { setMode("ask"); setContext(PAGE_CONTEXT, false); restart(); }

  function welcome() {
    var w = h("section", { class: "ia-welcome", "aria-label": "Welcome" }, [
      h("h3", { text: "Understand humanitarian coordination." }),
      h("p", { text: "Explore the IASC, understand the Humanitarian Reset, navigate evidence and learn through guided conversations." }),
      h("p", { class: "ia-disclose", text: "Independent learning assistant — not an official IASC spokesperson, policy authority, operational decision-maker or endorsed product. " + (S.live ? "Answers come from a live AI service constrained to the sources on file; check every citation." : "Demo mode: answers are assembled from a registry of the sources behind these pages. No AI model is connected.") }),
      h("div", { class: "ia-label", text: "Start here" }),
      h("div", { class: "ia-chips" }, CORE_STARTERS.map(function (s) { return h("button", { type: "button", class: "ia-chip", text: s, onclick: function () { ask(s); } }); })),
      h("div", { class: "ia-label", text: S.context === "overview" ? "About the IASC (this page)" : "About the Reset (this page)" }),
      h("div", { class: "ia-chips ia-row" }, CONTEXT_STARTERS[S.context].map(function (s) { return h("button", { type: "button", class: "ia-chip", text: s, onclick: function () { ask(s); } }); }))
    ]);
    logEl.appendChild(w);
  }

  function build() {
    var root = document.getElementById("iasc-assistant-root");
    var titleId = "ia-title-" + Math.random().toString(36).slice(2, 7);
    var closeBtn = h("button", { type: "button", class: "ia-iconbtn", "aria-label": "Close assistant", text: "✕", onclick: closePanel });
    var brand = h("div", { class: "ia-brand" }, [
      h("img", { src: BASE + "media/IASC_Logo_Blue.png", width: "172", height: "34", alt: "Inter-Agency Standing Committee (IASC)" }),
      h("div", { class: "ia-tools" }, [
        h("button", { type: "button", class: "ia-iconbtn", "aria-label": "Toggle wide view", text: "⤢", onclick: function () { panelEl.classList.toggle("ia-wide"); } }),
        closeBtn])
    ]);
    subEl = h("p", { class: "ia-sub" });
    var head = h("div", { class: "ia-head" }, [
      h("h2", { id: titleId, text: "Humanitarian Reset & Coordination Intelligence Assistant" }), subEl,
      h("div", { class: "ia-seg", role: "group", "aria-label": "Grounding context" }, [
        h("button", { type: "button", "data-ctx": "overview", "aria-pressed": "false", text: "IASC Overview", onclick: function () { setContext("overview", true); } }),
        h("button", { type: "button", "data-ctx": "reset", "aria-pressed": "false", text: "Humanitarian Reset", onclick: function () { setContext("reset", true); } })
      ])
    ]);
    var modes = h("div", { class: "ia-modes", role: "group", "aria-label": "Mode" }, MODES.map(function (m) {
      return h("button", { type: "button", "data-mode": m.id, "aria-pressed": String(m.id === "ask"), text: m.label, onclick: function () { setMode(m.id); inputEl.focus(); } });
    }));
    modeHintEl = h("p", { class: "ia-modehint", "aria-live": "polite" });
    logEl = h("div", { class: "ia-log", role: "log", "aria-live": "polite", "aria-relevant": "additions", "aria-label": "Conversation", tabindex: "0" });
    inputEl = h("textarea", { rows: "1", maxlength: String(MAX_INPUT), "aria-label": "Your question", autocomplete: "off" });
    sendBtn = h("button", { type: "submit", class: "ia-send", text: "Send" });
    var form = h("form", { class: "ia-form", onsubmit: function (e) { e.preventDefault(); var v = inputEl.value.trim(); if (!v && S.mode !== "ask") v = { explore: S.context === "overview" ? "structure" : "four Ds", learn: "lessons", simulate: "Start a fictional coordination scenario.", find: "", compare: "menu", brief: "" }[S.mode] || ""; if (S.mode === "find" && !v) { addUser("Show all sources"); answerFind(""); inputEl.value = ""; return; } if (S.mode === "brief" && !v) v = "study note"; inputEl.value = ""; ask(v); } }, [inputEl, sendBtn]);
    inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit")); } });
    inputEl.addEventListener("input", function () { inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + "px"; });
    liveBadge = h("span", { class: "ia-badge" + (S.live ? " ia-live" : ""), text: S.live ? "Live AI · sources checked" : "Demo mode · no AI connected" });
    var input = h("div", { class: "ia-input" }, [
      h("p", { class: "ia-privacy", text: "Don't enter names, beneficiary or case details, exact sensitive locations or confidential information. " + (S.live ? "Questions are sent to a third-party AI service to answer; this site stores nothing." : "Nothing is stored or sent.") + " Not for real-world decisions — use approved procedures." }),
      form,
      h("div", { class: "ia-foot" }, [liveBadge, h("span", null, [
        h("button", { type: "button", class: "ia-linkbtn", text: "Restart", onclick: restart }), " · ",
        h("button", { type: "button", class: "ia-linkbtn", text: "Reset settings", onclick: resetAll })])])
    ]);
    panelEl = h("div", { class: "ia-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": titleId, hidden: true }, [brand, head, modes, modeHintEl, logEl, input]);
    launcherEl = h("button", { type: "button", class: "ia-launcher", "aria-haspopup": "dialog", onclick: openPanel }, [
      h("span", { class: "ia-dot", "aria-hidden": "true" }), h("span", { text: "Ask about the IASC & the Reset" })]);
    root.appendChild(launcherEl); root.appendChild(panelEl);
    setContext(S.context, false);
    setMode("ask");
    welcome();
    if (/[?&]assistant=open\b/.test(location.search)) openPanel();
  }
  function unavailable(err) {
    var root = document.getElementById("iasc-assistant-root");
    var offline = navigator.onLine === false;
    root.appendChild(h("button", { type: "button", class: "ia-launcher", disabled: true, title: offline ? "You appear to be offline." : "The source registry could not be loaded.", text: offline ? "Assistant offline" : "Assistant unavailable" }));
    if (window.console) console.warn("IASC assistant: source registry unavailable (" + (err && err.message) + "). Launcher disabled rather than faking an answer.");
  }
  function init() {
    var root = document.getElementById("iasc-assistant-root");
    if (!root) { root = h("div", { id: "iasc-assistant-root" }); document.body.appendChild(root); }
    fetch(BASE + "registry.json", { credentials: "omit", cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.schema_version !== 2 || !j.sources) throw new Error("unexpected registry schema");
        S.reg = R = j; S.live = !!(j.backend && j.backend.enabled && j.backend.endpoint);
        build();
      })
      .catch(unavailable);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
