(() => {
'use strict';
const W = 1600, H = 900;
const stage  = document.querySelector('.stage');
const slides = [...document.querySelectorAll('.slide')];
const pad = n => String(n).padStart(2,'0');

/* VERTICAL STACKS (2026-09-02, Nils). A lecture slide may own two short stacks that the main flow
   skips: DOWN opens its explanation stack (fragments carrying data-stack="more"), UP opens its
   exercise stack (data-stack="exercise"). Stacked sections sit right after their parent in document
   order (build order), so print, the student copy and #N hashes see them in place. Left/Right and
   Space keep moving through MAIN slides only; from inside a stack, Left returns to the parent and
   Right goes to the parent's next main slide. Parents show a subtle chevron cue per stack. */
const stackKind = s => s.dataset.stack === 'exercise' ? 'exercise' : (s.dataset.stack === 'more' ? 'more' : '');
const parentOf = new Array(slides.length).fill(-1);
const moreOf = new Map(), exOf = new Map();   // parent index -> [child indices]
let lastMain = -1;
slides.forEach((s, k) => {
  const kind = stackKind(s);
  if (!kind) { lastMain = k; return; }
  if (lastMain < 0) return;
  parentOf[k] = lastMain;
  const m = kind === 'more' ? moreOf : exOf;
  if (!m.has(lastMain)) m.set(lastMain, []);
  m.get(lastMain).push(k);
});
const mainIdx = slides.map((s, k) => k).filter(k => !stackKind(slides[k]));
const mainPos = new Map(mainIdx.map((k, n) => [k, n]));   // slide index -> 1-based main number
const mainOf = k => (stackKind(slides[k]) ? parentOf[k] : k);
const labelOf = k => {
  const kind = stackKind(slides[k]);
  const p = mainOf(k), n = pad(mainPos.get(p) + 1);
  if (!kind) return n;
  const chain = (kind === 'more' ? moreOf : exOf).get(p) || [];
  return n + (kind === 'more' ? '\u25be' : '\u25b4') + (chain.indexOf(k) + 1);
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* optional-route.js runs first, so the last retained slide is the true route
   terminal for either the teaching route or ?review=all. */
const routeTerminal = slides.at(-1);
if (routeTerminal) routeTerminal.classList.add('closing', 'on-deep', 'route-terminal');

renderMathInElement(document.body, {
  delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}],
  throwOnError:false
});

/* Warm the maths fonts.
   A browser only fetches a webfont when a glyph that needs it is actually
   painted. Every slide but the current one is display:none, so on a deck
   whose equations are not on slide 1 the KaTeX faces are still unloaded when
   the print snapshot is taken — and every equation exports BLANK while
   looking perfect on screen. Ask for them up front.
   Caveat is the same story with a quieter failure: the handwriting face of the
   scribble annotations is painted only on the few slides that carry one, so
   without this warm-up document.fonts.check('500 28px Caveat') is still false
   2.5s after load (measured 2026-09-02, which is the whole settle window
   export_pdf.js allows) and the print snapshot falls back to a system cursive.
   A deck that declares no such face resolves the request to nothing, so the
   name is safe on all fourteen weeks and deck.js stays byte-identical. */
if (document.fonts) {
  ['KaTeX_Main','KaTeX_Math','KaTeX_Size1','KaTeX_Size2','KaTeX_Size3','KaTeX_Size4',
   'KaTeX_AMS','KaTeX_Caligraphic','KaTeX_Fraktur','KaTeX_SansSerif','KaTeX_Script',
   'KaTeX_Typewriter','Caveat'].forEach(f =>
     ['24px ', 'italic 24px ', 'bold 24px '].forEach(st =>
       document.fonts.load(st + '"' + f + '"').catch(() => {})));
}

/* page numbers, so reordering slides cannot leave a stale one behind */
slides.forEach((s,i) => {
  const p = s.querySelector('.page');
  if (p) p.textContent = `${labelOf(i)} / ${pad(mainIdx.length)}`;
  const kind = stackKind(s);
  if (kind) s.classList.add('stacked', 'stack-' + kind);
  const canvas = s.querySelector('.canvas');
  if (!canvas) return;
  const par = mainOf(i), fam = moreOf.has(par) || exOf.has(par);
  if (fam) { canvas.appendChild(stackNav(i, par)); return; }
  /* EXIT NODE (Nils, 2026-09-02): "on the slide after a slide that has exercises, you can also put this
     little animation and then put the red dot at the final exit node, so that I know that I'm still on
     the main lecture." A main slide that owns no family but FOLLOWS one redraws that family's map with
     the crimson dot on the trailing main node and the branch dots greyed out. A slide with a family of
     its own keeps its own map, so the exit marker is dropped there. */
  if (kind) return;
  const q = prevMain(i);
  if (q >= 0 && (moreOf.has(q) || exOf.has(q))) canvas.appendChild(stackNav(i, q, true));
});

/* STACK NAVIGATOR (Nils, 2026-09-02): a small wordless "you are here" map on every slide that belongs to
   a stack family, plus floating pills naming the moves. Main line with the previous, parent and next
   lecture slide; the exercise branch above, the explanation branch below; the current node marked in
   crimson. On the parent the pills read "▴ exercise" / "▾ more"; on a stacked slide "◂ lecture" (Left
   returns to the parent) plus a continuation arrow when the chain goes on. Hidden in print.
   With exit=true the map belongs to the PREVIOUS family and i is the main slide the family exits onto:
   the crimson dot sits on the trailing main node, the branch dots go grey, and one quiet pill names the
   slide Left goes back to. */
function stackNav(i, p, exit) {
  const ex = exOf.get(p) || [], mo = moreOf.get(p) || [];
  const W = 196, H = 66, cy = 33, px = 72, step = 22;
  const node = (x, y, cls) => `<circle class="${cls}" cx="${x}" cy="${y}" r="${cls.includes('here') ? 5.5 : 3.8}"/>`;
  let svg = `<path class="sn-line" d="M 8 ${cy} H ${W - 8}"/>`;
  if (ex.length) svg += `<path class="sn-branch" d="M ${px} ${cy} C ${px} ${cy - 11} ${px + 11} 11 ${px + 22} 11 H ${px + 22 + step * ex.length} C ${px + 33 + step * ex.length} 11 ${px + 44 + step * ex.length} ${cy - 11} ${px + 44 + step * ex.length} ${cy}"/>`;
  if (mo.length) svg += `<path class="sn-branch" d="M ${px} ${cy} C ${px} ${cy + 11} ${px + 11} ${H - 11} ${px + 22} ${H - 11} H ${px + 22 + step * mo.length} C ${px + 33 + step * mo.length} ${H - 11} ${px + 44 + step * mo.length} ${cy + 11} ${px + 44 + step * mo.length} ${cy}"/>`;
  svg += node(px - 44, cy, 'sn-main') + node(px, cy, (!exit && i === p) ? 'sn-main sn-here' : 'sn-main sn-parent') + node(px + 44 + step * Math.max(ex.length, mo.length), cy, exit ? 'sn-main sn-here' : 'sn-main');
  ex.forEach((k, n) => { svg += node(px + 22 + step * (n + 1), 11, (!exit && k === i) ? 'sn-ex sn-here' : 'sn-ex'); });
  mo.forEach((k, n) => { svg += node(px + 22 + step * (n + 1), H - 11, (!exit && k === i) ? 'sn-mo sn-here' : 'sn-mo'); });
  const kind = stackKind(slides[i]);
  let pills = '';
  if (exit) {
    pills = `<span class="sn-pill back quiet">\u25c2 back to ${labelOf(p)}</span>`;
  } else if (!kind) {
    if (ex.length) pills += '<span class="sn-pill up">\u25b4 exercise</span>';
    if (mo.length) pills += '<span class="sn-pill down">\u25be more</span>';
  } else {
    const chain = kind === 'more' ? mo : ex, j = chain.indexOf(i);
    pills += '<span class="sn-pill back">\u25c2 lecture</span>';
    if (j + 1 < chain.length) pills += `<span class="sn-pill ${kind === 'more' ? 'down' : 'up'}">${kind === 'more' ? '\u25be' : '\u25b4'} next</span>`;
  }
  const nav = document.createElement('div');
  nav.className = 'stack-nav' + (exit ? ' on-exit' : kind ? ' on-stack' : ' on-parent');
  nav.setAttribute('aria-hidden', 'true');
  nav.innerHTML = `<div class="sn-pills">${pills}</div><svg class="sn-map${exit ? ' sn-exit' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg>`;
  return nav;
}

/* stage fit — absolute + translate, because an oversized grid item is aligned
   to the start edge by Chrome and a 4:3 hall would lose the left of the slide */
const fit = () => stage.style.setProperty('--fit', String(Math.min(innerWidth/W, innerHeight/H)));
addEventListener('resize', fit); fit();

const maxStep = s => Number(s.dataset.maxStep || 0);

function applyStep(s, step) {
  const n = Math.max(0, Math.min(maxStep(s), step));
  s.dataset.step = String(n);
  s.classList.toggle('is-stepping', n > 0);
  // reveal: overlays and answers appear at their step and stay
  s.querySelectorAll('[data-reveal-step]').forEach(el => {
    const k = Number(el.dataset.revealStep);
    el.classList.toggle('is-revealed', n >= k);
    el.classList.toggle('is-now', n === k);
  });
  // focus: everything up to the current step stays visible; future items are
  // fully hidden by CSS, never previewed at low opacity
  s.querySelectorAll('[data-focus-step]').forEach(el => {
    const k = Number(el.dataset.focusStep);
    el.classList.toggle('is-lit', k <= n);
    el.classList.toggle('is-now', k === n);
  });
  s.querySelectorAll(`video[data-play-step="${n}"]`).forEach(v => {
    if (reduce) { v.muted = true; }
    try { v.currentTime = 0; v.play().catch(()=>{}); } catch(_){}
  });
  update();
}
function reset(s) {
  s.querySelectorAll('video').forEach(v => { try { v.pause(); v.currentTime = 0; } catch(_){} });
  /* Reduced motion no longer pre-plays builds: steps are discrete reveals,
     not motion, and pre-playing put the ANSWER of every question slide on
     screen at arrival (found by the 2026-08-24 final review on a machine
     with the OS setting on). The presenter's press is the reveal either way. */
  applyStep(s, 0);
}

let i = Math.max(0, slides.findIndex(s => s.classList.contains('is-active')));
let arrivalBuildTimer = 0;
const prevB = document.getElementById('prev'), nextB = document.getElementById('next');
const count = document.getElementById('count');
const notes = document.getElementById('notes'), notesP = notes.querySelector('p');
const ov = document.getElementById('overview');

function update() {
  const s = slides[i], step = Number(s.dataset.step || 0);
  prevB.disabled = i === 0 && step === 0;
  nextB.disabled = i === slides.length - 1 && step >= maxStep(s);
  count.textContent = `${labelOf(i)} / ${pad(mainIdx.length)}`;
}
function noteFor(slide) {
  const template = slide.querySelector('.speaker-notes');
  return template ? template.content.textContent.trim() : (slide.dataset.notes || 'No presenter notes.');
}

/* Autoplay with sound when a slide is entered.

   Browsers refuse unmuted autoplay until the page has seen a user gesture. In a
   lecture the presenter's first key press or click supplies one, so: try with
   sound, and if that is refused fall back to muted and unmute the moment a
   gesture arrives. Videos that declare data-play-step are driven by applyStep
   instead and are left alone here. */
let gestured = false;
['keydown', 'pointerdown'].forEach(ev =>
  addEventListener(ev, () => { gestured = true; }, { once: true, capture: true }));

function playSlideVideos(s) {
  /* prefers-reduced-motion used to freeze every video here, which read as
     "the animated figure is broken" on machines with the OS setting on
     (Nils, 2026-08-24: the bonsai QR on slide 2). Muted loops are slide
     content in this deck, so they always play; reduced motion now gates
     only the attempt to play with sound. */
  s.querySelectorAll('video:not([data-play-step])').forEach(v => {
    if (reduce) { v.muted = true; v.play().catch(() => {}); return; }
    v.muted = false;
    v.volume = 1;
    const p = v.play();
    if (p && p.catch) p.catch(() => {
      v.muted = true;
      v.play().catch(() => {});
      if (!gestured) {
        addEventListener('keydown', () => { v.muted = false; }, { once: true });
        addEventListener('pointerdown', () => { v.muted = false; }, { once: true });
      }
    });
  });
}

function isAnswerOnlyBuild(s) {
  if (s.querySelector('[data-focus-step]')) return false;
  /* A question slide's reveal is its answer unless the author explicitly
     opts it in with data-autostart="on". Keep that prediction beat gated. */
  if (s.classList.contains('question')) return true;
  const reveals = [...s.querySelectorAll('[data-reveal-step]')];
  return reveals.length > 0 && reveals.every(el =>
    el.matches('.answer.veiled') || !!el.closest('.answer.veiled'));
}

function shouldStartOnArrival(s) {
  if (maxStep(s) < 1 || s.dataset.autostep || s.dataset.autostart === 'off') return false;
  if (s.dataset.autostart === 'on') return true;
  return !isAnswerOnlyBuild(s);
}

function startBuildOnArrival(s, slideIndex) {
  clearTimeout(arrivalBuildTimer);
  arrivalBuildTimer = 0;
  if (!shouldStartOnArrival(s)) return;
  /* Let step 0 paint once, then reveal step 1 without asking for another key
     press. The guard keeps a fast navigation or print action from advancing a
     slide that is no longer current. */
  arrivalBuildTimer = setTimeout(() => {
    arrivalBuildTimer = 0;
    if (i === slideIndex && s.classList.contains('is-active') && Number(s.dataset.step || 0) === 0)
      applyStep(s, 1);
  }, 80);
}

function show(t) {
  clearTimeout(arrivalBuildTimer);
  arrivalBuildTimer = 0;
  i = Math.max(0, Math.min(slides.length - 1, t));
  slides.forEach((s,k) => {
    const on = k === i;
    s.classList.toggle('is-active', on);
    s.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (!on) reset(s);
  });
  reset(slides[i]);
  playSlideVideos(slides[i]);
  startBuildOnArrival(slides[i], i);
  notesP.textContent = noteFor(slides[i]);
  history.replaceState(null, '', `#${i+1}`);
  update();
  if (typeof syncMenu === 'function') syncMenu();
}
function nextMain(k) { const n = mainPos.get(mainOf(k)) + 1; return n < mainIdx.length ? mainIdx[n] : -1; }
function prevMain(k) { if (stackKind(slides[k])) return mainOf(k); const n = mainPos.get(k) - 1; return n >= 0 ? mainIdx[n] : -1; }
function next() {
  const s = slides[i], step = Number(s.dataset.step || 0);
  if (step < maxStep(s)) return applyStep(s, step + 1);
  const n = nextMain(i);
  if (n >= 0) show(n);
}
function prev() {
  const s = slides[i], step = Number(s.dataset.step || 0);
  if (step > 0) return applyStep(s, step - 1);
  const p = prevMain(i);
  if (p >= 0) { show(p); applyStep(slides[i], maxStep(slides[i])); }
}
/* down: deeper into the explanation stack, or back out of the exercise stack toward the parent */
function down() {
  const kind = stackKind(slides[i]), p = mainOf(i);
  if (!kind) { const c = moreOf.get(i); if (c) show(c[0]); return; }
  if (kind === 'more') { const c = moreOf.get(p), j = c.indexOf(i); if (j + 1 < c.length) show(c[j + 1]); return; }
  const c = exOf.get(p), j = c.indexOf(i); show(j > 0 ? c[j - 1] : p);
}
/* up: into the exercise stack, or back out of the explanation stack toward the parent */
function up() {
  const kind = stackKind(slides[i]), p = mainOf(i);
  if (!kind) { const c = exOf.get(i); if (c) show(c[0]); return; }
  if (kind === 'exercise') { const c = exOf.get(p), j = c.indexOf(i); if (j + 1 < c.length) show(c[j + 1]); return; }
  const c = moreOf.get(p), j = c.indexOf(i); show(j > 0 ? c[j - 1] : p);
}

const grid = document.getElementById('overviewGrid');
slides.forEach((s,k) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'thumb';
  b.innerHTML = `<small>${labelOf(k)}</small><strong></strong>`;
  if (stackKind(s)) b.classList.add('thumb-stack');
  b.querySelector('strong').textContent = s.dataset.name || 'Slide';
  b.onclick = () => { show(k); ov.classList.remove('is-open'); };
  grid.appendChild(b);
});

