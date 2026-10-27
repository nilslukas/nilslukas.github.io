/* edit-slider.js — "how many words must I edit to remove a KGW watermark?" as a dashboard
   (Nils, 21 Sep 2026, on One Edited Sentence: "it should show me how with KGW how many words I
   have to edit to remove the watermark and what the impact is given different parameters.. maybe
   you can animate this with a slider orsomething to make it intuitively understandable.. like a
   dashboard where you have a graph and words and everything and you slide some parameter and you
   can see how it changes").

   Markup, inside one slide (see src/420-one-edited-sentence.html for the live copy):
     <div class="es" data-edit-demo>
       <div class="es-ctl">
         <label>length <span class="ktx" data-tex="T"></span>
           <input type="range" data-p="T" min="50" max="400" step="10" value="200">
           <output data-o="T"></output></label>
         ... data-p="gamma" | "eta" | "k" ...
       </div>
       <div class="mstage" style="width:740px">
         <svg class="es-rule"  viewBox="0 0 740 62"  role="img" aria-label="..."></svg>
         <svg class="es-chips" viewBox="0 0 740 190" role="img" aria-label="..."></svg>
         <div class="scribs">...</div>
       </div>
       <div class="mstage" style="width:640px">
         <svg class="es-chart" viewBox="0 0 640 300" role="img" aria-label="..."></svg>
         <span class="mo sm halo es-kstar"><span class="ktx" data-tex="k^{*}"></span></span>
         ...
       </div>
       <p class="es-out" aria-live="polite"></p>
       <p class="es-read ...">Here <b data-o="ks"></b> of <b data-o="T2"></b> words ...</p>
     </div>

   THE MODEL, and where each line of it comes from. Kirchenbauer, Geiping, Wen, Katz, Miers &
   Goldstein, "A Watermark for Large Language Models", ICML 2023 (arXiv:2301.10226), archived in
   artifacts/papers/, is the source of the scheme, of the statistic and of the threshold:
     - Theorem 4.2, p. 5: with alpha = exp(delta) the expected green count of a marked sequence is
       at least  gamma alpha T / (1 + (alpha - 1) gamma) * S*,  where S* bounds the spike entropy.
       gamma alpha / (1 + (alpha - 1) gamma) is algebraically gamma alpha / (gamma alpha + 1 - gamma),
       so the green rate used here,
           g = gamma e^eta / (gamma e^eta + 1 - gamma),
       IS the paper's own rate with the spike entropy at its maximum, S* = 1, i.e. a uniform
       next-token distribution. The course writes eta for the logit bias the paper writes as delta
       (artifacts/course/notation.md section 5; alpha_bias = e^eta is the same alpha).
     - Section 4.1, p. 5: "a detection threshold of z = 4", so TAU = 4 below.
     - Section 4.1 / notation.md: z = (count - gamma T) / (T gamma (1 - gamma))^(1/2).
   THE EDIT ARITHMETIC IS THE COURSE'S OWN, not the paper's. At a context width of one token an
   edited word re-seeds the green list of its own position and of the position after it, so each
   edit turns TWO biased positions into fair coins (green with probability gamma):
       expected green count after k edits = (T - 2k) g + 2k gamma,  clamped at k = T/2
       z(k) = (T - 2k)(g - gamma) / (T gamma (1 - gamma))^(1/2)
   which is linear in k and reaches 0 at k = T/2. k* is the smallest integer k with z(k) < TAU. The
   arithmetic assumes the edits are spread out (no two adjacent, so their pairs do not overlap) and
   that no context repeats, so T counts scored positions. Both idealisations are on the slide's face
   and in its notes; nothing here is measured.

   The chips are a picture of ONE deterministic draw: a marked position is drawn green when a fixed
   integer hash of its index falls under g, so the strip redraws identically for the same settings
   and never disagrees with itself between presses. The printed numbers are the expectation, which
   the figure's tooltip says out loud.

   Deterministic, no network, keyboard-safe: each range input keeps the arrow keys to itself so
   deck.js does not turn a nudge into a slide change. Print shows whatever the sliders are set to,
   which on arrival is the default. Colours follow the deck: ink #071b34, slate #233c57,
   crimson #b0322a, teal #0e6a61; SVG type at 19 px or more (the 18 px floor is qa_slides.js). */
