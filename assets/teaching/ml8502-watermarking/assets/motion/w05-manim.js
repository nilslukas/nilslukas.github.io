/* w05-manim: the press-driven manim figures of Week 5 (20 Oct 2026). Week 9's assets/motion/w09-manim.js with the
   motion name w05-manim; the figure markup and its CSS are the shared engine's (.w09m-body, .w09m-fig, .w09m-still,
   .w09-foot, .w09-line in slides/shared/engine/head.html), so only this runtime lives in the week.
   Markup: <section data-motion="w05-manim" data-max-step="N"> holding <div class="w09m-fig" data-dir="assets/figures/
   <folder>/"> with <img class="w09m-still"> whose src is the final still sN.png of that folder. The folder is rendered by
   artifacts/tools/week05-watermarking-figures/manim/render.sh. Method walks add data-clips="on" (each press plays
   tK.webm); every other figure dissolves still to still. Week 9's comments below explain each rule. */
(function () {
  if (window.__w05Manim) return;
  window.__w05Manim = true;
  var instant = (navigator.webdriver === true && !/[?&]anim=1\b/.test(location.search));
  /* Nils, 19 Oct 2026 (night): "minimize these animations because it does not look too professional". Default: a
     press dissolves to the next state's still in 0.22 s; no arrival intro, no motion clips. ?anim=clips restores the
     manim clips and intros. */
  var CLIPS = /[?&]anim=clips\b/.test(location.search);
  /* ONE SWITCH for the arrival draw-ins (exec style, 19 Oct 2026 night): set INTROS = false here, or open the deck with
     ?intro=off, and every figure arrives as its still again (the fragments' data-intro="on" is then ignored). */
  var INTROS = !/[?&]intro=off\b/.test(location.search);
  /* Nils, 19 Oct 2026 (evening): "focus more on the methods: how it works. Animate that ... not flashy animations.
     Just draw the user's attention, like in a cinema." A method walk opts in with <div class="w09m-fig"
     data-clips="on" data-intro="off">: each press plays its clip tK.webm (camera framing, dimming, the algorithm
     running on a small example); every other figure keeps the still-to-still dissolve. */
  /* Nils, 19 Oct 2026, 22:10: "I really like the style (with transitions and everything) from the executive ai securiy
     slides" (outputs/exec-style-gap.md, F1). The arrival intro is OPT-IN: data-intro="on" (set by whoever renders
     intro0.webm, w09m_common.intro) plays it on a forward arrival, also on a dissolve figure; without it the slide
     shows s0 (a default of "on" would request missing files and blank the figure until the error). As in the exec deck
     (act2-inject.js), an arrival counts only within 1.5 s of a forward key, so a grid jump or a chapter-bar click to
     the next slide shows the still. */
  var lastFwd = 0;
  addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') lastFwd = Date.now();
  }, true);
  /* Nils, 19 Oct 2026 (evening): "when overlaying new text, first the new text appears then the old text disappears..
     can't it be at the same time?" A press is a true crossfade: the old still fades out WHILE the new one fades in.
     Both images blend with plus-lighter inside an isolated figure box and their opacities always sum to 1, so what the
     two states share stays solid and only what changes crossfades (the trick of the View Transitions API). */
  var XF = 260;
  function settle(st) {
    if (!st.pending) return;
    var p = st.pending; st.pending = null;
    clearTimeout(p.timer);
    st.img.src = p.src;
    st.img.style.transition = 'none'; st.img.style.opacity = '1';
    st.fade.onload = null; st.fade.style.transition = 'none'; st.fade.style.opacity = '0';
    st.fig.classList.remove('xfade');
  }
  function dissolve(st, src) {
    var f = st.fade, im = st.img;
    if (!f) { im.src = src; return; }
    settle(st);
    var p = st.pending = { src: src, timer: 0 };
    f.onload = function () {
      f.onload = null;
      if (st.pending !== p) return;
      st.fig.classList.add('xfade');
      f.style.transition = im.style.transition = 'none';
      f.style.opacity = '0'; im.style.opacity = '1';
      void f.offsetWidth;
      f.style.transition = im.style.transition = 'opacity ' + XF + 'ms linear';
      f.style.opacity = '1'; im.style.opacity = '0';
      p.timer = setTimeout(function () {
        if (st.pending !== p) return;
        im.style.transition = 'none';
        im.src = src;
        var done = function () { if (st.pending === p) settle(st); };
        if (im.decode) im.decode().then(done, done); else done();
      }, XF + 20);
    };
    f.src = src;
  }
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) instant = true; } catch (_) {}
  var states = new Map();

  function hideClips(st) {
    st.all.forEach(function (v) {
      v.onplaying = v.onended = null;
      try { v.pause(); } catch (_) {}
      v.classList.remove('on');
    });
  }
  /* Swap still and clip only on frames that are ready (19 Oct 2026, late; Nils: the zoom is "jagged.. laggy and weird
     sometimes"): show the clip once its first frame is actually presented (requestVideoFrameCallback), and show the end
     still only once it is decoded, so neither swap can flash an empty or stale frame. */
  function firstFrame(v, cb) {
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(function () { cb(); });
    else requestAnimationFrame(cb);
  }
  function play(st, v, fromSrc, endSrc, alive) {
    if (fromSrc) { st.img.src = fromSrc; st.img.classList.remove('off'); } else { st.img.classList.add('off'); }
    var shown = false;
    /* stall guard (from the exec deck's act1-see.js, 19 Oct 2026): a clip that has not started within 2.5 s (a decoder
       stall, or a clip lazy-media.js has only just begun to load after a jump) gives way to its end still, so the figure
       never sits on the previous state while the step counter has moved on */
    var guard = setTimeout(function () {
      if (!alive() || shown) return;
      try { v.pause(); } catch (_) {}
      st.img.src = endSrc; st.img.classList.remove('off');
    }, 2500);
    v.onplaying = function () {
      clearTimeout(guard);
      if (!alive() || shown) return;
      firstFrame(v, function () {
        if (!alive() || shown) return;
        shown = true;
        v.classList.add('on');
        st.img.classList.add('off');
      });
    };
    v.onended = function () {
      clearTimeout(guard);
      if (!alive()) return;
      var swap = function () {
        if (!alive()) return;
        st.img.classList.remove('off');
        requestAnimationFrame(function () { v.classList.remove('on'); });
      };
      st.img.src = endSrc;
      if (st.img.decode) st.img.decode().then(swap, swap); else swap();
    };
    try { v.currentTime = 0; } catch (_) {}
    var p = v.play();
    if (p && p.catch) p.catch(function () { st.img.src = endSrc; st.img.classList.remove('off'); });
  }
  function mkVideo(fig, src) {
    var v = document.createElement('video');
    v.className = 'w09m-clip';
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    /* keep deck.js's slide-video autoplay off these clips (it played every hidden clip of a walk at once on arrival,
       wasting decoders and fooling press-finish.js into holding the press); the exec deck's drivers do the same */
    v.setAttribute('data-play-step', 'never');
    v.src = src;
    fig.appendChild(v);
    return v;
  }

  Motion.register('w05-manim', {
    init: function (sec) {
      var fig = sec.querySelector('.w09m-fig');
      var max = Number(sec.dataset.maxStep || 0);
      var dir = fig.dataset.dir;
      var img = fig.querySelector('.w09m-still');
      /* The fragment's still is the FINAL state (s<max>.png). In student.html and the print export the exporter has
         inlined it as a data: URI and the per-step files do not exist, so a packed figure keeps its final still. */
      var orig = img.getAttribute('src') || '';
      var st = { fig: fig, img: img, clips: {}, dir: dir, all: [], introOn: false, token: 0, orig: orig,
                 packed: /^data:/.test(orig), hasIntro: INTROS && fig.dataset.intro === 'on' };
      if (st.packed) { st.hasIntro = false; states.set(sec, st); return st; }
      /* Week 5: only method walks (data-clips="on") have tK.webm; the dissolve figures were rendered without clips, so
         ?anim=clips must not request them (lane E, 20 Oct 2026: 404s) */
      st.clipsOn = fig.dataset.clips === 'on';
      if (!st.clipsOn) {
        st.fade = document.createElement('img');
        st.fade.className = 'w09m-fade'; st.fade.alt = ''; st.fade.setAttribute('aria-hidden', 'true');
        st.fade.style.opacity = '0';
        st.fade.src = orig;   /* never empty: an <img> without a src counts as a broken image (QA, lane S) */
        fig.appendChild(st.fade);
        if (st.hasIntro) { st.intro = mkVideo(fig, dir + 'intro0.webm'); st.all.push(st.intro); }   /* F1: above both stills */
        st.keep = [];   /* keep the preloaded stills referenced so they stay decoded in the memory cache (exec act1-see.js) */
        for (var q = 0; q <= max; q++) { var pq = new Image(); pq.src = dir + 's' + q + '.png'; st.keep.push(pq); }
        states.set(sec, st);
        return st;
      }
      for (var k = 1; k <= max; k++) { st.clips[k] = mkVideo(fig, dir + 't' + k + '.webm'); st.all.push(st.clips[k]); }
      if (st.hasIntro) { st.intro = mkVideo(fig, dir + 'intro0.webm'); st.all.push(st.intro); }
      st.keep = [];
      for (var s = 0; s <= max; s++) { var pre = new Image(); pre.src = dir + 's' + s + '.png'; st.keep.push(pre); }
      states.set(sec, st);
      return st;
    },
    render: function (sec, step, st, anim) {
      if (st.packed) { st.img.src = st.orig; st.img.classList.remove('off'); return; }
      if (!st.clipsOn) {
        if (st.introOn && step === 0 && !anim && sec.classList.contains('is-active')) return;   /* the arrival intro is running: leave it */
        if (st.intro) { st.introOn = false; st.token++; hideClips(st); }   /* a press, going back or a jump ends it at once */
        var target = st.dir + 's' + step + '.png';
        st.img.classList.remove('off');
        if (anim && !instant) dissolve(st, target); else { st.pending = { src: target }; settle(st); }
        return;
      }
      if (st.introOn && step === 0 && !anim && sec.classList.contains('is-active')) return;   /* the arrival intro is running: leave it */
      st.introOn = false; st.token++;
      var still = st.dir + 's' + step + '.png';
      hideClips(st);
      var v = anim && st.clips[step];
      if (!v) { st.img.src = still; st.img.classList.remove('off'); return; }
      play(st, v, st.dir + 's' + (step - 1) + '.png', still, anim.alive);
    }
  });

  /* forward arrival: one step forward onto one of these slides at step 0 plays its intro */
  var slides = Array.prototype.slice.call(document.querySelectorAll('section.slide'));
  var cur = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
  function check() {
    var now = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
    if (now === cur) return;
    var prev = cur; cur = now;
    var sec = slides[now], st = sec && states.get(sec);
    if (!st || !st.hasIntro || instant || now !== prev + 1 || Number(sec.dataset.step || 0) !== 0) return;
    if (Date.now() - lastFwd > 1500) return;   /* not a forward key: a grid jump or a click shows the still */
    var token = ++st.token;
    st.introOn = true;
    hideClips(st);
    play(st, st.intro, null, st.dir + 's0.png', function () {
      return st.token === token && sec.classList.contains('is-active');
    });
    st.intro.addEventListener('ended', function done() {
      st.intro.removeEventListener('ended', done);
      if (st.token === token) st.introOn = false;
    });
  }
  var mo = new MutationObserver(check);
  slides.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class'] }); });
})();