prevB.onclick = prev; nextB.onclick = next;
document.getElementById('grid').onclick = () => ov.classList.toggle('is-open');
document.getElementById('closeGrid').onclick = () => ov.classList.remove('is-open');
document.getElementById('noteToggle').onclick = () => notes.classList.toggle('is-open');
document.getElementById('full').onclick = () =>
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(()=>{});

/* 'b' blanks the projector to the deck's deep blue so the presenter can draw
   on the projected surface; 'b', Escape or a click brings the slide back.
   Navigation keys are swallowed while blanked so the deck cannot advance
   invisibly. Runtime chrome, so it lives here rather than in deck.css, and
   beforeprint force-clears it so a blanked deck can never print blank. */
const blank = document.createElement('div');
blank.id = 'blank';
blank.style.cssText = 'position:fixed;inset:0;background:var(--green-deep,#071b34);z-index:999;display:none;cursor:none';
document.body.appendChild(blank);
const setBlank = on => { blank.style.display = on ? 'block' : 'none'; };
blank.onclick = () => setBlank(false);

/* 'm' / the edge tab: a collapsible slide menu outside the canvas. Numbered
   titles, click to teleport. Runtime chrome like the blank overlay: built
   from the DOM at load, hidden from print, and invisible to the slide word
   counter because it lives outside every .slide. */
