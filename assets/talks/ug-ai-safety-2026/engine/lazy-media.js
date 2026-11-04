(function() {
  var KEEP = 1;
  var P = HTMLMediaElement.prototype, D = Object.getOwnPropertyDescriptor(P, "src");
  if (!D || !D.set) return;
  var pending = false, slides = null;
  function topSlides() {
    if (!slides) slides = Array.prototype.filter.call(document.querySelectorAll("section.slide"), function(s) {
      return !s.parentElement || !s.parentElement.closest("section.slide");
    });
    return slides;
  }
  function activeIndex() {
    var s = topSlides();
    for (var i = 0; i < s.length; i++) if (s[i].classList.contains("is-active")) return i;
    return 0;
  }
  function want(v) {
    if (!v.isConnected) return false;
    if (typeof v.__lazyWant === "function") {
      try {
        return !!v.__lazyWant();
      } catch (e) {
        return false;
      }
    }
    var sec = v.closest("section.slide");
    while (sec && sec.parentElement && sec.parentElement.closest("section.slide")) sec = sec.parentElement.closest("section.slide");
    if (!sec) return true;
    var i = topSlides().indexOf(sec);
    return i < 0 || Math.abs(i - activeIndex()) <= KEEP;
  }
  function sync() {
    pending = false;
    document.querySelectorAll("video").forEach(function(v) {
      if (v.__lazySrc === void 0) return;
      var w = want(v);
      if (w && !v.__lazyOn) {
        v.__lazyOn = true;
        D.set.call(v, v.__lazySrc);
        v.preload = "auto";
      } else if (!w && v.__lazyOn && v.paused) {
        v.__lazyOn = false;
        try {
          v.pause();
        } catch (e) {
        }
        v.removeAttribute("src");
        try {
          v.load();
        } catch (e) {
        }
      }
    });
  }
  function schedule() {
    if (!pending) {
      pending = true;
      Promise.resolve().then(sync);
    }
  }
  Object.defineProperty(P, "src", {
    configurable: true,
    enumerable: D.enumerable,
    get: function() {
      return this.__lazySrc !== void 0 ? this.__lazySrc : D.get.call(this);
    },
    set: function(u) {
      if (this.tagName !== "VIDEO") {
        D.set.call(this, u);
        return;
      }
      this.__lazySrc = u;
      this.__lazyOn = false;
      if (this.isConnected && want(this)) {
        this.__lazyOn = true;
        D.set.call(this, u);
      } else schedule();
    }
  });
  var PLAY = P.play;
  P.play = function() {
    if (this.tagName === "VIDEO" && this.__lazySrc !== void 0 && !this.__lazyOn) {
      this.__lazyOn = true;
      D.set.call(this, this.__lazySrc);
      this.preload = "auto";
    }
    return PLAY.apply(this, arguments);
  };
  function watch() {
    slides = null;
    var mo = new MutationObserver(schedule);
    topSlides().forEach(function(s) {
      mo.observe(s, { attributes: true, attributeFilter: ["class"] });
    });
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
  addEventListener("hashchange", schedule);
  window.LazyMedia = { sync, schedule, keep: function(k) {
    KEEP = k;
    sync();
  } };
})();
