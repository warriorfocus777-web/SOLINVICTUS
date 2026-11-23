/*!
 * IASC Humanitarian Reset & Coordination Intelligence Assistant
 * -----------------------------------------------------------------
 * Contextual, source-aware companion for /sol/reset/ and /sol/reset/overview/.
 *
 * HONESTY NOTE (read before changing): there is no live AI backend wired to
 * this public page. There is no server-side API key, no RAG pipeline, and no
 * language model generating these replies. Every answer below is produced by
 * matching the visitor's question against assistant/registry.json — a hand
 * -built, citable source registry pulled from what is actually published on
 * these two pages — and rendering a templated, source-traceable response.
 * The UI is labelled "Demo mode" throughout for exactly this reason. See
 * assistant/README.md for the API contract a future real backend would
 * need to satisfy, and for why this file never claims otherwise.
 *
 * Not an official IASC spokesperson, policy authority, operational
 * decision-maker or endorsed product. See the disclosure in the welcome
 * screen and in every message footer.
 */
(function(){
  "use strict";
  if (window.__iascAssistantLoaded) return;
  window.__iascAssistantLoaded = true;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  var BASE = SCRIPT_SRC ? SCRIPT_SRC.replace(/assistant\.js(\?.*)?$/, "") : "/sol/assistant/";

  var MODES = [
    { id: "ask", label: "Ask" },
    { id: "explore", label: "Explore" },
    { id: "learn", label: "Learn" },
    { id: "simulate", label: "Simulate" },
    { id: "find", label: "Find" },
    { id: "compare", label: "Compare" },
    { id: "brief", label: "Brief" }
  ];

  var STARTERS = [
    "Explain the IASC in five minutes.",
    "Explore how the IASC works.",
    "Explain the Humanitarian Reset and its four Ds.",
    "Explore stocktake figures and caveats.",
    "Start a fictional coordination scenario.",
    "Find an official document or source."
  ];

  var state = {
    context: /\/overview\//.test(location.pathname) ? "overview" : "reset",
    mode: "ask",
    open: false,
    busy: false,
    registry: null,
    registryError: null,
    simStepIndex: 0
  };

  // ---------- small DOM helpers ----------
  function el(tag, attrs, children){
    var n = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs){
      if (k === "html") { n.innerHTML = attrs[k]; }
      else if (k === "text") { n.textContent = attrs[k]; }
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") { n.addEventListener(k.slice(2), attrs[k]); }
      else { n.setAttribute(k, attrs[k]); }
    }
    (children || []).forEach(function(c){ if (c) n.appendChild(c); });
    return n;
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function byId(list, id){
    for (var i=0;i<list.length;i++) if (list[i].id === id) return list[i];
    return null;
  }

  // ---------- fetch registry ----------
  function loadRegistry(){
    return fetch(BASE + "registry.json", { credentials: "omit" })
      .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(json){ state.registry = json; return json; })
      .catch(function(err){ state.registryError = err; throw err; });
  }

  // ---------- retrieval ----------
  function tokenize(s){
    return (s || "").toLowerCase().replace(/[^a-z0-9%$.\s]/g, " ").split(/\s+/).filter(Boolean);
  }
  function scoreText(queryTokens, text){
    var hay = tokenize(text);
    if (!hay.length) return 0;
    var score = 0;
    queryTokens.forEach(function(t){
      if (t.length < 3) return;
      if (hay.indexOf(t) !== -1) score += 2;
      else if (hay.some(function(h){ return h.indexOf(t) !== -1 || t.indexOf(h) !== -1; })) score += 1;
    });
    return score;
  }

  function searchRegistry(query){
    var reg = state.registry;
    var qTok = tokenize(query);
    var hits = [];
    (reg.indicators || []).forEach(function(ind){
      var s = scoreText(qTok, [ind.title, ind.pillar, ind.unit, ind.caveat].join(" "));
      if (s > 0) hits.push({ type: "indicator", score: s, data: ind });
    });
    (reg.glossary || []).forEach(function(g){
      var s = scoreText(qTok, g.term + " " + g.def) + (qTok.indexOf(g.term.toLowerCase()) !== -1 ? 4 : 0);
      if (s > 0) hits.push({ type: "glossary", score: s, data: g });
    });
    (reg.documents || []).forEach(function(d){
      var s = scoreText(qTok, [d.title, d.issuer, d.format, d.note].join(" "));
      if (s > 0) hits.push({ type: "document", score: s, data: d });
    });
    (reg.discrepancies || []).forEach(function(d){
      var s = scoreText(qTok, d.label + " " + d.note) + (/discrepanc|differ|conflict|disagree/.test(query.toLowerCase()) ? 3 : 0);
      if (s > 0) hits.push({ type: "discrepancy", score: s, data: d });
    });
    (reg.milestones || []).forEach(function(m){
      var s = scoreText(qTok, m.what + " " + m.qualification);
      if (s > 0) hits.push({ type: "milestone", score: s, data: m });
    });
    hits.sort(function(a,b){ return b.score - a.score; });
    return hits;
  }

  // ---------- citation rendering ----------
  function sourceEntryFor(docId){
    var reg = state.registry;
    var doc = byId(reg.documents, docId);
    if (doc) return doc;
    return null;
  }
  function renderSources(docIds){
    var reg = state.registry;
    var uniq = [];
    docIds.forEach(function(id){ if (id && uniq.indexOf(id) === -1) uniq.push(id); });
    if (!uniq.length) return null;
    var items = uniq.map(function(id){
      var d = sourceEntryFor(id);
      if (!d) return null;
      var item = el("div", { "class": "iasc-a-source-item" });
      var titleLine = el("div");
      titleLine.appendChild(el("span", { "class": "t", text: d.title }));
      titleLine.appendChild(el("span", { "class": "iasc-a-tier", text: "Tier " + d.tier }));
      item.appendChild(titleLine);
      var meta = d.issuer + " · " + d.date + (d.status ? " · " + d.status : "");
      var metaEl = el("div", { "class": "m" });
      metaEl.textContent = meta;
      item.appendChild(metaEl);
      if (d.url){
        item.appendChild(el("div", {}, [ el("a", { href: d.url, target: "_blank", rel: "noopener", text: "Open source" }) ]));
      } else {
        item.appendChild(el("div", { "class": "m", text: "No public URL on file — not yet published." }));
      }
      return item;
    }).filter(Boolean);
    var det = el("details", { "class": "iasc-a-sources" });
    det.appendChild(el("summary", { text: "Sources (" + items.length + ")" }));
    items.forEach(function(it){ det.appendChild(it); });
    return det;
  }

  // ---------- message rendering ----------
  var bodyEl, formEl, textareaEl, sendBtn;

  function scrollToBottom(){ bodyEl.scrollTop = bodyEl.scrollHeight; }

  function addUserMessage(text){
    bodyEl.appendChild(el("div", { "class": "iasc-a-msg user", text: text }));
    scrollToBottom();
  }

  function addStatus(text){
    var s = el("div", { "class": "iasc-a-status", text: text });
    bodyEl.appendChild(s);
    scrollToBottom();
    return s;
  }

  function addBotCard(opts){
    opts = opts || {};
    var wrap = el("div", { "class": "iasc-a-msg bot" });
    var card = el("div", { "class": "iasc-a-bot-card" });
    if (opts.fiction) card.appendChild(el("span", { "class": "iasc-a-fiction", text: "Fictional learning scenario — not operational guidance" }));
    if (opts.answerHtml) card.appendChild(el("p", { "class": "answer", html: opts.answerHtml }));
    if (opts.kv && opts.kv.length){
      var dl = el("dl", { "class": "iasc-a-kv" });
      opts.kv.forEach(function(pair){
        dl.appendChild(el("dt", { text: pair[0] }));
        dl.appendChild(el("dd", { text: pair[1] }));
      });
      card.appendChild(dl);
    }
    if (opts.table){
      var tbl = el("table", { "class": "iasc-a-tbl" });
      var thead = el("tr");
      opts.table.headers.forEach(function(h){ thead.appendChild(el("th", { text: h })); });
      tbl.appendChild(el("thead", {}, [thead]));
      var tbody = el("tbody");
      opts.table.rows.forEach(function(row){
        var tr = el("tr");
        row.forEach(function(cell){ tr.appendChild(el("td", { text: cell })); });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      card.appendChild(tbl);
    }
    if (opts.caveat){
      card.appendChild(el("div", { "class": "iasc-a-caveat" }, [
        el("span", { text: "⚠" }),
        el("span", {}, [ el("b", { text: "Caveat: " }), document.createTextNode(opts.caveat) ])
      ]));
    }
    if (opts.sources && opts.sources.length){
      var drawer = renderSources(opts.sources);
      if (drawer) card.appendChild(drawer);
    } else if (opts.noEvidence) {
      card.appendChild(el("div", { "class": "iasc-a-caveat", html: "<b>No evidence found.</b> This isn't in the registry built from these two pages. Try rephrasing, or use Find mode to browse the document list." }));
    }
    if (opts.choices && opts.choices.length){
      var cwrap = el("div", { "class": "iasc-a-choices" });
      opts.choices.forEach(function(ch){
        cwrap.appendChild(el("button", { type: "button", text: ch.text, onclick: function(){ ch.onClick(); } }));
      });
      card.appendChild(cwrap);
    }
    var actions = el("div", { "class": "iasc-a-row-actions" }, [
      el("button", { type: "button", text: "Copy", onclick: function(){ copyCard(opts, actions); } }),
      el("button", { type: "button", text: "👍", "aria-label": "Helpful", onclick: function(){ ackFeedback(actions, true); } }),
      el("button", { type: "button", text: "👎", "aria-label": "Not helpful", onclick: function(){ ackFeedback(actions, false); } })
    ]);
    card.appendChild(actions);
    wrap.appendChild(card);
    bodyEl.appendChild(wrap);
    scrollToBottom();
    return card;
  }

  function ackFeedback(actions, positive){
    var note = el("span", { "class": "iasc-a-status", text: positive ? "Thanks — noted for this session only, nothing is sent anywhere." : "Noted — nothing is sent anywhere; try rephrasing or a different mode." });
    actions.parentNode.appendChild(note);
  }

  function copyCard(opts, actions){
    var lines = [];
    if (opts.answerHtml) lines.push(opts.answerHtml.replace(/<[^>]+>/g, ""));
    if (opts.caveat) lines.push("Caveat: " + opts.caveat);
    if (opts.sources && opts.sources.length){
      lines.push("Sources:");
      opts.sources.forEach(function(id){
        var d = sourceEntryFor(id);
        if (d) lines.push("- " + d.title + " — " + d.issuer + " (" + d.date + ", Tier " + d.tier + (d.url ? ", " + d.url : "") + ")");
      });
    }
    var text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ ackCopy(actions); }, function(){ ackCopy(actions, true); });
    } else { ackCopy(actions, true); }
  }
  function ackCopy(actions, failed){
    var note = el("span", { "class": "iasc-a-status", text: failed ? "Couldn't copy automatically — select the text above instead." : "Copied, with citations." });
    actions.parentNode.appendChild(note);
  }

  // ---------- canned starter handlers ----------
  function handleStarter(text){
    var reg = state.registry;
    if (/five minutes/i.test(text)){
      var iasc = byId(reg.glossary, "IASC-SKIP") || findGlossary("IASC");
      addBotCard({
        answerHtml: "The <strong>Inter-Agency Standing Committee (IASC)</strong> is the primary mechanism for inter-agency humanitarian coordination, established in June 1992 following UN General Assembly Resolution 46/182. It brings together UN and non-UN humanitarian organizations as members and standing invitees, chaired by the Emergency Relief Coordinator, and is built around four humanitarian principles: humanity, impartiality, neutrality and independence.",
        kv: [["Established", "June 1992, after Resolution 46/182"], ["Chaired by", "The Emergency Relief Coordinator"]],
        sources: ["iasc-membership", "ocha-principles"]
      });
      return true;
    }
    if (/how the iasc works/i.test(text)){
      addBotCard({
        answerHtml: "The IASC's institutional architecture runs: <strong>Principals</strong> (heads of agency) → <strong>Deputies Forum</strong> → <strong>Emergency Directors Group (EDG)</strong> and <strong>Operational Policy and Advocacy Group (OPAG)</strong> → <strong>Results Groups</strong>, supported by a <strong>Secretariat</strong> that keeps the system connected. The overview page flags this structure as current as of its writing and recommends re-verifying it before publication, since subsidiary-body names and mandates are periodically revised.",
        caveat: "The overview page itself says: 're-verify before publication, since subsidiary-body names and mandates are periodically revised.'",
        sources: ["iasc-structure"]
      });
      return true;
    }
    if (/four ds/i.test(text)){
      var g = ["Define","Deliver","Devolve","Defend"].map(function(t){ return findGlossary(t); }).filter(Boolean);
      var html = "The Humanitarian Reset is organized around four pillars: " + g.map(function(x){ return "<strong>" + x.term + "</strong> — " + x.def; }).join("<br>") ;
      addBotCard({ answerHtml: html, sources: ["stocktake", "presentation"] });
      return true;
    }
    if (/stocktake figures and caveats/i.test(text)){
      var picks = ["reached", "severity45", "cbpf", "local"].map(function(id){ return byId(reg.indicators, id); }).filter(Boolean);
      var html2 = picks.map(function(p){ return "<strong>" + p.title + ":</strong> " + p.value + " (" + p.period + ")"; }).join("<br>");
      addBotCard({
        answerHtml: html2,
        caveat: picks.map(function(p){ return p.caveat; }).join(" "),
        sources: ["stocktake"]
      });
      return true;
    }
    if (/fictional coordination scenario/i.test(text)){
      startSimulation();
      return true;
    }
    if (/find an official document/i.test(text)){
      setMode("find");
      renderFindList();
      return true;
    }
    return false;
  }
  function findGlossary(term){
    var reg = state.registry;
    for (var i=0;i<reg.glossary.length;i++){ if (reg.glossary[i].term.toLowerCase() === term.toLowerCase()) return reg.glossary[i]; }
    return null;
  }

  // ---------- Find mode ----------
  function renderFindList(){
    var reg = state.registry;
    var rows = reg.documents.map(function(d){ return [d.title, d.issuer, d.date, d.status]; });
    addBotCard({
      answerHtml: "Documents in the registry, newest status first. Each row is cited below.",
      table: { headers: ["Title", "Issuer", "Date", "Status"], rows: rows },
      sources: reg.documents.map(function(d){ return d.id; })
    });
  }

  // ---------- Compare mode ----------
  function renderCompare(query){
    var reg = state.registry;
    var hit = reg.discrepancies.find(function(d){ return scoreText(tokenize(query), d.label) > 2; });
    if (!hit) hit = reg.discrepancies[0];
    addBotCard({
      answerHtml: "<strong>" + hit.label + "</strong> is reported differently across sources. Shown side by side, not reconciled:",
      table: { headers: ["Source", "Value"], rows: hit.values.map(function(v){ return [v.source, v.value]; }) },
      caveat: hit.note,
      sources: ["stocktake", "presentation"]
    });
  }

  // ---------- Brief mode ----------
  function renderBrief(query){
    var reg = state.registry;
    var pillarMatch = ["define","deliver","devolve","defend"].find(function(p){ return query.toLowerCase().indexOf(p) !== -1; });
    var picks = reg.indicators.filter(function(i){ return !pillarMatch || i.pillar === pillarMatch; }).slice(0, 5);
    if (!picks.length) picks = reg.indicators.slice(0, 5);
    var html = "<strong>Source-traceable brief" + (pillarMatch ? " — " + pillarMatch : "") + "</strong><br>" +
      picks.map(function(p){ return "• " + p.title + ": " + p.value + " (" + p.period + ")"; }).join("<br>");
    addBotCard({
      answerHtml: html,
      caveat: "Study notes generated from the registry for exploration — not a cleared official IASC communication.",
      sources: ["stocktake"]
    });
  }

  // ---------- Learn mode ----------
  function renderLesson(){
    var reg = state.registry;
    var g = reg.glossary[Math.floor(Math.random() * reg.glossary.length)];
    addBotCard({
      answerHtml: "<strong>Glossary — " + esc(g.term) + ":</strong> " + esc(g.def),
      sources: g.term === "IASC" ? ["iasc-membership"] : ["stocktake"]
    });
    var q = el("div", { "class": "iasc-a-msg bot" });
    var card = el("div", { "class": "iasc-a-bot-card" });
    card.appendChild(el("p", { "class": "answer", text: "Quick check: is the figure for \"people assisted in severity 4–5 areas, 2026\" the same in the Stocktake and the presentation?" }));
    var choices = el("div", { "class": "iasc-a-choices" });
    choices.appendChild(el("button", { type: "button", text: "Yes, both say 62%", onclick: function(){ revealQuiz(choices, false); } }));
    choices.appendChild(el("button", { type: "button", text: "No — 62% vs 55%, an open discrepancy", onclick: function(){ revealQuiz(choices, true); } }));
    card.appendChild(choices);
    q.appendChild(card);
    bodyEl.appendChild(q);
    scrollToBottom();
  }
  function revealQuiz(choices, correct){
    choices.parentNode.appendChild(el("p", { "class": "iasc-a-caveat", html: correct ? "<b>Correct.</b> The Stocktake reports 62%, the presentation 55%. Both are shown; the page does not pick one." : "<b>Not quite.</b> The Stocktake reports 62%, the presentation 55% — an open discrepancy, shown rather than smoothed." }));
    scrollToBottom();
  }

  // ---------- Simulate mode ----------
  function startSimulation(){
    var sim = state.registry.simulation;
    state.simStepIndex = 0;
    addBotCard({
      fiction: true,
      answerHtml: "<strong>" + esc(sim.title) + "</strong><br>" + esc(sim.setting) + "<br><br><em>Learning objectives:</em> " + sim.objectives.join(" "),
      caveat: sim.role_limits
    });
    renderSimStep(sim.steps[0]);
  }
  function renderSimStep(step){
    var choices = step.choices.map(function(c){
      return { text: c.text, onClick: function(){ resolveSimChoice(c); } };
    });
    addBotCard({ fiction: true, answerHtml: esc(step.prompt), choices: choices });
  }
  function resolveSimChoice(choice){
    var sim = state.registry.simulation;
    addBotCard({
      fiction: true,
      answerHtml: "<strong>Consequence:</strong> " + esc(choice.consequence),
      caveat: "Debrief rubric: " + sim.debrief_rubric.join(", ") + ". There is no single right answer here — the scenario is evaluating your reasoning, not a pass/fail choice.",
    });
  }

  // ---------- Explore mode ----------
  function renderExplore(){
    addBotCard({
      answerHtml: "Structure, top to bottom: <strong>Principals</strong> (agency heads) → <strong>Deputies Forum</strong> → <strong>Emergency Directors Group (EDG)</strong> / <strong>Operational Policy and Advocacy Group (OPAG)</strong> → <strong>Results Groups</strong> → supported throughout by a <strong>Secretariat</strong>. Chaired by the Emergency Relief Coordinator. No architecture beyond what the Secretariat's own structure page documents is shown here.",
      caveat: "Re-verify against the live Secretariat structure page before relying on this for anything current — subsidiary-body names and mandates change periodically.",
      sources: ["iasc-structure", "iasc-membership"]
    });
  }

  // ---------- generic answer engine ----------
  function answerFreeText(query){
    var reg = state.registry;
    if (state.mode === "compare") return renderCompare(query);
    if (state.mode === "brief") return renderBrief(query);
    if (state.mode === "find") return renderFindList();
    if (state.mode === "learn") return renderLesson();
    if (state.mode === "explore") return renderExplore();
    if (state.mode === "simulate") return startSimulation();

    var hits = searchRegistry(query);
    if (!hits.length){
      addBotCard({ answerHtml: "I don't have anything in the registry that directly answers that.", noEvidence: true });
      return;
    }
    var top = hits[0];
    if (top.type === "indicator"){
      var ind = top.data;
      addBotCard({
        answerHtml: "<strong>" + esc(ind.title) + ":</strong> " + esc(ind.value) + " (" + esc(ind.period) + ").",
        kv: [["Denominator", ind.denominator], ["Status", ind.status]],
        caveat: ind.caveat,
        sources: [ind.source]
      });
    } else if (top.type === "glossary"){
      addBotCard({ answerHtml: "<strong>" + esc(top.data.term) + ":</strong> " + esc(top.data.def), sources: ["stocktake"] });
    } else if (top.type === "document"){
      var d = top.data;
      addBotCard({
        answerHtml: "<strong>" + esc(d.title) + "</strong> — " + esc(d.issuer) + ", " + esc(d.date) + ".",
        kv: [["Status", d.status], ["Format", d.format]],
        sources: [d.id]
      });
    } else if (top.type === "discrepancy"){
      var dd = top.data;
      addBotCard({
        answerHtml: "<strong>" + esc(dd.label) + "</strong> is reported differently across sources:",
        table: { headers: ["Source", "Value"], rows: dd.values.map(function(v){ return [v.source, v.value]; }) },
        caveat: dd.note,
        sources: ["stocktake", "presentation"]
      });
    } else if (top.type === "milestone"){
      var m = top.data;
      addBotCard({
        answerHtml: "<strong>" + esc(m.what) + "</strong> — " + esc(m.date) + ". Status: " + esc(m.status) + ".",
        caveat: m.qualification,
        sources: [m.source]
      });
    }
  }

  // ---------- panel chrome ----------
  var panelEl, launcherEl;

  function setMode(id){
    state.mode = id;
    Array.prototype.forEach.call(panelEl.querySelectorAll(".iasc-a-modes button"), function(b){
      b.setAttribute("aria-pressed", b.dataset.mode === id ? "true" : "false");
    });
    sendBtn.setAttribute("aria-label", "Send (" + id + " mode)");
  }
  function setContext(ctx){
    state.context = ctx;
    Array.prototype.forEach.call(panelEl.querySelectorAll(".iasc-a-ctx button"), function(b){
      b.setAttribute("aria-pressed", b.dataset.ctx === ctx ? "true" : "false");
    });
    var sub = panelEl.querySelector(".iasc-a-head p.sub");
    sub.textContent = ctx === "overview"
      ? "Context: IASC Overview — who the IASC is, its community, functions, principles and structure."
      : "Context: Humanitarian Reset stocktake — Define, Deliver, Devolve, Defend, progress and caveats.";
  }

  function openPanel(){
    state.open = true;
    panelEl.classList.add("is-open");
    panelEl.setAttribute("aria-hidden", "false");
    launcherEl.classList.add("is-hidden");
    window.addEventListener("keydown", onKeydown, true);
    setTimeout(function(){ textareaEl.focus(); }, 50);
  }
  function closePanel(){
    state.open = false;
    panelEl.classList.remove("is-open");
    panelEl.setAttribute("aria-hidden", "true");
    launcherEl.classList.remove("is-hidden");
    window.removeEventListener("keydown", onKeydown, true);
    launcherEl.focus();
  }
  function onKeydown(e){
    if (e.key === "Escape") { closePanel(); }
  }

  function submitQuery(){
    var text = textareaEl.value.trim();
    if (!text || state.busy) return;
    addUserMessage(text);
    textareaEl.value = "";
    state.busy = true;
    sendBtn.disabled = true;
    var status = addStatus("Searching the source registry…");
    setTimeout(function(){
      status.remove();
      try {
        if (!handleStarter(text)) answerFreeText(text);
      } catch (err){
        addBotCard({ answerHtml: "Something went wrong answering that locally. Try rephrasing, or use one of the mode buttons above.", noEvidence: true });
      }
      state.busy = false;
      sendBtn.disabled = false;
      textareaEl.focus();
    }, 260); // small, honest pause for the "searching" state — not simulating AI latency
  }

  function buildPanel(){
    var head = el("div", { "class": "iasc-a-head" });
    var top = el("div", { "class": "top" }, [
      el("div", {}, [
        el("h2", { text: "IASC Coordination Intelligence Assistant" }),
        el("p", { "class": "sub" })
      ]),
      el("button", { type: "button", "class": "iasc-a-close", "aria-label": "Close assistant", text: "✕", onclick: closePanel })
    ]);
    var ctx = el("div", { "class": "iasc-a-ctx", role: "group", "aria-label": "Page context" }, [
      el("button", { type: "button", "data-ctx": "overview", "aria-pressed": "false", text: "Overview", onclick: function(){ setContext("overview"); } }),
      el("button", { type: "button", "data-ctx": "reset", "aria-pressed": "false", text: "Reset stocktake", onclick: function(){ setContext("reset"); } })
    ]);
    head.appendChild(top);
    head.appendChild(ctx);

    var modes = el("div", { "class": "iasc-a-modes", role: "group", "aria-label": "Mode" });
    MODES.forEach(function(m){
      modes.appendChild(el("button", { type: "button", "data-mode": m.id, "aria-pressed": m.id === "ask" ? "true" : "false", text: m.label, onclick: function(){ setMode(m.id); } }));
    });

    bodyEl = el("div", { "class": "iasc-a-body", role: "log", "aria-live": "polite", "aria-label": "Conversation" });

    var inputwrap = el("div", { "class": "iasc-a-inputwrap" });
    inputwrap.appendChild(el("p", { "class": "iasc-a-privacy", text: "Don't enter names, beneficiary records, exact sensitive locations, or confidential/operationally sensitive information. Nothing you type is stored or sent anywhere — this runs entirely in your browser." }));
    textareaEl = el("textarea", { rows: "1", placeholder: "Ask about the IASC or the Reset…", "aria-label": "Your question" });
    sendBtn = el("button", { type: "button", text: "Send", "aria-label": "Send (ask mode)" });
    formEl = el("form", { "class": "iasc-a-form", onsubmit: function(e){ e.preventDefault(); submitQuery(); } }, [textareaEl, sendBtn]);
    textareaEl.addEventListener("keydown", function(e){
      if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); submitQuery(); }
    });
    sendBtn.addEventListener("click", function(e){ e.preventDefault(); submitQuery(); });
    inputwrap.appendChild(formEl);
    var footerRow = el("div", { "class": "iasc-a-footer-row" }, [
      el("span", { "class": "iasc-a-demo-badge", text: "DEMO MODE · no live AI backend" }),
      el("button", { type: "button", "class": "iasc-a-linklike", text: "Restart", onclick: restartConversation })
    ]);
    inputwrap.appendChild(footerRow);

    panelEl = el("div", {
      "class": "iasc-a-panel", role: "dialog", "aria-label": "IASC Coordination Intelligence Assistant", "aria-hidden": "true"
    }, [head, modes, bodyEl, inputwrap]);

    launcherEl = el("button", { type: "button", "class": "iasc-a-launcher", "aria-haspopup": "dialog", onclick: openPanel }, [
      el("span", { "class": "dot", "aria-hidden": "true" }),
      el("span", { text: "Ask about the IASC Reset" })
    ]);

    var root = document.getElementById("iasc-assistant-root");
    root.appendChild(launcherEl);
    root.appendChild(panelEl);

    setContext(state.context);
    renderWelcome();
  }

  function restartConversation(){
    bodyEl.innerHTML = "";
    state.simStepIndex = 0;
    renderWelcome();
    textareaEl.focus();
  }

  function renderWelcome(){
    var wrap = el("div", { "class": "iasc-a-welcome" });
    wrap.appendChild(el("h3", { text: "Understand humanitarian coordination." }));
    wrap.appendChild(el("p", { text: "Explore the IASC, understand the Humanitarian Reset, navigate evidence and learn through guided conversations. This assistant is not an official IASC spokesperson, policy authority or endorsed product — it reads from the registry of sources published on these two pages, in demo mode, with no live AI backend." }));
    var starters = el("div", { "class": "iasc-a-starters" });
    STARTERS.forEach(function(s){
      starters.appendChild(el("button", { type: "button", text: s, onclick: function(){ addUserMessage(s); if (!handleStarter(s)) answerFreeText(s); } }));
    });
    wrap.appendChild(starters);
    bodyEl.appendChild(wrap);
  }

  function renderOfflineState(err){
    var root = document.getElementById("iasc-assistant-root");
    launcherEl = el("button", { type: "button", "class": "iasc-a-launcher", text: "Assistant unavailable", disabled: "disabled" });
    root.appendChild(launcherEl);
    // eslint-disable-next-line no-console
    console.warn("IASC assistant: could not load source registry (" + (err && err.message) + "). The chat launcher is disabled rather than showing a broken or fake-live widget.");
  }

  function init(){
    var root = document.getElementById("iasc-assistant-root");
    if (!root){
      root = document.createElement("div");
      root.id = "iasc-assistant-root";
      document.body.appendChild(root);
    }
    loadRegistry().then(function(){
      buildPanel();
    }).catch(function(err){
      renderOfflineState(err);
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
