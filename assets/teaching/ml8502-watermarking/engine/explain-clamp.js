/* explain-clamp.js (deck-local, 2026-09-02). deck.css centres every [data-explain] tooltip over its
   target with no viewport clamp, so a target near the left or right edge of the stage loses part of its
   panel. On hover or focus this script measures the target and, when its centre is within half a panel
   (about 240px at the 26em cap) of the stage edge, adds .tipL or .tipR, which _head.html anchors to that
   edge. Classes are removed when the pointer leaves, so print is untouched. */
(function () {
  var HALF = 250;
  function clamp(el) {
    var stage = el.closest('.stage') || document.body;
    var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    var cx = (r.left + r.right) / 2;
    el.classList.remove('tipL', 'tipR');
    if (cx - s.left < HALF) el.classList.add('tipL');
    else if (s.right - cx < HALF) el.classList.add('tipR');
  }
  function on(e) { var t = e.target && e.target.closest ? e.target.closest('[data-explain]') : null; if (t) clamp(t); }
  document.addEventListener('mouseover', on, true);
  document.addEventListener('focusin', on, true);
})();