const menu = document.createElement('nav');
menu.id = 'slidemenu';
menu.setAttribute('aria-label', 'Slide menu');
menu.style.cssText = 'position:fixed;top:0;left:0;bottom:0;width:348px;background:var(--paper,#f4f7fb);border-right:1px solid var(--line,#c9d5e5);box-shadow:6px 0 24px rgba(7,27,52,.10);z-index:900;overflow-y:auto;padding:14px 0;transform:translateX(-102%);transition:transform .18s ease';
const menuList = document.createElement('div');
slides.forEach((s, k) => {
  const it = document.createElement('button');
  it.type = 'button';
  it.textContent = (k + 1) + ' · ' + (s.dataset.name || 'Slide ' + (k + 1));
  it.style.cssText = 'display:block;width:100%;text-align:left;padding:7px 20px;border:0;background:none;color:var(--ink-2,#233c57);font-family:inherit;font-size:15px;line-height:1.3;cursor:pointer';
  it.onmouseenter = () => { if (k !== i) it.style.background = 'rgba(7,27,52,.06)'; };
  it.onmouseleave = () => { if (k !== i) it.style.background = 'none'; };
  it.onclick = () => { show(k); setMenu(false); it.blur(); };
  menuList.appendChild(it);
});
menu.appendChild(menuList);
document.body.appendChild(menu);
const menuTab = document.createElement('button');
menuTab.type = 'button';
menuTab.id = 'slidemenuTab';
menuTab.title = 'Slide menu (m)';
menuTab.setAttribute('aria-label', 'Toggle slide menu');
menuTab.textContent = '≡';
menuTab.style.cssText = 'position:fixed;left:10px;bottom:12px;z-index:901;width:34px;height:34px;border:1px solid var(--line,#c9d5e5);border-radius:8px;background:var(--paper,#f4f7fb);color:var(--ink-2,#233c57);font-size:18px;line-height:1;cursor:pointer';
document.body.appendChild(menuTab);
const pdfTab = document.createElement('button');
pdfTab.type = 'button';
pdfTab.id = 'pdfTab';
pdfTab.title = 'Export PDF (p): prints every slide at its final build step; choose Save as PDF';
pdfTab.setAttribute('aria-label', 'Export the deck as PDF');
pdfTab.textContent = '⤓';
pdfTab.style.cssText = 'position:fixed;left:10px;bottom:54px;z-index:901;width:34px;height:34px;border:1px solid var(--line,#c9d5e5);border-radius:8px;background:var(--paper,#f4f7fb);color:var(--ink-2,#233c57);font-size:17px;line-height:1;cursor:pointer';
pdfTab.onclick = () => { setMenu(false); setBlank(false); pdfTab.blur(); print(); };
document.body.appendChild(pdfTab);
let menuOpen = false;
function setMenu(on) {
  menuOpen = on;
  menu.style.transform = on ? 'translateX(0)' : 'translateX(-102%)';
  if (on) syncMenu();
}
menuTab.onclick = () => { setMenu(!menuOpen); menuTab.blur(); };
function syncMenu() {
  if (!menuList.children.length) return;
  Array.from(menuList.children).forEach((el, k) => {
    const on = k === i;
    el.style.background = on ? 'var(--green-deep,#071b34)' : 'none';
    el.style.color = on ? '#fff' : 'var(--ink-2,#233c57)';
    if (on && menuOpen) el.scrollIntoView({ block: 'nearest' });
  });
}
/* A chapter starts at an explicit data-chapter marker or a divider heading.
   Consecutive duplicate names collapse so a roadmap can introduce a chapter
   immediately before its visual divider without creating two picker entries. */
