/* ==========================================================================
   BEYOND THE BEAST — Pressure Test behaviour  v2.2
   No dependencies. Without this script the page is a complete, static
   article in its final states (diagnostic open, everything drawn).

   One scroll loop measures the reading line (the vertical middle of the
   viewport) and derives every state from it:
     stage · section · segment fill · minutes left · stage-02 heat ·
     diagnostic split · the cut to white at the gap
   Contract with the markup: see build_page.py (every hook is a class or id
   used below).
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  var NAMES = { "01": "Mechanical", "02": "Identification", "03": "Presence", "04": "Gap" };
  var css = getComputedStyle(root);
  function token(name) { return css.getPropertyValue(name).trim(); }

  /* ---- colour mixing (sRGB, for near-black grounds) --------------------- */
  function hex(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return "#" + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0"); }).join("");
  }
  var BG = { "02": "#050505", "04": "#0A0A0A" };
  var HEAT = token("--bg-heat") || "#000000";

  /* ---- counters that roll like a mechanical register -------------------- */
  var forward = true; // scroll direction: forward rolls values upward
  function roll(el, value) {
    if (!el) return;
    var old = el.querySelector(".odo-v:not(.to-above):not(.to-below)");
    var prev = old ? old.textContent : "";
    if (prev === value) return;
    var up = forward;
    var next = document.createElement("span");
    next.className = "odo-v " + (up ? "from-below" : "from-above");
    next.textContent = value;
    el.appendChild(next);
    if (old) {
      old.classList.add(up ? "to-above" : "to-below");
      window.setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 400);
    }
    void next.offsetWidth;
    next.classList.remove("from-below", "from-above");
  }

  /* ---- elements --------------------------------------------------------- */
  var main = $("main");
  var bar = $("#bar");
  var stages = $$(".stage");
  var sections = $$("[data-sec]");
  var segs = $$(".seg");
  var railNow = $(".rail-now .odo");
  var railSec = $(".rail-sec .odo");
  var railName = $(".rail-name");
  var railMin = $(".rail-min");
  var railLinks = $$(".rail-list a");
  var brk = $(".break");
  var stamp = $(".stamp");
  var diag = $(".diagnostic");
  var gold = diag && $(".gold-rule", diag);
  var minTotal = parseInt((railMin && railMin.getAttribute("data-total")) || "0", 10);
  var minShort = parseInt((railMin && railMin.getAttribute("data-short")) || "0", 10) || minTotal;
  var minutes = minTotal;
  var nums = $$(".stage-num");
  var heatFrom = $("#being-versus-knowledge"), heatPeakA = $("#identification"),
      heatPeakB = $("#negative-emotions"), heatTo = $("#stage-03");

  /* The diagnostic becomes a pinned sequence only when motion is allowed. */
  var sequenced = !!(diag && !reduce);
  if (sequenced) diag.classList.add("is-sequenced");

  /* ---- stage state ------------------------------------------------------ */
  var current = null;
  function setStage(id) {
    var first = current === null;
    current = id;
    root.setAttribute("data-stage", id);
    roll(railNow, id);
    if (railName) railName.textContent = NAMES[id] || "";
    railLinks.forEach(function (a) {
      if (a.getAttribute("data-stage") === id) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
    segs.forEach(function (s) { s.classList.toggle("is-current", s.getAttribute("data-stage") === id); });
    if (!first && !reduce) {
      [brk, stamp].forEach(function (el) {
        if (!el) return;
        el.classList.remove("run"); void el.offsetWidth; el.classList.add("run");
      });
      if (stamp) stamp.textContent = id + " · " + (NAMES[id] || "");
    }
  }

  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  /* ---- the scroll loop -------------------------------------------------- */
  var ticking = false;
  var lastY = window.scrollY;
  var lastMin = null;
  var pulsed = false;

  function update() {
    ticking = false;
    if (window.scrollY !== lastY) forward = window.scrollY > lastY;
    lastY = window.scrollY;
    var vh = window.innerHeight;
    var line = window.scrollY + vh * 0.5;

    // stage + section
    var s = stages[0], si = 0;
    for (var i = 0; i < stages.length; i++) if (docTop(stages[i]) <= line) { s = stages[i]; si = i; }
    var id = s.getAttribute("data-stage");
    if (id !== current) setStage(id);
    var sec = null;
    for (var j = 0; j < sections.length; j++) if (docTop(sections[j]) <= line) sec = sections[j];
    roll(railSec, sec ? sec.getAttribute("data-sec") : "§00");

    // segment fills: each stage from its top to the next stage's top
    var docEnd = document.documentElement.scrollHeight - vh * 0.5;
    stages.forEach(function (st, k) {
      var a = docTop(st), b = k + 1 < stages.length ? docTop(stages[k + 1]) : docEnd;
      var f = clamp((line - a) / Math.max(1, b - a), 0, 1);
      if (segs[k]) segs[k].style.setProperty("--f", f.toFixed(4));
    });

    // minutes left
    if (railMin && minutes) {
      var max = document.documentElement.scrollHeight - vh;
      var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      var left = Math.ceil((1 - p) * minutes);
      if (left !== lastMin) { lastMin = left; railMin.textContent = left > 0 ? left + " min left" : "End"; }
    }

    if (bar) bar.classList.toggle("is-solid", window.scrollY > 48);

    // stage numerals: outlined as they enter, filled by the time they reach the reading line
    if (!reduce) nums.forEach(function (n) {
      var b = n.getBoundingClientRect();
      if (b.bottom < -40 || b.top > vh + 40) return;
      n.style.setProperty("--fill", clamp((vh * 0.96 - b.top) / (vh * 0.46), 0, 1).toFixed(3));
    });

    // continuous temperature
    var bg = null;
    if (id === "02" && heatFrom && heatPeakA && heatPeakB && heatTo) {
      var a0 = docTop(heatFrom), a1 = docTop(heatPeakA), b0 = docTop(heatPeakB), b1 = docTop(heatTo);
      var heat = line < a1 ? smooth((line - a0) / (a1 - a0)) : line < b0 ? 1 : 1 - smooth((line - b0) / (b1 - b0));
      bg = mix(BG["02"], HEAT, clamp(heat, 0, 1));
    }
    if (diag) {
      var r = diag.getBoundingClientRect();
      var span = Math.max(1, r.height - vh);
      var q = sequenced ? clamp(-r.top / span, 0, 1) : 1;
      // split: 0–.20 closed · .20–.55 the sentence separates · .40–.80 gold draws · .80 pulse · .85–1 tail
      var open = smooth((q - 0.2) / 0.35);
      var draw = smooth((q - 0.4) / 0.4);
      var tail = smooth((q - 0.82) / 0.15);
      if (sequenced) {
        diag.style.setProperty("--open", open.toFixed(4));
        diag.style.setProperty("--draw", draw.toFixed(4));
        diag.style.setProperty("--tail", tail.toFixed(4));
      }
      // The gap: when the rule is fully drawn the whole page cuts to white, the only light surface
      // on the site, and holds while the question is on screen. It cuts back as the reader leaves.
      var inGap = q >= 0.8 && r.top < vh * 0.5 && r.bottom > vh * 0.5;
      if (inGap !== root.classList.contains("is-gap")) root.classList.toggle("is-gap", inGap);
      if (gold && !pulsed && draw >= 0.999) {
        pulsed = true;
        if (!reduce) gold.classList.add("is-pulsing");
      }
    }
    if (bg) { root.style.setProperty("--bg", bg); root.classList.add("has-bg"); }
    else if (root.classList.contains("has-bg")) { root.style.removeProperty("--bg"); root.classList.remove("has-bg"); }
  }

  function measure() {
    if (main) root.style.setProperty("--col-left", main.getBoundingClientRect().left + "px");
    update();
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", measure);
  measure();

  /* ---- folds: Berserk readings and whole sections ------------------------
     Without script everything is open. With it, each reading shows its first
     paragraph and opens on request; any section can be folded to its title. */
  var RKEY = "btb:pt01:readings";
  function setFold(fold, open, instant) {
    var inner = fold.firstElementChild, btn = document.querySelector('[aria-controls="' + fold.id + '"]');
    if (open === !fold.classList.contains("is-shut") && !instant) return;
    if (!instant && !reduce) {
      fold.classList.add("is-moving");
      var end = function (e) { if (e.target !== fold) return; fold.classList.remove("is-moving"); fold.removeEventListener("transitionend", end); update(); };
      fold.addEventListener("transitionend", end);
    }
    fold.classList.toggle("is-shut", !open);
    if (inner) inner.inert = !open;
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      var t = $(".fold-txt", btn);
      if (t) t.textContent = open ? "Fold the reading" : "Continue the reading";
      if (btn.classList.contains("sec-fold")) btn.setAttribute("aria-label", (open ? "Fold " : "Open ") + "section " + fold.id.replace("fold-s", ""));
    }
    var sec = fold.closest(".section"); if (sec && fold.classList.contains("fold--sec")) sec.classList.toggle("is-folded", !open);
  }
  var rFolds = $$('.fold[data-fold="reading"]'), sFolds = $$('.fold[data-fold="section"]');
  var ctlR = $("#ctl-readings"), ctlS = $("#ctl-sections");
  function syncCtl() {
    var allR = rFolds.length && rFolds.every(function (f) { return !f.classList.contains("is-shut"); });
    var allS = sFolds.length && sFolds.every(function (f) { return f.classList.contains("is-shut"); });
    if (ctlR) { ctlR.setAttribute("aria-pressed", allR ? "true" : "false"); ctlR.textContent = allR ? "Fold the Berserk readings" : "Open every Berserk reading"; }
    if (ctlS) { ctlS.setAttribute("aria-pressed", allS ? "true" : "false"); ctlS.textContent = allS ? "Open all sections" : "Fold all sections"; }
    minutes = allR ? minTotal : minShort; lastMin = null;
  }
  if (rFolds.length || sFolds.length) {
    var pref = null; try { pref = localStorage.getItem(RKEY); } catch (e) {}
    rFolds.forEach(function (f) { setFold(f, pref === "open", true); });
    $$(".fold-btn, .sec-fold").forEach(function (b) {
      b.hidden = false;
      b.addEventListener("click", function () {
        var f = document.getElementById(b.getAttribute("aria-controls"));
        setFold(f, f.classList.contains("is-shut")); syncCtl(); update();
      });
    });
    if (ctlR) ctlR.addEventListener("click", function () {
      var open = ctlR.getAttribute("aria-pressed") !== "true";
      rFolds.forEach(function (f) { setFold(f, open, true); });
      try { localStorage.setItem(RKEY, open ? "open" : "shut"); } catch (e) {}
      syncCtl(); update();
    });
    if (ctlS) ctlS.addEventListener("click", function () {
      var shut = ctlS.getAttribute("aria-pressed") !== "true";
      sFolds.forEach(function (f) { setFold(f, !shut, true); });
      syncCtl(); update();
    });
    var mc = $(".map-ctl"); if (mc) mc.hidden = false;
    // a link into a folded section opens it
    window.addEventListener("hashchange", function () {
      var t = location.hash && document.querySelector(location.hash), f = t && t.querySelector && t.querySelector(":scope > .fold--sec.is-shut");
      if (f) { setFold(f, true, true); syncCtl(); }
    });
    syncCtl(); update();
  }

  /* ---- reveal: below-the-fold blocks rest dim, draw and sharpen once ---- */
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove("is-waiting"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -14% 0px" });
    $$(".reveal").forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.86) {
        el.classList.add("is-waiting");
        io.observe(el);
      }
    });
  }

  /* ---- "Check the gap" and the way back --------------------------------- */
  var back = $("#diag-return");
  $$('a[href="#the-test"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var from = a.closest("[data-sec]");
      if (!from || !back || from.closest(".diagnostic")) return;
      back.setAttribute("href", "#" + from.id);
      $(".lbl", back).textContent = "Return to " + from.getAttribute("data-sec");
      back.hidden = false;
    });
  });
  // Jumping to the test lands at the end of the sequence, where the question is open.
  if (diag && sequenced) {
    $$('a[href="#the-test"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var y = docTop(diag) + diag.offsetHeight - window.innerHeight;
        window.scrollTo({ top: y, behavior: "smooth" });
        history.replaceState(null, "", "#the-test");
      });
    });
  }

  /* ---- practices: mark as done, kept in this browser -------------------- */
  var KEY = "btb:pt01:done", done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { done = {}; }
  var ticks = $$(".tick"), doneN = $("#done-n");
  function paintTicks() {
    var n = 0;
    ticks.forEach(function (b) {
      var on = !!done[b.getAttribute("data-p")]; if (on) n++;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      $(".tick-txt", b).textContent = on ? "Done" : "Mark as done";
      var blk = b.closest(".block"); if (blk) blk.classList.toggle("is-done", on);
    });
    if (doneN) doneN.textContent = String(n);
  }
  ticks.forEach(function (b) {
    b.hidden = false;
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-p"); if (done[k]) delete done[k]; else done[k] = 1;
      try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
      paintTicks();
    });
  });
  if (ticks.length) { paintTicks(); var dc = $(".diag-count"); if (dc) dc.hidden = false; }

  /* ---- presence practice: 60 seconds, one pass -------------------------- */
  var pBtn = $("#presence-start"), pField = $("#presence-field"),
      pStatus = $("#presence-status"), pTime = $("#presence-time");
  var pTimer = null;
  function fmt(t) { return "00:" + String(t).padStart(2, "0"); }
  function endPresence(done) {
    window.clearInterval(pTimer); pTimer = null;
    root.classList.remove("is-still");
    pField.classList.remove("is-running");
    $(".lbl", pBtn).textContent = "Begin 60 seconds";
    pBtn.setAttribute("aria-pressed", "false");
    if (pTime) pTime.textContent = "01:00";
    pStatus.textContent = done
      ? "Sixty seconds. Did you remember yourself, or only the line?"
      : "Ended early. Notice what ended it.";
  }
  if (pBtn && pField && pStatus) {
    pBtn.addEventListener("click", function () {
      if (pTimer) { endPresence(false); return; }
      var t = 60;
      root.classList.add("is-still");
      pField.classList.add("is-running");
      $(".lbl", pBtn).textContent = "End early";
      pBtn.setAttribute("aria-pressed", "true");
      pStatus.textContent = "Line and self.";
      if (pTime) pTime.textContent = "01:00";
      pTimer = window.setInterval(function () {
        t -= 1;
        if (pTime) pTime.textContent = fmt(t);
        if (t === 30) pStatus.textContent = "Thirty seconds.";
        if (t === 10) pStatus.textContent = "Ten.";
        if (t <= 0) endPresence(true);
      }, 1000);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && pTimer) endPresence(false);
    });
  }

  /* ---- the loop: five steps, five seconds each, one pass ---------------- */
  var loop = $("#loop"), lBtn = $("#loop-run"), lStatus = $("#loop-status");
  var lTimer = null;
  function endLoop(msg) {
    window.clearInterval(lTimer); lTimer = null;
    loop.classList.remove("is-running");
    Array.prototype.forEach.call(loop.children, function (s) { s.classList.remove("is-now"); });
    $(".lbl", lBtn).textContent = "Run the loop once, 25 seconds";
    lBtn.setAttribute("aria-pressed", "false");
    lStatus.textContent = msg;
  }
  if (loop && lBtn && lStatus) {
    var steps = Array.prototype.slice.call(loop.children);
    lBtn.addEventListener("click", function () {
      if (lTimer) { endLoop("Stopped."); return; }
      var i = 0;
      function show() {
        steps.forEach(function (s, k) { s.classList.toggle("is-now", k === i); });
        lStatus.textContent = (i + 1) + " / " + steps.length + " · " + steps[i].getAttribute("data-name");
        i += 1;
      }
      loop.classList.add("is-running");
      $(".lbl", lBtn).textContent = "Stop";
      lBtn.setAttribute("aria-pressed", "true");
      show();
      lTimer = window.setInterval(function () {
        if (i >= steps.length) { endLoop("One pass. Did you remember yourself, or only follow the steps?"); return; }
        show();
      }, 5000);
    });
  }
  /* ---- the mirror (§6): name it, and it is handed back as something arising */
  var mirror = $("#mirror"), mIn = $("#mirror-in"), mOut = $("#mirror-out");
  if (mirror && mIn && mOut) {
    mirror.addEventListener("submit", function (e) {
      e.preventDefault();
      var raw = (mIn.value || "").trim().replace(/^(i am|i'm|im|i feel|feeling)\s+/i, "").replace(/[.!?]+$/, "");
      if (!raw) { mOut.textContent = "Name one emotion first."; return; }
      var w = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      mOut.innerHTML = "";
      var a = document.createElement("span"); a.textContent = w + " is arising in me. What does it want me to do immediately?";
      var b = document.createElement("span"); b.className = "m-dim"; b.textContent = "Wait before deciding whether to follow it. You noticed " + raw.toLowerCase() + "; for this moment you are not it.";
      mOut.appendChild(a); mOut.appendChild(b);
      mOut.classList.remove("is-new"); void mOut.offsetWidth; mOut.classList.add("is-new");
    });
  }

  /* ---- loupe over prints: the line work at ×2.6 ------------------------- */
  if (window.matchMedia("(hover: hover)").matches) {
    $$(".art-frame").forEach(function (frame) {
      var lp = $(".loupe", frame), inner = lp && $(".loupe-in", lp), src = $(".ink", frame);
      if (!lp || !src) return;
      inner.appendChild(src.cloneNode(false));
      var Z = 2.6, R = 110;
      frame.addEventListener("pointermove", function (e) {
        var b = frame.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
        lp.style.left = x + "px"; lp.style.top = y + "px";
        inner.style.width = b.width * Z + "px"; inner.style.height = b.height * Z + "px";
        inner.style.transform = "translate(" + (R - x * Z) + "px," + (R - y * Z) + "px)";
        lp.classList.add("is-on");
      });
      frame.addEventListener("pointerleave", function () { lp.classList.remove("is-on"); });
    });
  }
})();

