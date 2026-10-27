/* flow.js (Week 5, 21 Sep 2026; Nils on What Do We Want? and How a Watermark Works: "animate slightly the graphs
   where it shows the flow", "illustrate the flow subtly", "subtly animate the flow of information here").
   On every section.slide[data-flow], each wire of the pipeline drawing (path.pl-wire, path.wtm-wire) gets a twin
   path.flow with the same geometry and pathLength=600, so one short dash travels the wire once per cycle whatever
   its real length; the twin sits right after the wire in the same reveal group, so it appears with it. The dash is
   drawn in _head.html (path.flow); print and prefers-reduced-motion hide it there. The wire itself is untouched. */
(function () {
  function twin(p) {
    var f = p.cloneNode(false);
    f.removeAttribute('class'); f.removeAttribute('style'); f.removeAttribute('stroke-dasharray'); f.removeAttribute('id');
    // Week 9 (23 Sep 2026, architect): the dash takes the wire's colour class, so an amber outbound wire (.out) and a
    // teal wire (.ok) carry a matching dash; Week 5's copy knew only .at and .q.
    f.setAttribute('class', 'flow' + ['at', 'q', 'out', 'ok'].filter(function (c) { return p.classList.contains(c); }).map(function (c) { return ' ' + c; }).join(''));
    f.setAttribute('pathLength', '600');
    f.style.animationDelay = (-(Math.random() * 3.2)).toFixed(2) + 's';
    p.parentNode.insertBefore(f, p.nextSibling);
  }
  function run() {
    document.querySelectorAll('section.slide[data-flow]').forEach(function (s) {
      s.querySelectorAll('svg path.pl-wire, svg path.wtm-wire').forEach(function (p) {
        if (!p.getAttribute('d') || (p.nextSibling && p.nextSibling.classList && p.nextSibling.classList.contains('flow'))) return;
        twin(p);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
