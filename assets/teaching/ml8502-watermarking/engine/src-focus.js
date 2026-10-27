/* ============================================================================
   src-focus.js — hover a source, see only that source (Nils, 19 Oct 2026:
   "When I hover over a source, can you just highlight and color it, and
   dishighlight everything else that is not for the source?").

   Hovering a footer source (<cite class="src">) or an inline marker
   (<span class="srcref">) on the active slide:
     · lights that source up in amber: its footer entry and every inline
       marker with the same number;
     · dims everything else in the footer (the other sources, speaker,
       session, page number) and every inline marker of another source,
       together with the paragraph or item that marker sits in.
   Leaving it restores the slide. Nothing changes in print or in the exports:
   the classes exist only while the pointer is on a source.
   ======================================================================== */
(function () {
  'use strict';

  var SEL = '.footer .citation .src, .srcref';
  var BLOCK = 'p, li, td, figcaption, .figcap';
  var AMBER = '#ffc857';
  var current = null;
  var hovered = null;

  var s = document.createElement('style');
  s.textContent = [
    '.slide .footer>span,.slide .footer .citation .src,.slide .srcref,.slide .sf-block{transition:opacity .15s,color .15s,background-color .15s}',
    '.slide.sf-on .footer>span:not(.citation),.slide.sf-on .footer .citation .src:not(.sf-hit){opacity:.28}',
    '.slide.sf-on .footer .citation .src.sf-hit,.slide.sf-on .footer .citation .src.sf-hit>a,.slide.sf-on .footer .citation .src.sf-hit>.srcn{color:' + AMBER + '}',
    '.slide.sf-on .footer .citation .src.sf-hit>a{background-color:rgba(255,200,87,.16);box-shadow:0 0 0 3px rgba(255,200,87,.16);border-radius:2px}',
    '.slide.sf-on .srcref:not(.sf-hit),.slide.sf-on .sf-block.sf-dim{opacity:.28}',
    '.slide.sf-on .srcref.sf-hit{background:' + AMBER + ';color:#071b34;border-radius:3px;box-shadow:0 0 0 2px ' + AMBER + '}',
    '.slide.sf-on .sf-block.sf-lit{background-color:rgba(255,200,87,.16);box-shadow:0 0 0 4px rgba(255,200,87,.16);border-radius:3px}',
    '@media print{.slide.sf-on *{opacity:1!important}}'
  ].join('\n');
  document.head.appendChild(s);

  function clear() {
    hovered = null;
    if (!current) return;
    current.classList.remove('sf-on');
    Array.prototype.forEach.call(current.querySelectorAll('.sf-hit, .sf-block'), function (n) {
      n.classList.remove('sf-hit', 'sf-block', 'sf-lit', 'sf-dim');
    });
    current = null;
  }

  function focus(el) {
    var slide = el.closest('.slide');
    if (!slide) return;
    clear();
    current = slide;
    hovered = el;
    var n = el.getAttribute('data-n');
    /* by number only between a marker and its footer entry: the build can give two
       different footer entries the same number (two pages of one PDF) */
    var marker = el.classList.contains('srcref');
    var same = function (x) { return x === el || (n && x.getAttribute('data-n') === n && (marker || x.classList.contains('srcref'))); };
    Array.prototype.forEach.call(slide.querySelectorAll(SEL), function (x) {
      var hit = same(x);
      if (hit) x.classList.add('sf-hit');
      if (!x.classList.contains('srcref')) return;
      var b = x.parentElement && x.parentElement.closest(BLOCK);
      if (!b || !slide.contains(b) || b.closest('.footer')) return;
      b.classList.add('sf-block');
      if (hit) { b.classList.add('sf-lit'); b.classList.remove('sf-dim'); }
      else if (!b.classList.contains('sf-lit')) b.classList.add('sf-dim');
    });
    slide.classList.add('sf-on');
  }

  document.addEventListener('pointerover', function (e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (el) { if (el !== hovered) focus(el); return; }
    clear();
  });
  document.documentElement.addEventListener('pointerleave', clear);
  addEventListener('hashchange', clear);
  addEventListener('beforeprint', clear);
})();
