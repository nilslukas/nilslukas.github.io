/* motion.js v2.0 — the ML8502 animation library (27 Sep 2026). One file, no dependencies, no build step.
   Copy it into a deck's assets/ with `python3 artifacts/tools/sync_motion.py <deck>` and load it from src/_tail.html
   after deck.js, then the deck's own scene files after it.

   THE MANUAL is slides/shared/motion.md (every call, the three scene shapes, recipes); the gallery deck
   slides/motion-gallery/ shows each part on a real idea. WHEN and WHAT to animate is the slide skill's
   .claude/skills/ml8502-generate-slides/references/motion.md. This header is only a map of the file.

   Nils, 27 Sep 2026: "is there some source code reusable like a javascript library ... so that in the future it's
   easier to make these slides with just this library"; "I want students to understand the intuition of the most
   complicated and most beautiful ideas in each lecture's field."

   The contract (unchanged since v1): the drawing on a slide is a pure function of the slide's step. A forward press
   plays the change from step k-1 to step k once; arrival, going back, a grid jump, print, reduced motion and an
   automated browser draw the end frame of the current step at once. Nothing idles or loops. deck.js is frozen: this
   file only watches each slide's data-step and is-active.

   1. Declarative, no script:   data-draw="k"  data-travel="k" data-along=ID  data-count="k" data-to=N
                                data-on="k" | "k-m" (class mo-on)  data-type="k" (typewriter)
   2. Motion.scene(key, {setup, vars, draw, play, controls, ms, ease})     the default for anything that moves.
      A slide's picture is a function of a few named numbers; vars(step) gives them at every step's end frame, draw
      paints any set of them, and the library tweens between steps. Bound to <section data-motion=key> or to any
      element <div data-scene=key> inside a slide (several scenes per slide are fine).
   3. Motion.register(key, {init, render})     the v1 escape hatch: render(sec, step, st, anim) by hand.
   4. Parts: Motion.axes (plots, areas, dots, rules, arrows, trails, labels, bars, clouds, balls, fields, contours,
      TeX labels), Motion.graph, Motion.tokens, Motion.flip, Motion.wipe, Motion.camera.
   5. Helpers: Motion.math (erf, Phi, PhiInv, gauss, softmax, projections ...), Motion.fmt, Motion.color, Motion.mix,
      Motion.along, Motion.schedule, Motion.rng, Motion.ease, Motion.lerp, Motion.svg.
   6. Self-check: in an automated browser (qa_slides.js, motion_sheet.js) or with ?anim=1, every scene is run through
      all its steps and half-way frames once at load; problems are logged as console warnings starting "motion", which
      motion_sheet.js reports. */
