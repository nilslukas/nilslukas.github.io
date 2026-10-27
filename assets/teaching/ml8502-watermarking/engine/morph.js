/* morph.js (shared engine; Week 9's w09-morph.js, generalised 19 Oct 2026): a Keynote-style Magic Move between slides (Nils, 19 Oct 2026: "can you make it so that we have
   something like the keynote magic move between slides?").

   How: the View Transitions API. When a key press would leave the slide (not just play its next build), the change is
   wrapped in document.startViewTransition. Elements that exist on both slides get the same view-transition-name, so
   the browser glides each one from its old box to its new box and cross-fades its content; everything else
   cross-fades as one picture. Matched, in this order:
     - [data-morph="key"] on both slides (author's choice: name the same object on two slides);
     - the headline, the logo pair and the footer (they hold still, so only their text changes);
     - the manim figure box (.w09m-fig): the shared context window and loop stay put while the picture changes;
     - an <img> with the same src on both slides (a paper figure shown again, e.g. setup -> result).
   deck.js is frozen, so this listens in the capture phase before deck.js and calls Deck.next() / Deck.prev() itself.
   Off for print, reduced motion, automated browsers (QA) without ?anim=1, and browsers without the API: those keep
   the deck's plain cut. Load after deck.js. */
(function () {
  'use strict';
  if (!document.startViewTransition || !window.Deck) return;
  var animParam = /[?&]anim=1\b/.test(location.search);
  if (navigator.webdriver === true && !animParam) return;
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
  document.documentElement.classList.add('w09-vt');

  var slides = Array.prototype.slice.call(document.querySelectorAll('section.slide'));
  var named = [];
  var busy = false;

  function maxStep(s) { return Number(s.dataset.maxStep || 0); }
  function step(s) { return Number(s.dataset.step || 0); }
  function current() { return slides[window.Deck.current()]; }

  function fixed(s) {
    /* key -> element for the parts every slide has */
    var m = {};
    var h = s.querySelector('.slide-head h2, .slide-head h1, .title-copy h1, .divider-copy h1');
    if (h) m['w09-title'] = h;
    var logos = s.querySelector('.xbrands');
    if (logos) m['w09-logos'] = logos;
    var foot = s.querySelector('.footer');
    if (foot) m['w09-footer'] = foot;
    var fig = s.querySelector('.w09m-fig');
    if (fig) m['w09-fig'] = fig;
    Array.prototype.forEach.call(s.querySelectorAll('[data-morph]'), function (el) { m['w09-m-' + el.dataset.morph] = el; });
    Array.prototype.forEach.call(s.querySelectorAll('.body img[src]:not(.w09m-still)'), function (el) {
      var src = el.getAttribute('src');
      if (!/^data:/.test(src)) m['w09-i-' + src.replace(/[^a-z0-9]/gi, '').slice(-40)] = el;
    });
    return m;
  }
  function clear() {
    named.forEach(function (el) { el.style.viewTransitionName = ''; });
    named = [];
  }
  function apply(map, keys) {
    keys.forEach(function (k) { map[k].style.viewTransitionName = k; named.push(map[k]); });
  }

  function morph(dir, e) {
    var from = current();
    var to = dir > 0 ? slides[window.Deck.current() + 1] : slides[window.Deck.current() - 1];
    /* a stack slide or the deck's ends: let deck.js decide, without a transition */
    if (!to || to.hasAttribute('data-stack') || from.hasAttribute('data-stack')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    var a = fixed(from), b = fixed(to);
    var keys = Object.keys(a).filter(function (k) { return b[k]; });
    clear();
    apply(a, keys);
    var vt = document.startViewTransition(function () {
      clear();
      if (dir > 0) window.Deck.next(); else window.Deck.prev();
      apply(fixed(current()), keys.filter(function (k) { return fixed(current())[k]; }));
    });
    vt.finished.finally(function () { clear(); busy = false; });
  }

  addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable], button, a')) return;
    /* the slide grid, the blank screen and the slide menu keep their own keys (deck.js) */
    var ov = document.getElementById('overview');
    if (ov && ov.classList.contains('is-open')) return;
    if (document.getElementById('blank') && document.getElementById('blank').style.display === 'block') return;
    if (document.body.classList.contains('menu-open')) return;
    var s = current();
    if (!s) return;
    var k = e.key;
    if ((k === 'ArrowRight' || k === 'PageDown' || k === ' ') && step(s) >= maxStep(s)) morph(1, e);
    else if ((k === 'ArrowLeft' || k === 'PageUp') && step(s) === 0) morph(-1, e);
  }, true);
})();
