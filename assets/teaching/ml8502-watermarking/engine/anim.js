/* anim.js — step-driven motion for the Week 9 deck (27 Sep 2026 rework; Nils: "many animations and ways to visualize
   results (e.g., with 3b1b ... or veritasium style)"). deck.js (frozen) already toggles .is-revealed / .is-now on every
   [data-reveal-step] element; most motion in this deck is CSS keyed on those classes. This file adds what CSS cannot
   do on its own, and nothing else:

   1. STEP CLASSES. Every section.slide gets the classes w9-ge1 … w9-geN for every step <= its current step, so a
      rule like `.slide.w9-ge5 .c130-tok{fill:#9aa7b6}` recolours a drawing from press 5 on without marking up each
      shape. Print drives every slide to its last step (deck.js beforeprint), so print shows the final state.
   2. TYPEWRITER.  <tspan|span data-type-step="k">text</tspan> types itself out, character by character, when the
      slide arrives at step k from step k-1 (data-type-ms = ms per character, default 38). Any other way of reaching
      a step >= k (jumping, going back, print, reduced motion) shows the full text at once; a step < k empties it.
   3. COUNTERS.    <tspan|span data-count-step="k" data-count-to="256" [data-count-from="0"] [data-count-ms="1400"]
      [data-count-dec="0"] [data-count-suffix=" %"]> runs a number up when step k arrives from k-1; the final value is
      the authored text, so print and a jump both show it.
   4. TRAVELLERS.  <circle|g data-travel="pathId" data-travel-step="k" [data-travel-ms="1400"]
      [data-travel-end="stay|hide"]> moves along the SVG path with id pathId when step k arrives from k-1, using
      getPointAtLength. At rest (after the run, a jump, print) it sits at the end of the path, or is hidden with
      data-travel-end="hide".
   5. MARKS.       any element with data-on-step="k" gets the class w9-on while the step is >= k, and w9-now at k,
      WITHOUT being hidden before (unlike data-reveal-step): use it to recolour, highlight or move something that is
      already on screen (the answer chip of a prediction, a token that turns grey, a switch that flips).
   6. HOOKS.       window.W9Anim.on('<data-name of the slide>', function (step, prev, slide) { ... }) for the few
      slides whose motion is its own script (called on arrival, on every step change, and before print with
      prev = -1, which means "no motion: draw the final state for this step").

   Deterministic, no network, no timers left running after a slide is left. prefers-reduced-motion and print skip
   every animation and draw the end state. Nothing here reads the keyboard. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var printing = false;
  var hooks = {};
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var caf = window.cancelAnimationFrame || clearTimeout;
  var live = [];   // running animations: {cancel()}

  function stepOf(s) { return Number(s.dataset.step || 0); }
  function maxOf(s) { return Number(s.dataset.maxStep || 0); }
  function still() { return reduce || printing; }

  function run(ms, tick, done) {
    if (still() || ms <= 0) { tick(1); if (done) done(); return; }
    var t0 = null, id = 0, stopped = false;
    function f(t) {
      if (stopped) return;
      if (t0 === null) t0 = t;
      var u = Math.min(1, (t - t0) / ms);
      tick(u);
      if (u < 1) id = raf(f); else if (done) done();
    }
    id = raf(f);
    var h = { cancel: function () { stopped = true; caf(id); tick(1); } };
    live.push(h);
    return h;
  }
  function ease(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  function setClasses(s, n) {
    for (var k = 1; k <= Math.max(maxOf(s), 12); k++) s.classList.toggle('w9-ge' + k, k <= n);
  }

  function typeEl(el, n, prev) {
    var k = Number(el.dataset.typeStep);
    if (el.dataset.full === undefined) el.dataset.full = el.textContent;
    var full = el.dataset.full;
    if (n < k) { el.textContent = ''; return; }
    if (n === k && prev === k - 1 && !still()) {
      var ms = Number(el.dataset.typeMs || 38) * full.length;
      el.textContent = '';
      run(ms, function (u) { el.textContent = full.slice(0, Math.round(u * full.length)); });
    } else el.textContent = full;
  }

  function countEl(el, n, prev) {
    var k = Number(el.dataset.countStep);
    if (el.dataset.full === undefined) el.dataset.full = el.textContent;
    var to = Number(el.dataset.countTo), from = Number(el.dataset.countFrom || 0);
    var dec = Number(el.dataset.countDec || 0), suf = el.dataset.countSuffix || '';
    function show(v) { el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; }
    if (n < k) { show(from); return; }
    if (n === k && prev === k - 1 && !still()) {
      run(Number(el.dataset.countMs || 1400), function (u) { show(from + (to - from) * ease(u)); },
        function () { el.textContent = el.dataset.full; });
    } else el.textContent = el.dataset.full;
  }

  function travelEl(el, n, prev, root) {
    var k = Number(el.dataset.travelStep);
    var path = root.querySelector('#' + el.dataset.travel);
    if (!path || !path.getTotalLength) return;
    var L = path.getTotalLength();
    var endHide = el.dataset.travelEnd === 'hide';
    function place(u) {
      var p = path.getPointAtLength(L * u);
      el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
    }
    if (n < k) { place(0); el.style.opacity = '0'; return; }
    if (n === k && prev === k - 1 && !still()) {
      el.style.opacity = '1';
      run(Number(el.dataset.travelMs || 1400), function (u) { place(ease(u)); },
        function () { if (endHide) el.style.opacity = '0'; });
    } else { place(1); el.style.opacity = endHide ? '0' : '1'; }
  }

  function apply(s, n, prev) {
    setClasses(s, n);
    s.querySelectorAll('[data-on-step]').forEach(function (el) {
      var k = Number(el.dataset.onStep); el.classList.toggle('w9-on', n >= k); el.classList.toggle('w9-now', n === k);
    });
    s.querySelectorAll('[data-type-step]').forEach(function (el) { typeEl(el, n, prev); });
    s.querySelectorAll('[data-count-step]').forEach(function (el) { countEl(el, n, prev); });
    s.querySelectorAll('[data-travel]').forEach(function (el) { travelEl(el, n, prev, s); });
    var h = hooks[s.dataset.name];
    if (h) h.forEach(function (fn) { try { fn(n, prev, s); } catch (e) { console.error('[anim]', e); } });
  }

  function stopAll() { var l = live; live = []; l.forEach(function (h) { h.cancel(); }); }

  var last = new WeakMap();
  function observe(s) {
    last.set(s, stepOf(s));
    apply(s, stepOf(s), -1);
    new MutationObserver(function () {
      var n = stepOf(s), prev = last.get(s);
      var active = s.classList.contains('is-active');
      if (n === prev && !active) return;
      last.set(s, n);
      if (n !== prev) apply(s, n, printing ? -1 : prev);
    }).observe(s, { attributes: true, attributeFilter: ['data-step', 'class'] });
  }

  function init() {
    document.querySelectorAll('section.slide').forEach(observe);
    /* leaving a slide finishes its motion so nothing keeps running off screen */
    var cur = document.querySelector('section.slide.is-active');
    setInterval(function () {
      var a = document.querySelector('section.slide.is-active');
      if (a !== cur) { stopAll(); cur = a; }
    }, 250);
  }

  addEventListener('beforeprint', function () {
    printing = true; stopAll();
    document.querySelectorAll('section.slide').forEach(function (s) { last.set(s, stepOf(s)); apply(s, stepOf(s), -1); });
  });
  addEventListener('afterprint', function () { printing = false; });

  window.W9Anim = {
    on: function (name, fn) {
      (hooks[name] = hooks[name] || []).push(fn);
      var s = document.querySelector('section.slide[data-name="' + name.replace(/"/g, '\\"') + '"]');
      if (s) { try { fn(stepOf(s), -1, s); } catch (e) { console.error('[anim]', e); } }
    },
    run: run, ease: ease, still: still
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
