/* ===========================================================================
   sched-autostep.js — play a focus-step build by itself when its slide opens.

   Week 1's schedule slide lights five chapter groups. Waiting for five presses
   before anything moves reads as a dead slide, so the build runs on arrival
   and the presses become an override rather than the motor.

   deck.js and deck.css are frozen, so nothing here invents a second source of
   truth: every advance is Deck.next(), the exact call the right-arrow makes,
   which means data-step, .is-stepping and .is-lit/.is-now stay where deck.js
   put them and the control buttons stay in sync.

   A slide opts in from its own fragment:
       data-autostep="750"        ms between steps
       data-autostep-lead="300"   ms before the first step
       data-autostep-stop="1"     optional: play only up to this step
       data-autostep-predim="0"   optional: arrive lit, do not hold step 0 dim

   THE STOP POINT, added 2026-08-25 for Nils on Threats With Large ML Systems:
   "please just immediately start with the first animation (rather than me
   having to click once)". That slide wants ONE tile to land by itself as an
   opening beat and the other four to stay his, which is a different thing from
   the schedule slide, where the whole build is scenery. data-autostep-stop is
   how a slide asks for the first case. It is opt-in and it is the only new
   idea here: absent — or zero, or at/beyond data-max-step — the build runs to
   the last step exactly as before, so every slide written before this line
   behaves identically. After the stop the build simply is not running any
   more; the slide is left on an ordinary deck.js step, so the next forward
   press takes the next step and a backward press walks out, both untouched.

   AND WHY THERE IS A SECOND FLAG. The pre-dim below holds the unlit state
   through the first paint so a build cannot flash fully lit and then dim
   itself. That is right for the schedule, whose dim state is its resting
   state. It is wrong for Threats With Large ML Systems, which is sixteen news
   headlines and whose own design note calls the undimmed wall the punch: the
   room is meant to read it at full strength for a beat before the first pile
   is picked out. data-autostep-predim="0" is how that slide asks to arrive
   lit; it pays for the flash risk with a long lead, so the dim-down lands as
   a deliberate move rather than a stutter. Default is unchanged.

   Behaviour
     · arriving at the slide plays the build from step 0, one step per gap,
       stopping at data-autostep-stop when it is set and at the last step
       otherwise;
     · a forward press during the build finishes it at once, up to the same
       stopping point — the press is not swallowed, deck.js takes its own step
       and this completes the rest — and the press after that leaves the slide
       as normal;
     · a backward press during the build cancels it and hands control back, so
       walking backwards out of the slide still works;
     · leaving the slide cancels;
     · printing, prefers-reduced-motion and ?step= (QA screenshots) are left
       alone: in all three deck.js already shows the slide fully built, and a
       replay would fight it.
   ======================================================================== */