(function () {
  'use strict';
  var VERSION = '2.0';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  var animParam = /[?&]anim=1\b/.test(location.search);
  var automated = navigator.webdriver === true && !animParam;
  var checking = navigator.webdriver === true || animParam;
  var printing = false;
  var mods = {}, scenes = {}, live = new Map(), clipCount = 0;

  function warn() {
    if (!window.console) return;
    console.warn.apply(console, ['motion'].concat(Array.prototype.slice.call(arguments)));
  }
  function assign(a, b) { for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }
  function num(v, d) { v = parseFloat(v); return isNaN(v) ? d : v; }

  /* ================================================================ easing, tweens */
  var ease = {
    inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    in: function (t) { return t * t * t; },
    lin: function (t) { return t; }
  };
  function easeFn(e) { return typeof e === 'function' ? e : (ease[e] || ease.inOut); }
  function instantMode() { return reduce || automated || printing; }

  /* the animation handle a press receives; `o` is anything with a token and a section */
  function handle(o) {
    var token = ++o.token;
    function alive() { return o.token === token && o.sec.classList.contains('is-active'); }
    return {
      alive: alive,
      ease: ease,
      tween: function (ms, f, e) {
        var fn = easeFn(e);
        if (!(ms > 0)) { if (alive()) f(1, 1); return Promise.resolve(alive()); }
        return new Promise(function (res) {
          var t0 = null;
          function frame(now) {
            if (!alive()) { res(false); return; }
            if (t0 === null) t0 = now;
            var t = Math.min(1, (now - t0) / ms);
            f(fn(t), t);
            if (t < 1) requestAnimationFrame(frame); else res(true);
          }
          requestAnimationFrame(frame);
        });
      },
      wait: function (ms) {
        return new Promise(function (res) { setTimeout(function () { res(alive()); }, ms); });
      }
    };
  }

  /* ================================================================ 1. declarative motion */
  function tweenEl(el, ms, delay, f, done, e) {
    var id = (el._mo = (el._mo || 0) + 1), t0 = null, fn = easeFn(e);
    function frame(now) {
      if (el._mo !== id) return;
      if (t0 === null) t0 = now;
      var t = (now - t0 - delay) / ms;
      if (t < 0) { requestAnimationFrame(frame); return; }
      if (t >= 1) { done(); return; }
      f(fn(t));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function cancel(el) { el._mo = (el._mo || 0) + 1; }
  function secs(el, name, dflt) { return num(el.dataset[name], dflt) * 1000; }

  function place(el, path, t) {
    var L = path.getTotalLength(), p = path.getPointAtLength(L * t);
    el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
  }
  function travel(el, step, press) {
    var k = Number(el.dataset.travel), svg = el.ownerSVGElement;
    var path = svg && svg.getElementById(el.dataset.along);
    if (!path) return;
    function rest() { place(el, path, 1); el.style.opacity = el.dataset.rest === 'hide' ? '0' : '1'; }
    if (step < k) { cancel(el); el.style.opacity = '0'; return; }
    if (!(press && step === k)) { cancel(el); rest(); return; }
    var delay = secs(el, 'delay', 0);
    place(el, path, 0);
    el.style.opacity = delay ? '0' : '1';
    tweenEl(el, secs(el, 'dur', 1.1), delay, function (t) { el.style.opacity = '1'; place(el, path, t); }, rest);
  }

  function fmtEl(el, v) { return v.toFixed(parseInt(el.dataset.fixed || '0', 10)); }
  function count(el, step, press) {
    var k = Number(el.dataset.count), from = num(el.dataset.from, 0), to = parseFloat(el.dataset.to);
    if (step < k) { cancel(el); el.textContent = fmtEl(el, from); return; }
    if (!(press && step === k)) { cancel(el); el.textContent = fmtEl(el, to); return; }
    el.textContent = fmtEl(el, from);
    tweenEl(el, secs(el, 'dur', 1), secs(el, 'delay', 0), function (t) { el.textContent = fmtEl(el, from + (to - from) * t); },
      function () { el.textContent = fmtEl(el, to); });
  }

  function draw(el, step, press) {
    var k = Number(el.dataset.draw), L;
    function rest() { el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; }
    if (step >= k && !(press && step === k)) { cancel(el); rest(); return; }
    /* measured now, not cached: a scene may have re-drawn the path since (a curve that grows with a parameter) */
    try { L = Math.ceil(el.getTotalLength()) + 1; } catch (_) { return; }
    el.style.strokeDasharray = L + ' ' + L;
    if (step < k) { cancel(el); el.style.strokeDashoffset = String(L); return; }
    el.style.strokeDashoffset = String(L);
    tweenEl(el, secs(el, 'dur', 1.2), secs(el, 'delay', 0), function (t) { el.style.strokeDashoffset = String(L * (1 - t)); }, rest);
  }

  /* data-on="3" (on from step 3) or "2-4" (steps 2 to 4): class mo-on, and mo-now at its first step. The element is
     never hidden by this; the deck's own CSS says what mo-on does (recolour, dim, move), with a transition if wanted. */
  function on(el, step) {
    var m = String(el.dataset.on).split('-'), a = Number(m[0]), b = m.length > 1 && m[1] !== '' ? Number(m[1]) : Infinity;
    el.classList.toggle('mo-on', step >= a && step <= b);
    el.classList.toggle('mo-now', step === a);
  }

  /* data-type="k": the text types itself out on the press into step k (data-dur seconds in all, else 38 ms a
     character), is empty before k and complete after. Reserve its space in the layout (a fixed width or height). */
  function type(el, step, press) {
    var k = Number(el.dataset.type);
    if (el._full === undefined) el._full = el.textContent;
    var full = el._full;
    if (step < k) { cancel(el); el.textContent = ''; return; }
    if (!(press && step === k)) { cancel(el); el.textContent = full; return; }
    el.textContent = '';
    tweenEl(el, el.dataset.dur ? secs(el, 'dur', 1) : full.length * 38, secs(el, 'delay', 0),
      function (t) { el.textContent = full.slice(0, Math.round(full.length * t)); },
      function () { el.textContent = full; }, 'lin');
  }

  var DECL = [['[data-travel]', travel], ['[data-count]', count], ['[data-draw]', draw], ['[data-on]', on], ['[data-type]', type]];
  var DECL_SEL = DECL.map(function (d) { return d[0]; }).join(',');

  /* ================================================================ 2. scenes */
  function Tween(to, ms, e) { return { to: to, ms: ms === undefined ? 900 : ms, ease: e }; }

  function isHex(s) { return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s); }
  function mixHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), o = '#';
    for (var s = 16; s >= 0; s -= 8) {
      var c = Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
      o += (c < 16 ? '0' : '') + c.toString(16);
    }
    return o;
  }
  /* numbers and arrays of numbers interpolate, #rrggbb colours mix, anything else switches when the tween ends */
  function mixv(x, y, e) {
    if (x === undefined) return y;
    if (typeof x === 'number' && typeof y === 'number') return x + (y - x) * e;
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) return x.map(function (xi, i) { return mixv(xi, y[i], e); });
    if (isHex(x) && isHex(y)) return mixHex(x, y, e);
    return e >= 1 ? y : x;
  }
  function mixState(a, b, e) {
    var o = assign({}, a);
    for (var k in b) o[k] = mixv(a[k], b[k], e);
    return o;
  }
  function same(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return same(x, b[i]); });
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      var ka = Object.keys(a), kb = Object.keys(b);
      return ka.length === kb.length && ka.every(function (k) { return same(a[k], b[k]); });
    }
    return false;
  }
  function stepOf(sec) { return Number(sec.dataset.step || 0); }

  function makeScene(key, spec, sec, box) {
    var sc = { key: key, spec: spec, sec: sec, box: box, token: 0, cur: null, ctx: {}, ctl: [], running: false };
    try { sc.ctx = (spec.setup && spec.setup(box, sec)) || {}; } catch (e) { warn(key, 'setup', e); }
    bindControls(sc);
    if (checking) selfCheck(sc);
    return sc;
  }
  function varsAt(sc, step) {
    try { return sc.spec.vars(step, sc.ctx) || {}; } catch (e) { warn(sc.key, 'vars(' + step + ')', e); return {}; }
  }
  function paint(sc, v) {
    sc.cur = v;
    try { sc.spec.draw(sc.ctx, v, sc.box); } catch (e) { warn(sc.key, 'draw', e); }
    syncControls(sc, v);
  }

  /* controls: {name: selector}. A range or number input sets a number; a select sets its value; a group of buttons
     sets each button's value (or data-value) when clicked and carries aria-pressed for the current one. Moving a
     control cancels a running press; a press moves the control, so a knob the room has watched turn can then be
     handed to the room. Keys on a control never reach deck.js. */
  function parse(v) { var n = Number(v); return v !== '' && !isNaN(n) ? n : v; }
  function bindControls(sc) {
    var c = sc.spec.controls || {};
    Object.keys(c).forEach(function (name) {
      var els = sc.box.querySelectorAll(c[name]);
      if (!els.length) { warn(sc.key, 'control not found:', c[name]); return; }
      els.forEach(function (el) {
        sc.ctl.push({ name: name, el: el });
        function set(val) {
          sc.token++; sc.running = false;
          var nv = assign({}, sc.cur || varsAt(sc, stepOf(sc.sec)));
          nv[name] = val;
          paint(sc, nv);
        }
        if (el.tagName === 'BUTTON') {
          el.addEventListener('click', function () { set(parse(el.value !== '' ? el.value : el.dataset.value)); });
        } else {
          el.addEventListener('input', function () { set(parse(el.value)); });
          el.addEventListener('change', function () { set(parse(el.value)); });
        }
        ['keydown', 'keyup', 'keypress'].forEach(function (ty) {
          el.addEventListener(ty, function (e) { e.stopPropagation(); });
        });
      });
    });
  }
  function syncControls(sc, v) {
    sc.ctl.forEach(function (c) {
      var val = v[c.name];
      if (val === undefined) return;
      if (c.el.tagName === 'BUTTON') {
        var mine = String(parse(c.el.value !== '' ? c.el.value : c.el.dataset.value)) === String(val);
        c.el.setAttribute('aria-pressed', mine ? 'true' : 'false');
      } else if (String(c.el.value) !== String(val)) {
        c.el.value = String(val);
      }
    });
  }

  function msFor(sc, step) {
    var m = sc.spec.ms;
    return typeof m === 'function' ? m(step, sc.ctx) : (m === undefined ? 900 : m);
  }
  function renderScene(sc, step, press) {
    var end = varsAt(sc, step);
    if (!press) { sc.token++; sc.running = false; paint(sc, end); return; }
    var interrupted = sc.running;
    var a = handle(sc);
    var list = sc.spec.play ? sc.spec.play(step, sc.ctx) : null;
    /* a play list names only the vars it moves, so a press made while the previous press still runs first completes
       that previous step; the plain tween below instead continues from the values on screen */
    if (list && (interrupted || !sc.cur)) paint(sc, varsAt(sc, step - 1));
    var from = sc.cur || varsAt(sc, step - 1);
    if (!list) {
      if (same(from, end)) { paint(sc, end); return; }
      list = [Tween(end, msFor(sc, step), sc.spec.ease)];
    }
    sc.running = true;
    runList(sc, a, list, 0).then(function (ok) { if (ok) { sc.running = false; paint(sc, end); } });
  }
  function runList(sc, a, list, i) {
    if (!a.alive()) return Promise.resolve(false);
    if (i >= list.length) return Promise.resolve(true);
    var seg = list[i];
    function next(ok) { return ok ? runList(sc, a, list, i + 1) : false; }
    if (seg.wait !== undefined) return a.wait(seg.wait).then(next);
    if (seg.set) { paint(sc, assign(assign({}, sc.cur), seg.set)); return next(true); }
    var from = sc.cur, target = assign(assign({}, from), seg.to);
    return a.tween(seg.ms, function (e) { paint(sc, mixState(from, target, e)); }, seg.ease).then(next);
  }

  /* run once per scene in an automated browser: every step's vars, the half-way frame of every press, the play
     lists, and no NaN written into the drawing. Warnings only; the slide still renders. */
  function selfCheck(sc) {
    var max = Number(sc.sec.dataset.maxStep || 0), key = sc.key, v0 = varsAt(sc, 0), names = Object.keys(v0);
    function nanScan(where) {
      var bad = null;
      sc.box.querySelectorAll('*').forEach(function (el) {
        if (bad) return;
        for (var i = 0; i < el.attributes.length; i++) {
          if (/NaN|Infinity/.test(el.attributes[i].value)) { bad = el.tagName + '[' + el.attributes[i].name + ']'; return; }
        }
      });
      if (bad) warn(key, 'check: NaN or Infinity written to', bad, where);
    }
    function tryDraw(v, where) {
      try { sc.spec.draw(sc.ctx, v, sc.box); } catch (e) { warn(key, 'check: draw failed', where, e); return; }
      nanScan(where);
    }
    var prev = v0;
    for (var k = 0; k <= max; k++) {
      var v = varsAt(sc, k);
      names.forEach(function (n) { if (!(n in v)) warn(key, 'check: vars(' + k + ') has no "' + n + '" (vars(0) has it)'); });
      Object.keys(v).forEach(function (n) {
        if (names.indexOf(n) < 0) warn(key, 'check: vars(' + k + ') adds "' + n + '"; give every var a value at every step');
        if (typeof v[n] === 'number' && !isFinite(v[n])) warn(key, 'check: vars(' + k + ').' + n + ' is ' + v[n]);
      });
      tryDraw(v, 'at step ' + k);
      if (k > 0) {
        tryDraw(mixState(prev, v, 0.5), 'half-way into step ' + k);
        var list = sc.spec.play ? sc.spec.play(k, sc.ctx) : null;
        if (list) {
          var s = assign({}, prev);
          list.forEach(function (seg) { if (seg.set) assign(s, seg.set); if (seg.to) assign(s, seg.to); });
          if (!Object.keys(v).every(function (n) { return same(s[n], v[n]); })) {
            warn(key, 'check: play(' + k + ') ends somewhere other than vars(' + k + '); the end frame will jump');
          }
        }
      }
      prev = v;
    }
    if (!same(varsAt(sc, max + 1), varsAt(sc, max))) warn(key, 'check: vars keeps changing after data-max-step="' + max + '"');
  }

  /* ================================================================ records: one per slide that uses motion */
  function render(rec, press, at) {
    var step = at === undefined ? stepOf(rec.sec) : at;
    DECL.forEach(function (d) {
      rec.sec.querySelectorAll(d[0]).forEach(function (el) {
        try { d[1](el, step, press); } catch (e) { warn(d[0], e); }
      });
    });
    if (rec.mod) {
      var a = null;
      if (press) a = handle(rec); else rec.token++;          // an instant draw cancels any running tween
      try { rec.mod.render(rec.sec, step, rec.st, a); } catch (e) { warn(rec.key, e); }
    }
    rec.scenes.forEach(function (sc) { renderScene(sc, step, press); });
  }

  function update(rec) {
    var active = rec.sec.classList.contains('is-active');
    var step = stepOf(rec.sec);
    if (active === rec.active && step === rec.step) return;
    var press = active && rec.active && step === rec.step + 1 && !instantMode();
    rec.active = active;
    rec.step = step;
    render(rec, press);
  }

  function setup(sec) {
    var key = sec.dataset.motion, rec = live.get(sec);
    var boxes = [];
    if (key && scenes[key]) boxes.push([key, sec]);
    sec.querySelectorAll('[data-scene]').forEach(function (b) { if (scenes[b.dataset.scene]) boxes.push([b.dataset.scene, b]); });
    if (!rec) {
      var mod = key ? mods[key] : null;
      if (!mod && !boxes.length && !sec.querySelector(DECL_SEL)) return;
      rec = { sec: sec, key: key, mod: null, st: null, step: -1, active: false, token: 0, scenes: [] };
      live.set(sec, rec);
      rec.obs = new MutationObserver(function () { update(rec); });
      rec.obs.observe(sec, { attributes: true, attributeFilter: ['class', 'data-step'] });
    }
    var fresh = false;
    if (!rec.mod && key && mods[key]) {
      rec.mod = mods[key];
      try { rec.st = (rec.mod.init && rec.mod.init(sec)) || {}; } catch (e) { warn(key, e); rec.st = {}; }
      fresh = true;
    }
    boxes.forEach(function (b) {
      if (b[1]._moScene) return;
      b[1]._moScene = makeScene(b[0], scenes[b[0]], sec, b[1]);
      rec.scenes.push(b[1]._moScene);
      fresh = true;
    });
    if (fresh) {                 /* a new module or scene draws the current step at once, never as a press */
      rec.active = sec.classList.contains('is-active');
      rec.step = stepOf(sec);
      render(rec, false);
    } else update(rec);
  }

  var scanned = false;
  function scan() { scanned = true; document.querySelectorAll('section.slide').forEach(setup); }
  function rescan(key) {
    if (!scanned) return;
    document.querySelectorAll('section.slide[data-motion="' + key + '"], section.slide:has([data-scene="' + key + '"])').forEach(setup);
  }

  addEventListener('beforeprint', function () {
    printing = true;
    live.forEach(function (rec) {
      /* deck.js also drives every slide to its last step for print; draw that end frame here without waiting */
      rec.step = Math.max(Number(rec.sec.dataset.maxStep || 0), stepOf(rec.sec));
      render(rec, false, rec.step);
    });
  });
  addEventListener('afterprint', function () {
    printing = false;
    live.forEach(function (rec) {
      rec.active = rec.sec.classList.contains('is-active');
      rec.step = stepOf(rec.sec);
      render(rec, false);
    });
  });

  /* ================================================================ base styles for the parts */
  /* Prepended to <head>, so a deck's own rules always win. Colours come from the deck's tokens where it has them:
     crimson is the attack, teal the defense, amber the open problem (usage.md), ink everything else. Layering follows
     the skill: the object at full strength, context at about 0.4, axes 0.4 and grid 0.15; type at 19 px or more. */
  var CSS = [
    ':root{--mo-ink:var(--ink-2,#233c57);--mo-muted:var(--ink-3,#60768d);--mo-attack:var(--coral,#b0322a);',
    '--mo-defense:#0e6a61;--mo-open:var(--amber,#8a6410);--mo-accent:var(--blue,#210eca);--mo-paper:#fff}',
    '.mo-ink{color:var(--mo-ink)}.mo-attack{color:var(--mo-attack)}.mo-defense{color:var(--mo-defense)}',
    '.mo-open{color:var(--mo-open)}.mo-accent{color:var(--mo-accent)}.mo-muted{color:var(--mo-muted)}',
    '.mo-axes{color:var(--mo-ink)}',
    '.mo-axis{fill:none;stroke:currentColor;stroke-opacity:.4;stroke-width:1.6}',
    '.mo-gridline{fill:none;stroke:currentColor;stroke-opacity:.15;stroke-width:1}',
    '.mo-tick{fill:var(--mo-muted);font-family:var(--sans,system-ui);font-size:19px;font-weight:600}',
    '.mo-curve{fill:none;stroke:currentColor;stroke-width:3.2;stroke-linejoin:round;stroke-linecap:round}',
    '.mo-area{fill:currentColor;fill-opacity:.2;stroke:none}',
    '.mo-dot{fill:currentColor;stroke:var(--mo-paper);stroke-width:2}',
    '.mo-rule{fill:none;stroke:currentColor;stroke-width:2;stroke-dasharray:6 5}',
    '.mo-line{fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
    '.mo-trail{fill:none;stroke:currentColor;stroke-width:2.4;stroke-dasharray:6 6;stroke-linecap:round}',
    '.mo-arrow .mo-shaft{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round}',
    '.mo-arrow .mo-head{fill:currentColor;stroke:none}',
    '.mo-label{fill:currentColor;font-family:var(--sans,system-ui);font-size:20px;font-weight:600}',
    '.mo-bar{fill:currentColor;fill-opacity:.85}',
    '.mo-cloud{fill:currentColor;fill-opacity:.75}',
    '.mo-ball{fill:currentColor;fill-opacity:.08;stroke:currentColor;stroke-width:2.2}',
    '.mo-contour{fill:none;stroke:currentColor;stroke-width:3;stroke-linejoin:round}',
    '.mo-field{image-rendering:auto}',
    '.mo-node{fill:var(--mo-paper);stroke:currentColor;stroke-width:2.4}',
    '.mo-edge{fill:none;stroke:currentColor;stroke-opacity:.4;stroke-width:2}',
    '.mo-tokens{display:flex;flex-wrap:wrap;gap:6px 5px;font-family:var(--mono,monospace);font-size:20px;line-height:1.25}',
    '.mo-tok{padding:1px 6px;border-radius:4px;border:1px solid transparent;color:var(--mo-ink);background:transparent;',
    'transition:background-color .25s,border-color .25s,opacity .25s}',
    '.mo-tok.is-hidden{visibility:hidden}',
    '.mo-tex{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none}',
    '@media (prefers-reduced-motion:reduce){.mo-tok{transition:none}}@media print{.mo-tok{transition:none}}'
  ].join('');
  function injectCSS() {
    if (document.querySelector('style[data-motion-base]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-motion-base', VERSION);
    st.textContent = CSS;
    var head = document.head || document.documentElement;
    head.insertBefore(st, head.firstChild);
  }
  injectCSS();

  /* ================================================================ math, formatting, colour */
  var M = {};
  M.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.linspace = function (a, b, n) { var o = []; for (var i = 0; i < n; i++) o.push(n === 1 ? a : a + (b - a) * i / (n - 1)); return o; };
  /* Abramowitz and Stegun 7.1.26, |error| < 1.5e-7 (the one the Week 5, 6 and 13 sliders each carried) */
  M.erf = function (x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  };
  M.normPdf = function (x, mu, s) { mu = mu || 0; s = s || 1; var z = (x - mu) / s; return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)); };
  M.Phi = function (x, mu, s) { mu = mu || 0; s = s || 1; return 0.5 * (1 + M.erf((x - mu) / (s * Math.SQRT2))); };
  /* the inverse normal CDF, Acklam's rational approximation (relative error < 1.2e-9) */
  M.PhiInv = function (p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
      c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], q, r;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  M.sigmoid = function (x) { return 1 / (1 + Math.exp(-x)); };
  M.logit = function (p) { return Math.log(p / (1 - p)); };
  M.softmax = function (xs, T) {
    T = T || 1; var m = Math.max.apply(null, xs), e = xs.map(function (x) { return Math.exp((x - m) / T); });
    var s = e.reduce(function (a, b) { return a + b; }, 0); return e.map(function (x) { return x / s; });
  };
  /* 1 - (1 - p)^n without losing tiny p: the chance of at least one success in n independent tries */
  M.atLeastOnce = function (p, n) { return -Math.expm1(n * Math.log1p(-p)); };
  /* a standard normal draw from a seeded uniform source (Box-Muller) */
  M.gauss = function (rand) { var u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  M.binomPmf = function (k, n, p) {
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;
    var lc = 0; for (var i = 1; i <= k; i++) lc += Math.log((n - k + i) / i);
    return Math.exp(lc + k * Math.log(p) + (n - k) * Math.log1p(-p));
  };
  /* P[Bin(n, p) >= k] and the one-sided Clopper-Pearson lower bound on p after k successes in n: the p_A a
     certificate may use (Cohen et al. 2019 certify at alpha = 0.001) */
  M.binomTail = function (k, n, p) { var s = 0; for (var i = k; i <= n; i++) s += M.binomPmf(i, n, p); return Math.min(1, s); };
  M.cpLower = function (k, n, alpha) {
    if (k <= 0) return 0;
    if (k >= n) return Math.pow(alpha, 1 / n);
    var lo = 0, hi = 1;
    for (var it = 0; it < 40; it++) { var m = (lo + hi) / 2; if (M.binomTail(k, n, m) < alpha) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  M.norm = function (v, p) {
    if (p === Infinity || p === 'inf') return Math.max.apply(null, v.map(Math.abs));
    p = p || 2; return Math.pow(v.reduce(function (s, x) { return s + Math.pow(Math.abs(x), p); }, 0), 1 / p);
  };
  /* Euclidean projection of point x onto the p-norm ball of radius eps around c, for p = 2, Infinity and 1 */
  M.project = function (x, c, eps, p) {
    var d = x.map(function (xi, i) { return xi - c[i]; });
    if (p === Infinity || p === 'inf') return d.map(function (di, i) { return c[i] + M.clamp(di, -eps, eps); });
    if (p === 1) {
      if (M.norm(d, 1) <= eps) return x.slice();
      var u = d.map(Math.abs).sort(function (a, b) { return b - a; }), cs = 0, th = 0;
      for (var j = 0; j < u.length; j++) { cs += u[j]; var t = (cs - eps) / (j + 1); if (u[j] > t) th = t; }
      return d.map(function (di, i) { return c[i] + Math.sign(di) * Math.max(0, Math.abs(di) - th); });
    }
    var n = M.norm(d, 2);
    return n <= eps ? x.slice() : d.map(function (di, i) { return c[i] + di * eps / n; });
  };
  /* a steepest-ascent step of size alpha under the p-norm: sign(g) for Infinity (FGSM, PGD), g/|g| for 2, and for 1
     all of alpha on the coordinate with the largest |g_i| */
  M.steepest = function (g, alpha, p) {
    if (p === Infinity || p === 'inf') return g.map(function (gi) { return alpha * Math.sign(gi); });
    if (p === 1) {
      var j = 0; g.forEach(function (gi, i) { if (Math.abs(gi) > Math.abs(g[j])) j = i; });
      return g.map(function (gi, i) { return i === j ? alpha * Math.sign(gi) : 0; });
    }
    var n = M.norm(g, 2) || 1; return g.map(function (gi) { return alpha * gi / n; });
  };
  /* central-difference gradient of a scalar function of a point */
  M.grad = function (f, x, h) {
    h = h || 1e-4;
    return x.map(function (_, i) {
      var a = x.slice(), b = x.slice(); a[i] += h; b[i] -= h; return (f(a) - f(b)) / (2 * h);
    });
  };

  var F = {
    int: function (n) { return Math.round(n).toLocaleString('en-US'); },
    fixed: function (x, d) { return Number(x).toFixed(d === undefined ? 2 : d); },
    pct: function (x, d) { return (100 * x).toFixed(d || 0) + '%'; },
    sign: function (x, d) { var s = Number(x).toFixed(d === undefined ? 2 : d); return (x >= 0 ? '+' : '−') + s.replace('-', ''); }
  };

  function color(name) {
    var v = '';
    try { v = getComputedStyle(document.documentElement).getPropertyValue('--mo-' + name).trim(); } catch (_) {}
    return v || ({ ink: '#233c57', muted: '#60768d', attack: '#b0322a', defense: '#0e6a61', open: '#8a6410', accent: '#210eca' })[name] || '#233c57';
  }
  function toHex(c) {
    if (isHex(c)) return c;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (!m) return c;
    return '#' + [m[1], m[2], m[3]].map(function (x) { var h = Number(x).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
  }

  /* value at fractional index h of a list of numbers or points, easing each segment on its own, so an iterate walking
     hop by hop slows into every landing: along([w0, w1, w2], 1.5) is half-way from w1 to w2 */
  function along(list, h, e) {
    var n = list.length - 1;
    if (n < 0) return undefined;
    if (n === 0) return list[0];
    h = M.clamp(h, 0, n);
    var i = Math.min(n - 1, Math.floor(h));
    return mixv(list[i], list[i + 1], easeFn(e === undefined ? 'inOut' : e)(h - i));
  }

  /* a sorted list of events on a clock, for searches and streams: flips.upTo(v.n) is every event at or before n */
  function schedule(evs) {
    var list = evs.slice().sort(function (a, b) { return a.at - b.at; });
    return {
      list: list,
      upTo: function (c) { var o = []; for (var i = 0; i < list.length && list[i].at <= c; i++) o.push(list[i]); return o; },
      count: function (c) { var i = 0; while (i < list.length && list[i].at <= c) i++; return i; },
      fold: function (c, init, f) { var s = init; for (var i = 0; i < list.length && list[i].at <= c; i++) s = f(s, list[i]); return s; }
    };
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ================================================================ 4. parts */
  function svg(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function cls(base, extra) { return extra ? base + ' ' + extra : base; }
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }
  function hide(el, h) { if (h) el.setAttribute('display', 'none'); else el.removeAttribute('display'); }

  function scale(dom, rng, log) {
    var d0 = log ? Math.log10(dom[0]) : dom[0], d1 = log ? Math.log10(dom[1]) : dom[1];
    function f(v) { var u = log ? Math.log10(v) : v; return rng[0] + (u - d0) / (d1 - d0) * (rng[1] - rng[0]); }
    f.inv = function (p) { var u = d0 + (p - rng[0]) / (rng[1] - rng[0]) * (d1 - d0); return log ? Math.pow(10, u) : u; };
    f.log = !!log; f.dom = dom.slice(); f.rng = rng.slice();
    return f;
  }
  function ticksOf(t) {
    if (!t) return [];
    return t.map(function (x) { return Array.isArray(x) ? x : [x, String(x)]; });
  }

  /* Motion.axes(svg, opts): a coordinate system inside an SVG, in the SVG's own user units.
       box   [left, top, right, bottom] in user units (default: the viewBox less a margin for tick labels)
       x, y  [min, max] data ranges; xlog / ylog: base-10 log scales (give the ranges in data units, e.g. [1, 1e4]);
             a reversed range ([1, 1e-6]) runs right to left
       xticks, yticks   [value, ...] or [[value, 'label'], ...]; labels at 19 px, edge labels anchored inward
       xgrid, ygrid     values that get a hairline (true = at the ticks)
       frame  'L' (left and bottom axis lines, the default), 'x' (bottom only), 'box', 'cross' (through 0), 'none'
       equal  true: shrink the box so one x unit and one y unit are the same length (planes, balls, clouds)
       clip   true: cut every part at the box (curves, balls, trails and labels included)
     Every part is retained: ax.rescale({x, y}) moves the whole picture to new ranges (a zoom), redrawing each part
     from the last values it was given. Parts draw in data coordinates; dots, clouds and rules hide outside the box,
     and clip: true cuts every other part there too. */
  function axes(root, o) {
    o = o || {};
    var vb = root.viewBox && root.viewBox.baseVal && root.viewBox.baseVal.width ? root.viewBox.baseVal : { x: 0, y: 0, width: 800, height: 450 };
    var b = (o.box || [vb.x + 70, vb.y + 20, vb.x + vb.width - 20, vb.y + vb.height - 44]).slice(), b0 = b.slice();
    var g = svg('g', { 'class': cls('mo-axes', o.cls) }, root);
    var under = svg('g', { 'class': 'mo-under' }, g), deco = svg('g', {}, g), layer = svg('g', { 'class': 'mo-layer' }, g);
    /* clip: true cuts everything drawn in data coordinates at the box (a zoom, a cloud wider than the view); labels
       that sit outside the box, such as an axis name under the axis, then belong in a second, unclipped axes or in
       plain SVG */
    var clipRect = null;
    if (o.clip) {
      var cid = 'mo-clip-' + (++clipCount), cp = svg('clipPath', { id: cid }, svg('defs', {}, g));
      clipRect = svg('rect', {}, cp);
      under.setAttribute('clip-path', 'url(#' + cid + ')');
      layer.setAttribute('clip-path', 'url(#' + cid + ')');
    }
    var parts = [];
    var ax = { g: g, layer: layer, under: under, box: b, parts: parts, opts: o };

    function fitEqual() {
      if (!o.equal) return;
      var bx = b0, w = bx[2] - bx[0], h = bx[3] - bx[1];
      var ux = w / Math.abs(o.x[1] - o.x[0]), uy = h / Math.abs(o.y[1] - o.y[0]), u = Math.min(ux, uy);
      var cx = (bx[0] + bx[2]) / 2, cy = (bx[1] + bx[3]) / 2, hw = u * Math.abs(o.x[1] - o.x[0]) / 2, hh = u * Math.abs(o.y[1] - o.y[0]) / 2;
      b[0] = cx - hw; b[2] = cx + hw; b[1] = cy - hh; b[3] = cy + hh;
    }
    function scales() {
      fitEqual();
      if (clipRect) { clipRect.setAttribute('x', b[0]); clipRect.setAttribute('y', b[1]); clipRect.setAttribute('width', b[2] - b[0]); clipRect.setAttribute('height', b[3] - b[1]); }
      ax.x = scale(o.x, [b[0], b[2]], o.xlog);
      ax.y = scale(o.y, [b[3], b[1]], o.ylog);
    }
    function decorate() {
      deco.textContent = '';
      var X = ax.x, Y = ax.y, xt = ticksOf(o.xticks), yt = ticksOf(o.yticks);
      var xg = o.xgrid === true ? xt.map(function (t) { return t[0]; }) : (o.xgrid || []);
      var yg = o.ygrid === true ? yt.map(function (t) { return t[0]; }) : (o.ygrid || []);
      xg.forEach(function (v) { var px = X(v); if (px >= b[0] - .5 && px <= b[2] + .5) svg('line', { 'class': 'mo-gridline', x1: f1(px), y1: b[1], x2: f1(px), y2: b[3] }, deco); });
      yg.forEach(function (v) { var py = Y(v); if (py >= b[1] - .5 && py <= b[3] + .5) svg('line', { 'class': 'mo-gridline', x1: b[0], y1: f1(py), x2: b[2], y2: f1(py) }, deco); });
      var fr = o.frame || 'L', x0 = b[0], y0 = b[3];
      if (fr === 'cross') { x0 = M.clamp(X(0), b[0], b[2]); y0 = M.clamp(Y(0), b[1], b[3]); }
      if (fr === 'L') svg('path', { 'class': 'mo-axis', d: 'M' + b[0] + ' ' + b[1] + 'V' + b[3] + 'H' + b[2] }, deco);
      if (fr === 'x') svg('line', { 'class': 'mo-axis', x1: b[0], y1: b[3], x2: b[2], y2: b[3] }, deco);
      if (fr === 'box') svg('rect', { 'class': 'mo-axis', x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1] }, deco);
      if (fr === 'cross') {
        svg('line', { 'class': 'mo-axis', x1: b[0], y1: f1(y0), x2: b[2], y2: f1(y0) }, deco);
        svg('line', { 'class': 'mo-axis', x1: f1(x0), y1: b[1], x2: f1(x0), y2: b[3] }, deco);
      }
      var gap = o.tickgap || 26, mark = o.tickmarks === false ? 0 : 6;
      xt.forEach(function (t) {
        var px = X(t[0]);
        if (!(px >= b[0] - .5 && px <= b[2] + .5)) return;
        var anchor = Math.abs(px - b[0]) < 1 ? 'start' : Math.abs(px - b[2]) < 1 ? 'end' : 'middle';
        if (mark) svg('line', { 'class': 'mo-axis', x1: f1(px), y1: y0, x2: f1(px), y2: y0 + mark }, deco);
        if (t[1] !== '') svg('text', { 'class': 'mo-tick', x: f1(px), y: f1(y0 + gap), 'text-anchor': anchor }, deco).textContent = t[1];
      });
      yt.forEach(function (t) {
        var py = Y(t[0]);
        if (!(py >= b[1] - .5 && py <= b[3] + .5)) return;
        if (mark) svg('line', { 'class': 'mo-axis', x1: x0 - mark, y1: f1(py), x2: x0, y2: f1(py) }, deco);
        if (t[1] !== '') svg('text', { 'class': 'mo-tick', x: x0 - 10, y: f1(py + 7), 'text-anchor': 'end' }, deco).textContent = t[1];
      });
    }
    scales();
    decorate();

    ax.pt = function (x, y) { return [ax.x(x), ax.y(y)]; };
    ax.inside = function (px, py, pad) {
      pad = pad || 0.5;
      return isFinite(px) && isFinite(py) && px >= b[0] - pad && px <= b[2] + pad && py >= b[1] - pad && py <= b[3] + pad;
    };
    ax.rescale = function (r) {
      if (r.x) o.x = r.x.slice();
      if (r.y) o.y = r.y.slice();
      scales(); decorate();
      parts.forEach(function (p) { if (p._redraw) p._redraw(); });
      return ax;
    };
    function part(p, redraw) { p._redraw = redraw; parts.push(p); return p; }
    function el(tag, base, opts, parent) {
      opts = opts || {};
      var e = svg(tag, assign({ 'class': cls(base, opts.cls) }, opts.attrs || {}), parent || (opts.under ? under : layer));
      if (opts.id) e.id = opts.id;
      return e;
    }

    /* sample f over [from, to] (in log space on a log axis) into a path that breaks wherever the curve leaves the
       box; p.exit is the first point where it leaves, so a curve that falls through the floor can end on a mark */
    function sampled(f, from, to, n) {
      var X = ax.x, Y = ax.y, lg = X.log, d = [], exit = null, prev = null, drawing = false;
      var a = lg ? Math.log10(from) : from, c = lg ? Math.log10(to) : to;
      function xv(u) { return lg ? Math.pow(10, u) : u; }
      function py(u) { var v = f(xv(u)); return (typeof v === 'number') ? Y(v) : NaN; }
      function ins(u) { var p = py(u); return ax.inside(X(xv(u)), p); }
      function edge(u0, u1) {   /* bisect between an inside and an outside sample */
        var inA = ins(u0);
        for (var k = 0; k < 24; k++) { var m = (u0 + u1) / 2; if (ins(m) === inA) u0 = m; else u1 = m; }
        var u = inA ? u0 : u1, p = M.clamp(py(u), b[1], b[3]);
        return [X(xv(u)), isFinite(p) ? p : (inA ? b[3] : b[1])];
      }
      for (var i = 0; i <= n; i++) {
        var u = n ? a + (c - a) * i / n : a, px = X(xv(u)), p = py(u), inside = ax.inside(px, p);
        if (inside) {
          if (!drawing) {
            if (prev !== null) { var e0 = edge(prev, u); d.push('M' + f1(e0[0]) + ' ' + f1(e0[1])); d.push('L' + f1(px) + ' ' + f1(p)); }
            else d.push('M' + f1(px) + ' ' + f1(p));
            drawing = true;
          } else d.push('L' + f1(px) + ' ' + f1(p));
        } else if (drawing) {
          var e1 = edge(prev, u); d.push('L' + f1(e1[0]) + ' ' + f1(e1[1]));
          if (!exit) exit = e1;
          drawing = false;
        }
        prev = u;
      }
      return { d: d.join(''), exit: exit };
    }

    ax.plot = function (f, opts) {
      opts = opts || {};
      var e = el('path', 'mo-curve', opts), p = { el: e, exit: null, f: f, from: opts.from, to: opts.to };
      p.set = function (fn, from, to) {
        if (fn) p.f = fn; if (from !== undefined) p.from = from; if (to !== undefined) p.to = to;
        var lo = p.from === undefined ? o.x[0] : p.from, hi = p.to === undefined ? o.x[1] : p.to;
        var s = sampled(p.f, lo, hi, opts.n || 160);
        e.setAttribute('d', s.d || 'M0 0'); hide(e, !s.d); p.exit = s.exit;
        return p;
      };
      p.set();
      return part(p, function () { p.set(); });
    };

    /* the region between f and a baseline (default the bottom of the box) over [a, b]: a tail probability, a mass */
    ax.area = function (f, a0, b0, opts) {
      opts = opts || {};
      var e = el('path', 'mo-area', assign({ under: true }, opts)), p = { el: e, f: f, a: a0, b: b0, base: opts.base };
      p.set = function (fn, a1, b1) {
        if (fn) p.f = fn; if (a1 !== undefined) p.a = a1; if (b1 !== undefined) p.b = b1;
        var lo = Math.max(Math.min(p.a, p.b), Math.min(o.x[0], o.x[1])), hi = Math.min(Math.max(p.a, p.b), Math.max(o.x[0], o.x[1]));
        if (!(hi > lo)) { hide(e, true); return p; }
        var n = opts.n || 120, base = p.base === undefined ? b[3] : M.clamp(ax.y(p.base), b[1], b[3]), X = ax.x, lg = X.log;
        var ua = lg ? Math.log10(lo) : lo, ub = lg ? Math.log10(hi) : hi, d = 'M' + f1(X(lo)) + ' ' + f1(base);
        for (var i = 0; i <= n; i++) {
          var u = ua + (ub - ua) * i / n, xv = lg ? Math.pow(10, u) : u, py = ax.y(p.f(xv));
          if (!isFinite(py)) py = py > 0 ? b[3] : b[1];
          d += 'L' + f1(X(xv)) + ' ' + f1(M.clamp(py, b[1], b[3]));
        }
        e.setAttribute('d', d + 'L' + f1(X(hi)) + ' ' + f1(base) + 'Z'); hide(e, false);
        return p;
      };
      p.set();
      return part(p, function () { p.set(); });
    };

    ax.dot = function (opts) {
      opts = opts || {};
      var e = el('circle', 'mo-dot', opts), p = { el: e, x: NaN, y: NaN };
      e.setAttribute('r', opts.r || 8); hide(e, true);
      p.at = function (x, y) {
        p.x = x; p.y = y;
        var q = ax.pt(x, y), ok = opts.clip === false ? isFinite(q[0]) && isFinite(q[1]) : ax.inside(q[0], q[1]);
        hide(e, !ok);
        if (ok) { e.setAttribute('cx', f1(q[0])); e.setAttribute('cy', f1(q[1])); }
        return p;
      };
      return part(p, function () { p.at(p.x, p.y); });
    };
    /* a vertical rule at x or a horizontal one at y, across the box (a threshold, 1/N, a budget) */
    ax.vline = function (opts) {
      opts = opts || {};
      var e = el('line', 'mo-rule', opts), p = { el: e, v: NaN };
      hide(e, true);
      p.at = function (x) {
        p.v = x; var px = ax.x(x), ok = px >= b[0] - .5 && px <= b[2] + .5;
        hide(e, !ok);
        if (ok) { e.setAttribute('x1', f1(px)); e.setAttribute('x2', f1(px)); e.setAttribute('y1', opts.top !== undefined ? opts.top : b[1]); e.setAttribute('y2', b[3]); }
        return p;
      };
      return part(p, function () { p.at(p.v); });
    };
    ax.hline = function (opts) {
      opts = opts || {};
      var e = el('line', 'mo-rule', opts), p = { el: e, v: NaN };
      hide(e, true);
      p.at = function (y) {
        p.v = y; var py = ax.y(y), ok = py >= b[1] - .5 && py <= b[3] + .5;
        hide(e, !ok);
        if (ok) { e.setAttribute('y1', f1(py)); e.setAttribute('y2', f1(py)); e.setAttribute('x1', b[0]); e.setAttribute('x2', b[2]); }
        return p;
      };
      return part(p, function () { p.at(p.v); });
    };
    /* a segment in data coordinates */
    ax.line = function (opts) {
      opts = opts || {};
      var e = el('line', 'mo-line', opts), p = { el: e, a: null, b: null };
      p.set = function (a, c) {
        p.a = a; p.b = c; var q = ax.pt(a[0], a[1]), r = ax.pt(c[0], c[1]);
        e.setAttribute('x1', f1(q[0])); e.setAttribute('y1', f1(q[1])); e.setAttribute('x2', f1(r[0])); e.setAttribute('y2', f1(r[1]));
        return p;
      };
      return part(p, function () { if (p.a) p.set(p.a, p.b); });
    };
    /* an arrow from a to b in data coordinates (a gradient, a step, a force); a zero-length arrow hides */
    ax.arrow = function (opts) {
      opts = opts || {};
      var g2 = el('g', 'mo-arrow', opts), shaft = svg('path', { 'class': 'mo-shaft' }, g2), head = svg('path', { 'class': 'mo-head' }, g2);
      var p = { el: g2, a: null, b: null };
      p.set = function (a, c) {
        p.a = a; p.b = c;
        var q = ax.pt(a[0], a[1]), r = ax.pt(c[0], c[1]);
        arrowPath(shaft, head, q, r, opts.head || 13);
        return p;
      };
      return part(p, function () { if (p.a) p.set(p.a, p.b); });
    };
    /* a polyline through data points: the path an iterate has walked */
    ax.trail = function (opts) {
      opts = opts || {};
      var e = el('polyline', 'mo-trail', opts), p = { el: e, pts: [] };
      p.set = function (pts) {
        p.pts = pts;
        e.setAttribute('points', pts.map(function (q) { var r = ax.pt(q[0], q[1]); return f1(r[0]) + ',' + f1(r[1]); }).join(' '));
        return p;
      };
      return part(p, function () { p.set(p.pts); });
    };
    /* SVG text at a data point; opts.dx, opts.dy offset it in user units, opts.anchor = start | middle | end */
    ax.text = function (str, opts) {
      opts = opts || {};
      var e = el('text', 'mo-label', opts), p = { el: e, x: NaN, y: NaN };
      hide(e, true);
      if (opts.anchor) e.setAttribute('text-anchor', opts.anchor);
      e.textContent = str;
      p.text = function (s) { e.textContent = s; return p; };
      p.at = function (x, y) {
        p.x = x; p.y = y; var q = ax.pt(x, y);
        hide(e, !(isFinite(q[0]) && isFinite(q[1])));
        e.setAttribute('x', f1(q[0] + (opts.dx || 0))); e.setAttribute('y', f1(q[1] + (opts.dy || 0)));
        return p;
      };
      return part(p, function () { p.at(p.x, p.y); });
    };
    /* bars: values at positions xs (numbers, or category indices), each `width` data units wide, from the baseline
       0 (or opts.base) up; set(values) animates cleanly when values are interpolated by a scene */
    ax.bars = function (xs, opts) {
      opts = opts || {};
      var g2 = el('g', '', opts), rects = xs.map(function () { return svg('rect', { 'class': 'mo-bar' }, g2); });
      var p = { el: g2, rects: rects, xs: xs, vals: xs.map(function () { return 0; }) };
      p.set = function (vals) {
        p.vals = vals;
        var w = opts.width === undefined ? 0.8 : opts.width, base = ax.y(opts.base || 0);
        rects.forEach(function (r, i) {
          var x0 = ax.x(xs[i] - w / 2), x1 = ax.x(xs[i] + w / 2), y1 = M.clamp(ax.y(vals[i]), b[1], b[3]), yb = M.clamp(base, b[1], b[3]);
          r.setAttribute('x', f1(Math.min(x0, x1))); r.setAttribute('width', f1(Math.abs(x1 - x0)));
          r.setAttribute('y', f1(Math.min(y1, yb))); r.setAttribute('height', f1(Math.abs(yb - y1)));
        });
        return p;
      };
      p.set(p.vals);
      return part(p, function () { p.set(p.vals); });
    };
    /* many small dots in one go (samples, a noise cloud, a dataset). set(points, classOf) where classOf(point, i)
       returns an extra class for that dot (mo-attack, mo-defense ...) or null; points outside the box are hidden */
    ax.cloud = function (opts) {
      opts = opts || {};
      var g2 = el('g', '', opts), dots = [], p = { el: g2, pts: [], of: null };
      p.set = function (pts, classOf) {
        p.pts = pts; p.of = classOf || null;
        while (dots.length < pts.length) dots.push(svg('circle', { r: opts.r || 4.5 }, g2));
        dots.forEach(function (c, i) {
          if (i >= pts.length) { hide(c, true); return; }
          var q = ax.pt(pts[i][0], pts[i][1]), ok = ax.inside(q[0], q[1]);
          hide(c, !ok);
          if (!ok) return;
          c.setAttribute('cx', f1(q[0])); c.setAttribute('cy', f1(q[1]));
          var k = classOf ? classOf(pts[i], i) : null;
          c.setAttribute('class', cls('mo-cloud', k));
        });
        return p;
      };
      return part(p, function () { p.set(p.pts, p.of); });
    };
    /* the p-norm ball {x : |x - c|_p <= r} for p = 1, 2 or Infinity; needs an axes with equal: true to look right */
    ax.ball = function (opts) {
      opts = opts || {};
      var e = el('path', 'mo-ball', opts), p = { el: e, c: null, r: 0, p: opts.p || 2 };
      p.set = function (c, r, pn) {
        p.c = c; p.r = r; if (pn !== undefined) p.p = pn;
        if (!(r > 0)) { hide(e, true); return p; }
        hide(e, false);
        var d = '', k, n = 96;
        if (p.p === Infinity || p.p === 'inf') {
          var cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          d = cs.map(function (s, i) { var q = ax.pt(c[0] + s[0] * r, c[1] + s[1] * r); return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join('') + 'Z';
        } else if (p.p === 1) {
          var ds = [[1, 0], [0, 1], [-1, 0], [0, -1]];
          d = ds.map(function (s, i) { var q = ax.pt(c[0] + s[0] * r, c[1] + s[1] * r); return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join('') + 'Z';
        } else {
          for (k = 0; k < n; k++) {
            var t = 2 * Math.PI * k / n, ct = Math.cos(t), st = Math.sin(t), pp = p.p;
            var rr = r / Math.pow(Math.pow(Math.abs(ct), pp) + Math.pow(Math.abs(st), pp), 1 / pp);
            var q2 = ax.pt(c[0] + rr * ct, c[1] + rr * st);
            d += (k ? 'L' : 'M') + f1(q2[0]) + ' ' + f1(q2[1]);
          }
          d += 'Z';
        }
        e.setAttribute('d', d);
        return p;
      };
      return part(p, function () { if (p.c) p.set(p.c, p.r); });
    };
    /* a scalar field f(x, y) painted as a soft image behind everything: a classifier's two regions, a loss surface.
       colorOf(value) returns [r, g, b, a] (0-255); default: ink for f > 0 and paper for f < 0, fading over |f| < 1.
       res = pixels across (default 120); the image is smoothed by the browser, so it stays cheap to redraw */
    ax.field = function (f, opts) {
      opts = opts || {};
      var img = svg('image', { 'class': cls('mo-field', opts.cls), preserveAspectRatio: 'none' }, under);
      var cv = document.createElement('canvas'), p = { el: img, f: f };
      var col = opts.color || (function () {
        var pos = hexRGB(toHex(opts.pos || color('ink'))), neg = hexRGB(toHex(opts.neg || '#ffffff')), alpha = opts.alpha === undefined ? 0.16 : opts.alpha;
        return function (v) {
          var t = M.sigmoid(3 * v), a = Math.round(255 * alpha * Math.abs(2 * t - 1));
          return t > 0.5 ? [pos[0], pos[1], pos[2], a] : [neg[0], neg[1], neg[2], a];
        };
      })();
      p.set = function (fn) {
        if (fn) p.f = fn;
        var W = opts.res || 120, H = Math.max(2, Math.round(W * (b[3] - b[1]) / (b[2] - b[0])));
        cv.width = W; cv.height = H;
        var c2 = cv.getContext('2d'), im = c2.createImageData(W, H), dd = im.data;
        for (var j = 0; j < H; j++) {
          var yv = ax.y.inv(b[1] + (j + 0.5) / H * (b[3] - b[1]));
          for (var i = 0; i < W; i++) {
            var xv = ax.x.inv(b[0] + (i + 0.5) / W * (b[2] - b[0])), c = col(p.f(xv, yv)), q = 4 * (j * W + i);
            dd[q] = c[0]; dd[q + 1] = c[1]; dd[q + 2] = c[2]; dd[q + 3] = c[3];
          }
        }
        c2.putImageData(im, 0, 0);
        img.setAttribute('x', b[0]); img.setAttribute('y', b[1]); img.setAttribute('width', b[2] - b[0]); img.setAttribute('height', b[3] - b[1]);
        img.setAttribute('href', cv.toDataURL());
        return p;
      };
      p.set();
      return part(p, function () { p.set(); });
    };
    /* the level set f(x, y) = level as a path, by marching squares on a grid (res cells across): a decision
       boundary, a contour of a loss, a certified region's edge */
    ax.contour = function (f, opts) {
      opts = opts || {};
      var e = el('path', 'mo-contour', opts), p = { el: e, f: f, level: opts.level || 0 };
      p.set = function (fn, level) {
        if (fn) p.f = fn; if (level !== undefined) p.level = level;
        var W = opts.res || 90, H = Math.max(2, Math.round(W * (b[3] - b[1]) / (b[2] - b[0]))), L = p.level, g3 = [], i, j;
        for (j = 0; j <= H; j++) {
          var row = [], yv = ax.y.inv(b[1] + j / H * (b[3] - b[1]));
          for (i = 0; i <= W; i++) row.push(p.f(ax.x.inv(b[0] + i / W * (b[2] - b[0])), yv) - L);
          g3.push(row);
        }
        var segs = [];
        function P(i2, j2) { return [b[0] + i2 / W * (b[2] - b[0]), b[1] + j2 / H * (b[3] - b[1])]; }
        function cut(a, c, va, vc) { var t = va / (va - vc); return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]; }
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
          var v = [g3[j][i], g3[j][i + 1], g3[j + 1][i + 1], g3[j + 1][i]], q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], pts = [];
          for (var k = 0; k < 4; k++) { var k2 = (k + 1) % 4; if ((v[k] > 0) !== (v[k2] > 0)) pts.push(cut(q[k], q[k2], v[k], v[k2])); }
          if (pts.length === 2) segs.push(pts);
          else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
        }
        e.setAttribute('d', joinSegs(segs));
        return p;
      };
      p.set();
      return part(p, function () { p.set(); });
    };
    /* a KaTeX label that sits on the drawing at a data point: the svg must fill a .mstage (one user unit is one stage
       pixel, the course's overlay rule), so the label is positioned in per cent like any hand-placed .mo */
    ax.tex = function (tex, opts) {
      opts = opts || {};
      var stage = root.closest('.mstage') || root.parentNode, span = document.createElement('span'), p = { el: span, x: NaN, y: NaN };
      span.className = cls('mo mo-tex', opts.cls);
      span.style.display = 'none';
      if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
      stage.appendChild(span);
      p.tex = function (t) {
        if (window.katex) { try { window.katex.render(t, span, { throwOnError: false }); return p; } catch (_) {} }
        span.textContent = t; return p;
      };
      p.at = function (x, y) {
        p.x = x; p.y = y; var q = ax.pt(x, y), vb2 = root.viewBox.baseVal;
        span.style.display = isFinite(q[0]) && isFinite(q[1]) ? '' : 'none';
        span.style.left = ((q[0] + (opts.dx || 0) - vb2.x) / vb2.width * 100).toFixed(2) + '%';
        span.style.top = ((q[1] + (opts.dy || 0) - vb2.y) / vb2.height * 100).toFixed(2) + '%';
        return p;
      };
      p.tex(tex);
      return part(p, function () { p.at(p.x, p.y); });
    };
    return ax;
  }

  function hexRGB(h) { var n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function arrowPath(shaft, head, q, r, hs) {
    var dx = r[0] - q[0], dy = r[1] - q[1], L = Math.sqrt(dx * dx + dy * dy);
    if (!(L > 0.5) || !isFinite(L)) { hide(shaft, true); hide(head, true); return; }
    hide(shaft, false); hide(head, false);
    var ux = dx / L, uy = dy / L, h = Math.min(hs, L * 0.6), bx = r[0] - ux * h, by = r[1] - uy * h, w = h * 0.5;
    shaft.setAttribute('d', 'M' + f1(q[0]) + ' ' + f1(q[1]) + 'L' + f1(bx + ux * 1.5) + ' ' + f1(by + uy * 1.5));
    head.setAttribute('d', 'M' + f1(r[0]) + ' ' + f1(r[1]) + 'L' + f1(bx - uy * w) + ' ' + f1(by + ux * w) + 'L' + f1(bx + uy * w) + ' ' + f1(by - ux * w) + 'Z');
  }
  /* chain marching-squares segments into polylines so a contour draws as few paths (and dashes run continuously) */
  function joinSegs(segs) {
    var key = function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }, ends = {}, used = [], d = '';
    segs.forEach(function (s, i) { [0, 1].forEach(function (e) { var k = key(s[e]); (ends[k] = ends[k] || []).push([i, e]); }); });
    function nextFrom(p, skip) {
      var l = ends[key(p)] || [];
      for (var i = 0; i < l.length; i++) if (!used[l[i][0]] && l[i][0] !== skip) return l[i];
      return null;
    }
    for (var i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      var line = [segs[i][0], segs[i][1]], n;
      while ((n = nextFrom(line[line.length - 1]))) { used[n[0]] = true; line.push(segs[n[0]][1 - n[1]]); }
      while ((n = nextFrom(line[0]))) { used[n[0]] = true; line.unshift(segs[n[0]][1 - n[1]]); }
      d += line.map(function (p, k) { return (k ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); }).join('');
    }
    return d || 'M0 0';
  }

  /* Motion.graph(svg, nodes, edges, opts): agents, a network, an epidemic. nodes = [{id, x, y, label?}] in user units
     (or pass opts.layout = 'ring' with opts.center and opts.radius to place them on a circle); edges = [[idA, idB]].
     g.state(id, cls) sets a node's extra class (mo-attack for infected, mo-defense for patched ...); g.edgeState(i, cls)
     likewise for an edge; g.pos(id) gives a node's centre, g.edgePath(i) the edge's <path> for data-travel or a pulse. */
  function graph(root, nodes, edges, opts) {
    opts = opts || {};
    var g = svg('g', { 'class': cls('mo-graph', opts.cls) }, root), ge = svg('g', {}, g), gn = svg('g', {}, g);
    var R = opts.r || 16, byId = {};
    if (opts.layout === 'ring') {
      var c = opts.center || [200, 200], rad = opts.radius || 150;
      nodes.forEach(function (n, i) { var t = -Math.PI / 2 + 2 * Math.PI * i / nodes.length; n.x = c[0] + rad * Math.cos(t); n.y = c[1] + rad * Math.sin(t); });
    }
    nodes.forEach(function (n) {
      var ng = svg('g', { 'class': 'mo-nodeg', transform: 'translate(' + f1(n.x) + ' ' + f1(n.y) + ')' }, gn);
      var circ = svg('circle', { 'class': 'mo-node', r: n.r || R }, ng);
      if (n.label) svg('text', { 'class': 'mo-label', 'text-anchor': 'middle', y: (n.r || R) + 24 }, ng).textContent = n.label;
      byId[n.id] = { n: n, g: ng, c: circ };
    });
    var paths = edges.map(function (e, i) {
      var a = byId[e[0]].n, b2 = byId[e[1]].n;
      return svg('path', { 'class': 'mo-edge', id: opts.idPrefix ? opts.idPrefix + i : null, d: 'M' + f1(a.x) + ' ' + f1(a.y) + 'L' + f1(b2.x) + ' ' + f1(b2.y) }, ge);
    });
    return {
      el: g, nodes: byId, edges: paths,
      pos: function (id) { var n = byId[id].n; return [n.x, n.y]; },
      state: function (id, k) { byId[id].g.setAttribute('class', cls('mo-nodeg', k)); return this; },
      edgeState: function (i, k) { paths[i].setAttribute('class', cls('mo-edge', k)); return this; },
      edgePath: function (i) { return paths[i]; }
    };
  }

  /* Motion.tokens(container, words, opts): a row of text tokens as HTML chips that wrap like prose (a generated
     answer, a suffix under search, a watermarked paragraph). t.set(i, {text, cls, hidden}) changes one token;
     t.show(n) shows the first n and hides the rest while keeping their space, so a stream never reflows. */
  function tokens(box, words, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = cls('mo-tokens', opts.cls);
    var spans = words.map(function (w) {
      var s = document.createElement('span'); s.className = 'mo-tok'; s.textContent = w; wrap.appendChild(s); return s;
    });
    box.appendChild(wrap);
    return {
      el: wrap, spans: spans,
      set: function (i, o) {
        var s = spans[i]; if (!s) return this;
        if (o.text !== undefined) s.textContent = o.text;
        if (o.cls !== undefined) s.className = cls('mo-tok', o.cls);
        if (o.hidden !== undefined) s.classList.toggle('is-hidden', !!o.hidden);
        return this;
      },
      show: function (n) { spans.forEach(function (s, i) { s.classList.toggle('is-hidden', i >= n); }); return this; }
    };
  }

  /* Motion.flip(elements, change): record where the elements are, run change() (re-sort, re-parent, re-class them),
     and return apply(t): apply(0) puts them back where they were, apply(1) where they are now; call it inside
     anim.tween. For modules written with Motion.register; a scene computes positions from its vars instead. */
  function flip(els, change) {
    els = Array.prototype.slice.call(els);
    function unit(el) {
      if (el instanceof SVGElement) { var m = el.parentNode.getScreenCTM && el.parentNode.getScreenCTM(); return m ? Math.abs(m.a) || 1 : 1; }
      return el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
    }
    var r0 = els.map(function (el) { return el.getBoundingClientRect(); });
    change();
    els.forEach(function (el) { el.style.translate = ''; });
    var d = els.map(function (el, i) {
      var r1 = el.getBoundingClientRect(), u = unit(el);
      return [(r0[i].left - r1.left) / u, (r0[i].top - r1.top) / u];
    });
    function apply(t) {
      els.forEach(function (el, i) {
        var dx = d[i][0] * (1 - t), dy = d[i][1] * (1 - t);
        el.style.translate = (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) ? '' : dx.toFixed(2) + 'px ' + dy.toFixed(2) + 'px';
      });
    }
    apply(0);
    return apply;
  }

  /* Motion.wipe(el, from): uncover an element (the paper's figure, a hidden panel) from one side: w.set(t) shows the
     fraction t, from 'left' (default), 'right', 'top' or 'bottom' */
  function wipe(el, from) {
    from = from || 'left';
    return {
      el: el,
      set: function (t) {
        var c = (100 * (1 - M.clamp(t, 0, 1))).toFixed(2) + '%';
        el.style.clipPath = from === 'left' ? 'inset(0 ' + c + ' 0 0)' : from === 'right' ? 'inset(0 0 0 ' + c + ')' :
          from === 'top' ? 'inset(0 0 ' + c + ' 0)' : 'inset(' + c + ' 0 0 0)';
        return this;
      }
    };
  }

  /* Motion.camera(svg): look at part of a drawing: cam.set(cx, cy, zoom) in the drawing's user units (zoom 1 is the
     authored viewBox). Everything scales, text and strokes too, so zoom only into drawings whose text can grow;
     to zoom the DATA while keeping type and strokes fixed, use ax.rescale instead. */
  function camera(root) {
    var vb = root.viewBox.baseVal, W = vb.width, H = vb.height, X0 = vb.x, Y0 = vb.y;
    return {
      set: function (cx, cy, z) {
        z = z || 1; var w = W / z, h = H / z;
        root.setAttribute('viewBox', f1(cx - w / 2) + ' ' + f1(cy - h / 2) + ' ' + f1(w) + ' ' + f1(h));
        return this;
      },
      reset: function () { root.setAttribute('viewBox', X0 + ' ' + Y0 + ' ' + W + ' ' + H); return this; },
      home: [X0 + W / 2, Y0 + H / 2]
    };
  }

  /* ================================================================ public */
  window.Motion = {
    version: VERSION,
    register: function (key, mod) { mods[key] = mod; rescan(key); },
    scene: function (key, spec) {
      if (!spec || typeof spec.vars !== 'function' || typeof spec.draw !== 'function') { warn(key, 'a scene needs vars(step) and draw(ctx, v)'); return; }
      scenes[key] = spec; rescan(key);
    },
    to: Tween,
    set: function (vals) { return { set: vals }; },
    wait: function (ms) { return { wait: ms }; },
    axes: axes, graph: graph, tokens: tokens, flip: flip, wipe: wipe, camera: camera,
    along: along, schedule: schedule, rng: rng, math: M, fmt: F,
    color: color, mix: function (a, b, t) { return mixHex(toHex(a), toHex(b), t); },
    ease: ease, lerp: M.lerp, svg: svg,
    get instant() { return instantMode(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