const chapterStarts = [];
slides.forEach((s, index) => {
  const explicit = (s.dataset.chapter || '').trim();
  const heading = s.classList.contains('divider') ? s.querySelector('h1')?.textContent.trim() : '';
  const name = explicit || heading;
  if (name && chapterStarts.at(-1)?.name !== name) chapterStarts.push({ name, index });
});

/* The footer's second field used to repeat "Lecture / ML8502 - Week 1" on every
   slide. Nils 2026-08-25: the room knows which lecture it is in; tell them which
   CHAPTER instead. Each .slide.divider names a chapter in its h1, so walk the deck
   once at load, carry the current chapter forward, and relabel each footer field.
   Runtime, so no fragment has to be edited and a reordered deck stays correct. */
(function () {
  let current = null;
  slides.forEach((s, index) => {
    const start = chapterStarts.find(c => c.index === index);
    if (start) current = start.name;
    const field = [...s.querySelectorAll('.footer > span')]
      .find(sp => sp.querySelector('b') && /lecture/i.test(sp.querySelector('b').textContent));
    if (!field) return;
    /* the title slide precedes every chapter, so it claims none; the closer
       sits outside them and names the lecture instead (Nils 2026-08-25) */
    if (s === slides[0]) { field.remove(); return; }
    if (s === slides[slides.length - 1]) {
      const b = field.querySelector('b');
      b.textContent = 'Lecture';
      [...field.childNodes].forEach(n => { if (n !== b) n.remove(); });
      /* Read the deck's own name rather than hardcoding one. The literal
         'ML8502 \u00b7 Week 1 \u00b7 Introduction to ML Security' lived here until
         2026-08-25 and printed WEEK 1'S NAME ON EVERY OTHER DECK'S CLOSING
         SLIDE -- exactly the recycled-wrong-footer defect CLAUDE.md section 8
         forbids; caught on Week 2 by an independent verifier. Every deck's
         <title> is already 'ML8502 \u00b7 Week N \u00b7 <Lecture title>', so for
         Week 1 this resolves to the identical string it printed before and
         deck.js stays byte-identical across decks. */
      field.appendChild(document.createTextNode(document.title.trim()));
      return;
    }
    if (!current) { field.remove(); return; }
    const b = field.querySelector('b');
    b.textContent = 'Chapter';
    [...field.childNodes].forEach(n => { if (n !== b) n.remove(); });
    field.appendChild(document.createTextNode(current));
  });
})();

