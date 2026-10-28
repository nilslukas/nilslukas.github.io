/* ============================================================================
   lightbox.js — click a figure to blow it up, click again to put it back.

   WHY
   In the room a student asks "what does the y-axis say?" about a chart that is
   224px tall on a four-up slide. Nils should be able to click it and have it
   fill the hall, then click it away and carry on from the same slide, the same
   step, with nothing else disturbed. That is the whole feature.

   HOW IT PLUGS INTO THE DECK
   deck.js and deck.css are frozen and this file changes neither. It is loaded
   with `defer` from the deck's <head>, so it runs AFTER deck.js (a classic
   script at the end of <body> executes during parsing; deferred scripts run
   after the parse) and it never calls into deck.js — it only makes sure the
   deck's own handlers do not fire while an image is open:

     · clicks   deck.js binds no document-level click handler at all (only the
                control buttons and the grid thumbnails), so nothing here has
                to fight it. The click listener below is nevertheless installed
                in the CAPTURE phase and calls stopPropagation ONLY when the
                pointer is genuinely over a zoomable image, so a click on any
                other content — a link, a button, another agent's autostep
                widget on slide 6 — reaches its own handler untouched.
     · keys     deck.js listens for keydown on window in the BUBBLE phase. The
                listener below is on window in the CAPTURE phase, which runs
                first; while an image is open it swallows the deck's key set,
                so Escape / arrows / space close the overlay instead of moving
                the slide underneath it.

   THE ANIMATION IS A FLIP
   The overlay holds a CLONE of the image, positioned at the original's exact
   viewport rectangle, and then transformed to the centred, letterboxed target
   rectangle. Only `transform` and `opacity` animate, so the browser can run
   the whole thing on the compositor and it stays smooth over a 2560px page
   capture. Because getBoundingClientRect() reports the rect AFTER every
   ancestor transform, this works unchanged for images that live inside the
   scaled .stage, inside the timeline's flying .ev-shot boxes (080-how-we-got-here) and
   inside the stepwise chart grid (060-where-we-are-today) — the source rect is
   simply whatever is on screen at the instant of the click.
   The clone is appended to <body>, never inside .stage: .stage carries a
   transform, which would make `position:fixed` resolve against it, and it also
   clips with overflow:hidden.

   WHAT IS ZOOMABLE
   An <img> or a <video> that is
     · inside a .slide, and not inside .brand-logo / .footer / .pagenum /
       .chapters / .cast-mark or the deck chrome,
     · actually visible (nothing on its ancestor chain is display:none,
       visibility:hidden or effectively transparent — this is what keeps the
       not-yet-revealed charts on 060-where-we-are-today and the un-lit timeline
       pages on 080-how-we-got-here out),
     · at least 90 CSS px on both sides, measured with offsetWidth/offsetHeight
       so the floor is in AUTHORED pixels and does not move when the stage is
       scaled to the hall. This is what excludes small logos and marks,
     · not carrying data-nozoom (see below),
     · and, for <video>, not carrying `controls` — a video with controls owns
       its own clicks (play/pause/scrub) and must keep them. The bio slide's
       looping QR video has no controls, so it zooms, which is the point: the
       room can scan it off the wall.

   TWO ATTRIBUTES FOR AUTHORS
     data-nozoom   on an image, or on any ancestor of it, opts that image (or
                   that whole block) out of zooming. Use it for decoration.
     data-zoom     forces an element IN, past the size floor and past the
                   video-controls rule. Use it for a small image the room
                   genuinely needs to see big.

   KNOWN LIMIT
   Inline <svg> diagrams are deliberately not zoomable. They are authored at
   slide scale and are styled by descendant selectors in deck.css, so a clone
   lifted out of .slide would lose its type styling. Charts and screenshots —
   the things anyone asks to see bigger — are <img>.

   Degrades to nothing: if this file fails to load the deck is unchanged, and
   the overlay is display:none in print, so the PDF export never sees it.
   ========================================================================= */
