/* Content and links work without JavaScript. */
(() => {
 const preference = matchMedia('(prefers-reduced-motion: reduce)');
 const readPause = key => { try { return localStorage.getItem(key) === 'true'; } catch (_) { return false; } };
 const savePause = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) {} };
 const motion = document.querySelector('.motion-toggle');
 const sun = document.querySelector('.sun');
 if (motion && sun) {
  let paused = readPause('jme-sun-paused');
  let range = 1, frame = 0, previous = -1;
  // Cache geometry on resize only. Scroll work reads scrollY and writes one variable.
  const measure = () => { range = Math.max(1, document.querySelector('.hero').offsetHeight); schedule(); };
  const render = () => {
   frame = 0;
   if (paused || preference.matches) return;
   const rise = Math.max(0, Math.min(1, window.scrollY / range));
   if (Math.abs(rise - previous) > .001) { sun.style.setProperty('--rise', rise.toFixed(3)); previous = rise; }
  };
  const schedule = () => { if (!frame && !paused && !preference.matches) frame = requestAnimationFrame(render); };
  const updateMotion = () => {
   motion.hidden = preference.matches;
   motion.setAttribute('aria-pressed', String(paused));
   motion.textContent = paused ? 'Resume sun' : 'Pause sun';
   if (preference.matches) { sun.style.setProperty('--rise', '.35'); previous = -1; }
   // Pausing leaves the exact current value untouched; resuming follows the scroll.
   schedule();
  };
  motion.addEventListener('click', () => { paused = !paused; savePause('jme-sun-paused', paused); updateMotion(); });
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', measure, {passive:true});
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.querySelector('.hero'));
  preference.addEventListener('change', updateMotion);
  measure(); updateMotion();
 }
 const tape = document.querySelector('.coverage-tape');
 const tapeButton = document.querySelector('.tape-toggle');
 if (tape && tapeButton) {
  let paused = readPause('jme-tape-paused');
  const updateTape = () => {
   tape.classList.add('tape-ready');
   tape.classList.toggle('tape-paused', paused || preference.matches);
   tapeButton.hidden = preference.matches;
   tapeButton.setAttribute('aria-pressed', String(paused));
   tapeButton.textContent = paused ? 'Resume tape' : 'Pause tape';
  };
  tapeButton.addEventListener('click', () => { paused = !paused; savePause('jme-tape-paused', paused); updateTape(); });
  preference.addEventListener('change', updateTape);
  // Offscreen tape does not need to consume animation frames.
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
   tape.classList.toggle('tape-offscreen', !entries[0].isIntersecting);
  }).observe(tape);
  updateTape();
 }
 // Reveals run once. Unsupported browsers and reduced-motion users see static content.
 const reveals = document.querySelectorAll('.reveal, .solar-study');
 let entryObserver;
 const showAll = () => { reveals.forEach(el => el.classList.remove('reveal-pending')); if (entryObserver) entryObserver.disconnect(); };
 if (!preference.matches && 'IntersectionObserver' in window) {
  entryObserver = new IntersectionObserver(entries => entries.forEach(entry => {
   if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); entryObserver.unobserve(entry.target); }
  }), {threshold:.08});
  reveals.forEach(el => { el.classList.add('reveal-pending'); entryObserver.observe(el); });
 }
 preference.addEventListener('change', () => { if (preference.matches) showAll(); });
 // Keyboard focus must never land in visually hidden reveal content.
 document.addEventListener('focusin', e => { const el = e.target.closest('.reveal-pending'); if (el) { el.classList.remove('reveal-pending'); if (entryObserver) entryObserver.unobserve(el); } });
 const menu = document.querySelector('.menu-toggle');
 const nav = document.querySelector('.main-nav');
 if (menu && nav) {
  document.documentElement.classList.add('js');
  const closeMenu = () => menu.setAttribute('aria-expanded', 'false');
  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') !== 'true')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
  matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
 }
 const clocks = document.querySelectorAll('.clock');
 const tick = () => {
  const now = new Date();
  clocks.forEach(clock => {
   const time = clock.querySelector('time');
   try { time.textContent = new Intl.DateTimeFormat('en-GB', {timeZone: clock.dataset.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(now); time.dateTime = now.toISOString(); } catch (_) {}
  });
 };
 if (clocks.length) { tick(); setInterval(tick, 30000); }
 document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
   const link = document.getElementById(button.dataset.copy);
   const status = document.querySelector('.copy-status');
   const address = link.getAttribute('href').replace(/^mailto:/, '').split('?')[0];
   try { await navigator.clipboard.writeText(address); status.textContent = 'Email address copied.'; }
   catch (_) { const range = document.createRange(); range.selectNodeContents(link); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); status.textContent = 'Copy unavailable. Use the email link, or copy the address shown above.'; }
  });
 });
})();
