/* Agent orbit — a faithful port of the adherence.ae hero instrument in its
   "team" state (the second panel: the whole team turning inside the harness).

   Every constant here is taken from the company page's own renderer so the
   two read as the same object: the agent table (radii, speeds, phases,
   colours), the rim and its travelling highlight, the field of points, the
   ring paths, the comet trails and the label placement.

   The team agents orbit OFF-CENTRE circles (ox/oy), which is what makes the
   paths lean past one another instead of sitting concentric.

   Time is milliseconds since the first frame and position is a pure function
   of it, so the motion never resets. Honours prefers-reduced-motion (a single
   still frame, as the original does by freezing its clock), pauses on a
   hidden tab, redraws on resize. Mounts into #agent-orbit. */
(function () {
  'use strict';

  var TAU   = Math.PI * 2;
  var SIG   = '31,94,214';      /* signal blue — rim, core agents, points  */
  var SIGHI = '96,152,255';     /* the brighter blue of the rim highlight  */

  /* The three core agents ride circles centred on the rim's centre. */
  var CORE = [
    { name: 'ARIA',  c: SIG, r1: 0.46, v:  1 / 5200, phs: 0.0 },
    { name: 'SAM',   c: SIG, r1: 0.61, v: -1 / 7600, phs: 2.1 },
    { name: 'RILEY', c: SIG, r1: 0.76, v:  1 / 9800, phs: 4.3 }
  ];

  /* The wider team orbits off-centre, so the tracks interleave. Two of them
     are deliberately unlabelled in the original. */
  var EXTRA = [
    { name: 'MAYA', c: '47,146,168',  r2: 0.74, ox: -0.05, oy:  0.18, v:  1 / 6100,  phs: 0.9 },
    { name: 'OMAR', c: '192,138,53',  r2: 0.66, ox:  0.20, oy: -0.12, v: -1 / 8200,  phs: 2.4 },
    { name: null,   c: '46,132,101',  r2: 0.70, ox: -0.22, oy:  0.02, v:  1 / 7100,  phs: 3.9 },
    { name: 'NOOR', c: '96,152,255',  r2: 0.76, ox:  0.06, oy: -0.20, v: -1 / 9400,  phs: 5.2 },
    { name: 'KAI',  c: '100,116,139', r2: 0.76, ox: -0.12, oy: -0.16, v:  1 / 8600,  phs: 0.4 },
    { name: null,   c: '40,88,170',   r2: 0.75, ox:  0.17, oy:  0.13, v: -1 / 10300, phs: 1.7 }
  ];

  var MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  function boot() {
    var host = document.getElementById('agent-orbit');
    if (!host) return;

    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = mq ? mq.matches : false;

    var cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'display:block;width:100%;height:100%;';
    host.appendChild(cv);

    var ctx = cv.getContext('2d');
    var W = 0, H = 0, S = 0;
    var raf = null, t0 = null, t = 0;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = cv.getBoundingClientRect();
      W = r.width; H = r.height; S = Math.min(W, H);
      if (!W || !H) return;
      cv.width  = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    }

    /* ---------- the primitives, as on adherence.ae ---------- */

    function ringPath(cx, cy, r, col) {
      ctx.strokeStyle = 'rgba(' + col + ',0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    }

    function ringTrail(cx, cy, r, u, dirV, col) {
      var dir = dirV > 0 ? -1 : 1;
      ctx.lineWidth = 2;
      for (var q = 0; q < 15; q++) {
        var a0 = u + dir * q * 0.05, a1 = u + dir * (q + 1) * 0.05;
        ctx.strokeStyle = 'rgba(' + col + ',' + (0.5 * (1 - q / 15)) + ')';
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
        ctx.stroke();
      }
    }

    function drawDot(x, y, col, r, label) {
      var gr = ctx.createRadialGradient(x, y, 0, x, y, 11);
      gr.addColorStop(0, 'rgba(' + col + ',0.5)');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();

      ctx.fillStyle = 'rgba(' + col + ',1)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();

      if (label) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(' + col + ',1)';
        ctx.font = Math.max(10, Math.round(S * 0.019)) + 'px ' + MONO;
        ctx.fillText(label, x + 9, y - 8);
      }
    }

    /* ---------- the instrument ---------- */

    function render() {
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);

      var cx = W / 2, cy = H / 2, R0 = Math.min(W, H) / 2 - 10;

      /* field of points */
      var sp = Math.max(16, R0 / 11), lim = R0 * 0.8;
      ctx.fillStyle = 'rgba(' + SIG + ',1)';
      for (var gx = cx % sp; gx < W; gx += sp) {
        for (var gy = cy % sp; gy < H; gy += sp) {
          var dd = Math.hypot(gx - cx, gy - cy);
          if (dd > lim) continue;
          ctx.globalAlpha = 0.05 + 0.13 * (1 - dd / lim);
          ctx.fillRect(gx - 0.9, gy - 0.9, 1.8, 1.8);
        }
      }
      ctx.globalAlpha = 1;

      /* the rim — the secure harness — and its travelling highlight */
      ctx.strokeStyle = 'rgba(' + SIG + ',0.5)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke();

      var hd = -Math.PI / 2 + (t / 6400) * TAU;
      ctx.strokeStyle = 'rgba(' + SIGHI + ',0.9)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R0, hd, hd + 0.85); ctx.stroke();
      ctx.lineCap = 'butt';

      /* the wider team, on off-centre tracks */
      for (var e = 0; e < EXTRA.length; e++) {
        var xo = EXTRA[e];
        var xr = xo.r2 * R0, xcx = cx + xo.ox * R0, xcy = cy + xo.oy * R0;
        var xu = xo.phs + t * xo.v * TAU;
        ringPath(xcx, xcy, xr, xo.c);
        ringTrail(xcx, xcy, xr, xu, xo.v, xo.c);
        drawDot(xcx + Math.cos(xu) * xr, xcy + Math.sin(xu) * xr,
                xo.c, 2.8, xo.name);
      }

      /* the three core agents, centred */
      for (var i = 0; i < CORE.length; i++) {
        var cg = CORE[i];
        var crr = cg.r1 * R0, cu = cg.phs + t * cg.v * TAU;
        ringPath(cx, cy, crr, cg.c);
        ringTrail(cx, cy, crr, cu, cg.v, cg.c);
        drawDot(cx + Math.cos(cu) * crr, cy + Math.sin(cu) * crr,
                cg.c, 3.4, cg.name);
      }
    }

    /* ---------- the loop ---------- */

    function frame(now) {
      if (t0 === null) t0 = now - t;   /* resume mid-phase after a pause */
      t = reduced ? 0 : now - t0;
      render();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf) return;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = null;
      t0 = null;          /* frame() re-bases off the stored t on resume */
    }

    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (ev) { reduced = ev.matches; });
    }

    size();
    start();
  }
})();