/* Clicking the footer's Chapter field opens a chapter picker at the top of the
   stage (Nils 2026-08-25). Built once from the dividers, so it stays correct
   through a reorder; the field itself becomes a real button for keyboard use. */
(function () {
  const chapters = chapterStarts;
  if (!chapters.length) return;

  const pick = document.createElement('nav');
  pick.id = 'chapterPick';
  pick.setAttribute('aria-label', 'Jump to chapter');
  pick.style.cssText = 'position:fixed;top:0;left:50%;transform:translate(-50%,-104%);z-index:902;' +
    'display:flex;gap:6px;padding:9px 11px;background:var(--paper,#f4f7fb);border:1px solid var(--line,#c9d5e5);' +
    'border-top:0;border-radius:0 0 10px 10px;box-shadow:0 8px 26px rgba(7,27,52,.14);transition:transform .18s ease';
  chapters.forEach((c, n) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(n + 1).padStart(2, '0') + '  ' + c.name;
    btn.style.cssText = 'border:1px solid transparent;border-radius:6px;padding:7px 13px;background:none;cursor:pointer;' +
      'color:var(--ink-2,#233c57);font-family:inherit;font-size:15px;line-height:1.2;white-space:nowrap';
    btn.onmouseenter = () => { btn.style.background = 'rgba(7,27,52,.06)'; };
    btn.onmouseleave = () => { btn.style.background = c.index === lastLit ? 'rgba(7,27,52,.06)' : 'none'; };
    btn.onclick = () => { show(c.index); setPick(false); btn.blur(); };
    pick.appendChild(btn);
  });
  document.body.appendChild(pick);

  let open = false, lastLit = -1;
  function setPick(on) {
    open = on;
    pick.style.transform = on ? 'translate(-50%,0)' : 'translate(-50%,-104%)';
    if (!on) return;
    let cur = -1;
    chapters.forEach(c => { if (c.index <= i) cur = c.index; });
    lastLit = cur;
    [...pick.children].forEach((b, n) => {
      const on2 = chapters[n].index === cur;
      b.style.background = on2 ? 'rgba(7,27,52,.06)' : 'none';
      b.style.borderColor = on2 ? 'var(--line,#c9d5e5)' : 'transparent';
      b.style.fontWeight = on2 ? '650' : '400';
    });
  }

  /* every footer's Chapter label becomes the trigger */
  slides.forEach(s => {
    const field = [...s.querySelectorAll('.footer > span')]
      .find(sp => sp.querySelector('b') && sp.querySelector('b').textContent === 'Chapter');
    if (!field) return;
    const b = field.querySelector('b');
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.title = 'Jump to chapter';
    b.style.cursor = 'pointer';
    b.style.textDecorationLine = 'underline';
    b.style.textDecorationStyle = 'dotted';
    b.style.textUnderlineOffset = '3px';
    const fire = e => { e.preventDefault(); e.stopPropagation(); setPick(!open); b.blur(); };
    b.addEventListener('click', fire);
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  });

  addEventListener('keydown', e => { if (open && e.key === 'Escape') { setPick(false); e.preventDefault(); } }, true);
  addEventListener('pointerdown', e => { if (open && !pick.contains(e.target)) setPick(false); });
})();

