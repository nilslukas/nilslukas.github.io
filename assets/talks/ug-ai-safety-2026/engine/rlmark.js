/* rlmark.js — flag every footer citation that is on this week's reading list (Nils, 2026-09-14:
   "please highlight the papers from the reading list"). The list is read off the deck itself: the
   slide named "Week 3 Reading List" carries twelve numbered rows whose citation cell links the
   paper, so the map from link to entry number is never written down twice. Every other slide's
   footer citations are compared by arXiv identifier (or by whole URL when there is none), and a
   match gets data-rl="Reading list NN", which the head's CSS draws as a small sand flag before the
   source number. Attribute plus generated content: no word for the budget, no glyph for the floor. */
(function () {
  'use strict';
  var rl = document.querySelector('.slide[data-name$="Reading List"]');
  if (!rl) return;
  function key(href) {
    var m = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/.exec(href || '');
    return m ? 'arxiv:' + m[1] : (href || '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  }
  var entries = {};
  Array.prototype.forEach.call(rl.querySelectorAll('td.source'), function (td) {
    var a = td.querySelector('a[href]'), num = td.previousElementSibling;
    if (!a || !num) return;
    var n = (num.textContent || '').trim();
    if (/^\d\d$/.test(n)) entries[key(a.getAttribute('href'))] = n;
  });
  if (!Object.keys(entries).length) return;
  Array.prototype.forEach.call(document.querySelectorAll('.slide'), function (s) {
    if (s === rl) return;
    Array.prototype.forEach.call(s.querySelectorAll('.footer .citation cite.src'), function (c) {
      var a = c.querySelector('a[href]');
      var n = a ? entries[key(a.getAttribute('href'))] : null;
      if (n) c.setAttribute('data-rl', 'Reading list ' + n);
    });
  });
})();