(function () {
  'use strict';

  var TAU = 4;                       // Kirchenbauer et al. 2023, section 4.1
  var NS = 'http://www.w3.org/2000/svg';
  var MAXT = 400;                    // the length slider's own maximum; the chip pool is this long
  var PERROW = 50, CW = 12, CH = 16, PX = 14.6, PY = 23, SX = 4;   // strip geometry, stage pixels
  var WORDS = ['the', 'cat', 'sat', 'on', 'the', 'step'];          // the six-word example
  var MEM = ['g', 'g', 'r', 'g', 'g', 'r'];                        // fixed memberships: the picture
  var EDIT_AT = 2;                   // zero-based: "sat" is the word the attacker replaces

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  // a fixed integer hash, so the same settings always draw the same strip
  function hash01(i) {
    var x = Math.imul(i + 1, 2654435761) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13;
    return (x >>> 8) / 16777216;
  }
  function greenRate(gamma, eta) { var a = gamma * Math.exp(eta); return a / (a + 1 - gamma); }
  function sd(T, gamma) { return Math.sqrt(T * gamma * (1 - gamma)); }
  function zAt(T, gamma, g, k) { return Math.max(T - 2 * k, 0) * (g - gamma) / sd(T, gamma); }
  // the smallest integer k with z(k) < TAU
  function kStar(T, gamma, g) {
    var d = g - gamma;
    if (d <= 0) return 0;
    var need = TAU * sd(T, gamma) / d;              // z < TAU  iff  T - 2k < need
    var k = Math.floor((T - need) / 2) + 1;
    return Math.min(Math.max(k, 0), T);
  }
  // k edits spread evenly over T positions; at k <= T/2 no two are adjacent, so each one
  // re-seeds a pair of positions of its own
  function editSet(T, k) {
    var s = {}, j;
    for (j = 1; j <= k; j++) s[Math.min(T, 1 + Math.floor((j - 0.5) * T / k))] = 1;
    return s;
  }

  function init(box) {
    var chips = box.querySelector('.es-chips'),
        rule = box.querySelector('.es-rule'),
        chart = box.querySelector('.es-chart'),
        out = box.querySelector('.es-out'),
        moK = box.querySelector('.es-kstar');
    if (!chips || !chart) return;

    var inp = {}, val = {};
    ['T', 'gamma', 'eta', 'k'].forEach(function (p) {
      inp[p] = box.querySelector('input[data-p="' + p + '"]');
    });
    box.querySelectorAll('[data-o]').forEach(function (n) { val[n.dataset.o] = n; });
    if (!inp.T || !inp.gamma || !inp.eta || !inp.k) return;

    /* ---------------------------------------------------------------- the six-word example */
    (function () {
      var w = 66, h = 32, pitch = 70, y = 8, i, x;
      rule.textContent = '';
      for (i = 0; i < WORDS.length; i++) {
        x = 8 + i * pitch;
        var seeded = (i === EDIT_AT || i === EDIT_AT + 1);
        rule.appendChild(el('rect', {
          'class': 'es-cw ' + (seeded ? 'c' : MEM[i]) + (i === EDIT_AT ? ' x' : ''),
          x: x, y: y, width: w, height: h, rx: 5
        }));
        rule.appendChild(el('text', {
          'class': 'es-w' + (i === EDIT_AT ? ' at' : ''), x: x + w / 2, y: y + 22, 'text-anchor': 'middle'
        }, WORDS[i]));
      }
      // the cross on the edited word, and the pair of positions it re-seeds
      x = 8 + EDIT_AT * pitch;
      rule.appendChild(el('path', {
        'class': 'es-x big',
        d: 'M' + (x + 12) + ' ' + (y + 7) + 'L' + (x + w - 12) + ' ' + (y + h - 7) +
           'M' + (x + w - 12) + ' ' + (y + 7) + 'L' + (x + 12) + ' ' + (y + h - 7)
      }));
      rule.appendChild(el('path', {
        'class': 'es-pair',
        d: 'M' + (x + 3) + ' ' + (y + h + 9) + 'H' + (x + 2 * pitch - 7)
      }));
    }());

    /* ------------------------------------------------------------------- the chip strip pool */
    var pool = [], cross = [], i;
    chips.textContent = '';
    for (i = 0; i < MAXT; i++) {
      pool.push(chips.appendChild(el('rect', { 'class': 'es-ch', width: CW, height: CH, rx: 3 })));
    }
    for (i = 0; i < MAXT; i++) {
      cross.push(chips.appendChild(el('path', { 'class': 'es-x' })));
    }

    /* ------------------------------------------------------------------------- the chart frame */
    var L = 80, R = 620, TOPY = 28, BASE = 240, VBW = 640, VBH = 300;
    chart.textContent = '';
    var band = chart.appendChild(el('rect', { 'class': 'es-band', x: L, width: R - L }));
    var line = chart.appendChild(el('path', { 'class': 'es-z' }));
    var tauline = chart.appendChild(el('path', { 'class': 'es-tau' }));
    var kstarline = chart.appendChild(el('path', { 'class': 'es-kline' }));
    var guide = chart.appendChild(el('path', { 'class': 'es-guide' }));
    chart.appendChild(el('path', { 'class': 'es-ax', d: 'M' + L + ' ' + TOPY + 'V' + BASE + 'H' + R }));
    var dot = chart.appendChild(el('circle', { 'class': 'es-dot', r: 8 }));
    var tTop = chart.appendChild(el('text', { 'class': 'es-n', x: L - 12, y: TOPY + 8, 'text-anchor': 'end' }));
    var tTau = chart.appendChild(el('text', { 'class': 'es-n at', x: L - 12, 'text-anchor': 'end' }, String(TAU)));
    chart.appendChild(el('text', { 'class': 'es-n', x: L - 12, y: BASE + 7, 'text-anchor': 'end' }, '0'));
    var tEnd = chart.appendChild(el('text', { 'class': 'es-n', x: R, y: BASE + 26, 'text-anchor': 'middle' }));
    chart.appendChild(el('text', { 'class': 'es-n', x: L, y: BASE + 26, 'text-anchor': 'middle' }, '0'));
    /* the x axis carries its plain name on its own row, under the two ticks; the symbol k is the
       .mo overlay beside it in the fragment (symbols on a drawing are KaTeX and never SVG text) */
    chart.appendChild(el('text', { 'class': 'es-n', x: 350, y: BASE + 51, 'text-anchor': 'middle' }, 'words edited'));
    var tHi = chart.appendChild(el('text', { 'class': 'es-zone', x: R - 8, y: TOPY + 26, 'text-anchor': 'end' }, 'detected'));
    var tLo = chart.appendChild(el('text', { 'class': 'es-zone gone', x: R - 8, 'text-anchor': 'end' }, 'mark gone'));

    function draw() {
      var T = Number(inp.T.value), gamma = Number(inp.gamma.value), eta = Number(inp.eta.value);
      if (Number(inp.k.max) !== T) inp.k.max = T;
      if (Number(inp.k.value) > T) inp.k.value = T;
      var k = Number(inp.k.value);

      var g = greenRate(gamma, eta), z0 = zAt(T, gamma, g, 0), z = zAt(T, gamma, g, k),
          ks = kStar(T, gamma, g),
          count = Math.max(T - 2 * k, 0) * g + Math.min(2 * k, T) * gamma,
          pct = Math.round(ks / T * 100);

      /* the strip: the first 2k spread-out positions lose their bias, the edited ones are crossed */
      var edits = editSet(T, k), reseeded = {}, j;
      for (j in edits) { reseeded[Number(j)] = 1; reseeded[Number(j) + 1] = 1; }
      /* the strip is as tall as the text is long: the viewBox grows with the number of rows, which
         is what makes the length slider visible as a longer text rather than a denser block. The
         .mstage keeps its 740 px width so one user unit stays one stage pixel. */
      var rows = Math.ceil(T / PERROW), y0 = 3;
      chips.setAttribute('viewBox', '0 0 740 ' + (rows * PY + 6));
      for (i = 0; i < MAXT; i++) {
        var p = i + 1, c = pool[i], xr = cross[i];
        if (p > T) { c.setAttribute('display', 'none'); xr.setAttribute('display', 'none'); continue; }
        var x = SX + (i % PERROW) * PX, y = y0 + Math.floor(i / PERROW) * PY;
        var chance = (2 * k >= T) || reseeded[p];
        c.setAttribute('display', 'inline');
        c.setAttribute('x', x.toFixed(1)); c.setAttribute('y', y);
        c.setAttribute('class', 'es-ch ' + (chance ? 'c' : (hash01(i) < g ? 'g' : 'r')) + (edits[p] ? ' x' : ''));
        if (edits[p]) {
          xr.setAttribute('display', 'inline');
          xr.setAttribute('d', 'M' + (x + 2.5).toFixed(1) + ' ' + (y + 3) + 'L' + (x + CW - 2.5).toFixed(1) + ' ' + (y + CH - 3) +
                               'M' + (x + CW - 2.5).toFixed(1) + ' ' + (y + 3) + 'L' + (x + 2.5).toFixed(1) + ' ' + (y + CH - 3));
        } else xr.setAttribute('display', 'none');
      }

      /* the chart: z against k is a straight line to zero at k = T/2 */
      var yMax = Math.max(8, Math.ceil(z0 * 1.15));
      var px = function (kk) { return L + kk / T * (R - L); },
          py = function (zz) { return BASE - Math.min(zz, yMax) / yMax * (BASE - TOPY); };
      line.setAttribute('d', 'M' + px(0).toFixed(1) + ' ' + py(z0).toFixed(1) +
                             'L' + px(T / 2).toFixed(1) + ' ' + py(0).toFixed(1) +
                             'L' + px(T).toFixed(1) + ' ' + py(0).toFixed(1));
      tauline.setAttribute('d', 'M' + L + ' ' + py(TAU).toFixed(1) + 'H' + R);
      band.setAttribute('y', py(TAU).toFixed(1));
      band.setAttribute('height', (BASE - py(TAU)).toFixed(1));
      tTau.setAttribute('y', (py(TAU) + 7).toFixed(1));
      tLo.setAttribute('y', (py(TAU) + 28).toFixed(1));
      tTop.textContent = String(yMax);
      tEnd.textContent = String(T);
      dot.setAttribute('cx', px(k).toFixed(1)); dot.setAttribute('cy', py(z).toFixed(1));
      guide.setAttribute('d', 'M' + px(k).toFixed(1) + ' ' + py(z).toFixed(1) + 'V' + BASE);
      kstarline.setAttribute('d', 'M' + px(ks).toFixed(1) + ' ' + py(TAU).toFixed(1) + 'V' + (BASE + 9));
      /* the k* label rides the crossing, in the empty wedge above the threshold line and right of
         the falling z line; clamped so it never leaves the plot */
      if (moK) {
        moK.style.left = (Math.min(px(ks) + 18, R - 26) / VBW * 100).toFixed(2) + '%';
        moK.style.top = (Math.max(py(TAU) - 22, TOPY + 10) / VBH * 100).toFixed(2) + '%';
      }

      /* the printed numbers */
      if (val.T) val.T.textContent = String(T);
      if (val.gamma) val.gamma.textContent = gamma.toFixed(2);
      if (val.eta) val.eta.textContent = eta.toFixed(1);
      if (val.k) val.k.textContent = String(k);
      if (val.ks) val.ks.textContent = String(ks);
      if (val.T2) val.T2.textContent = String(T);
      if (val.pct) val.pct.textContent = String(pct);
      if (out) {
        out.textContent = 'green rate ' + g.toFixed(2) + ' · expected green ' + Math.round(count) +
          ' · z ' + z.toFixed(1) + ' · gone after ' + ks + ' edits (' + pct + '%)';
      }
    }

    ['T', 'gamma', 'eta', 'k'].forEach(function (p) {
      inp[p].addEventListener('input', draw);
      inp[p].addEventListener('change', draw);
      ['keydown', 'keyup', 'keypress'].forEach(function (t) {
        inp[p].addEventListener(t, function (e) { e.stopPropagation(); });
      });
    });
    draw();
  }

  function boot() { document.querySelectorAll('[data-edit-demo]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
