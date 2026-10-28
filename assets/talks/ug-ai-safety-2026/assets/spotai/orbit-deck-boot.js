/* Deck bootstrap for the vendored agents-orbit.js. NOT part of the upstream
   asset -- agents-orbit.js is byte-identical to what nilslukas.github.io
   serves, and this file is the only thing added to make it work inside a deck.

   The orbit measures its host with getBoundingClientRect and re-draws on the
   window's resize event. A deck slide is display:none until it is activated,
   so the orbit's first measurement is 0x0 and the canvas would stay blank for
   the whole lecture. Re-firing the script's own resize listener the first time
   the host has a real box is the entire fix. Guarded on a changed width, so
   deck.js's own resize handler cannot start a feedback loop.

   Lives in its own file rather than in a <script> block on the slide because
   qa_slides.js counts slide.textContent against the reading budget, and inline
   script source counts as words the audience is supposedly reading. */
(function () {
  var host = document.getElementById('agent-orbit');
  if (!host || !window.ResizeObserver) return;
  var last = 0;
  new ResizeObserver(function () {
    var w = host.clientWidth;
    if (w > 0 && w !== last) { last = w; window.dispatchEvent(new Event('resize')); }
  }).observe(host);
})();