/* The Lecture Roadmap's four chapter cards jump too (Nils 2026-08-25: "make each
   chapter clickable so that if I click on the chapter, I go there"). Same source
   of truth as the picker above - the dividers, read off the DOM in deck order -
   so a reorder carries the targets with it and no slide index is written down
   anywhere. Cards pair with dividers in order; if the two counts ever disagree
   the surplus is left inert and the console says which way it drifted, rather
   than throwing and taking the rest of the deck's runtime with it. */
(function () {
  const cards = [...document.querySelectorAll('.slide .lrc')];
  if (!cards.length) return;
  const chapters = chapterStarts;
  const n = Math.min(cards.length, chapters.length);
  if (cards.length !== chapters.length)
    console.warn('[deck] lecture roadmap: ' + cards.length + ' card(s) against ' +
      chapters.length + ' chapter divider(s) - wired the first ' + n + ', left the rest inert');
  for (let c = 0; c < n; c++) {
    const card = cards[c], target = chapters[c];
    /* role + tabindex rather than a real <button>, exactly the way the footer's
       Chapter field is done above: the card keeps the warm-paper .note .card
       treatment untouched and gains only the affordance, which
       src/011-lecture-roadmap.html styles off [role="button"] and drops again
       for print. lightbox.js already lists [role="button"] in its STOP set, so
       the card owns its own clicks from the moment this runs. */
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Jump to chapter: ' + target.name);
    card.title = 'Jump to ' + target.name;
    const fire = e => { e.preventDefault(); e.stopPropagation(); show(target.index); card.blur(); };
    card.addEventListener('click', fire);
    /* the deck's own key handler reads keydown off window in the bubble phase
       and bails only for `button, a`, so a div carrying a role has to stop the
       event itself or Space would advance the slide out from under the jump */
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  }
})();

