/* SOLAR FINANCIAL — behaviour. No dependencies. Every module degrades to a
   readable static page: if this file never loads, nothing essential is lost. */
(() => {
  'use strict';
  const doc = document.documentElement;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  /* ---- arrival: start the orchestrated entrance once fonts are ready ---- */
  const go = () => doc.classList.add('go');
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(() => requestAnimationFrame(go));
  } else go();

  /* ---- mobile menu ---- */
  const menuBtn = $('.menu-btn');
  const topnav = $('#topnav');
  if (menuBtn && topnav) {
    menuBtn.addEventListener('click', () => {
      const open = topnav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && topnav.classList.contains('open')) { topnav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); }
    });
  }

  /* ---- matrix streams + glyph entrances ---- */
  const core = $('.core');
  if (core) initMatrix(core);

  function initMatrix(section) {
    const canvas = $('.matrix', section);
    const field = $('.glyph-field', section);
    const toggle = $('#reveal-entrances');
    const entrances = $$('.entrance', field);
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const TOKENS = ['4.318', '+0.42', '-1.07', '0.0525', '35.00', '+2.18', '-0.36', '1971', '97%', '+0.05', '-3.40', '10Y', '2.75', '+1.9', '-0.8', '415', '945', '0.97', '+12.6', '-4.1', '100.00', '92.28', '108.53', '62.50', '+0.11', '-0.02', '5.00', '0x2F', '1944', '1.0718', '-50%', '+100%', '38.00', '42.22', '0.03', '193.7'];
    let W = 0, H = 0, dpr = 1, cols = [], running = false, visible = true, last = 0, raf = 0;
    const COLW = 74, ROWH = 24;
    const reveal = () => field && field.classList.contains('reveal');

    function resize() {
      const r = section.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.ceil(W / COLW) + 1;
      cols = Array.from({ length: n }, (_, i) => ({
        x: i * COLW + 8 + (i % 2) * 6,
        off: Math.random() * H,
        speed: 7 + Math.random() * 16,
        seed: Math.floor(Math.random() * 997),
        alpha: 0.07 + Math.random() * 0.12,
        off_: Math.random() < 0.3, // some columns stay dark
      }));
      if (!running) draw(0);
      if (reveal() || RM.matches) placeAll();
    }

    function blockedRects() {
      return entrances.filter((e) => e.classList.contains('on') || reveal() || RM.matches).map((e) => {
        const x = parseFloat(e.style.left) / 100 * W, y = parseFloat(e.style.top) / 100 * H;
        return [x - 30, y - 22, x + 30, y + 22];
      });
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      const blocks = blockedRects();
      for (const c of cols) {
        c.off = (c.off + c.speed * dt) % (ROWH * 400);
        if (c.off_) continue;
        const centre = Math.min(1, Math.abs(c.x + 18 - W / 2) / (W * 0.3));
        const fall = 0.3 + centre * 0.7;
        const rows = Math.ceil(H / ROWH) + 2;
        const shift = c.off % ROWH;
        const base = Math.floor(c.off / ROWH);
        for (let r = -1; r < rows; r++) {
          const y = r * ROWH + shift;
          const idx = (c.seed + (base - r) * 7 + 9999) % TOKENS.length;
          const tok = TOKENS[idx];
          if (blocks.some(([x0, y0, x1, y1]) => c.x + 36 > x0 && c.x < x1 && y > y0 && y < y1)) continue;
          const head = r === 0;
          const neg = tok.charCodeAt(0) === 45;
          const fade = 1 - r / rows;
          const a = (head ? 0.42 : c.alpha * (0.3 + fade * 0.7)) * fall;
          ctx.fillStyle = neg ? `rgba(239,70,87,${a * 0.8})` : head ? `rgba(160,255,205,${a})` : `rgba(0,216,120,${a})`;
          ctx.fillText(neg ? '−' + tok.slice(1) : tok, c.x, y);
        }
      }
    }

    function frame(t) {
      if (!running) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running || RM.matches || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    /* glyph entrances: appear at varied intervals between the numbers.
       Never over the nameplate; never more than two at once. */
    const ZONES = [[6, 22, 12, 82], [78, 94, 12, 82], [24, 34, 8, 30], [66, 76, 8, 30]];
    const FIXED = [[12, 30], [9, 52], [14, 72], [88, 30], [91, 52], [86, 72]];
    function placeRandom(el) {
      const z = ZONES[Math.floor(Math.random() * ZONES.length)];
      const colPct = (x) => { const c = Math.round((x / 100 * W - 8) / COLW); return ((c * COLW + 26) / W) * 100; };
      const x = colPct(z[0] + Math.random() * (z[1] - z[0]));
      const y = z[2] + Math.random() * (z[3] - z[2]);
      el.style.left = x.toFixed(2) + '%'; el.style.top = y.toFixed(2) + '%';
    }
    function placeAll() { entrances.forEach((el, i) => { el.style.left = FIXED[i][0] + '%'; el.style.top = FIXED[i][1] + '%'; }); }

    let timers = [];
    function cycle() {
      timers.forEach(clearTimeout); timers = [];
      if (RM.matches || reveal()) return;
      const schedule = (el, delay) => {
        timers.push(setTimeout(() => {
          if (reveal() || document.activeElement === el) return schedule(el, 4000);
          const lit = entrances.filter((e) => e.classList.contains('on')).length;
          if (lit >= 2) return schedule(el, 2500 + Math.random() * 3000);
          placeRandom(el);
          el.classList.add('on');
          timers.push(setTimeout(() => {
            if (el.matches(':hover') || document.activeElement === el) { schedule(el, 3000); return; }
            el.classList.remove('on');
            schedule(el, 5000 + Math.random() * 9000);
          }, 5200 + Math.random() * 3800));
        }, delay));
      };
      entrances.forEach((el, i) => schedule(el, 2600 + i * 1700 + Math.random() * 2400));
    }
    entrances.forEach((el) => {
      el.addEventListener('focus', () => { if (!el.classList.contains('on') && !reveal()) { placeRandom(el); el.classList.add('on'); } });
      el.addEventListener('blur', () => { if (!reveal()) setTimeout(() => el.classList.remove('on'), 1200); });
    });
    if (toggle && field) {
      toggle.addEventListener('click', () => {
        const on = field.classList.toggle('reveal');
        toggle.setAttribute('aria-pressed', String(on));
        toggle.textContent = on ? toggle.dataset.hide : toggle.dataset.show;
        if (on) { entrances.forEach((e) => e.classList.remove('on')); placeAll(); stop(); draw(0); } else { cycle(); start(); }
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(section);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    RM.addEventListener?.('change', () => { if (RM.matches) { stop(); placeAll(); draw(0); } else { cycle(); start(); } });
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 150); });
    resize();
    if (RM.matches) { placeAll(); draw(0); } else { start(); cycle(); }
  }

  /* ---- market strip: ECB reference rates, labelled, or an honest fallback ---- */
  const ticker = $('.ticker');
  if (ticker) initTicker(ticker);

  function initTicker(el) {
    const label = $('.ticker-label span', el);
    const track = $('.ticker-track', el);
    const src = $('.ticker-src', el);
    const PAIRS = [
      ['EUR/USD', 'EUR', true], ['GBP/USD', 'GBP', true], ['USD/JPY', 'JPY'], ['USD/CHF', 'CHF'], ['USD/CNY', 'CNY'],
      ['USD/INR', 'INR'], ['USD/BRL', 'BRL'], ['USD/MXN', 'MXN'], ['USD/MYR', 'MYR'], ['USD/ZAR', 'ZAR'],
    ];
    const fmt = (v, s) => v.toFixed(['JPY', 'INR'].includes(s) ? 2 : 4);
    const fmtDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

    function render(items, ariaLabel) {
      const list = (hidden) => `<ul class="ticker-list"${hidden ? ' aria-hidden="true"' : ` aria-label="${ariaLabel}"`}>${items}</ul>`;
      track.innerHTML = list(false) + list(true);
      const w = track.scrollWidth / 2;
      track.style.setProperty('--dur', Math.max(40, w / 38) + 's');
    }

    function fallback() {
      el.dataset.state = 'fallback';
      label.textContent = el.dataset.fallbackLabel;
      if (src) src.hidden = true;
      const items = $$('template#edition-items', document)[0];
      if (items) render(items.innerHTML, el.dataset.fallbackLabel);
    }

    async function load() {
      const cached = store.get('sf-fx');
      if (cached && Date.now() - cached.t < 30 * 60 * 1000) return cached.d;
      const start = new Date(Date.now() - 12 * 864e5).toISOString().slice(0, 10);
      const url = `https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=${PAIRS.map((p) => p[1]).join(',')}`;
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 6000);
      try {
        const r = await fetch(url, { signal: ctl.signal, mode: 'cors' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        store.set('sf-fx', { t: Date.now(), d });
        return d;
      } finally { clearTimeout(to); }
    }

    load().then((d) => {
      const dates = Object.keys(d.rates || {}).sort();
      if (dates.length < 2) throw new Error('not enough fixings');
      const now = d.rates[dates[dates.length - 1]], prev = d.rates[dates[dates.length - 2]];
      const items = PAIRS.map(([name, sym, inv]) => {
        if (now[sym] == null || prev[sym] == null) return '';
        const a = inv ? 1 / now[sym] : now[sym], b = inv ? 1 / prev[sym] : prev[sym];
        const chg = (a / b - 1) * 100;
        const flat = Math.abs(chg) < 0.005;
        const cls = flat ? 'flat' : chg > 0 ? 'up' : 'down';
        const arrow = flat ? '=' : chg > 0 ? '↑' : '↓';
        const sign = flat ? '' : chg > 0 ? '+' : '−';
        const words = flat ? 'unchanged' : chg > 0 ? 'up' : 'down';
        return `<li><span class="sym">${name}</span><span class="px num">${fmt(a, sym)}</span><span class="chg num ${cls}" aria-label="${words} ${Math.abs(chg).toFixed(2)} percent"><span aria-hidden="true">${arrow} ${sign}${Math.abs(chg).toFixed(2)}%</span></span></li>`;
      }).join('');
      if (!items) throw new Error('empty');
      el.dataset.state = 'live';
      const when = fmtDate(dates[dates.length - 1]);
      label.textContent = `ECB reference rates · ${when}`;
      if (src) { src.hidden = false; src.querySelector('.when').textContent = `change vs ${fmtDate(dates[dates.length - 2])}`; }
      render(items, `Foreign exchange reference rates published by the European Central Bank on ${when}. Daily fixings, not live quotes.`);
    }).catch(fallback);
  }

  /* ---- email signup: never claims success it cannot verify ---- */
  $$('form[data-signup]').forEach((form) => {
    const status = $('.form-status', form);
    const input = $('input[type="email"]', form);
    const btn = $('button[type="submit"]', form);
    const say = (msg, kind) => { status.textContent = msg; status.className = 'form-status ' + kind; };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!input.checkValidity() || !email) { say(form.dataset.msgInvalid, 'err'); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      input.removeAttribute('aria-invalid');
      const endpoint = form.dataset.endpoint;
      if (!endpoint) { say(form.dataset.msgOffline, 'info'); return; }
      btn.disabled = true; say(form.dataset.msgSending, 'info');
      try {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, source: 'solar-financial' }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        say(form.dataset.msgOk, 'ok'); form.reset();
      } catch { say(form.dataset.msgError, 'err'); } finally { btn.disabled = false; }
    });
  });

  /* ---- charts: hover and keyboard read-out ---- */
  $$('.chart').forEach((chart) => {
    const svg = $('svg', chart);
    const hits = $$('[data-tip]', chart);
    if (!svg || !hits.length) return;
    const tip = document.createElement('div');
    tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true');
    chart.appendChild(tip);
    const live = document.createElement('div');
    live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
    chart.appendChild(live);
    const cross = $('.crosshair', chart);
    let idx = -1;
    function show(h, px, py) {
      const rows = h.dataset.tip.split('|');
      tip.innerHTML = rows.map((r, i) => {
        if (i === 0) return `<div class="th">${r}</div>`;
        const [k, v, c] = r.split('::');
        return `<div class="tr"><span>${c ? `<i class="sw" style="background:${c}"></i>` : ''}${k}</span><b>${v || ''}</b></div>`;
      }).join('');
      chart.classList.add('has-hover');
      $$('.mark', chart).forEach((m) => m.classList.toggle('is-on', !h.dataset.key || h.dataset.key.split(' ').includes(m.dataset.key)));
      if (cross && h.dataset.cx) { cross.setAttribute('x1', h.dataset.cx); cross.setAttribute('x2', h.dataset.cx); }
      const cr = chart.getBoundingClientRect();
      let x = px - cr.left + 14, y = py - cr.top - 10;
      tip.classList.add('on');
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (x + tw > cr.width) x = px - cr.left - tw - 14;
      y = Math.max(0, Math.min(y - th / 2, cr.height - th));
      tip.style.left = Math.max(0, x) + 'px'; tip.style.top = y + 'px';
      live.textContent = rows.map((r) => r.split('::').slice(0, 2).join(' ')).join(', ');
    }
    function hide() { tip.classList.remove('on'); chart.classList.remove('has-hover'); $$('.mark', chart).forEach((m) => m.classList.remove('is-on')); }
    hits.forEach((h) => {
      h.addEventListener('pointerenter', (e) => show(h, e.clientX, e.clientY));
      h.addEventListener('pointermove', (e) => show(h, e.clientX, e.clientY));
      h.addEventListener('pointerleave', hide);
    });
    svg.setAttribute('tabindex', '0');
    const atHit = (i) => { const r = hits[i].getBoundingClientRect(); show(hits[i], r.left + r.width / 2, r.top + r.height / 2); };
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { idx = Math.min(hits.length - 1, idx + 1); atHit(idx); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); atHit(idx); e.preventDefault(); }
      else if (e.key === 'Escape') { hide(); idx = -1; }
    });
    svg.addEventListener('focus', () => { if (idx < 0) idx = 0; atHit(idx); });
    svg.addEventListener('blur', hide);
  });

  /* ---- reading progress ---- */
  const bar = $('.progress');
  const article = $('[data-article]');
  if (bar && article) {
    let q = false;
    const upd = () => {
      q = false;
      const r = article.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      bar.style.setProperty('--p', p.toFixed(4));
    };
    window.addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }
})();
