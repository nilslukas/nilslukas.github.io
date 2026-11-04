(function() {
  "use strict";
  var DEFAULT_GAP = 750;
  var DEFAULT_LEAD = 300;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scripted = /(^|[?&])step=/.test(location.search);
  function attach(slide) {
    var gap = Number(slide.dataset.autostep) || DEFAULT_GAP;
    var lead = Number(slide.dataset.autostepLead || DEFAULT_LEAD);
    var stopAt = Number(slide.dataset.autostepStop || 0);
    var predim = slide.dataset.autostepPredim !== "0";
    var timer = null, running = false, expected = -1, printing = false;
    var wasActive = slide.classList.contains("is-active");
    var step = function() {
      return Number(slide.dataset.step || 0);
    };
    var last = function() {
      return Number(slide.dataset.maxStep || 0);
    };
    var goal = function() {
      var end = last();
      return stopAt > 0 && stopAt < end ? stopAt : end;
    };
    function live() {
      if (!window.Deck || !slide.classList.contains("is-active")) return false;
      if (document.querySelectorAll(".slide.is-active").length !== 1) return false;
      var all = document.querySelectorAll(".slide");
      return Array.prototype.indexOf.call(all, slide) === window.Deck.current();
    }
    function stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      running = false;
      if (step() === 0) slide.classList.remove("is-stepping");
    }
    function tick() {
      timer = null;
      if (!running) return;
      if (!live() || step() >= goal()) {
        stop();
        return;
      }
      window.Deck.next();
      expected = step();
      if (expected >= goal()) {
        stop();
        return;
      }
      timer = setTimeout(tick, gap);
    }
    function finish() {
      stop();
      for (var guard = 0; guard < 99 && live() && step() < goal(); guard++) window.Deck.next();
    }
    function start() {
      stop();
      if (printing || reduced || scripted || !live()) return;
      if (step() > 0) {
        window.Deck.go(window.Deck.current());
        if (step() !== 0) return;
      }
      if (predim) slide.classList.add("is-stepping");
      expected = 0;
      running = true;
      timer = setTimeout(tick, lead);
    }
    new MutationObserver(function(records) {
      var active = slide.classList.contains("is-active");
      if (active !== wasActive) {
        wasActive = active;
        if (active) start();
        else stop();
        return;
      }
      var now = step();
      if (running) {
        if (now === expected) return;
        if (now > expected) finish();
        else stop();
        return;
      }
      if (!active || now !== 0) return;
      var steps = records.filter(function(r) {
        return r.attributeName === "data-step";
      });
      if (steps.length && Number(steps[steps.length - 1].oldValue || 0) > 1) start();
    }).observe(slide, { attributes: true, attributeFilter: ["class", "data-step"], attributeOldValue: true });
    addEventListener("beforeprint", function() {
      printing = true;
      stop();
    });
    addEventListener("afterprint", function() {
      printing = false;
      setTimeout(function() {
        if (slide.classList.contains("is-active")) start();
      }, 50);
    });
    if (wasActive) start();
  }
  function boot(tries) {
    if (!window.Deck || !window.Deck.next) {
      if (tries > 0) setTimeout(function() {
        boot(tries - 1);
      }, 50);
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll(".slide[data-autostep]"), attach);
  }
  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", function() {
      boot(40);
    });
  } else {
    boot(40);
  }
})();