/* Slide-local interactive: the training-cost estimator on What Training Costs.
   It lives here rather than in the fragment because artifacts/tools/build_deck.py extracts
   only <section>...</section>, so a <script> beside the section is dropped at
   build time and the field renders inert (found 2026-08-25 by driving the built
   deck rather than an isolated harness). Keeping it here also keeps its source
   text out of the QA word count, which is why it was outside the section to
   begin with. Guarded, so it is a no-op on any deck without that slide. */
(function () {
  'use strict';
  var slide = document.querySelector('.slide[data-name="What Training Costs"]');
  if (!slide) return;
  var inp  = slide.querySelector('.s330-n');
  var tok  = slide.querySelector('.s330-tok');
  var mant = slide.querySelector('.s330-mant');
  var expo = slide.querySelector('.s330-exp');
  var usd  = slide.querySelector('.s330-usd');
  if (!inp || !tok || !mant || !expo || !usd) return;

  var TOK_PER_PARAM = 38.5;     /* Llama 3.1 405B: 15.6e12 / 405e9 */
  var USD_PER_FLOP  = 1.7e-18;  /* DeepSeek-V3: $5.576M / (6 x 37e9 x 14.8e12) */
  var FALLBACK = 405, LO = 0.1, HI = 1e5;

  /* two significant figures, the way a lecturer says a number out loud */
  function sig2(x) {
    if (!isFinite(x) || x <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / p) * p;
  }
  function money(v) {
    v = sig2(v);
    var u = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
    for (var i = 0; i !== u.length; i++) {
      if (v >= u[i][0]) {
        var q = v / u[i][0];
        return '≈ $' + (q >= 10 ? Math.round(q) : q.toFixed(1)) + ' ' + u[i][1];
      }
    }
    return '≈ $' + (v >= 10 ? Math.round(v) : v.toFixed(1));
  }
  function tokens(t) {
    var big = t >= 1e12, q = t / (big ? 1e12 : 1e9);
    var s = q >= 1000 ? Math.round(q).toLocaleString('en-US') : q.toFixed(1).replace(/\.0$/, '');
    return s + (big ? 'T' : 'B');
  }
  function paint() {
    var raw = inp.value.trim();
    var n = raw === '' ? NaN : Number(raw), note = '';
    /* An empty or unreadable field falls back to the worked example above it, and
       the greyed placeholder 405 is what says so. A number outside the range is
       clamped and SAYS it was, in the token slot rather than as a fourth item on
       the result line: that line has no width left at $3.9 trillion, and being
       told the value actually used matters more than the token count of an input
       nobody meant literally. */
    if (!isFinite(n))  { n = FALLBACK; }
    else if (n < LO)   { n = LO; note = 'floored at 0.1'; }
    else if (n > HI)   { n = HI; note = 'capped at 100,000'; }
    var params = n * 1e9;
    var ntok = TOK_PER_PARAM * params;
    var flop = 6 * params * ntok;
    var e = Math.floor(Math.log10(flop));
    var m = Math.round(flop / Math.pow(10, e) * 10) / 10;
    if (m >= 10) { m = m / 10; e = e + 1; }
    tok.setAttribute('data-t', note || ('→ ' + tokens(ntok) + ' tokens'));
    mant.textContent = m.toFixed(1);
    expo.textContent = String(e);
    usd.textContent = money(flop * USD_PER_FLOP);
  }
  inp.addEventListener('input', paint);
  /* deck.js reads keydown off window in the bubble phase and bails only for
     `button, a`, so the field has to stop the event itself or space advances the
     slide and the arrows leave it. Escape and Enter hand the keyboard back. */
  inp.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); inp.blur(); }
  });
  inp.addEventListener('keyup', function (e) { e.stopPropagation(); });
  inp.addEventListener('keypress', function (e) { e.stopPropagation(); });
  paint();   /* deck.js runs after parse, so paint once now: the authored HTML
                carries fallback values, and this guarantees DOM and value
                cannot disagree if either is ever edited alone. */
})();

