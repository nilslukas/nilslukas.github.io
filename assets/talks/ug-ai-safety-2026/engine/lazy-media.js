/* lazy-media.js (19 Oct 2026, evening). Why: every slide driver creates all of its clips at load with preload='auto',
   so the 93-slide deck held ~230 decoding VP9-alpha players at once, and Chrome crashed ("the slides crash so often").
   Fix, without touching the 30 drivers: a <video> created by script remembers its src but only loads it while its slide
   is the active one or a neighbour (KEEP slides either side). Clips of slides further away are unloaded, which frees
   their decoders. Must load before every driver (first script in _tail.html). Videos written in HTML are not affected.
   26 Oct 2026: a driver may give a clip its own rule, v.__lazyWant = function () { return true/false; }, which then
   replaces the slide-distance rule for that clip (the engine's manim.js does: the next presses' clips only); a driver
   that changes what it wants calls LazyMedia.schedule(). Clips without the rule behave exactly as before. */
(function () {
  var KEEP = 1;
  var P = HTMLMediaElement.prototype, D = Object.getOwnPropertyDescriptor(P, 'src');
  if (!D || !D.set) return;
  var pending = false, slides = null;

  function topSlides() {
    if (!slides) slides = Array.prototype.filter.call(document.querySelectorAll('section.slide'), function (s) {
      return !s.parentElement || !s.parentElement.closest('section.slide');
    });
    return slides;
  }
  function activeIndex() {
    var s = topSlides();
    for (var i = 0; i < s.length; i++) if (s[i].classList.contains('is-active')) return i;
    return 0;
  }
  function want(v) {
    if (!v.isConnected) return false;
    /* a driver that knows which of its clips the next press needs sets v.__lazyWant (26 Oct 2026, Week 10 manim.js):
       then only that decides, so a walk keeps two or three decoders alive instead of every clip of three slides */
    if (typeof v.__lazyWant === 'function') { try { return !!v.__lazyWant(); } catch (e) { return false; } }
    var sec = v.closest('section.slide');
    while (sec && sec.parentElement && sec.parentElement.closest('section.slide')) sec = sec.parentElement.closest('section.slide');
    if (!sec) return true;
    var i = topSlides().indexOf(sec);
    return i < 0 || Math.abs(i - activeIndex()) <= KEEP;
  }
  function sync() {
    pending = false;
    document.querySelectorAll('video').forEach(function (v) {
      if (v.__lazySrc === undefined) return;
      var w = want(v);
      if (w && !v.__lazyOn) { v.__lazyOn = true; D.set.call(v, v.__lazySrc); v.preload = 'auto'; }
      else if (!w && v.__lazyOn && v.paused) {
        v.__lazyOn = false;
        try { v.pause(); } catch (e) {}
        v.removeAttribute('src');
        try { v.load(); } catch (e) {}        /* releases the decoder and its buffers */
      }
    });
  }
  function schedule() { if (!pending) { pending = true; Promise.resolve().then(sync); } }

  Object.defineProperty(P, 'src', {
    configurable: true, enumerable: D.enumerable,
    get: function () { return this.__lazySrc !== undefined ? this.__lazySrc : D.get.call(this); },
    set: function (u) {
      if (this.tagName !== 'VIDEO') { D.set.call(this, u); return; }
      this.__lazySrc = u;
      this.__lazyOn = false;
      if (this.isConnected && want(this)) { this.__lazyOn = true; D.set.call(this, u); }
      else schedule();                       /* drivers set src before appendChild: decide once it is placed */
    }
  });

  /* a clip asked to play loads at once, wherever it is (a reload or a jump lands on a slide before sync has run) */
  var PLAY = P.play;
  P.play = function () {
    if (this.tagName === 'VIDEO' && this.__lazySrc !== undefined && !this.__lazyOn) {
      this.__lazyOn = true; D.set.call(this, this.__lazySrc); this.preload = 'auto';
    }
    return PLAY.apply(this, arguments);
  };

  function watch() {
    slides = null;
    var mo = new MutationObserver(schedule);
    topSlides().forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class'] }); });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  addEventListener('hashchange', schedule);
  window.LazyMedia = { sync: sync, schedule: schedule, keep: function (k) { KEEP = k; sync(); } };
})();
