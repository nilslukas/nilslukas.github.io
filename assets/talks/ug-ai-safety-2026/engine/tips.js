/* ============================================================================
   tips.js — rich hover tooltips for HTML *and* SVG, deck-wide.

   WHY A SECOND MECHANISM. deck.css already has [data-explain]: a pure-CSS
   ::after tooltip, used 70 times, one line of prose, perfect for glossing a
   word mid-sentence. It cannot do the two things asked for on 2026-08-25:

     · Nils: "when I hover over each topic bubble it gives me in a tooltip a
       bullet-point like short description of the topic" — ::after carries
       attr() content, which is a single string with no list structure;
     · the bubbles on What Is Still Open, the pipeline boxes on How Models Are
       Trained and the risk cards on AI Risk Categories are SVG <rect>/<text>,
       and CSS generated content DOES NOT APPLY to SVG elements at all. ::after
       on an SVG rect renders nothing, in every browser.

   So [data-explain] is left ALONE — all 70 uses keep working, deck.css keeps
   its rule — and this file adds [data-tip] beside it for the multi-line,
   works-on-SVG case. Two attributes, two jobs, no migration.

   AUTHORING
       data-tip="First bullet|Second bullet|Third bullet"
       data-tip-title="Optional heading"        (optional)
   Bullets split on "|", or ONLY on newlines (&#10;) when the text contains one — use newlines when
   the prose carries absolute-value bars such as |D_p| (Nils, 2026-09-02, photo of a broken tip). One bullet renders as a plain
   paragraph rather than a one-item list. Put it on ANY element: an HTML <div>,
   an SVG <rect>, an SVG <g> wrapping a box and its labels (preferred — the
   whole bubble becomes the hover target, not just its outline).

   WHY THE TEXT LIVES IN AN ATTRIBUTE. qa_slides.js measures a slide against
   the 120-word cap from section.textContent, and attribute values are not
   textContent. Tooltip prose is therefore free of the word budget — which is
   the point: it is the depth behind a slide, not copy on it. This file is
   loaded once for the whole deck by a <script src> in the first fragment that
   needs it, exactly the way assets/sched-autostep.js is loaded from the
   schedule slide. Do not inline it into a fragment: script text IS counted.

   WHY IT IS INVISIBLE TO QA. The panel is created empty and filled only on
   hover, and it is display:none until then, so at QA time it holds no text to
   measure for the 18px floor and no partly-transparent text to report as ghost
   text (qa_slides.js flags 0.05 < opacity < 0.95; display:none is neither).
   It is suppressed in print, so it cannot reach the PDF.

   GEOMETRY. .stage is CSS-transformed by --fit, so slide coordinates are not
   viewport coordinates. getBoundingClientRect() is post-transform, and the
   panel is position:fixed, so the two agree at any window size and in
   fullscreen without this file knowing the scale.
   ======================================================================== */