const chromeHide = document.createElement('style');
chromeHide.textContent = '@media print{#slidemenu,#slidemenuTab,#pdfTab,#blank,#chapterPick{display:none!important}}';
document.head.appendChild(chromeHide);

addEventListener('keydown', e => {
  if (ov.classList.contains('is-open')) {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'g') ov.classList.remove('is-open');
    return;
  }
  if (blank.style.display === 'block') {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'b') setBlank(false);
    e.preventDefault();
    return;
  }
  if (menuOpen && e.key === 'Escape') { setMenu(false); return; }
  if (e.target.closest('button, a')) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); next(); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
  else if (k === 'ArrowDown') { e.preventDefault(); down(); }
  else if (k === 'ArrowUp') { e.preventDefault(); up(); }
  else if (k === 'Home') show(0);
  else if (k === 'End') show(slides.length - 1);
  else if (k.toLowerCase() === 'g') ov.classList.add('is-open');
  else if (k.toLowerCase() === 'n') document.getElementById('noteToggle').click();
  else if (k.toLowerCase() === 'f') document.getElementById('full').click();
  else if (k.toLowerCase() === 'b') setBlank(true);
  else if (k.toLowerCase() === 'm') setMenu(!menuOpen);
  else if (k.toLowerCase() === 'p') { e.preventDefault(); print(); }
});
addEventListener('hashchange', () => {
  const n = Number(location.hash.slice(1));
  if (n >= 1 && n <= slides.length && n - 1 !== i) show(n - 1);
});

/* print: drive every slide to its last step so the PDF matches the room */
addEventListener('beforeprint', () => {
  clearTimeout(arrivalBuildTimer);
  arrivalBuildTimer = 0;
  setBlank(false);
  slides.forEach(s => { s.classList.add('is-active'); applyStep(s, maxStep(s)); });
});
addEventListener('afterprint', () => show(i));

const req = Number(location.hash.slice(1));
show(req >= 1 ? req - 1 : i);

/* ?step=max (or ?step=2) opens the slide with its build already played —
   handy for checking a build without clicking, and for screenshot QA. */
const wanted = new URLSearchParams(location.search).get('step');
if (wanted) applyStep(slides[i], wanted === 'max' ? maxStep(slides[i]) : Number(wanted));

/* Headlines stay on one line at ONE size. Slide titles are short enough that
   none of them needs to shrink, so the deck no longer renders 31px on one
   slide and 42px on the next -- which was the most visible typographic
   inconsistency in the deck. The clamp survives only as a safety net, and it
   will not go below --fs-h2-min. Anything that trips it is a title to
   rewrite, not a font size to accept, so it is reported to the console. */
function fitTitles() {
  const root = getComputedStyle(document.documentElement);
  const base = parseFloat(root.getPropertyValue('--fs-h2')) || 46;
  const floor = parseFloat(root.getPropertyValue('--fs-h2-min')) || 38;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;white-space:nowrap;visibility:hidden';
  document.body.appendChild(probe);
  const active = document.querySelector('.slide.is-active .slide-head h2');
  const columnWidth = (active && active.parentElement.clientWidth) || 1190;
  const over = [];
  document.querySelectorAll('.slide-head h2').forEach(h => {
    const slide = h.closest('.slide');
    const cs = getComputedStyle(h);
    probe.style.font = `${cs.fontStyle} ${cs.fontWeight} ${base}px/${cs.lineHeight} ${cs.fontFamily}`;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.textContent = h.textContent.trim();
    const naturalWidth = probe.getBoundingClientRect().width;
    const clear = () => { h.style.whiteSpace = ''; slide.style.removeProperty('--band-head'); };
    if (naturalWidth <= columnWidth) { h.style.fontSize = ''; clear(); return; }
    const exact = base * columnWidth / naturalWidth;
    if (exact >= floor) {
      h.style.fontSize = `${Math.floor(exact * 10) / 10}px`;
      clear();
    } else {
      /* Below the floor a headline is not shrunk any further: it wraps to a
         second line at the floor size and the head band grows to hold it.
         Clipping the end of a sentence off the slide, which is what a hard
         nowrap did, loses words the room needs. */
      h.style.fontSize = `${floor}px`;
      h.style.whiteSpace = 'normal';
      slide.style.setProperty('--band-head', 'auto');
    }
    over.push(`${probe.textContent} (${h.style.fontSize})`);
  });
  probe.remove();
  if (over.length) console.warn('[deck] headline too long for one line at full size:', over);
}
fitTitles();
addEventListener('resize', fitTitles);
addEventListener('beforeprint', fitTitles);
window.Deck = { go: show, next, prev, length: slides.length, current: () => i };
})();
