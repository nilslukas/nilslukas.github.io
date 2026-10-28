/* press-finish.js (19 Oct 2026, evening). Nils: "when I skip through the slide fast with the right arrow I often don't see
   the 'end' slide ... it just interrupts the animation and goes to the next slide ... when I press through always see the
   final slide after all animations". A forward press (ArrowRight, PageDown, Space) while a clip of the current slide is
   still playing does not advance: it jumps that clip to its end, so the driver shows the step's final still. The next
   press advances as usual. Runs in the capture phase on window, before deck.js's own keydown handler. */
(function () {
  var FWD = { ArrowRight: 1, PageDown: 1, ' ': 1 };
  function running(sec) {
    var out = [];
    sec.querySelectorAll('video').forEach(function (v) {
      if (v.loop || v.paused || v.ended) return;
      if (!(v.duration > 0) || v.currentTime >= v.duration - 0.06) return;
      out.push(v);
    });
    return out;
  }
  addEventListener('keydown', function (e) {
    if (!FWD[e.key] || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable], button, a')) return;
    var sec = document.querySelector('section.slide.is-active');
    if (!sec) return;
    var vs = running(sec);
    if (!vs.length) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    /* jump to just before the end and let the clip finish by itself, so the driver's onplaying / onended run in their
       usual order (seeking straight to the end could fire 'playing' after 'ended' and leave the figure blank) */
    vs.forEach(function (v) { try { v.currentTime = Math.max(v.currentTime, v.duration - 0.05); } catch (_) {} });
  }, true);
})();