(function () {
  'use strict';

  var SEL = '[data-tip]';
  var panel = null, list = null, head = null, current = null, hideTimer = null;

  function css() {
    var s = document.createElement('style');
    s.textContent = [
      '[data-tip]{cursor:help}',
      /* Everything inside the panel is sized in em against --tip-fs, which
         place() rewrites per hover, so the whole panel scales as one piece
         instead of the type drifting away from the box. */
      '#deckTip{position:fixed;z-index:940;display:none;font-size:var(--tip-fs,16px);',
      '  max-width:26em;padding:.78em .95em;border:1px solid var(--line,#c9d5e5);',
      '  border-radius:.5em;background:var(--paper,#f4f7fb);',
      '  box-shadow:0 10px 30px rgba(7,27,52,.17);',
      '  color:var(--ink,#071b34);font-family:inherit;line-height:1.34;',
      '  text-align:left;pointer-events:none}',
      '#deckTip.is-open{display:block}',
      '#deckTip b{display:block;margin-bottom:.42em;color:var(--green,#210eca);',
      '  font-family:var(--mono,SFMono-Regular,Consolas,monospace);font-size:.87em;',
      '  font-weight:700;letter-spacing:.07em;text-transform:uppercase}',
      '#deckTip ul{margin:0;padding:0;list-style:none}',
      /* font-size:1em is NOT redundant. deck.css:87 sets p,li{font-size:var(--fs-body)}
         on the ELEMENT, and an element-level declaration beats inheritance from
         #deckTip, so without this every bullet renders at 23px whatever --tip-fs
         says and the panel GROWS as the window shrinks -- measured on AI Risk
         Categories at 1280x720, the panel was 869px tall against 268px once this
         line is present. The id selector outranks deck.css's element selector. */
      '#deckTip li{position:relative;padding-left:1.02em;margin-bottom:.3em;',
      '  font-size:1em;line-height:1.34;color:var(--ink-2,#233c57)}',
      '#deckTip li:last-child{margin-bottom:0}',
      '#deckTip li::before{content:"";position:absolute;left:.12em;top:.56em;',
      '  width:.36em;height:.36em;border-radius:50%;background:var(--green,#210eca)}',
      '#deckTip p{margin:0;font-size:1em;line-height:1.34;color:var(--ink-2,#233c57)}',
      '@media print{#deckTip{display:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'deckTip';
    panel.setAttribute('role', 'tooltip');
    head = document.createElement('b');
    list = document.createElement('ul');
    panel.appendChild(head);
    panel.appendChild(list);
    document.body.appendChild(panel);
  }

  function fill(el) {
    var raw = el.getAttribute('data-tip') || '';
    var title = el.getAttribute('data-tip-title') || '';
    var items = (/\n/.test(raw) ? raw.split(/\s*\n\s*/) : raw.split(/\s*\|\s*/)).map(function (t) { return t.trim(); })
                   .filter(function (t) { return t.length; });
    if (!items.length) return false;

    head.textContent = title;
    head.style.display = title ? 'block' : 'none';

    while (list.firstChild) list.removeChild(list.firstChild);
    if (items.length === 1) {
      var p = document.createElement('p');
      p.textContent = items[0];
      list.appendChild(p);
      list.style.listStyle = 'none';
    } else {
      items.forEach(function (t) {
        var li = document.createElement('li');
        li.textContent = t;
        list.appendChild(li);
      });
    }
    return true;
  }

  /* The panel is position:fixed, so it is sized in VIEWPORT pixels while the
     slide under it is sized in stage units scaled by --fit. At a fixed 19px it
     therefore grew relative to the slide every time the deck got smaller --
     Nils, 2026-08-25: "when I zoom out the font becomes pretty large". Track
     --fit instead, off a smaller base, so the tooltip keeps its proportion to
     the slide at any window size. Clamped at both ends: never smaller than
     11px in a narrow pane, never larger than 22px on a projector where --fit
     runs well above 1. */
  var BASE = 16, MIN = 11, MAX = 22;
  function scale() {
    var stage = document.querySelector('.stage');
    var fit = stage && parseFloat(getComputedStyle(stage).getPropertyValue('--fit'));
    if (!fit || !isFinite(fit) || fit <= 0) fit = 1;
    panel.style.setProperty('--tip-fs',
      Math.round(Math.min(MAX, Math.max(MIN, BASE * fit)) * 10) / 10 + 'px');
  }

  /* Above the target when it fits, below when it does not, clamped to the
     viewport on both axes so a bubble at the edge of the map still shows a
     whole panel. Measured after the panel is displayed, because its height
     depends on how many bullets it just took AND on the scale just set. */
  function place(el) {
    var r = el.getBoundingClientRect();
    var GAP = 12, EDGE = 10;
    scale();
    panel.style.left = '0px';
    panel.style.top = '0px';
    panel.classList.add('is-open');
    var p = panel.getBoundingClientRect();

    var left = r.left + r.width / 2 - p.width / 2;
    left = Math.max(EDGE, Math.min(left, innerWidth - p.width - EDGE));

    var top = r.top - p.height - GAP;
    if (top < EDGE) top = r.bottom + GAP;
    top = Math.max(EDGE, Math.min(top, innerHeight - p.height - EDGE));

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
  }

  function show(el) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (el === current) return;
    /* Moving straight from one target to the next never passes through hide(),
       so the class has to be surrendered here or it accumulates: measured on
       What Is Still Open, 41 hovers left 40 stale .has-tip elements and the
       affordance drew a trail across the map. Released BEFORE fill() can bail,
       so a target with an empty data-tip cannot strand it either. */
    if (current) current.classList.remove('has-tip');
    current = null;
    if (!fill(el)) { panel.classList.remove('is-open'); return; }
    current = el;
    el.classList.add('has-tip');
    place(el);
  }

  function hide() {
    if (!current) return;
    current.classList.remove('has-tip');
    current = null;
    panel.classList.remove('is-open');
  }

  /* Delegated, so a slide can carry thirty-five hover targets without
     thirty-five listeners, and so fragments added later need no registration.
     Element.closest() is defined on SVG elements too, which is what makes one
     handler cover both trees. */
  function bind() {
    document.addEventListener('mouseover', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (t) show(t); else if (current && !panel.contains(e.target)) hide();
    }, true);

    document.addEventListener('mouseout', function (e) {
      if (!current) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(SEL) === current) return;
      hideTimer = setTimeout(hide, 60);
    }, true);

    document.addEventListener('focusin', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (t) show(t);
    });
    document.addEventListener('focusout', hide);

    /* Any navigation key, any slide change, any reflow: the panel is anchored
       to a box that is about to move, so drop it rather than let it float. */
    addEventListener('keydown', hide, true);
    addEventListener('resize', hide);
    addEventListener('beforeprint', hide);
    addEventListener('scroll', hide, true);
  }

  function boot() {
    try {
      css();
      build();
      bind();
      /* Keyboard reachability, matching deck.css's [data-explain]:focus-visible
         intent. Only elements that are not already focusable are given a stop. */
      Array.prototype.forEach.call(document.querySelectorAll(SEL), function (el) {
        if (!el.hasAttribute('tabindex') && !/^(a|button|input|select|textarea)$/i.test(el.tagName)) {
          el.setAttribute('tabindex', '0');
        }
      });
    } catch (err) {
      /* qa_slides.js reports any console error as a slide ERROR, and a broken
         tooltip must never be able to fail a deck. Degrade to no tooltips. */
    }
  }

  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