/* ==========================================================================
   BEYOND THE BEAST — visual layer  v5.0
   Clean pass. Glyphs appear only where they mean something; everything else
   is stars, hairlines and the logo.

     hero     the site logo, animated as SOL's sun: points sampled from the
              logo gather in, then the logo itself rises beneath them; it
              breathes, turns slowly, leans with the pointer, and two rings
              of letters turn around it (the 22 Hebrew letters; the four
              scripts in sequence). Scrolling away disperses it.
     stars    a still field of points that twinkle, behind everything
     field    the stage figure (Metatron's cube, the Wedjat, the Tree of
              Life, the enneagram) as points, only in the right-hand margin,
              never under text or an artwork; it shimmers like SOL's figures
     rails    one column of the stage's letters at each edge
     decode   headings resolve through their stage's script, letter by
              letter, without changing width
     eclipse  §10: an instrument — limb-darkened sun, sliding disc, coverage
              ring, diamond ring, then the corona at totality
   Without this script the page is complete: static logo, drawn figures.
   ========================================================================== */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var DPR = Math.min(window.devicePixelRatio || 1, 3);
  var DPR_BG = Math.min(window.devicePixelRatio || 1, 2);
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var easeOut = function (t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var MOB = window.innerWidth < 760;
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function P(k, r) { var a = (-90 + 40 * k) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }
  function arc(r, a0, a1, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = a0 + (a1 - a0) * (i / n), b = a0 + (a1 - a0) * ((i + 1) / n);
      out.push([r * Math.cos(a), r * Math.sin(a), r * Math.cos(b), r * Math.sin(b)]);
    }
    return out;
  }
  function poly(pts, close) {
    var s = [];
    for (var i = 0; i < pts.length - (close ? 0 : 1); i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s.push([a[0], a[1], b[0], b[1]]);
    }
    return s;
  }
  var R = 0.84;
  var FIG = {
    enneagram: [].concat(
      arc(R, 0, Math.PI * 2, 120),
      poly([P(0, R), P(3, R), P(6, R)], true),
      poly([1, 4, 2, 8, 5, 7].map(function (k) { return P(k, R); }), true),
      [[0, -R, 0, R]],
      [[-0.128, 0.28, 0.128, 0.116]]
    ),
    anchor: [[0, -0.82, 0, 0.82], [-0.46, 0.5, 0.46, -0.04]],
    broken: arc(0.74, -62 * Math.PI / 180, (-62 + 0.83 * 360) * Math.PI / 180, 90),
    line: [[0, -0.86, 0, 0.86]]
  };
  function qb(p0, c, p1, n) {             // quadratic Bézier as segments
    var out = [], prev = p0;
    for (var i = 1; i <= n; i++) {
      var t = i / n, u = 1 - t;
      var q = [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
      out.push([prev[0], prev[1], q[0], q[1]]); prev = q;
    }
    return out;
  }
  function circ(cx, cy, r, n) { return arc(r, 0, Math.PI * 2, n).map(function (s) { return [s[0] + cx, s[1] + cy, s[2] + cx, s[3] + cy]; }); }

  /* Metatron's cube: 13 circles, every centre joined to every other. */
  FIG.metatron = (function () {
    var d = 0.36, c = [[0, 0]], out = [];
    for (var k = 0; k < 6; k++) { var a = (-90 + 60 * k) * Math.PI / 180; c.push([d * Math.cos(a), d * Math.sin(a)]); }
    for (k = 0; k < 6; k++) { a = (-90 + 60 * k) * Math.PI / 180; c.push([2 * d * Math.cos(a), 2 * d * Math.sin(a)]); }
    c.forEach(function (p) { out = out.concat(circ(p[0], p[1], d / 2, 28)); });
    for (var i = 0; i < c.length; i++) for (var j = i + 1; j < c.length; j++) out.push([c[i][0], c[i][1], c[j][0], c[j][1]]);
    return out;
  })();

  /* The Wedjat (eye of Horus): lids, pupil, brow, the drop and the spiral. */
  FIG.wedjat = [].concat(
    qb([-0.66, 0], [-0.06, -0.46], [0.5, -0.04], 40),
    qb([-0.66, 0], [-0.06, 0.3], [0.5, -0.04], 40),
    circ(-0.07, -0.06, 0.17, 40),
    qb([-0.7, -0.44], [-0.04, -0.78], [0.66, -0.4], 40),
    [[0.5, -0.04, 0.88, -0.04]],
    qb([-0.1, 0.17], [-0.12, 0.45], [-0.2, 0.72], 16), qb([-0.2, 0.72], [-0.28, 0.8], [-0.34, 0.7], 8),
    qb([0.12, 0.15], [0.38, 0.32], [0.48, 0.62], 20), arc(0.11, 0, Math.PI * 1.6, 20).map(function (s) { return [s[0] + 0.37, s[1] + 0.62, s[2] + 0.37, s[3] + 0.62]; })
  );

  /* The Tree of Life: ten sephirot, twenty-two paths (the Hebrew letters). */
  var SEPH = [[0, -1], [0.5, -0.78], [-0.5, -0.78], [0.5, -0.34], [-0.5, -0.34], [0, -0.12], [0.5, 0.32], [-0.5, 0.32], [0, 0.54], [0, 0.98]]
    .map(function (p) { return [p[0] * 0.92, p[1] * 0.88]; });
  var PATHS = [[0, 1], [0, 2], [0, 5], [1, 2], [1, 3], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5], [3, 6], [4, 5], [4, 7], [5, 6], [5, 7], [5, 8], [6, 7], [6, 8], [6, 9], [7, 8], [7, 9], [8, 9]];
  FIG.tree = (function () {
    var rr = 0.085, out = [];
    SEPH.forEach(function (p) { out = out.concat(circ(p[0], p[1], rr, 30)); });
    PATHS.forEach(function (pq) {
      var a = SEPH[pq[0]], b = SEPH[pq[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      out.push([a[0] + dx / L * rr, a[1] + dy / L * rr, b[0] - dx / L * rr, b[1] - dy / L * rr]);
    });
    return out;
  })();
  var STAGE_FIG = { "01": "metatron", "02": "wedjat", "03": "tree", "04": "enneagram" };

  /* ---------------------------------------------------------------------
     Scripts. Fonts are embedded subsets (see make_glyph_fonts.py); the
     Enochian is the site's own drawing of Dee's 21 letters on U+E000–E014.
     --------------------------------------------------------------------- */
  function cps(list) { return list.map(function (c) { return String.fromCodePoint(c); }); }
  function range(a, b) { var o = []; for (var c = a; c <= b; c++) o.push(c); return o; }
  var HIERO = [0x13000,0x13001,0x13002,0x13003,0x13004,0x13005,0x13006,0x13007,0x13008,0x13009,0x1300a,0x1300b,0x1300c,0x1300d,0x1300e,0x1300f,0x13075,0x13076,0x13077,0x13078,0x13079,0x1307a,0x1307b,0x1307c,0x1307d,0x1307e,0x1307f,0x13080,0x13081,0x130b8,0x130c0,0x13153,0x13154,0x13155,0x13156,0x13157,0x13158,0x13159,0x1315a,0x1315b,0x1315c,0x1315d,0x1315e,0x1315f,0x13171,0x1317f,0x13180,0x13181,0x13182,0x13183,0x13184,0x13185,0x13186,0x13187,0x13188,0x13189,0x1318a,0x1318b,0x1318c,0x1318d,0x1318e,0x1318f,0x13193,0x131a3,0x131cb,0x131ef,0x131f0,0x131f1,0x131f2,0x131f3,0x131f4,0x131f5,0x13216,0x13217,0x13218,0x13219,0x1321a,0x1321b,0x1321c,0x1321d,0x1321e,0x1321f,0x13220,0x13221,0x13283,0x132aa,0x132bd,0x132f4,0x132f9,0x13300,0x13319,0x1333b];
  var SCRIPT = {
    "01": { font: "BTB Kana", list: cps(range(0x30A1, 0x30F6)).concat("0123456789".split("")), mirror: true, k: 1 },
    "02": { font: "BTB Hiero", list: cps(HIERO), k: 0.92 },
    "03": { font: "BTB Hebrew", list: cps(range(0x05D0, 0x05EA)), k: 1.05 },
    "04": { font: "BTB Enochian", list: cps(range(0xE000, 0xE014)), k: 0.95 }
  };
  var SIDS = ["01", "02", "03", "04"];
  var fontsReady = false;

  /* A glyph atlas: every letter of a script pre-drawn white, twice — plain
     and with a glow — so thousands of glyphs a frame cost one drawImage each. */
  function atlas(sid, px, dpr, blur) {
    var sc = SCRIPT[sid], n = sc.list.length, c = Math.ceil(px * 1.7 * dpr);
    var cv = document.createElement("canvas"); cv.width = c * n; cv.height = c * 2;
    var o = cv.getContext("2d");
    if (blur) o.filter = "blur(" + (blur * dpr).toFixed(1) + "px)";
    o.font = Math.round(px * sc.k * dpr) + "px '" + sc.font + "'"; o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = "#fff";
    for (var row = 0; row < 2; row++) {
      if (row) { o.shadowColor = "rgba(255,255,255,.95)"; o.shadowBlur = px * 0.7 * dpr; }
      for (var i = 0; i < n; i++) {
        o.save(); o.translate(i * c + c / 2, row * c + c / 2);
        if (sc.mirror) o.scale(-1, 1);
        o.fillText(sc.list[i], 0, 0); if (row) o.fillText(sc.list[i], 0, 0);
        o.restore();
      }
    }
    return { cv: cv, c: c, n: n, dpr: dpr, px: px };
  }
  function atlasSet(px, dpr, blur) { var o = {}; SIDS.forEach(function (k) { o[k] = atlas(k, px, dpr, blur); }); return o; }
  function glyph(ctx, A, i, x, y, glow) {        // A = one script's atlas; draws centred at x, y
    var c = A.c, s = c / A.dpr;
    ctx.drawImage(A.cv, (i % A.n) * c, glow ? c : 0, c, c, x - s / 2, y - s / 2, s, s);
  }
  function glyphRot(ctx, A, i, x, y, rot, mirror) {
    var c = A.c, s = c / A.dpr;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(A.cv, (i % A.n) * c, 0, c, c, -s / 2, -s / 2, s, s); ctx.restore();
  }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }
  function sizeCanvas(cv, w, h, dpr) {
    dpr = dpr || DPR;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    return ctx;
  }
  /* Film grain: the noise tile is made here instead of being shipped (saves 54 KB). */
  (function () {
    try {
      var gd = Math.min(2, Math.round(window.devicePixelRatio || 1)), n = 256 * gd, c = document.createElement("canvas"); c.width = c.height = n;
      root.style.setProperty("--grain-s", "256px");
      var g = c.getContext("2d"), d = g.createImageData(n, n), r = rng(9);
      for (var i = 0; i < n * n; i++) { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = Math.pow(r(), 3) * 255; }
      g.putImageData(d, 0, 0); root.style.setProperty("--grain", "url(" + c.toDataURL("image/png") + ")");
    } catch (e) {}
  })();
  var hero = $(".hero"), stages = $$(".stage"), diag = $(".diagnostic");

  /* Pointer: absolute for the field, normalised and eased for parallax. */
  var ptr = { x: -9999, y: -9999, t: 0, nx: 0, ny: 0 }, PX = 0, PY = 0;
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now();
    ptr.nx = e.clientX / window.innerWidth * 2 - 1; ptr.ny = e.clientY / window.innerHeight * 2 - 1;
  }, { passive: true });

  /* Pause control (WCAG 2.2.2), remembered per browser where storage works. */
  var paused = false, mt = $(".motion-toggle");
  function setPaused(v, save) {
    paused = v; root.classList.toggle("is-paused", v);
    if (mt) { mt.setAttribute("aria-pressed", v ? "true" : "false"); var t = $(".mt-txt", mt); if (t) t.textContent = v ? "Resume motion" : "Pause motion"; mt.title = v ? "Resume motion" : "Pause motion"; }
    if (save) { try { localStorage.setItem("btb-motion", v ? "off" : "on"); } catch (e) {} }
    if (!v) { startAmbient(); startHero(); }
  }
  if (mt) {
    if (reduce) mt.hidden = true;
    mt.addEventListener("click", function () { setPaused(!paused, true); });
    try { if (localStorage.getItem("btb-motion") === "off") { paused = true; root.classList.add("is-paused"); setTimeout(function () { setPaused(true, false); }, 0); } } catch (e) {}
  }

  /* =====================================================================
     1. Hero: the logo as SOL's sun
     ===================================================================== */
  var sigBox = $(".sigil"), heroCv = $("#sigil"), logoImg = $(".sigil-img"), H1 = null, ringAtlas = null;
  function sampleLogo(img, N) {
    var S = 380, c = document.createElement("canvas"); c.width = c.height = S;
    var g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, S, S);
    var d = g.getImageData(0, 0, S, S).data, cand = [], r = rng(77);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var i = (y * S + x) * 4, a = d[i + 3] / 255;
      if (a < 0.5) continue;
      var L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      cand.push([x / S - 0.5, y / S - 0.5, L, a * (0.2 + 0.8 * Math.pow(L, 1.2))]);
    }
    for (var k = cand.length - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)), tmp = cand[k]; cand[k] = cand[j]; cand[j] = tmp; }
    var out = [], guard = 0;
    while (out.length < N && guard++ < 40) for (var m = 0; m < cand.length && out.length < N; m++) {
      var p = cand[m]; if (r() < p[3]) out.push([p[0] + r() / S, p[1] + r() / S, p[2]]);
    }
    return out;
  }
  function initHero() {
    if (!heroCv || !sigBox || !logoImg || H1) return;
    var N = MOB ? 7000 : 16000, pts = sampleLogo(logoImg, N), r = rng(9);
    N = pts.length;
    pts.sort(function (a, b) { return a[2] - b[2]; });
    var F = function () { return new Float32Array(N); };
    var h = { N: N, U: F(), V: F(), T: F(), LX: F(), LY: F(), LD: F(), AM: F(), SP: F(), P1: F(), P2: F(), SX: F(), SY: F(), starts: [], t0: performance.now() / 1000 };
    var last = -1;
    for (var i = 0; i < N; i++) {
      var p = pts[i], b = Math.min(9, (p[2] * 10) | 0);
      while (last < b) { last++; h.starts[last] = i; }
      h.U[i] = p[0]; h.V[i] = p[1]; h.T[i] = p[2];
      var th2 = r() * 6.2832, r2 = 40 * Math.sqrt(r()); h.LX[i] = Math.cos(th2) * r2; h.LY[i] = Math.sin(th2) * r2;
      h.LD[i] = r() * 0.9; h.AM[i] = 0.7 + r() * 0.5; h.SP[i] = 0.35 + r() * 1.35; h.P1[i] = r() * 6.283; h.P2[i] = r() * 6.283;
      var th = Math.atan2(p[1], p[0]) + (r() - 0.5) * 0.9, d = 0.3 + r() * 0.9; h.SX[i] = Math.cos(th) * d; h.SY[i] = Math.sin(th) * d;
    }
    while (last < 10) { last++; h.starts[last] = N; }
    // rings: 22 Hebrew letters; 44 letters cycling through the four scripts
    h.R1 = []; for (i = 0; i < 22; i++) h.R1.push(i);
    h.lx = -1.1; h.ly = -0.5; h.lod = 0; h.ema = 16;
    h.R2 = []; for (i = 0; i < 44; i++) h.R2.push({ sid: SIDS[i % 4], g: hash(i * 13 + 5) % 97 });
    H1 = h; sizeHero(); sigBox.classList.add("is-live");
    if (reduce || paused) drawHero(h.t0 + 99); else startHero();
  }
  function sizeHero() {
    if (!H1) return;
    var b = sigBox.getBoundingClientRect(), S = Math.max(1, Math.round(Math.min(b.width, b.height || b.width)));
    H1.S = S; H1.ctx = sizeCanvas(heroCv, S, S, Math.min(DPR, 2));
    var k = S / 1.42;
    if (fontsReady) ringAtlas = { r1: atlas("03", Math.max(11, k * 0.036), DPR), r2: atlasSet(Math.max(9, k * 0.024), DPR), small: k < 330 };
  }
  function drawHero(t) {
    var h = H1, ctx = h.ctx, S = h.S, lt = t - h.t0;
    ctx.clearRect(0, 0, S, S);
    var leave = hero ? clamp(window.scrollY / Math.max(1, hero.offsetHeight * 0.85), 0, 1) : 0, fade = 1 - leave;
    if (fade <= 0.01) return;
    var k = S / 1.42 * (reduce ? 1 : 1 + 0.006 * (1 - Math.cos(0.35 * t)));
    var par = MOB ? 0.4 : 1, cx = S / 2 + PX * 9 * par, cy = S / 2 + PY * 6 * par;
    var spin = reduce ? 0 : t * 0.03, cs = Math.cos(spin), sn = Math.sin(spin);
    var logoA = reduce ? 1 : smooth((lt - 1.9) / 1.4), ptsA = reduce ? 0 : 1 - 0.84 * logoA;
    // the logo itself, exactly as supplied
    if (logoA > 0.002) {
      ctx.save(); ctx.globalAlpha = logoA * clamp(1 - leave * 1.4, 0, 1);
      ctx.translate(cx, cy); ctx.rotate(spin); ctx.drawImage(logoImg, -k / 2, -k / 2, k, k); ctx.restore();
      // Light. The logo's pixels are untouched; a soft highlight and its shadow are laid over the metal only
      // (source-atop: nothing but the logo is on the canvas yet). The light rests upper left, sweeps in once,
      // and follows the pointer while it moves.
      if (!reduce) {
        var tx = -0.26, ty = -0.3;
        if (performance.now() - ptr.t < 4000 && h.box) {
          tx = clamp((ptr.x - h.box.left - S / 2) / k, -0.62, 0.62); ty = clamp((ptr.y - h.box.top - S / 2) / k, -0.62, 0.62);
        }
        h.lx += (tx - h.lx) * 0.07; h.ly += (ty - h.ly) * 0.07;
        var lx = cx + h.lx * k, ly = cy + h.ly * k, la = logoA * clamp(1 - leave * 1.4, 0, 1);
        ctx.globalCompositeOperation = "source-atop";
        var g1 = ctx.createRadialGradient(lx, ly, 0, lx, ly, k * 0.5);
        g1.addColorStop(0, "rgba(255,255,255," + (0.3 * la).toFixed(3) + ")"); g1.addColorStop(0.35, "rgba(255,255,255," + (0.11 * la).toFixed(3) + ")"); g1.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g1; ctx.fillRect(0, 0, S, S);
        var sx = cx - h.lx * k * 1.25, sy = cy - h.ly * k * 1.25, g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, k * 0.62);
        g2.addColorStop(0, "rgba(0,0,0," + (0.36 * la).toFixed(3) + ")"); g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g2; ctx.fillRect(0, 0, S, S);
        ctx.globalCompositeOperation = "source-over";
      }
    }
    // the points: gather in, then stay as a living shimmer over the steel
    if (ptsA > 0.01) {
      var zk = clamp(S / 520, 0.8, 1.5), spread = leave * k * 0.55;
      var stride = (logoA > 0.98 ? 3 : 1) * (h.lod > 0 ? 2 : 1);      // settled: a third of the points carry the shimmer
      if (stride > 1) ptsA = Math.min(1, ptsA * (logoA > 0.98 ? 1.9 : 1.3));
      for (var b = 0; b < 10; b++) {
        var a0 = h.starts[b], e0 = h.starts[b + 1]; if (a0 === e0) continue;
        var tb = (b + 0.5) / 10, z = (0.45 + 1.15 * tb) * zk, hz = z / 2;
        ctx.fillStyle = "rgba(255,255,255," + (ptsA * fade * (0.18 + 0.82 * tb)).toFixed(3) + ")";
        for (var i = a0; i < e0; i += stride) {
          var u = h.U[i], v = h.V[i];
          var x = cx + (u * cs - v * sn) * k, y = cy + (u * sn + v * cs) * k;
          if (!reduce) {
            var lp = clamp((lt - h.LD[i]) / 1.8, 0, 1), le = 1 - lp * lp * (3 - 2 * lp);
            x += h.LX[i] * le + h.AM[i] * Math.sin(h.SP[i] * t + h.P1[i]) + h.SX[i] * spread;
            y += h.LY[i] * le + h.AM[i] * Math.cos(h.SP[i] * 0.83 * t + h.P2[i]) + h.SY[i] * spread;
          }
          ctx.fillRect(x - hz, y - hz, z, z);
        }
      }
    }
    // the rings
    var ringIn = reduce ? 1 : smooth((lt - 1.8) / 1.6);
    if (ringAtlas && ringIn > 0.01) {
      if (!reduce && !paused) {
        if (Math.random() < 0.05) h.R1[(Math.random() * 22) | 0] = (Math.random() * 22) | 0;
        if (Math.random() < 0.08) { var q = h.R2[(Math.random() * 44) | 0]; q.g = (Math.random() * 97) | 0; }
      }
      var r1 = reduce ? 0 : -t * 0.05, r2 = spin * 0.6;
      ctx.globalAlpha = 0.85 * ringIn * fade;
      for (var m = 0; m < 22; m++) { var th = r1 + m / 22 * 6.2832; glyphRot(ctx, ringAtlas.r1, h.R1[m], cx + Math.cos(th) * k * 0.56, cy + Math.sin(th) * k * 0.56, th + 1.5708); }
      ctx.globalAlpha = 0.4 * ringIn * fade;
      for (m = 0; m < 44; m += ringAtlas.small ? 2 : 1) { var q2 = h.R2[m], th3 = r2 + m / 44 * 6.2832; glyphRot(ctx, ringAtlas.r2[q2.sid], q2.g, cx + Math.cos(th3) * k * 0.64, cy + Math.sin(th3) * k * 0.64, th3 + 1.5708, q2.sid === "01"); }
      ctx.globalAlpha = 0.14 * ringIn * fade; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, k * 0.6, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  var heroOn = false;
  function heroLoop(now) {
    if (paused || document.hidden || reduce) { heroOn = false; return; }
    PX += (ptr.nx - PX) * 0.05; PY += (ptr.ny - PY) * 0.05;
    var b = hero ? hero.getBoundingClientRect() : null, h = H1;
    // Slow device: measured, not guessed. Step down once to half the points, then to 30 frames a second.
    if (h.last) { h.ema += (Math.min(100, now - h.last) - h.ema) * 0.08; h.n = (h.n || 0) + 1; if (h.n > 45 && h.ema > 26 && h.lod < 2) { h.lod++; h.n = 0; h.ema = 16; } }
    h.last = now; h.skip = !h.skip;
    if ((!b || b.bottom > 0) && !(h.lod > 1 && h.skip)) { h.box = heroCv.getBoundingClientRect(); drawHero(now / 1000); }
    window.requestAnimationFrame(heroLoop);
  }
  function startHero() { if (H1 && !heroOn && !reduce && !paused) { heroOn = true; window.requestAnimationFrame(heroLoop); } }

  /* =====================================================================
     2. Stars (after SOL): still points that twinkle
     ===================================================================== */
  var starCv = $("#stars"), stars = null;
  function sizeStars() {
    if (!starCv) return;
    var W = window.innerWidth, H = window.innerHeight, r = rng(220), n = MOB ? 90 : 200, list = [];
    for (var i = 0; i < n; i++) list.push({ x: r(), y: r(), s: 0.5 + r() * 1.1, a: 0.1 + r() * 0.32, sp: 0.4 + r() * 1.6, ph: r() * 6.283 });
    stars = { W: W, H: H, list: list, ctx: sizeCanvas(starCv, W, H, DPR_BG) };
  }
  function drawStars(t) {
    if (!stars) return;
    var ctx = stars.ctx; ctx.clearRect(0, 0, stars.W, stars.H);
    stars.list.forEach(function (s) {
      var tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(s.sp * t + s.ph);
      ctx.fillStyle = "rgba(255,255,255," + (s.a * tw).toFixed(3) + ")";
      ctx.fillRect(s.x * stars.W, s.y * stars.H, s.s, s.s);
    });
  }

  /* =====================================================================
     3. Field: the stage figure, in the right-hand margin only
     ===================================================================== */
  var fieldCv = $("#field"), field = null, colR = 0;
  if (fieldCv) {
    var NF = 2600, rf = rng(5);
    field = { figs: {}, delay: new Float32Array(NF), scatter: new Float32Array(NF * 2), alpha: new Float32Array(NF), am: new Float32Array(NF), sp: new Float32Array(NF), ph: new Float32Array(NF), N: NF };
    ["metatron", "wedjat", "tree", "enneagram"].forEach(function (k, idx) { field.figs[k] = sample(k, NF, 31 + idx); });
    for (var j = 0; j < NF; j++) {
      field.delay[j] = rf() * 0.35;
      var a2 = rf() * Math.PI * 2, d2 = 0.15 + rf() * 0.5;
      field.scatter[j * 2] = Math.cos(a2) * d2; field.scatter[j * 2 + 1] = Math.sin(a2) * d2;
      field.alpha[j] = 0.35 + rf() * 0.65; field.am[j] = 0.5 + rf() * 0.6; field.sp[j] = 0.35 + rf() * 1.2; field.ph[j] = rf() * 6.283;
    }
  }
  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function sizeField() {
    if (!field) return;
    field.W = window.innerWidth; field.H = window.innerHeight;
    field.ctx = sizeCanvas(fieldCv, field.W, field.H, DPR_BG); field.blank = false;
    var pg = $(".page"); colR = pg ? pg.getBoundingClientRect().right - 32 : field.W * 0.7;
    field.arts = $$(".stage-art, .stage-plate");
  }
  function drawField(now) {
    if (!field || !field.ctx) return;
    var f = field, ctx = f.ctx, W = f.W, H = f.H, t = now / 1000;
    function blank() { if (!f.blank) { ctx.clearRect(0, 0, W, H); f.blank = true; } }
    var gutter = W - colR;
    if (gutter < 200 || W < 1100) { blank(); return; }                       // never under the reading column
    var line = window.scrollY + H * 0.5, T = H * 0.42;
    var ids = stages.map(function (s) { return s.getAttribute("data-stage"); }), tops = stages.map(docTop);
    if (!ids.length) { blank(); return; }
    var A = ids[0], B = ids[0], m = 0;
    for (var k = 0; k < tops.length; k++) if (line >= tops[k] - T) { A = ids[Math.max(0, k - 1)]; B = ids[k]; m = k === 0 ? 1 : smooth((line - (tops[k] - T)) / (2 * T)); }
    if (m >= 1) A = B;
    var heroH = hero ? hero.offsetHeight : 0;
    var vis = smooth((window.scrollY - heroH * 0.35) / (heroH * 0.6));
    if (diag) { var q = clamp(-diag.getBoundingClientRect().top / Math.max(1, diag.offsetHeight - H), 0, 1); vis *= 1 - smooth((q - 0.1) / 0.3); }
    var cx = colR + gutter * 0.5, cy = H * 0.5, sc = Math.min(gutter * 0.34, H * 0.3, 260);
    // give way to any artwork or plate in the margin
    f.arts.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.right < cx - sc || r.left > cx + sc || r.bottom < cy - sc || r.top > cy + sc) return;
      var ov = (Math.min(r.bottom, cy + sc) - Math.max(r.top, cy - sc)) / (2 * sc);
      vis *= 1 - smooth(ov * 2.2);
    });
    var base = 0.2 * vis;
    if (base < 0.004) { blank(); return; }
    var FA = f.figs[STAGE_FIG[A]], FB = f.figs[STAGE_FIG[B]];
    var push = reduce || paused ? 0 : clamp(1 - (now - ptr.t - 600) / 900, 0, 1);
    ctx.clearRect(0, 0, W, H); f.blank = false;
    ctx.fillStyle = "#fff";
    for (var i = 0; i < f.N; i++) {
      var e = A === B ? 1 : smooth((m - f.delay[i]) / 0.65);
      var x = FA[i * 2] + (FB[i * 2] - FA[i * 2]) * e, y = FA[i * 2 + 1] + (FB[i * 2 + 1] - FA[i * 2 + 1]) * e;
      var sp = Math.sin(Math.PI * e);
      x += f.scatter[i * 2] * sp; y += f.scatter[i * 2 + 1] * sp;
      var px = cx + x * sc, py = cy + y * sc, al = f.alpha[i] * base;
      if (!reduce && !paused) { px += f.am[i] * Math.sin(f.sp[i] * t + f.ph[i]); py += f.am[i] * Math.cos(f.sp[i] * 0.83 * t + f.ph[i]); }
      if (push) {
        var ddx = px - ptr.x, ddy = py - ptr.y, dd = ddx * ddx + ddy * ddy;
        if (dd < 8100) { var d0 = Math.sqrt(dd) || 1, kk = (90 - d0) / 90 * push; px += ddx / d0 * 30 * kk; py += ddy / d0 * 30 * kk; }
      }
      ctx.globalAlpha = al; ctx.fillRect(px, py, 1.1, 1.1);
    }
    ctx.globalAlpha = 1;
  }

  /* Stage emblems: the stage figure drawn small in its stage head, in hairlines. */
  function drawEmblems() {
    $$(".emblem").forEach(function (cv) {
      var segs = FIG[STAGE_FIG[cv.getAttribute("data-stage")]]; if (!segs) return;
      var S = 56, ctx = sizeCanvas(cv, S, S), r = S / 2 - 2;
      ctx.clearRect(0, 0, S, S); ctx.strokeStyle = getComputedStyle(cv).color || "#fff"; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.95;
      ctx.beginPath();
      segs.forEach(function (g) { ctx.moveTo(S / 2 + g[0] * r, S / 2 + g[1] * r); ctx.lineTo(S / 2 + g[2] * r, S / 2 + g[3] * r); });
      ctx.stroke(); cv.classList.add("is-drawn");
    });
  }
  drawEmblems();

  /* =====================================================================
     4. Rails (after SOL): one column of the stage's letters at each edge
     ===================================================================== */
  var railCv = $("#rails"), rails = null, railAtlas = null;
  function sizeRails() {
    if (!railCv) return;
    rails = rails || { pulse0: -1 };
    rails.W = window.innerWidth; rails.H = window.innerHeight;
    rails.ctx = sizeCanvas(railCv, rails.W, rails.H); rails.y = -1;
  }
  function drawRails(now) {
    if (!rails || !railAtlas) return;
    var ctx = rails.ctx, W = rails.W, H = rails.H, t = now / 1000;
    ctx.clearRect(0, 0, W, H);
    if (W < 900) return;
    var st = root.getAttribute("data-stage") || "01", A = railAtlas[st];
    var step = 30, off = window.scrollY * 0.25;      // the columns move only when the reader does
    var pulse = H * 0.5;                              // brightest at the reading line
    var sp = rails.pulse0 > 0 ? (now - rails.pulse0) / 1100 : 2, sweep = sp < 1 ? -120 + (H + 240) * easeOut(sp) : -999;
    for (var y = -step - (off % step); y < H + step; y += step) {
      var row = Math.round((y + off) / step);
      for (var side = 0; side < 2; side++) {
        var yy = side ? H - y : y, pl = Math.exp(-Math.pow((yy - pulse) / 70, 2)), sw = Math.exp(-Math.pow((y - sweep) / 50, 2));
        ctx.globalAlpha = Math.min(1, 0.2 + 0.6 * pl + 0.7 * sw);
        glyph(ctx, A, hash(row + (side ? 7 : 1000)) % A.n, side ? W - 22 : 22, y, sw > 0.4 || pl > 0.85);
      }
    }
    ctx.globalAlpha = 1;
    rails.y = window.scrollY; rails.st = st; rails.live = sp < 1;
  }
  function railsDirty() { return rails && (rails.y !== window.scrollY || rails.st !== root.getAttribute("data-stage") || rails.live || rails.pulse0 > rails.seen); }
  var lastStage = root.getAttribute("data-stage");
  function pulseIfStageChanged() {
    var st = root.getAttribute("data-stage");
    if (st !== lastStage) { lastStage = st; if (rails) { rails.pulse0 = performance.now(); rails.seen = 0; } }
  }

  /* =====================================================================
     5. Decode (after SOL): each letter falls through the stage's script
        before it settles. Glyphs are drawn over the real letters, so the
        line never changes width. Screen readers get the text unchanged.
     ===================================================================== */
  function scriptsFor(el) {
    var sec = el.closest(".stage"), st = sec && sec.getAttribute("data-stage");
    if (st && SCRIPT[st]) return [st, st];
    return [["01", "02"], ["03", "04"]];
  }
  function pick(sids) { var s = Array.isArray(sids) ? sids[(Math.random() * sids.length) | 0] : sids; return [s, SCRIPT[s].list[(Math.random() * SCRIPT[s].list.length) | 0]]; }
  function decode(el) {
    if (reduce || el.dataset.dec) return; el.dataset.dec = "1";
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    while (w.nextNode()) if (w.currentNode.nodeValue.trim() && !w.currentNode.parentElement.closest(".sr-only, svg")) nodes.push(w.currentNode);
    if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    var sc = scriptsFor(el), early = sc[0], late = sc[1];
    nodes.forEach(function (n) {
      var txt = n.nodeValue, chars = Array.from(txt), L = chars.length, wrap = document.createElement("span");
      wrap.className = "dec"; wrap.setAttribute("aria-hidden", "true");
      var spans = chars.map(function (ch) { var s = document.createElement("span"); s.textContent = ch; if (ch.trim()) s.className = "dc"; wrap.appendChild(s); return s; });
      n.parentNode.replaceChild(wrap, n);
      var t0 = performance.now() + 120, dur = 1000 + Math.min(L, 64) * 38;
      var at = chars.map(function (_, i) { return 0.14 + 0.8 * (i / Math.max(1, L - 1)) + (Math.random() - 0.5) * 0.1; });
      function tick(now) {
        var p = Math.max(0, (now - t0) / dur), done = true;
        spans.forEach(function (s, i) {
          if (!chars[i].trim() || s.dataset.ok) return;
          if (p >= at[i]) { s.dataset.ok = "1"; s.className = "dc lit"; s.removeAttribute("data-g"); return; }
          done = false;
          var old = p / at[i] > 0.55;
          if (!s.classList.contains("on") || Math.random() < (old ? 0.45 : 0.2)) {
            var g = pick(old ? late : early);
            s.className = "dc on" + (g[0] === "01" ? " k" : g[0] === "02" ? " h" : ""); s.setAttribute("data-g", g[1]);
          }
        });
        if (!done) { window.requestAnimationFrame(tick); return; }
        setTimeout(function () { if (wrap.parentNode) wrap.parentNode.replaceChild(document.createTextNode(txt), wrap); }, 1000);
      }
      window.requestAnimationFrame(tick);
    });
  }
  if ("IntersectionObserver" in window) {
    var dio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { dio.unobserve(e.target); if (fontsReady) decode(e.target); else e.target.dataset.pending = "1"; } });
    }, { rootMargin: "0px 0px -18% 0px" });
    $$(".decode").forEach(function (el) { dio.observe(el); });
  }

  function sample(name, N, seed) {
    var segs = FIG[name], r = rng(seed), lens = [], total = 0;
    segs.forEach(function (s) { var l = Math.hypot(s[2] - s[0], s[3] - s[1]); lens.push(l); total += l; });
    var out = new Float32Array(N * 2), dust = Math.floor(N * 0.07), main = N - dust, i = 0;
    for (var k = 0; k < segs.length && i < main; k++) {
      var n = Math.max(1, Math.round(main * lens[k] / total));
      var s = segs[k], nx = -(s[3] - s[1]) / (lens[k] || 1), ny = (s[2] - s[0]) / (lens[k] || 1);
      for (var j = 0; j < n && i < main; j++, i++) {
        var t = (j + r()) / n, w = (r() - 0.5) * 0.016;
        out[i * 2] = s[0] + (s[2] - s[0]) * t + nx * w;
        out[i * 2 + 1] = s[1] + (s[3] - s[1]) * t + ny * w;
      }
    }
    for (; i < N; i++) {                        // loose points: the figure is not perfect
      var src = Math.floor(r() * main), a = r() * Math.PI * 2, d = 0.02 + r() * 0.07;
      out[i * 2] = out[src * 2] + Math.cos(a) * d;
      out[i * 2 + 1] = out[src * 2 + 1] + Math.sin(a) * d;
    }
    return out;
  }

  /* =====================================================================
     3c. Glossary (after SOL's dfn + gloss)
     ===================================================================== */
  var gloss = $("#gloss");
  function showGloss(d) {
    if (!gloss) return;
    gloss.innerHTML = "";
    var b = document.createElement("b"); b.textContent = d.textContent;
    gloss.appendChild(b); gloss.appendChild(document.createTextNode(d.getAttribute("data-g")));
    gloss.hidden = false;
    var r = d.getBoundingClientRect(), gw = Math.min(300, window.innerWidth - 32);
    var x = clamp(r.left, 16, window.innerWidth - gw - 16);
    gloss.style.left = x + "px"; gloss.style.top = "0px";
    var gh = gloss.offsetHeight, y = r.top - gh - 12;
    if (y < 72) y = r.bottom + 12;
    gloss.style.top = y + "px";
    void gloss.offsetWidth; gloss.classList.add("is-on");
  }
  function hideGloss() { if (gloss) { gloss.classList.remove("is-on"); } }
  $$("dfn[data-g]").forEach(function (d) {
    d.addEventListener("pointerenter", function () { showGloss(d); });
    d.addEventListener("pointerleave", hideGloss);
    d.addEventListener("focus", function () { showGloss(d); });
    d.addEventListener("blur", hideGloss);
    d.addEventListener("click", function (e) { e.preventDefault(); if (gloss.classList.contains("is-on")) hideGloss(); else showGloss(d); });
  });
  window.addEventListener("scroll", hideGloss, { passive: true });

  /* =====================================================================
     3d. Point portrait (after SOL's portraits): the stage-03 painting is
         re-drawn as points of light that gather once, when it enters.
         The wanderer stands as the one dark shape in a field of points.
     ===================================================================== */
  $$(".stage-art--tone").forEach(function (panel) {
    if (reduce || !panel.closest("#stage-03") || window.innerWidth <= 760) return;
    var img = $("img", panel); if (!img) return;
    var cv = document.createElement("canvas"); cv.className = "portrait"; panel.appendChild(cv);
    panel.classList.add("is-points");
    var P = null;
    function build() {
      var w = panel.clientWidth, h = panel.clientHeight; if (!w || !h) return false;
      var ctx = sizeCanvas(cv, w, h);
      var sw = 240, sh = Math.round(sw * img.naturalHeight / img.naturalWidth);
      var oc = document.createElement("canvas"); oc.width = sw; oc.height = sh;
      var o = oc.getContext("2d"); o.drawImage(img, 0, 0, sw, sh);
      var d = o.getImageData(0, 0, sw, sh).data, pts = [], r = rng(1818);
      // object-fit: contain inside the panel
      var sc = Math.min(w / sw, h / sh), ox = (w - sw * sc) / 2, oy = (h - sh * sc) / 2;
      for (var y = 0; y < sh; y++) for (var x = 0; x < sw; x++) {
        var L = d[(y * sw + x) * 4] / 255;
        var n = L > 0.12 ? Math.pow(L, 1.6) * 1.15 : 0;
        while (n > 0) { if (r() < n) pts.push([ox + (x + r()) * sc, oy + (y + r()) * sc, L]); n -= 1; }
      }
      P = { ctx: ctx, w: w, h: h, pts: pts, from: pts.map(function () { var a = r() * 6.283, d2 = 80 + r() * 260; return [Math.cos(a) * d2, Math.sin(a) * d2, r() * 0.4]; }) };
      return true;
    }
    function draw(now) {
      var k = clamp((now - P.t0) / 2200, 0, 1), ctx = P.ctx;
      ctx.clearRect(0, 0, P.w, P.h);
      for (var i = 0; i < P.pts.length; i++) {
        var p = P.pts[i], f = P.from[i], e = easeOut((k - f[2]) / 0.6);
        if (e <= 0) continue;
        ctx.fillStyle = "rgba(238,238,238," + (p[2] * 0.95 * e).toFixed(3) + ")";
        ctx.fillRect(Math.round(p[0] + f[0] * (1 - e)), Math.round(p[1] + f[1] * (1 - e)), 1, 1);
      }
      if (k < 1) window.requestAnimationFrame(draw); else panel.classList.add("is-settled");
    }
    function start() { if (!P && !build()) return; P.t0 = performance.now(); window.requestAnimationFrame(draw); }
    var pio = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { pio.disconnect(); if (img.complete) start(); else img.addEventListener("load", start); }
    }, { rootMargin: "0px 0px -20% 0px" });
    pio.observe(panel);
  });


  /* =====================================================================
     7. Eclipse (§10): an instrument, not an illustration
     ===================================================================== */
  var eclCv = $("#eclipse"), ecl = null;
  function sizeEclipse() {
    if (!eclCv) return;
    var w = eclCv.parentElement.getBoundingClientRect().width, h = Math.round(Math.min(420, Math.max(280, w * 0.56)));
    var r = h * 0.15;
    ecl = { ctx: sizeCanvas(eclCv, w, h), w: w, h: h, r: r, cx: w / 2, cy: h / 2 };
    var S = Math.round(r * 6.4 * DPR), off = document.createElement("canvas"); off.width = off.height = S;
    var o = off.getContext("2d"), c = S / 2, rr = r * DPR, rn = rng(19);
    var g = o.createRadialGradient(c, c, rr, c, c, rr * 3.1);
    g.addColorStop(0, "rgba(255,255,255,.62)"); g.addColorStop(0.06, "rgba(255,255,255,.34)"); g.addColorStop(0.2, "rgba(255,255,255,.12)");
    g.addColorStop(0.5, "rgba(255,255,255,.035)"); g.addColorStop(1, "rgba(255,255,255,0)");
    o.fillStyle = g; o.fillRect(0, 0, S, S);
    o.globalCompositeOperation = "lighter";
    for (var i = 0; i < 150; i++) {              // streamers, longer along the equator
      var a = rn() < 0.62 ? (rn() < 0.5 ? 0 : Math.PI) + (rn() - 0.5) * 1.15 : rn() * Math.PI * 2;
      var len = rr * (0.4 + Math.pow(rn(), 1.7) * 2.1) * (0.55 + 0.5 * Math.abs(Math.cos(a)));
      var wd = 0.012 + 0.05 * rn(), bend = (rn() - 0.5) * 0.18;
      var x0 = c + Math.cos(a) * rr, y0 = c + Math.sin(a) * rr, x1 = c + Math.cos(a + bend) * (rr + len), y1 = c + Math.sin(a + bend) * (rr + len);
      var lg = o.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, "rgba(255,255,255," + (0.07 + 0.13 * rn()).toFixed(3) + ")"); lg.addColorStop(1, "rgba(255,255,255,0)");
      o.fillStyle = lg; o.beginPath();
      o.moveTo(c + Math.cos(a - wd) * rr, c + Math.sin(a - wd) * rr);
      o.quadraticCurveTo(c + Math.cos(a + bend * 0.5) * (rr + len * 0.5), c + Math.sin(a + bend * 0.5) * (rr + len * 0.5), x1, y1);
      o.quadraticCurveTo(c + Math.cos(a + bend * 0.5) * (rr + len * 0.5), c + Math.sin(a + bend * 0.5) * (rr + len * 0.5), c + Math.cos(a + wd) * rr, c + Math.sin(a + wd) * rr);
      o.closePath(); o.fill();
    }
    o.globalCompositeOperation = "destination-out"; o.beginPath(); o.arc(c, c, rr * 0.995, 0, Math.PI * 2); o.fill();
    ecl.corona = off;
  }
  function drawEclipse() {
    if (!ecl || !eclCv) return;
    var b = eclCv.getBoundingClientRect(), vh = window.innerHeight;
    if (b.bottom < -50 || b.top > vh + 50) return;
    var k = reduce ? 1 : clamp((vh * 0.84 - b.top) / (vh * 0.56), 0, 1);
    var ctx = ecl.ctx, w = ecl.w, h = ecl.h, r = ecl.r, cx = ecl.cx, cy = ecl.cy;
    var bg = getComputedStyle(root).getPropertyValue("--bg").trim() || "#0A0A0A";
    ctx.clearRect(0, 0, w, h);
    var tot = smooth((k - 0.965) / 0.035);
    // horizon with a scale
    ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(0, Math.round(cy), w, 1);
    for (var x = cx % 24; x < w; x += 24) ctx.fillRect(Math.round(x), Math.round(cy) - 2, 1, Math.abs(x - cx) < 1 ? 9 : 4);
    // coverage ring: 100 ticks, the covered share drawn bright
    var rm = r * 2.7;
    for (var i = 0; i < 100; i++) {
      var a = -Math.PI / 2 + i / 100 * Math.PI * 2, lit = i / 100 < k, maj = i % 10 === 0, l = maj ? 7 : 3;
      ctx.strokeStyle = "rgba(255,255,255," + (lit ? 0.6 : 0.14) + ")"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rm, cy + Math.sin(a) * rm); ctx.lineTo(cx + Math.cos(a) * (rm + l), cy + Math.sin(a) * (rm + l)); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(cx, cy, rm - 4, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    var ea = -Math.PI / 2 + k * Math.PI * 2; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx + Math.cos(ea) * (rm - 4), cy + Math.sin(ea) * (rm - 4), 2, 0, Math.PI * 2); ctx.fill();
    // corona
    if (tot > 0) { ctx.globalAlpha = tot; var S = ecl.corona.width / DPR; ctx.drawImage(ecl.corona, cx - S / 2, cy - S / 2, S, S); ctx.globalAlpha = 1; }
    // sun, limb-darkened
    var sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    sg.addColorStop(0, "#F4F4F4"); sg.addColorStop(0.75, "#E2E2E2"); sg.addColorStop(1, "#A8A8A8");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // the disc
    var mx = cx + (1 - easeOut(k)) * r * 2.4;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(mx, cy, r * 1.012, 0, Math.PI * 2); ctx.fill();
    if (tot < 1) { ctx.strokeStyle = "rgba(150,150,150," + (0.5 * (1 - tot)).toFixed(3) + ")"; ctx.stroke(); }
    // diamond ring and beads at the last sliver
    var dia = smooth((k - 0.9) / 0.06) * (1 - tot);
    if (dia > 0.01) {
      var dx = cx - r, gl = ctx.createRadialGradient(dx, cy, 0, dx, cy, r * 1.1);
      gl.addColorStop(0, "rgba(255,255,255," + (0.95 * dia).toFixed(3) + ")"); gl.addColorStop(0.25, "rgba(255,255,255," + (0.25 * dia).toFixed(3) + ")"); gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl; ctx.fillRect(dx - r * 1.1, cy - r * 1.1, r * 2.2, r * 2.2);
      ctx.strokeStyle = "rgba(255,255,255," + (0.5 * dia).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(dx - r * 0.8, cy); ctx.lineTo(dx + r * 0.3, cy); ctx.moveTo(dx, cy - r * 0.55); ctx.lineTo(dx, cy + r * 0.55); ctx.stroke();
      if (k > 0.94) for (var j = -2; j <= 2; j++) { if (!j) continue; var ba = Math.PI + j * 0.13; ctx.fillStyle = "rgba(255,255,255," + (0.8 * dia).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * r, cy + Math.sin(ba) * r, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    if (tot > 0) { ctx.strokeStyle = "rgba(255,255,255," + (0.85 * tot).toFixed(3) + ")"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r * 1.012, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
    var read = $("#eclipse-read");
    if (read) read.textContent = tot > 0.5 ? "Totality" : "Coverage " + String(Math.round(k * 100)).padStart(3, "0") + "%";
  }

  /* =====================================================================
     5. Slashes (§07): tear across once
     ===================================================================== */
  var slCv = $("#slashes"), sl = null;
  function buildSlashes() {
    if (!slCv) return;
    var w = slCv.parentElement.getBoundingClientRect().width, h = Math.round(Math.min(260, Math.max(180, w * 0.34)));
    sl = sl || { t0: null };
    sl.ctx = sizeCanvas(slCv, w, h); sl.w = w; sl.h = h;
    var r4 = rng(66); sl.items = [];
    for (var i = 0; i < 17; i++) {
      var ang = (-58 + (r4() - 0.5) * 14) * Math.PI / 180, len = h * (0.7 + r4() * 0.9);
      var x = w * (0.08 + r4() * 0.95), y = h * (0.85 + r4() * 0.4);
      sl.items.push({ x: x, y: y, dx: Math.cos(ang) * len, dy: Math.sin(ang) * len, wd: 2 + r4() * 13,
        red: r4() < 0.55, delay: i * 42 + r4() * 60, dur: 150 + r4() * 140 });
    }
  }
  function drawSlashes(now) {
    var ctx = sl.ctx, w = sl.w, h = sl.h, all = true;
    var css = getComputedStyle(root);
    var red = css.getPropertyValue("--mark").trim() || "#F2F2F2";
    ctx.clearRect(0, 0, w, h);
    sl.items.forEach(function (s) {
      var p = reduce || sl.t0 === -1 ? 1 : easeOut((now - sl.t0 - s.delay) / s.dur);
      if (p < 1) all = false;
      if (p <= 0) return;
      var ex = s.x + s.dx * p, ey = s.y + s.dy * p, nx = -s.dy, ny = s.dx, L = Math.hypot(nx, ny), mx = s.x + s.dx * p * 0.45, my = s.y + s.dy * p * 0.45;
      nx = nx / L * s.wd * p; ny = ny / L * s.wd * p;
      ctx.fillStyle = s.red ? red : "#000";
      ctx.globalAlpha = s.red ? 0.9 : 1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(mx + nx, my + ny); ctx.lineTo(ex, ey); ctx.lineTo(mx - nx * 0.3, my - ny * 0.3); ctx.closePath(); ctx.fill();
    });
    ctx.globalAlpha = 1;
    return !all;
  }
  if (slCv) {
    buildSlashes();
    var tear = function () {
      sl.t0 = performance.now();
      var loop = function (now) { if (drawSlashes(now)) window.requestAnimationFrame(loop); };
      window.requestAnimationFrame(loop);
    };
    if (reduce || !("IntersectionObserver" in window)) { sl.t0 = -1; drawSlashes(0); }
    else {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); tear(); } }, { rootMargin: "0px 0px -25% 0px" });
      io.observe(slCv);
    }
  }


  /* =====================================================================
     Scheduling. Hero: its own frame loop while it is on screen. Stars,
     field and rails: one loop at ~30 fps, stopped when the tab is hidden
     or motion is paused. Scroll-driven figures: one frame per scroll.
     ===================================================================== */
  var amb = { last: 0, on: false };
  function ambient(now) {
    if (document.hidden || paused || reduce) { amb.on = false; return; }
    if (now - amb.last >= 32) {
      amb.last = now;
      var stg = root.getAttribute("data-stage");
      if (now - (amb.s || 0) >= 80 && stg !== "02" && stg !== "04") { amb.s = now; drawStars(now / 1000); }   // hidden in 02 and 04
      drawField(now);
      if (railsDirty()) { drawRails(now); rails.seen = rails.pulse0; }
    }
    window.requestAnimationFrame(ambient);
  }
  function startAmbient() { if (!amb.on && !reduce && !paused && fontsReady) { amb.on = true; window.requestAnimationFrame(ambient); } }
  function still() { var n = performance.now(); drawStars(n / 1000); drawField(n); drawRails(n); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { startAmbient(); startHero(); } });

  var ticking = false;
  var arts = $$(".stage-art");
  function parallax() {
    if (reduce || window.innerWidth <= 760) return;
    var vh = window.innerHeight;
    arts.forEach(function (el) {
      var b = el.parentElement.getBoundingClientRect();
      if (b.bottom < -200 || b.top > vh + 200) return;
      el.style.setProperty("--par", (clamp(((b.top + b.height / 2) - vh / 2) / vh, -1, 1) * -46).toFixed(1) + "px");
    });
  }
  function frame() { ticking = false; pulseIfStageChanged(); drawEclipse(); parallax(); if (reduce || paused) still(); }
  function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(frame); } }
  function onResize() {
    MOB = window.innerWidth < 760;
    sizeStars(); sizeField(); sizeRails(); sizeEclipse(); sizeHero();
    if (fontsReady) railAtlas = atlasSet(13, DPR);
    if (sl) { var t = sl.t0; buildSlashes(); sl.t0 = t === null ? null : -1; if (sl.t0 === -1) drawSlashes(0); }
    if (H1 && (reduce || paused)) drawHero(H1.t0 + 99);
    frame(); still();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  sizeStars(); sizeField(); sizeRails(); sizeEclipse();

  function whenReady(cb) {
    var done = false, go = function () { if (!done) { done = true; cb(); } };
    var fonts = document.fonts && document.fonts.load ? Promise.all(SIDS.map(function (k) { return document.fonts.load("16px '" + SCRIPT[k].font + "'", SCRIPT[k].list.slice(0, 4).join("")); })) : Promise.resolve();
    var img = !logoImg || logoImg.complete ? Promise.resolve() : new Promise(function (res) { logoImg.addEventListener("load", res); logoImg.addEventListener("error", res); });
    Promise.all([fonts.catch(function () {}), img]).then(go, go);
    setTimeout(go, 3000);
  }
  whenReady(function () {
    fontsReady = true;
    railAtlas = atlasSet(13, DPR);
    initHero(); sizeHero();
    $$(".decode[data-pending]").forEach(function (el) { el.removeAttribute("data-pending"); decode(el); });
    if (reduce || paused) still(); else startAmbient();
    frame();
  });
})();


/* Prints are CSS masks, which browsers fetch at once; hold each until the reader is near it. */
(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll(".ink[data-m]"));
  function show(el) {
    var u = el.getAttribute("data-m");
    Array.prototype.forEach.call(document.querySelectorAll('.ink[data-m="' + u + '"]'), function (n) { n.style.setProperty("--m", "url(" + u + ")"); });
  }
  if (!("IntersectionObserver" in window)) { els.forEach(show); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); show(e.target); } }); }, { rootMargin: "1400px 0px" });
  els.forEach(function (el) { io.observe(el); });
})();