(() => {
'use strict';

const MIN_PX = 90;                       /* authored-px floor on both sides   */
const FILL   = 0.94;                     /* share of the viewport when open   */
const MS     = 300;                      /* zoom duration                      */
const EASE   = 'cubic-bezier(.22,.61,.36,1)';
const SCRIM  = 'rgba(7,27,52,.88)';      /* --ink at 88%                        */

/* chrome and furniture: never zoomable, whatever their size */
const CHROME = '.brand-logo,.footer,.pagenum,.chapters,.cast-mark,' +
               '.controls,.notes,.overview,#lightbox';
/* things that own their own clicks — the hit scan stops when it meets one */
const STOP   = 'a[href],button,input,select,textarea,video,[role="button"]';
/* the keys deck.js acts on, plus Escape */
const KEYS = new Set(['Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
                      'PageUp', 'PageDown', ' ', 'Spacebar', 'Home', 'End',
                      'g', 'G', 'n', 'N', 'f', 'F', 'p', 'P']);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- eligibility */

/* Visible to the eye, not merely present in the DOM. 060-where-we-are-today
   keeps its unrevealed charts at visibility:hidden and 080-how-we-got-here keeps
   its unlit pages at opacity:0 — both still have a box, and both must stay
   unclickable. */
function shown(el) {
  for (let e = el; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.1) return false;
  }
  return true;
}

function eligible(el) {
  /* comment mode (c) owns every click, also on images (Nils, 26 Oct 2026) */
  if (document.documentElement.classList.contains('cm-on')) return false;
  if (!el || (el.tagName !== 'IMG' && el.tagName !== 'VIDEO')) return false;
  if (!el.closest('.slide')) return false;          /* slide content only     */
  if (el.closest(CHROME)) return false;
  if (el.closest('[data-nozoom]')) return false;
  const forced = !!el.closest('[data-zoom]');
  if (el.tagName === 'VIDEO' && el.controls && !forced) return false;
  if (!forced && (el.offsetWidth < MIN_PX || el.offsetHeight < MIN_PX)) return false;
  return shown(el);
}

/* The topmost zoomable image under the pointer.

   Not simply e.target: 080-how-we-got-here lays every event out as a full-band
   <figcaption class="ev-cap"> at z-index 4, so the small page thumbnails at
   z-index 2 are covered by a sibling's caption and never become the click
   target. Walking the hit stack finds them anyway, and stops the moment it
   meets something that owns its own click, so a link or a button is never
   hijacked by an image lying behind it. */
function pick(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (eligible(el)) return el;
    if (el.matches && el.matches(STOP)) return null;
    if (el.classList && el.classList.contains('slide')) break;
  }
  return null;
}

/* The ground the zoomed image sits on. A pencil-art PNG is transparent
   everywhere it is not drawn, so on the dark scrim it would vanish; painting
   it on whatever colour it already sits on keeps it looking native on a paper
   slide and on an .on-deep one alike. */
function ground(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && c !== 'transparent' && !/,\s*0\)$/.test(c)) return c;
  }
  return '#fff';
}

/* ------------------------------------------------------------------- state */

let src = null;      /* the on-slide element being shown                      */
let root = null, scrim = null, clone = null;

/* Put the clone exactly on top of the on-slide image, and transform it to the
   centred target. Both are recomputed from the live rect rather than
   remembered, so a window resize while an image is open re-lands it instead of
   leaving it stranded. */
function place(zoomed) {
  const r = src.getBoundingClientRect();
  clone.style.left   = r.left + 'px';
  clone.style.top    = r.top + 'px';
  clone.style.width  = r.width + 'px';
  clone.style.height = r.height + 'px';
  if (!zoomed) { clone.style.transform = 'none'; return; }
  const vw = innerWidth, vh = innerHeight;
  /* one uniform scale, so the clone keeps the source's rendered aspect ratio
     exactly and there is no jump at either end of the transition */
  const s = Math.max(1, Math.min(vw * FILL / r.width, vh * FILL / r.height));
  const dx = (vw - r.width * s) / 2 - r.left;
  const dy = (vh - r.height * s) / 2 - r.top;
  clone.style.transform = `translate(${dx}px,${dy}px) scale(${s})`;
}

