/* Subtle animated CS backdrop: a proximity graph with slow "walkers" that
   trace paths across it (evokes graph traversal / pointer chasing). Very low
   opacity, warm-clay palette, respects prefers-reduced-motion, pauses when the
   tab is hidden.

   The graph is laid out over the FULL document height and the drawing is
   offset by the scroll position each frame, so the backdrop scrolls with the
   page while the canvas itself stays viewport-sized (cheap to redraw). */
(function () {
  'use strict';
  if (!document.body && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  function boot() {
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduce = mq ? mq.matches : false;

    var canvas = document.createElement('canvas');
    canvas.className = 'cs-bg';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext('2d');
    var W = 0, VH = 0, DOC = 0, DPR = 1;
    var nodes = [], edges = [], walkers = [];
    var raf = null, lastT = 0;

    var EDGE = '158, 74, 47';   /* --accent  (clay)        */
    var GLOW = '193, 95, 60';   /* --accent-bright (clay)  */
    var PARALLAX = 0.4;         /* backdrop scrolls at 40% of page speed */

    function docHeight() {
      var b = document.body, e = document.documentElement;
      return Math.max(b ? b.scrollHeight : 0, e ? e.scrollHeight : 0,
                      b ? b.offsetHeight : 0, e ? e.offsetHeight : 0, window.innerHeight);
    }
    function scrollY() {
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; VH = window.innerHeight; DOC = docHeight();
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(VH * DPR);
      build();
      if (reduce) drawStatic();
    }

    function build() {
      nodes = []; edges = []; walkers = [];
      var LH = PARALLAX * Math.max(0, DOC - VH) + VH;   /* span the graph must cover under parallax */
      var count = Math.max(14, Math.min(130, Math.round((W * LH) / 44000)));
      var cols = Math.max(3, Math.round(Math.sqrt(count * W / LH)));
      var rows = Math.max(3, Math.ceil(count / cols));
      var cw = W / cols, ch = LH / rows;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols && nodes.length < count; c++) {
          nodes.push({
            bx: (c + 0.5) * cw + (Math.random() - 0.5) * cw * 0.7,
            by: (r + 0.5) * ch + (Math.random() - 0.5) * ch * 0.7,
            ph: Math.random() * Math.PI * 2,
            heat: 0, adj: [], x: 0, y: 0
          });
        }
      }
      var maxD = Math.min(cw, ch) * 2.2;
      for (var i = 0; i < nodes.length; i++) {
        var near = [];
        for (var j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          var dx = nodes[i].bx - nodes[j].bx, dy = nodes[i].by - nodes[j].by;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) near.push({ j: j, d: d });
        }
        near.sort(function (a, b) { return a.d - b.d; });
        for (var m = 0; m < Math.min(3, near.length); m++) addEdge(i, near[m].j);
      }
      edges.forEach(function (e, idx) {
        nodes[e.a].adj.push({ node: e.b, edge: idx });
        nodes[e.b].adj.push({ node: e.a, edge: idx });
      });
      var wc = Math.max(2, Math.min(7, Math.round(nodes.length / 13)));
      for (var w = 0; w < wc; w++) spawnWalker();
    }

    function addEdge(a, b) {
      for (var e = 0; e < edges.length; e++) {
        if ((edges[e].a === a && edges[e].b === b) || (edges[e].a === b && edges[e].b === a)) return;
      }
      edges.push({ a: a, b: b, heat: 0 });
    }

    function spawnWalker() {
      if (!nodes.length) return;
      var s = Math.floor(Math.random() * nodes.length);
      if (!nodes[s].adj.length) return;
      var step = nodes[s].adj[Math.floor(Math.random() * nodes[s].adj.length)];
      walkers.push({ from: s, to: step.node, edge: step.edge, t: 0, speed: 0.09 + Math.random() * 0.08 });
    }

    function step(w, dt) {
      w.t += w.speed * dt;
      var e = edges[w.edge]; if (e) e.heat = Math.min(1, e.heat + dt * 1.1);
      if (w.t >= 1) {
        w.t = 0;
        var nd = nodes[w.to];
        nd.heat = Math.min(1, nd.heat + 0.9);
        var opts = nd.adj.filter(function (a) { return a.node !== w.from; });
        var pool = opts.length ? opts : nd.adj;
        var nx = pool[Math.floor(Math.random() * pool.length)];
        if (!nx) { walkers.splice(walkers.indexOf(w), 1); spawnWalker(); return; }
        w.from = w.to; w.to = nx.node; w.edge = nx.edge;
      }
    }

    function frame(ts) {
      var dt = Math.min(0.05, (ts - lastT) / 1000 || 0); lastT = ts;
      var s = ts / 1000;
      var off = scrollY() * PARALLAX;
      var top = off - 60, bot = off + VH + 60;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, VH);
      ctx.setTransform(DPR, 0, 0, DPR, 0, -off * DPR);

      for (var n = 0; n < nodes.length; n++) {
        var nd = nodes[n];
        nd.x = nd.bx + Math.sin(s * 0.2 + nd.ph) * 3;
        nd.y = nd.by + Math.cos(s * 0.17 + nd.ph) * 3;
      }
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i], a = nodes[e.a], b = nodes[e.b];
        if ((a.by < top && b.by < top) || (a.by > bot && b.by > bot)) {
          if (e.heat > 0.01) e.heat = Math.max(0, e.heat - dt * 0.35);
          continue;
        }
        ctx.strokeStyle = 'rgba(' + EDGE + ',0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (e.heat > 0.01) {
          ctx.strokeStyle = 'rgba(' + GLOW + ',' + (e.heat * 0.20) + ')'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          e.heat = Math.max(0, e.heat - dt * 0.35);
        }
      }
      for (var m = 0; m < nodes.length; m++) {
        var p = nodes[m];
        if (p.by >= top && p.by <= bot) {
          ctx.fillStyle = 'rgba(' + EDGE + ',' + (0.10 + p.heat * 0.45) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + p.heat * 1.5, 0, Math.PI * 2); ctx.fill();
        }
        if (p.heat > 0.01) p.heat = Math.max(0, p.heat - dt * 0.5);
      }
      for (var w = 0; w < walkers.length; w++) {
        var wk = walkers[w]; step(wk, dt);
        var fa = nodes[wk.from], tb = nodes[wk.to];
        if (!fa || !tb) continue;
        var wy0 = fa.by + (tb.by - fa.by) * wk.t;
        if (wy0 < top || wy0 > bot) continue;
        var wx = fa.x + (tb.x - fa.x) * wk.t, wy = fa.y + (tb.y - fa.y) * wk.t;
        var g = ctx.createRadialGradient(wx, wy, 0, wx, wy, 6);
        g.addColorStop(0, 'rgba(' + GLOW + ',0.42)');
        g.addColorStop(1, 'rgba(' + GLOW + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function drawStatic() {
      var off = scrollY() * PARALLAX, top = off - 60, bot = off + VH + 60;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, VH);
      ctx.setTransform(DPR, 0, 0, DPR, 0, -off * DPR);
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i], a = nodes[e.a], b = nodes[e.b];
        if ((a.by < top && b.by < top) || (a.by > bot && b.by > bot)) continue;
        ctx.strokeStyle = 'rgba(' + EDGE + ',0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.bx, a.by); ctx.lineTo(b.bx, b.by); ctx.stroke();
      }
      for (var n = 0; n < nodes.length; n++) {
        var p = nodes[n];
        if (p.by < top || p.by > bot) continue;
        ctx.fillStyle = 'rgba(' + EDGE + ',0.10)';
        ctx.beginPath(); ctx.arc(p.bx, p.by, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    function start() { if (reduce) return; if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    if (reduce) drawStatic(); else start();

    var rt;
    function onResize() { clearTimeout(rt); rt = setTimeout(resize, 200); }
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize);
    // In reduced-motion mode nothing redraws on its own, so keep the static
    // backdrop aligned with the page as it scrolls.
    window.addEventListener('scroll', function () {
      if (reduce) drawStatic();
      // If the document grew (lazy content), rebuild to cover the new height.
      else if (Math.abs(docHeight() - DOC) > VH) onResize();
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (ev) {
        reduce = ev.matches; stop();
        if (reduce) drawStatic(); else start();
      });
    }
  }
})();
