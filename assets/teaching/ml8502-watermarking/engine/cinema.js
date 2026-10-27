/* cinema.js (shared engine, slides/shared/engine/): the exec deck's chapter bar, generalised from Week 9's
   w09-cinema.js on 19 Oct 2026 so every engine deck gets it. Ported from the exec deck's exec-cinema.js
   (slides/exec-ai-security-2026-10-16/assets/exec-cinema.js). One change: the exec deck reads each slide's chapter from
   its eyebrow; this reads it from the footer's Chapter field, which deck.js fills from data-chapter and the
   divider headings. The week badge reads window.ML8502_DECK (written by build_deck.py from src/deck.json):
   { week: "5", topic: "Watermarking", dates: [["Tue 22 Sep", "Lecture", "CR1"], ...] }. Load after deck.js.

   1. A YouTube-style chapter progress bar along the top edge of the footer: one segment per chapter, filled up to the
      current slide and build step, with a small clickable label per chapter.
   2. An "N slides left" counter next to the page number.
   3. Automated browsers (QA screenshots) and reduced-motion viewers get the static deck: html.no-cinema, unless the
      URL carries ?anim=1, the same contract as motion.js. */
(function () {
  'use strict';
  var animParam = /[?&]anim=1\b/.test(location.search);
  if (navigator.webdriver === true && !animParam) document.documentElement.classList.add('no-cinema');

  var stage = document.querySelector('.stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('section.slide'));
  if (!stage || !slides.length || !window.Deck) return;

  /* the footer's Chapter field after deck.js relabelled it; the title slide joins the first chapter, the closer is
     its own segment */
  function chapterOf(s, k) {
    if (k === slides.length - 1) return 'Closing';
    var field = Array.prototype.slice.call(s.querySelectorAll('.footer > span')).find(function (sp) {
      var b = sp.querySelector('b');
      return b && /chapter/i.test(b.textContent);
    });
    if (!field) return '';
    return field.textContent.replace(field.querySelector('b').textContent, '').trim();
  }

  var segs = [];
  slides.forEach(function (s, k) {
    var name = chapterOf(s, k);
    var last = segs[segs.length - 1];
    if (last && (last.name === name || !name || !last.name)) { last.to = k + 1; if (!last.name) last.name = name; }
    else segs.push({ name: name, from: k, to: k + 1 });
  });

  /* main slides only (26 Oct 2026, Week 10 review): a Down-arrow stack (data-stack) is off the lecture line, so it is
     not counted in the chapter's slide count and shows its parent's position */
  var isMain = function (k) { return !slides[k].dataset.stack; };
  var mainPos = function (g, k) { var p = 0; for (var j = g.from; j <= k; j++) if (isMain(j)) p++; return Math.max(p, 1); };
  segs.forEach(function (g) { g.mains = 0; for (var j = g.from; j < g.to; j++) if (isMain(j)) g.mains++; g.mains = Math.max(g.mains, 1); });

  var bar = document.createElement('nav');
  bar.className = 'cin-bar';
  bar.setAttribute('aria-label', 'Chapters');
  var N = slides.length;
  segs.forEach(function (g) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'cin-seg';
    el.style.flexGrow = String(g.mains);
    el.setAttribute('aria-label', g.name);
    el.innerHTML = '<span class="cin-lab"></span><span class="cin-line"><span class="cin-fill"></span></span>';
    /* Nils, 19 Oct 2026: "show how many slides we actually have for each topic": the count beside each label */
    el.querySelector('.cin-lab').textContent = g.name;
    if (g.name) {
      var n = document.createElement('span');
      n.className = 'cin-n';
      n.textContent = String(g.mains);
      el.querySelector('.cin-lab').appendChild(n);
    }
    el.addEventListener('click', function (e) { e.stopPropagation(); window.Deck.go(g.from); });
    g.el = el;
    bar.appendChild(el);
  });
  stage.appendChild(bar);

  /* (i) at the footer's bottom right: hover shows when and from which commit this page was built (Nils, 26 Oct 2026).
     The data comes from build_deck.py (window.ML8502_DECK.build); .pagenum keeps it out of QA's word count. */
  var BI = (window.ML8502_DECK || {}).build;
  if (BI) {
    var ib = document.createElement('span');
    ib.className = 'build-i pagenum';
    ib.textContent = 'i';
    ib.tabIndex = 0;
    var nSlides = slides.filter(function (s) { return !s.dataset.stack; }).length;
    var lines = ['Built ' + BI.built, (BI.commit ? 'Source commit ' + BI.commit + (BI.commit_date ? ' (' + BI.commit_date + ')' : '') : ''),
      (BI.commit_subject ? '\u201c' + BI.commit_subject + '\u201d' : ''), nSlides + ' slides \u00b7 ' + (BI.tool || '')].filter(Boolean);
    ib.setAttribute('data-tip-title', ((window.ML8502_DECK || {}).title || 'This deck'));
    ib.setAttribute('data-tip', lines.join('|'));
    ib.setAttribute('aria-label', lines.join('. '));
    stage.appendChild(ib);
  }

  /* the slide's place in its chapter, small, after the footer's chapter name ("like slide 4 out of 20"); .pagenum
     keeps it out of QA's word count, like the slides-left counter */
  segs.forEach(function (g) {
    for (var k = g.from; k < g.to; k++) {
      var field = Array.prototype.slice.call(slides[k].querySelectorAll('.footer > span')).find(function (sp) {
        var b = sp.querySelector('b');
        return b && /chapter/i.test(b.textContent);
      });
      if (!field || field.querySelector('.cin-chpos')) continue;
      var pos = document.createElement('span');
      pos.className = 'cin-chpos pagenum';
      pos.textContent = mainPos(g, k) + ' / ' + g.mains;
      field.appendChild(pos);
    }
  });

  /* the week badge left of the instructor; hover or focus shows this week's dates (Nils, 19 Oct 2026). Dates come
     from src/deck.json (the week's row of the Lecture Schedule). Positioned outside the footer's grid; .pagenum keeps
     it out of QA's word count. No week in the config: no badge. */
  var CFG = window.ML8502_DECK || {};
  var WEEK = CFG.week ? String(CFG.week) : '', DATES = CFG.dates || [], TOPIC = CFG.topic || '';
  if (WEEK) slides.forEach(function (s) {
    var foot = s.querySelector('.footer');
    if (!foot || foot.querySelector('.wk-badge')) return;
    var badge = document.createElement('span');
    badge.className = 'wk-badge pagenum';
    badge.tabIndex = 0;
    badge.setAttribute('aria-label', 'Week ' + WEEK + ': ' + DATES.map(function (d) { return d.join(' '); }).join('; '));
    badge.textContent = WEEK;
    var pop = document.createElement('span');
    pop.className = 'wk-pop';
    pop.innerHTML = '<span class="wk-pop-h">Week ' + WEEK + (TOPIC ? ' \u00b7 ' + TOPIC : '') + '</span>' + DATES.map(function (d) {
      return '<span class="wk-pop-r"><b>' + d[0] + '</b><span>' + d[1] + '</span><i>' + d[2] + '</i></span>';
    }).join('');
    badge.appendChild(pop);
    foot.insertBefore(badge, foot.firstChild);
  });

  /* the "N slides left" counter is off (Nils, 26 Oct 2026: "you don't have to show this"); set SHOW_LEFT to bring it back */
  var SHOW_LEFT = false;
  if (SHOW_LEFT) slides.forEach(function (s, k) {
    var page = s.querySelector('.footer .page');
    if (!page || page.querySelector('.cin-left')) return;
    var left = N - 1 - k;
    var span = document.createElement('span');
    span.className = 'cin-left pagenum';   /* .pagenum: QA counts it as chrome, not as slide words */
    span.textContent = left ? left + (left === 1 ? ' slide left' : ' slides left') : 'last slide';
    page.appendChild(span);
  });

  function update() {
    var i = window.Deck.current();
    var s = slides[i];
    var max = Number(s.dataset.maxStep || 0), step = Number(s.dataset.step || 0);
    var within = (step + 1) / (max + 1);
    segs.forEach(function (g) {
      var f = i >= g.to ? 1 : i < g.from ? 0 : (mainPos(g, i) - 1 + within) / g.mains;
      g.el.querySelector('.cin-fill').style.transform = 'scaleX(' + Math.max(0, Math.min(1, f)) + ')';
      var cur = i >= g.from && i < g.to;
      g.el.classList.toggle('is-current', cur);
      /* Nils, 19 Oct 2026 (evening): "instead of just showing the total number of slides in this chapter also show
         where we are right now (if we are in that section, i.e., 3/8)" */
      var n = g.el.querySelector('.cin-n');
      if (n) n.textContent = cur ? mainPos(g, i) + '/' + g.mains : String(g.mains);
    });
    bar.classList.toggle('on-dark', s.classList.contains('on-deep'));
  }

  var mo = new MutationObserver(update);
  slides.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class', 'data-step'] }); });
  update();
})();
