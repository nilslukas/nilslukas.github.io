/* fpr-slider.js — the false-alarm / miss trade-off as a slider (Nils, 21 Sep 2026, on Detection as
   Hypothesis Testing: "maybe make a bit more overlap and make this slideable to show the trade-off";
   "make this with a slider please").

   Markup, inside a figure:
     <div class="fpr" data-fpr-demo data-mu="3" data-tau="2">
       <svg class="fpr-svg" viewBox="0 0 560 300" role="img" aria-label="..."></svg>
       <label class="fpr-ctl">threshold <input type="range" min="-1" max="6" step="0.05"></label>
       <p class="fpr-out" aria-live="polite"></p>
     </div>
   Two standard normal densities, the null at 0 and the marked statistic at mu (the separation the
   generation bought; 3 by default so the overlap is visible). The slider moves the threshold tau; the
   false-alarm rate is the null's area right of tau (crimson), the miss rate the marked curve's area
   left of it (teal); both are printed with the normal CDF. Deterministic, no network, keyboard-safe:
   the range input keeps the arrow keys to itself so deck.js does not turn a nudge into a slide change.
   Colours and sizes follow the deck: ink #071b34, slate #233c57, crimson #b0322a, teal #0e6a61, and
   SVG type at 19 px or more. Print shows the default state. */
(function () {
  'use strict';
  var W = 560, H = 300, L = 46, R = 540, BASE = 250, TOP = 40, XMIN = -3.6, XMAX = 6.6;
  function erf(x) { // Abramowitz and Stegun 7.1.26
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function Phi(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function pdf(x, mu) { return Math.exp(-0.5 * (x - mu) * (x - mu)) / Math.sqrt(2 * Math.PI); }
  function sx(x) { return L + (x - XMIN) / (XMAX - XMIN) * (R - L); }
  var SCALE = (BASE - TOP) / pdf(0, 0);
  function sy(p) { return BASE - p * SCALE; }
  function curve(mu, a, b) { // path of the density from a to b
    var d = [], n = 90;
    for (var i = 0; i <= n; i++) { var x = a + (b - a) * i / n; d.push((i ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(pdf(x, mu)).toFixed(1)); }
    return d.join(' ');
  }
  function area(mu, a, b) { return curve(mu, a, b) + ' L' + sx(b).toFixed(1) + ' ' + BASE + ' L' + sx(a).toFixed(1) + ' ' + BASE + ' Z'; }
  function fmt(p) { return p < 0.001 ? p.toExponential(1) : p.toFixed(3); }
  function init(box) {
    var svg = box.querySelector('svg'), inp = box.querySelector('input[type=range]'), out = box.querySelector('.fpr-out');
    if (!svg || !inp) return;
    var mu = Number(box.dataset.mu || 3), tau = Number(box.dataset.tau || inp.value || 2);
    inp.value = tau;
    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
    svg.textContent = '';
    var alpha = el('path', { 'class': 'fpr-alpha' }), beta = el('path', { 'class': 'fpr-beta' });
    svg.appendChild(alpha); svg.appendChild(beta);
    svg.appendChild(el('path', { 'class': 'fpr-c', d: curve(0, XMIN, XMAX) }));
    svg.appendChild(el('path', { 'class': 'fpr-c mk', d: curve(mu, XMIN, XMAX) }));
    svg.appendChild(el('path', { 'class': 'fpr-ax', d: 'M' + L + ' ' + BASE + ' H' + R }));
    var tl = el('path', { 'class': 'fpr-tau' }); svg.appendChild(tl);
    svg.appendChild(el('text', { 'class': 'fpr-t', x: sx(0), y: TOP - 14, 'text-anchor': 'middle' }, 'unmarked'));
    svg.appendChild(el('text', { 'class': 'fpr-t mk', x: sx(mu), y: TOP - 14, 'text-anchor': 'middle' }, 'marked'));
    svg.appendChild(el('text', { 'class': 'fpr-t dim', x: R, y: BASE - 10, 'text-anchor': 'end' }, 'detection statistic z'));
    var tt = el('text', { 'class': 'fpr-t at', y: BASE + 28, 'text-anchor': 'middle' }); svg.appendChild(tt);
    var ta = el('text', { 'class': 'fpr-t at', y: 122, 'text-anchor': 'start' }); svg.appendChild(ta);
    var tb = el('text', { 'class': 'fpr-t mk', y: 148, 'text-anchor': 'end' }); svg.appendChild(tb);
    function draw() {
      tau = Number(inp.value);
      var a = 1 - Phi(tau), b = Phi(tau - mu);
      alpha.setAttribute('d', area(0, tau, XMAX));
      beta.setAttribute('d', area(mu, XMIN, tau));
      tl.setAttribute('d', 'M' + sx(tau).toFixed(1) + ' ' + (TOP - 30) + ' V' + (BASE + 6));
      tt.setAttribute('x', sx(tau).toFixed(1)); tt.textContent = 'threshold ' + tau.toFixed(2);
      ta.setAttribute('x', (sx(tau) + 10).toFixed(1)); ta.textContent = 'false alarms ' + fmt(a);
      tb.setAttribute('x', (sx(tau) - 10).toFixed(1)); tb.textContent = 'misses ' + fmt(b);
      if (out) out.textContent = 'At a threshold of ' + tau.toFixed(2) + ': false-alarm rate ' + fmt(a) + ', miss rate ' + fmt(b) + '. Moving the line trades one for the other.';
    }
    inp.addEventListener('input', draw);
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { inp.addEventListener(t, function (e) { e.stopPropagation(); }); });
    draw();
  }
  document.querySelectorAll('[data-fpr-demo]').forEach(init);
})();