function open(el) {
  if (src) return;
  src = el;

  /* The mechanism's own geometry is set here rather than in the deck's <head>,
     so dropping this one file into any later deck brings a working lightbox
     with it. The head carries only the two cursor rules and the print rule. */
  root = document.createElement('div');
  root.id = 'lightbox';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.style.cssText = 'position:fixed;inset:0;z-index:9000;' +
                       'cursor:zoom-out;-webkit-user-select:none;user-select:none';

  scrim = document.createElement('div');
  scrim.style.cssText = 'position:absolute;inset:0;opacity:0;background:' + SCRIM;

  /* cloneNode(false) keeps src/srcset/alt/poster and the element's own
     attributes; the authored inline style goes, because it carries the
     on-slide geometry (max-height:340px and friends) that this element is
     escaping. object-fit and object-position are copied from the computed
     style so a cover-cropped portrait zooms as the same crop the room was
     already looking at. */
  const cs = getComputedStyle(el);
  const bg = ground(el);
  clone = el.cloneNode(false);
  clone.removeAttribute('class');
  clone.removeAttribute('id');
  clone.style.cssText =
    'position:absolute;display:block;margin:0;max-width:none;max-height:none;' +
    'transform-origin:0 0;will-change:transform;backface-visibility:hidden;' +
    'object-fit:' + cs.objectFit + ';object-position:' + cs.objectPosition +
    ';background:' + bg;

  if (el.tagName === 'VIDEO') {
    /* muted on purpose: the original keeps playing underneath, and two copies
       of the same soundtrack is worse than none. Everything that reaches here
       is a controls-less loop (the bio QR), which is silent anyway. */
    clone.muted = true;
    clone.loop = true;
    clone.playsInline = true;
    clone.removeAttribute('controls');
  }

  root.appendChild(scrim);
  root.appendChild(clone);
  document.body.appendChild(root);

  if (el.tagName === 'VIDEO') {
    try { clone.currentTime = el.currentTime; } catch (_) {}
    const p = clone.play(); if (p && p.catch) p.catch(() => {});
  }

  place(false);
  if (reduce) { scrim.style.opacity = '1'; place(true); return; }

  /* commit the start state before asking for the end state, or the browser
     coalesces both into one style change and there is no transition */
  getComputedStyle(clone).transform;
  clone.style.transition = `transform ${MS}ms ${EASE}`;
  scrim.style.transition = `opacity ${MS}ms ease`;
  scrim.style.opacity = '1';
  place(true);
}

function close(instant) {
  if (!src) return;
  const r = root, c = clone, s = scrim;
  src = null; root = null; clone = null; scrim = null;
  if (instant || reduce) { r.remove(); return; }
  /* the FLIP run backwards: the clone lands exactly on the on-slide image it
     came from and is only then removed, so there is no seam at the end */
  c.style.transition = `transform ${MS}ms ${EASE}`;
  c.style.transform = 'none';
  r.style.pointerEvents = 'none';     /* no second click on a leaving overlay */
  s.style.opacity = '0';
  let done = false;
  const fin = () => { if (!done) { done = true; r.remove(); } };
  c.addEventListener('transitionend', fin, { once: true });
  setTimeout(fin, MS + 150);          /* a transform that did not change fires
                                         no transitionend; never leak the node */
}

/* ---------------------------------------------------------------- handlers */

/* Capture phase, but deliberately quiet: the event is only intercepted when
   the overlay is open, or when the pointer really is over a zoomable image.
   Everything else propagates exactly as it did before this file existed. */
addEventListener('click', e => {
  if (src) { e.preventDefault(); e.stopPropagation(); close(); return; }
  if (e.button || e.detail === 0) return;      /* keyboard-synthesised clicks */
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const el = pick(e.clientX, e.clientY);
  if (!el) return;
  e.preventDefault(); e.stopPropagation();
  open(el);
}, true);

/* Window capture runs before deck.js's window-bubble keydown, so a navigation
   key closes the overlay instead of moving the deck behind it. */
addEventListener('keydown', e => {
  if (!src || !KEYS.has(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  close();
}, true);

/* Re-land, without animating: the image should follow the new stage size the
   way the slide under it does. The transition is put back so the closing FLIP
   still animates. */
addEventListener('resize', () => {
  if (!src) return;
  const c = clone;
  c.style.transition = 'none';
  place(true);
  getComputedStyle(c).transform;
  c.style.transition = `transform ${MS}ms ${EASE}`;
});

/* deck.js drives every slide to its last step on beforeprint; an overlay left
   standing would be one more thing in that snapshot. It is display:none in
   print anyway — this just makes sure it is gone. */
addEventListener('beforeprint', () => close(true));

/* The affordance. Resolved on hover rather than up front because a slide that
   is not showing is display:none, and an image inside it has no measurable
   size to test the floor against. */
addEventListener('pointerover', e => {
  const el = e.target;
  if (!el || (el.tagName !== 'IMG' && el.tagName !== 'VIDEO')) return;
  el.classList.toggle('lb-zoomable', eligible(el));
}, true);

})();