(function () {
  'use strict';

  var DEFAULT_GAP = 750;
  var DEFAULT_LEAD = 300;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scripted = /(^|[?&])step=/.test(location.search);

  function attach(slide) {
    var gap = Number(slide.dataset.autostep) || DEFAULT_GAP;
    var lead = Number(slide.dataset.autostepLead || DEFAULT_LEAD);
    var stopAt = Number(slide.dataset.autostepStop || 0);
    var predim = slide.dataset.autostepPredim !== '0';
    var timer = null, running = false, expected = -1, printing = false;
    var wasActive = slide.classList.contains('is-active');

    var step = function () { return Number(slide.dataset.step || 0); };
    var last = function () { return Number(slide.dataset.maxStep || 0); };

    /* Where THIS build hands control back. Read through last() rather than
       cached, because data-max-step is the slide's own declaration and a
       stop point that is missing, zero, negative or past the end must mean
       "the whole build" — the pre-2026-08-25 behaviour, unchanged. */
    var goal = function () {
      var end = last();
      return (stopAt > 0 && stopAt < end) ? stopAt : end;
    };

    /* Ours to drive only while it is the one slide on screen and deck.js
       agrees it is the current one. Printing makes every slide active at
       once, which is precisely the state this refuses to touch. */
    function live() {
      if (!window.Deck || !slide.classList.contains('is-active')) return false;
      if (document.querySelectorAll('.slide.is-active').length !== 1) return false;
      var all = document.querySelectorAll('.slide');
      return Array.prototype.indexOf.call(all, slide) === window.Deck.current();
    }

    function stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      running = false;
      // Take back the pre-dim only if the build never left step 0. Everything
      // above that is deck.js's own state, exactly as applyStep() wrote it.
      if (step() === 0) slide.classList.remove('is-stepping');
    }

    function tick() {
      timer = null;
      if (!running) return;
      if (!live() || step() >= goal()) { stop(); return; }
      window.Deck.next();
      expected = step();
      if (expected >= goal()) { stop(); return; }
      timer = setTimeout(tick, gap);
    }

    /* Forward press mid-build: complete the remaining steps immediately, to
       the same goal() the timer was heading for. On a stop-point slide his
       press has usually already taken the one step that was owed, so this
       loop runs zero times and the impatient press costs him nothing. */
    function finish() {
      stop();
      for (var guard = 0; guard < 99 && live() && step() < goal(); guard++) window.Deck.next();
    }

    function start() {
      stop();
      if (printing || reduced || scripted || !live()) return;
      if (step() > 0) {
        /* Backward navigation lands here fully built, because deck.js's prev()
           applies the last step on arrival. Re-show the slide through deck.js
           to get an honest step 0 instead of poking at the step ourselves. */
        window.Deck.go(window.Deck.current());
        if (step() !== 0) return;
      }
      /* Hold the unlit state before the first paint. Without it the table
         appears fully lit and then dims itself when step 1 arrives, which
         reads as a glitch rather than as a build. .is-stepping is deck.js's
         own flag and applyStep() rewrites it on every advance, so this cannot
         drift out of sync. A slide whose lit state is the point of step 0
         turns the hold off with data-autostep-predim="0". */
      if (predim) slide.classList.add('is-stepping');
      expected = 0;
      running = true;
      timer = setTimeout(tick, lead);
    }

    new MutationObserver(function (records) {
      var active = slide.classList.contains('is-active');
      if (active !== wasActive) {
        wasActive = active;
        if (active) start(); else stop();
        return;
      }
      var now = step();
      if (running) {
        if (now === expected) return;   // our own advance
        if (now > expected) finish();   // pressed forward: finish the build now
        else stop();                    // pressed back: hand control over
        return;
      }
      /* deck.js's show() resets a slide to step 0 whenever it is opened —
         including a jump to the slide the deck is already on, such as clicking
         its own thumbnail in the grid, which changes no class and so is not an
         arrival above. That is still an arrival for the build. A backward press
         also ends on step 0, but deck.js only ever decrements one step at a
         time, so the last record's oldValue tells the two apart. */
      if (!active || now !== 0) return;
      var steps = records.filter(function (r) { return r.attributeName === 'data-step'; });
      if (steps.length && Number(steps[steps.length - 1].oldValue || 0) > 1) start();
    }).observe(slide, { attributes: true, attributeFilter: ['class', 'data-step'], attributeOldValue: true });

    addEventListener('beforeprint', function () { printing = true; stop(); });
    addEventListener('afterprint', function () {
      printing = false;
      // After deck.js's own afterprint handler has re-shown the current slide.
      setTimeout(function () { if (slide.classList.contains('is-active')) start(); }, 50);
    });

    if (wasActive) start();
  }

  function boot(tries) {
    if (!window.Deck || !window.Deck.next) {
      if (tries > 0) setTimeout(function () { boot(tries - 1); }, 50);
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll('.slide[data-autostep]'), attach);
  }

  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', function () { boot(40); });
  } else {
    boot(40);
  }
})();
